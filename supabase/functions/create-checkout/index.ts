// Edge Function: Create Stripe Checkout Session
// Creates a checkout session for web subscription

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Price IDs from Stripe Dashboard
const PRICE_IDS: Record<string, Record<string, string>> = {
    premium: {
        monthly: Deno.env.get('STRIPE_PRICE_PREMIUM_MONTHLY') || 'price_premium_monthly',
        yearly: Deno.env.get('STRIPE_PRICE_PREMIUM_YEARLY') || 'price_premium_yearly',
    },
    pro: {
        monthly: Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') || 'price_pro_monthly',
        yearly: Deno.env.get('STRIPE_PRICE_PRO_YEARLY') || 'price_pro_yearly',
    },
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get user from auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Authorization header required' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            {
                global: { headers: { Authorization: authHeader } },
            }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'User not authenticated' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { tier, billing_period, success_url, cancel_url } = await req.json();

        if (!tier || !billing_period) {
            return new Response(
                JSON.stringify({ error: 'tier and billing_period are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const priceId = PRICE_IDS[tier]?.[billing_period];
        if (!priceId) {
            return new Response(
                JSON.stringify({ error: 'Invalid tier or billing period' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if user already has a Stripe customer ID
        const serviceSupabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single();

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: success_url || `${Deno.env.get('APP_URL')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url || `${Deno.env.get('APP_URL')}/subscription`,
            client_reference_id: user.id, // Important: used in webhook to identify user
            customer_email: profile?.email || user.email,
            subscription_data: {
                metadata: {
                    user_id: user.id,
                    tier: tier,
                },
            },
            allow_promotion_codes: true,
        });

        return new Response(
            JSON.stringify({
                session_id: session.id,
                url: session.url,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Create checkout error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to create checkout session', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
