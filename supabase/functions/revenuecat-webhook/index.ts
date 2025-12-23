// Edge Function: RevenueCat Webhook Handler
// Processes RevenueCat subscription events for iOS/Android IAP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-revenuecat-signature',
}

// Map RevenueCat product IDs to subscription tiers
const PRODUCT_TO_TIER: Record<string, string> = {
    // Replace with your actual RevenueCat product IDs
    'jaobolao_premium_monthly': 'premium',
    'jaobolao_premium_yearly': 'premium',
    'jaobolao_pro_monthly': 'pro',
    'jaobolao_pro_yearly': 'pro',
};

interface RevenueCatEvent {
    type: string;
    app_user_id: string;
    product_id: string;
    entitlement_id?: string;
    original_transaction_id: string;
    environment: string;
    event_timestamp_ms: number;
    expiration_at_ms?: number;
    is_trial_conversion?: boolean;
}

interface RevenueCatWebhook {
    api_version: string;
    event: RevenueCatEvent;
}

async function verifySignature(body: string, signature: string | null): Promise<boolean> {
    if (!signature) return false;

    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!webhookSecret) {
        console.warn('REVENUECAT_WEBHOOK_SECRET not set, skipping verification');
        return true; // Skip verification if secret not configured
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );

    const signatureBytes = new Uint8Array(
        signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    return await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        encoder.encode(body)
    );
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.text();
        const signature = req.headers.get('x-revenuecat-signature');

        // Verify webhook signature
        const isValid = await verifySignature(body, signature);
        if (!isValid) {
            console.error('Invalid RevenueCat webhook signature');
            return new Response(
                JSON.stringify({ error: 'Invalid signature' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const webhook: RevenueCatWebhook = JSON.parse(body);
        const event = webhook.event;

        // Skip sandbox events in production
        if (Deno.env.get('ENVIRONMENT') === 'production' && event.environment === 'SANDBOX') {
            console.log('Skipping sandbox event in production');
            return new Response(
                JSON.stringify({ received: true, skipped: true }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // app_user_id should be set to Supabase user ID when configuring RevenueCat
        const userId = event.app_user_id;
        const tier = PRODUCT_TO_TIER[event.product_id] || 'premium';

        console.log(`Processing RevenueCat event: ${event.type} for user ${userId}`);

        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'PRODUCT_CHANGE': {
                // Create or update subscription record
                await supabase.from('subscriptions').upsert({
                    user_id: userId,
                    provider: 'revenuecat',
                    provider_subscription_id: event.original_transaction_id,
                    tier: tier,
                    status: 'active',
                    current_period_start: new Date(event.event_timestamp_ms).toISOString(),
                    current_period_end: event.expiration_at_ms
                        ? new Date(event.expiration_at_ms).toISOString()
                        : null,
                    cancel_at_period_end: false,
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

                console.log(`Subscription activated for user ${userId}: ${tier}`);
                break;
            }

            case 'CANCELLATION': {
                // User canceled but might still have access until period ends
                await supabase
                    .from('subscriptions')
                    .update({
                        cancel_at_period_end: true,
                    })
                    .eq('user_id', userId)
                    .eq('provider', 'revenuecat');

                console.log(`Subscription will be canceled for user ${userId}`);
                break;
            }

            case 'EXPIRATION': {
                // Subscription has fully expired
                await supabase
                    .from('subscriptions')
                    .update({ status: 'canceled' })
                    .eq('user_id', userId)
                    .eq('provider', 'revenuecat');

                await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'free',
                        subscription_status: 'inactive',
                    })
                    .eq('id', userId);

                console.log(`Subscription expired for user ${userId}`);
                break;
            }

            case 'BILLING_ISSUE': {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'past_due' })
                    .eq('user_id', userId)
                    .eq('provider', 'revenuecat');

                await supabase
                    .from('profiles')
                    .update({ subscription_status: 'past_due' })
                    .eq('id', userId);

                console.log(`Billing issue for user ${userId}`);
                break;
            }

            case 'SUBSCRIBER_ALIAS': {
                // User ID mapping, usually when anonymous user logs in
                console.log(`Alias event for user ${userId}`);
                break;
            }

            default:
                console.log(`Unhandled RevenueCat event type: ${event.type}`);
        }

        return new Response(
            JSON.stringify({ received: true, event_type: event.type }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('RevenueCat webhook error:', error);
        return new Response(
            JSON.stringify({ error: 'Webhook handler failed', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
