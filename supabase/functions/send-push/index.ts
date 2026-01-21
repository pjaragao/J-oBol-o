// Edge Function: Send Push Notification
// Uses web-push to send notifications, bypasses RLS with service_role

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VAPID configuration
const VAPID_MAILTO = Deno.env.get('VAPID_MAILTO') || 'mailto:suporte@jaobolao.com.br'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')

// Web Push implementation for Deno
// Using raw crypto APIs since web-push npm package isn't Deno-compatible directly

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

// Base64 URL encoding helpers
function base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
    const padding = '='.repeat((4 - str.length % 4) % 4)
    const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

// Create JWT for VAPID authentication
async function createVapidJwt(audience: string): Promise<string> {
    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
        throw new Error('VAPID keys not configured')
    }

    const header = { typ: 'JWT', alg: 'ES256' }
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        aud: audience,
        exp: now + 86400, // 24 hours
        sub: VAPID_MAILTO
    }

    const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
    const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
    const unsignedToken = `${encodedHeader}.${encodedPayload}`

    // Import private key
    const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY)
    const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    )

    // Sign the token
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        new TextEncoder().encode(unsignedToken)
    )

    const encodedSignature = base64UrlEncode(signature)
    return `${unsignedToken}.${encodedSignature}`
}

// Send a single push notification
async function sendPush(token: PushToken, payload: string): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    try {
        const endpoint = new URL(token.endpoint)
        const audience = `${endpoint.protocol}//${endpoint.host}`

        // Create VAPID JWT
        const jwt = await createVapidJwt(audience)

        // Prepare headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
            'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        }

        // For now, send unencrypted payload (basic implementation)
        // Full implementation would use ECDH + AES-GCM encryption
        const response = await fetch(token.endpoint, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: payload,
        })

        if (response.ok || response.status === 201) {
            return { success: true }
        }

        const errorBody = await response.text()
        return {
            success: false,
            error: errorBody,
            statusCode: response.status
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

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
            const result = await sendPush(token, payload)

            results.push({
                endpoint: token.endpoint.substring(0, 50) + '...',
                success: result.success,
                error: result.error
            })

            // Mark expired tokens for deletion
            if (result.statusCode === 410 || result.statusCode === 404) {
                expiredTokenIds.push(token.id)
                console.log(`[send-push] Token expired: ${token.endpoint.substring(0, 50)}...`)
            }

            // Update last_used_at on success
            if (result.success) {
                await supabase.rpc('touch_push_token', { p_endpoint: token.endpoint })
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

    } catch (error) {
        console.error('[send-push] Error:', error)
        return new Response(
            JSON.stringify({ error: 'Send failed', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
