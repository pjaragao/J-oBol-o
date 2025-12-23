// Edge Function: Stripe Webhook Handler
// Processes Stripe subscription events and updates user profiles

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Map Stripe price IDs to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
    // Replace with your actual Stripe price IDs
    'price_premium_monthly': 'premium',
    'price_premium_yearly': 'premium',
    'price_pro_monthly': 'pro',
    'price_pro_yearly': 'pro',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const signature = req.headers.get('stripe-signature');
        const body = await req.text();
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

        let event: Stripe.Event;

        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature!,
                webhookSecret,
                undefined,
                cryptoProvider
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return new Response(
                JSON.stringify({ error: 'Invalid signature' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        console.log(`Processing event: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;
                const userId = session.client_reference_id; // Set when creating checkout session

                if (!userId) {
                    console.error('No user ID in checkout session');
                    break;
                }

                // Get subscription details
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const priceId = subscription.items.data[0]?.price.id;
                const tier = PRICE_TO_TIER[priceId] || 'premium';

                // Create subscription record
                await supabase.from('subscriptions').upsert({
                    user_id: userId,
                    provider: 'stripe',
                    provider_subscription_id: subscriptionId,
                    tier: tier,
                    status: subscription.status === 'active' ? 'active' : 'trialing',
                    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                    cancel_at_period_end: subscription.cancel_at_period_end,
                }, {
                    onConflict: 'provider,provider_subscription_id',
                });

                // Update user profile
                await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: tier,
                        subscription_status: 'active',
                    })
                    .eq('id', userId);

                console.log(`Subscription created for user ${userId}: ${tier}`);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const priceId = subscription.items.data[0]?.price.id;
                const tier = PRICE_TO_TIER[priceId] || 'premium';

                // Find user by subscription ID
                const { data: subRecord } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider_subscription_id', subscription.id)
                    .single();

                if (!subRecord) {
                    console.error('Subscription record not found:', subscription.id);
                    break;
                }

                // Update subscription record
                await supabase
                    .from('subscriptions')
                    .update({
                        tier: tier,
                        status: subscription.status as string,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                    })
                    .eq('provider_subscription_id', subscription.id);

                // Update user profile
                const profileStatus = subscription.status === 'active' ? 'active' :
                    subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'canceled' ? 'canceled' : 'inactive';

                await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: subscription.status === 'active' ? tier : 'free',
                        subscription_status: profileStatus,
                    })
                    .eq('id', subRecord.user_id);

                console.log(`Subscription updated for user ${subRecord.user_id}: ${subscription.status}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;

                // Find user by subscription ID
                const { data: subRecord } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider_subscription_id', subscription.id)
                    .single();

                if (!subRecord) {
                    console.error('Subscription record not found:', subscription.id);
                    break;
                }

                // Update subscription record
                await supabase
                    .from('subscriptions')
                    .update({ status: 'canceled' })
                    .eq('provider_subscription_id', subscription.id);

                // Downgrade user to free
                await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'free',
                        subscription_status: 'canceled',
                    })
                    .eq('id', subRecord.user_id);

                console.log(`Subscription canceled for user ${subRecord.user_id}`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = invoice.subscription as string;

                if (!subscriptionId) break;

                // Find user by subscription ID
                const { data: subRecord } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('provider_subscription_id', subscriptionId)
                    .single();

                if (!subRecord) break;

                // Update status to past_due
                await supabase
                    .from('subscriptions')
                    .update({ status: 'past_due' })
                    .eq('provider_subscription_id', subscriptionId);

                await supabase
                    .from('profiles')
                    .update({ subscription_status: 'past_due' })
                    .eq('id', subRecord.user_id);

                console.log(`Payment failed for user ${subRecord.user_id}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(
            JSON.stringify({ error: 'Webhook handler failed', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
