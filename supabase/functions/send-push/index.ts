// Edge Function: Send Push Notification
// Simplified version using web-push npm package via Deno

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VAPID configuration
const VAPID_MAILTO = Deno.env.get('VAPID_MAILTO') || 'mailto:suporte@jaobolao.com.br'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')

interface PushToken {
    id: string
    user_id: string
    endpoint: string
    p256dh: string
    auth: string
}

interface PushPayload {
    user_id?: string
    user_ids?: string[]
    title: string
    body: string
    url?: string
    data?: Record<string, any>
}

// Import web-push from npm via esm.sh (Deno-compatible)
// @ts-ignore
import webPush from 'https://esm.sh/web-push@3.6.7'

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Validate VAPID configuration
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            console.error('[send-push] VAPID keys not configured!')
            return new Response(
                JSON.stringify({ error: 'VAPID keys not configured on server' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Set VAPID details
        webPush.setVapidDetails(
            VAPID_MAILTO,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        )

        const body: PushPayload = await req.json()
        const { user_id, user_ids, title, body: messageBody, url = '/', data } = body

        // Validate input
        const targetUserIds = user_ids || (user_id ? [user_id] : [])
        if (targetUserIds.length === 0) {
            return new Response(
                JSON.stringify({ error: 'user_id or user_ids is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!title || !messageBody) {
            return new Response(
                JSON.stringify({ error: 'title and body are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase client with service role (bypasses RLS)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Fetch all tokens for target users
        const { data: tokens, error: fetchError } = await supabase
            .from('push_tokens')
            .select('*')
            .in('user_id', targetUserIds)

        if (fetchError) {
            console.error('[send-push] Error fetching tokens:', fetchError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch push tokens', details: fetchError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!tokens || tokens.length === 0) {
            console.log('[send-push] No tokens found for users:', targetUserIds)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No push tokens found for specified users',
                    users_count: targetUserIds.length,
                    tokens_count: 0
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[send-push] Found ${tokens.length} tokens for ${targetUserIds.length} users`)

        // Prepare payload
        const payload = JSON.stringify({
            title,
            body: messageBody,
            url,
            ...data
        })

        // Send to all tokens
        const results: Array<{ endpoint: string; success: boolean; error?: string }> = []
        const expiredTokenIds: string[] = []

        for (const token of tokens) {
            try {
                // Create push subscription object
                const pushSubscription = {
                    endpoint: token.endpoint,
                    keys: {
                        p256dh: token.p256dh,
                        auth: token.auth
                    }
                }

                // Send notification using web-push
                await webPush.sendNotification(pushSubscription, payload)

                console.log(`[send-push] ✅ Sent to ${token.endpoint.substring(0, 50)}...`)
                results.push({
                    endpoint: token.endpoint.substring(0, 50) + '...',
                    success: true
                })

                // Update last_used_at
                await supabase.rpc('touch_push_token', { p_endpoint: token.endpoint })

            } catch (error: any) {
                console.error(`[send-push] ❌ Failed to send to ${token.endpoint.substring(0, 50)}...`, error.message)

                results.push({
                    endpoint: token.endpoint.substring(0, 50) + '...',
                    success: false,
                    error: error.message
                })

                // Mark expired tokens for deletion (410 = Gone, 404 = Not Found)
                if (error.statusCode === 410 || error.statusCode === 404) {
                    expiredTokenIds.push(token.id)
                    console.log(`[send-push] Token expired: ${token.id}`)
                }
            }
        }

        // Clean up expired tokens
        if (expiredTokenIds.length > 0) {
            await supabase
                .from('push_tokens')
                .delete()
                .in('id', expiredTokenIds)
            console.log(`[send-push] Cleaned up ${expiredTokenIds.length} expired tokens`)
        }

        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length

        console.log(`[send-push] Complete: ${successCount} sent, ${failCount} failed`)

        return new Response(
            JSON.stringify({
                success: successCount > 0,
                sent_count: successCount,
                failed_count: failCount,
                expired_cleaned: expiredTokenIds.length,
                results
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[send-push] Error:', error)
        return new Response(
            JSON.stringify({ error: 'Send failed', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
