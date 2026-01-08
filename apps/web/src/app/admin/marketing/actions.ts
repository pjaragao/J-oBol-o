'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CampaignFilters {
    audience: 'all' | 'tier' | 'smart_group' | 'manual'
    tier?: 'free' | 'premium' | 'pro'
    daysNextMatches?: number
    daysInactive?: number
    targetGroupAdmins?: boolean
    isSystemAdmin?: boolean
    eventId?: string
    smartTargetTab?: 'dashboard' | 'bets' | 'ranking' | 'members' | 'settings'
    smartMatchFilter?: 'all' | 'pending' | 'completed' | 'missed'
    selectedUserIds?: string[]
}

export interface CampaignData {
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'group_invite' | 'points'
    actionLinkType: 'fixed'
    fixedLink?: string
}

export async function getEvents() {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('events')
            .select('id, name')
            .eq('is_active', true)
            .order('name')
        if (error) throw error
        return { success: true, data }
    } catch (error: any) {
        return { success: false, message: error.message, data: [] }
    }
}

export async function getAudiencePreview(filters: CampaignFilters) {
    try {
        const supabase = await createClient()
        let count = 0

        if (filters.audience === 'all' || filters.audience === 'tier') {
            let query = supabase.from('profiles').select('*', { count: 'exact', head: true })

            if (filters.audience === 'tier') {
                query = query.eq('subscription_tier', filters.tier || 'free')
            }

            if (filters.isSystemAdmin) {
                query = query.eq('is_admin', true)
            }

            if (filters.eventId) {
                // To filter profiles by event, we need a join or subquery. 
                // Using nested select via supabase client:
                const { data: userIdsInEvent } = await supabase
                    .from('group_members')
                    .select('user_id, groups!inner(event_id)')
                    .eq('groups.event_id', filters.eventId)

                const ids = [...new Set((userIdsInEvent || []).map(m => m.user_id))]
                query = query.in('id', ids)
            }

            const { count: c, error } = await query
            if (error) throw error
            count = c || 0
        } else if (filters.audience === 'manual') {
            count = filters.selectedUserIds?.length || 0
        } else if (filters.audience === 'smart_group') {
            // Logic for smart group is more complex as it returns notifications count (potentially multiple per user)
            // For preview, we'll return number of *expected notifications*
            if (filters.daysNextMatches) {
                const now = new Date().toISOString()
                const future = new Date(Date.now() + (filters.daysNextMatches * 24 * 60 * 60 * 1000)).toISOString()

                // Complex query: Find (user, group) pairs where there are matches in next X days but no bet
                // This is hard to do in a single count. We'll do a simplified count of target user-group pairs.
                const { data, error } = await supabase.rpc('get_smart_campaign_preview', {
                    p_days_ahead: filters.daysNextMatches || null,
                    p_only_admins: filters.targetGroupAdmins || false,
                    p_event_id: filters.eventId || null
                })
                if (error) throw error
                count = data || 0
            }
        }

        return { success: true, count }
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 }
    }
}

export async function sendCampaign(filters: CampaignFilters, data: CampaignData) {
    try {
        const supabase = await createClient()
        let notificationsToInsert: any[] = []

        if (filters.audience === 'all' || filters.audience === 'tier') {
            let query = supabase.from('profiles').select('id, display_name')

            if (filters.audience === 'tier') {
                query = query.eq('subscription_tier', filters.tier || 'free')
            }

            if (filters.isSystemAdmin) {
                query = query.eq('is_admin', true)
            }

            if (filters.eventId) {
                const { data: userIdsInEvent } = await supabase
                    .from('group_members')
                    .select('user_id, groups!inner(event_id)')
                    .eq('groups.event_id', filters.eventId)

                const ids = [...new Set((userIdsInEvent || []).map(m => m.user_id))]
                query = query.in('id', ids)
            }

            const { data: users, error } = await query
            if (error) throw error

            notificationsToInsert = users.map(u => ({
                user_id: u.id,
                title: data.title.replace(/{user_name}/g, u.display_name || 'Usuário'),
                message: data.message.replace(/{user_name}/g, u.display_name || 'Usuário'),
                type: data.type,
                is_read: false,
                data: data.actionLinkType === 'fixed' ? { link: data.fixedLink } : {}
            }))
        } else if (filters.audience === 'manual') {
            // Fetch user names for manual selection too
            const { data: users, error } = await supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', filters.selectedUserIds || [])

            if (error) throw error

            notificationsToInsert = users.map(u => ({
                user_id: u.id,
                title: data.title.replace(/{user_name}/g, u.display_name || 'Usuário'),
                message: data.message.replace(/{user_name}/g, u.display_name || 'Usuário'),
                type: data.type,
                is_read: false,
                data: data.actionLinkType === 'fixed' ? { link: data.fixedLink } : {}
            }))
        } else if (filters.audience === 'smart_group') {
            // Smart logic: Get specific group notifications
            // Join with profiles to get user_name
            const { data: targets, error } = await supabase.rpc('get_smart_campaign_targets', {
                p_days_ahead: filters.daysNextMatches || null,
                p_only_admins: filters.targetGroupAdmins || false,
                p_event_id: filters.eventId || null
            })
            if (error) throw error

            // Fetch user names for these targets
            const userIds = [...new Set((targets as any[]).map(t => t.user_id))]
            const { data: users } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
            const userMap = Object.fromEntries((users || []).map(u => [u.id, u.display_name]))

            notificationsToInsert = (targets as any[]).map(t => {
                const userName = userMap[t.user_id] || 'Usuário'
                let finalTitle = data.title.replace(/{user_name}/g, userName).replace(/{group_name}/g, t.group_name)
                let finalMessage = data.message.replace(/{user_name}/g, userName).replace(/{group_name}/g, t.group_name)

                return {
                    user_id: t.user_id,
                    title: finalTitle,
                    message: finalMessage,
                    type: data.type,
                    is_read: false,
                    data: {
                        group_id: t.group_id,
                        group_name: t.group_name,
                        link: `/groups/${t.group_id}?tab=${filters.smartTargetTab || 'bets'}${filters.smartTargetTab === 'bets' ? `&filter=${filters.smartMatchFilter || 'pending'}` : ''}`
                    }
                }
            })
        }

        if (notificationsToInsert.length === 0) {
            return { success: false, message: 'Nenhum usuário encontrado para os filtros selecionados.' }
        }

        // Insert in batches of 100
        const batchSize = 100
        for (let i = 0; i < notificationsToInsert.length; i += batchSize) {
            const batch = notificationsToInsert.slice(i, i + batchSize)
            const { error: insertError } = await supabase
                .from('notifications')
                .insert(batch)
            if (insertError) throw insertError
        }

        revalidatePath('/')
        revalidatePath('/notifications')

        return {
            success: true,
            message: `${notificationsToInsert.length} notificações enviadas com sucesso!`
        }
    } catch (error: any) {
        console.error('Error sending campaign:', error)
        return { success: false, message: error.message }
    }
}
