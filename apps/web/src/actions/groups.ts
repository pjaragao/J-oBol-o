'use server'

import { createClient } from '@/lib/supabase/server'

// Helper to send push via Edge Function
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function sendPushNotification(userId: string, title: string, body: string, url: string = '/') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[Push] Missing Supabase config')
        return { success: false }
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ user_id: userId, title, body, url })
        })
        return await response.json()
    } catch (error) {
        console.error('[Push] Error:', error)
        return { success: false }
    }
}

export async function notifyAdminsOfJoinRequest(groupId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // 1. Verify that the user has a pending request
    const { data: request } = await supabase
        .from('pending_members')
        .select('id, group:groups(name)')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single()

    if (!request) return { error: 'No pending request found' }

    // 2. Get Admins
    const { data: admins } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('role', 'admin')

    const requesterName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Usuário'
    // Safe cast for group name
    const groupName = (request.group as any)?.name || 'Grupo'

    // 3. Send Push
    if (admins) {
        for (const admin of admins) {
            await sendPushNotification(
                admin.user_id,
                'Solicitação de Entrada 👥',
                `${requesterName} quer entrar no grupo ${groupName}`,
                `/groups/${groupId}`
            )
        }
    }

    return { success: true }
}

export async function notifyUserOfInvite(invitedUserId: string, groupId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // 1. Verify invitation exists
    const { data: invitation } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('group_id', groupId)
        .eq('invited_user_id', invitedUserId)
        .eq('invited_by', user.id)
        .eq('status', 'pending')
        .maybeSingle()

    if (!invitation) return { error: 'Invitation not found' }

    // 2. Get Group Info and Sender Name
    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()
    const senderName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Alguém'

    // 3. Send Push
    await sendPushNotification(
        invitedUserId,
        'Você foi convidado! 📩',
        `${senderName} te convidou para o grupo ${group?.name || 'de bolão'}`,
        `/notifications?tab=invites`
    )

    return { success: true }
}
