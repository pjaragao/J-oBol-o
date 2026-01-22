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

export async function searchPublicGroups(query: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // Search public groups by name
    const { data: groups } = await supabase
        .from('groups')
        .select(`
            id,
            name,
            description,
            is_public,
            is_paid,
            entry_fee,
            payment_method,
            events ( 
                name,
                logo_url,
                online_fee_percent,
                offline_fee_per_slot,
                offline_base_fee
            )
        `)
        .eq('is_public', true)
        .ilike('name', `%${query}%`)
        .limit(20)

    if (!groups) return []

    // Get groups where user is already a member or has pending request
    const { data: userGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)

    const { data: pendingGroups } = await supabase
        .from('pending_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'pending')

    const userGroupIds = new Set([
        ...(userGroups?.map(g => g.group_id) || []),
        ...(pendingGroups?.map(g => g.group_id) || [])
    ])

    // Filter out groups user is already part of
    const availableGroups = groups.filter(g => !userGroupIds.has(g.id))

    // Fetch member counts
    const groupIds = availableGroups.map(g => g.id)
    if (groupIds.length === 0) return []

    const { data: memberCounts } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)

    const memberCountMap = new Map<string, number>()
    memberCounts?.forEach(mc => {
        memberCountMap.set(mc.group_id, (memberCountMap.get(mc.group_id) || 0) + 1)
    })

    // Fetch paid counts for paid groups
    const paidGroupIds = availableGroups.filter(g => g.is_paid).map(g => g.id)
    const paidCountMap = new Map<string, number>()

    if (paidGroupIds.length > 0) {
        const { data: paidMembers } = await supabase
            .from('group_members')
            .select('group_id')
            .in('group_id', paidGroupIds)
            .eq('payment_status', 'PAID')

        paidMembers?.forEach(pm => {
            paidCountMap.set(pm.group_id, (paidCountMap.get(pm.group_id) || 0) + 1)
        })
    }

    // Enrich groups with counts
    return availableGroups.map(group => {
        const event = Array.isArray(group.events) ? group.events[0] : group.events
        const memberCount = memberCountMap.get(group.id) || 0
        const paidCount = paidCountMap.get(group.id) || 0

        let prizePool = 0
        if (group.is_paid && paidCount > 0) {
            const grossPot = group.entry_fee * paidCount
            if (group.payment_method === 'ONLINE') {
                const feePercent = event?.online_fee_percent || 10
                prizePool = grossPot * (1 - feePercent / 100)
            } else {
                prizePool = grossPot
            }
        }

        return {
            ...group,
            event,
            memberCount,
            prizePool
        }
    })
}
