'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CampaignFilters {
    audience: 'all' | 'tier' | 'smart_group' | 'manual'
    tier?: 'free' | 'premium' | 'pro'
    daysNextMatches?: number
    daysInactive?: number
    selectedUserIds?: string[]
}

export interface CampaignData {
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'group_invite' | 'points'
    actionLinkType: 'fixed' | 'dynamic_group'
    fixedLink?: string
}

export async function getAudiencePreview(filters: CampaignFilters) {
    try {
        const supabase = await createClient()
        let count = 0

        if (filters.audience === 'all') {
            const { count: c, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
            if (error) throw error
            count = c || 0
        } else if (filters.audience === 'tier') {
            const { count: c, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('subscription_tier', filters.tier || 'free')
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
                    p_days_ahead: filters.daysNextMatches
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
            let query = supabase.from('profiles').select('id')
            if (filters.audience === 'tier') {
                query = query.eq('subscription_tier', filters.tier || 'free')
            }

            const { data: users, error } = await query
            if (error) throw error

            notificationsToInsert = users.map(u => ({
                user_id: u.id,
                title: data.title,
                message: data.message,
                type: data.type,
                is_read: false,
                data: data.actionLinkType === 'fixed' ? { link: data.fixedLink } : {}
            }))
        } else if (filters.audience === 'manual') {
            notificationsToInsert = (filters.selectedUserIds || []).map(userId => ({
                user_id: userId,
                title: data.title,
                message: data.message,
                type: data.type,
                is_read: false,
                data: data.actionLinkType === 'fixed' ? { link: data.fixedLink } : {}
            }))
        } else if (filters.audience === 'smart_group') {
            // Smart logic: Get specific group notifications
            const { data: targets, error } = await supabase.rpc('get_smart_campaign_targets', {
                p_days_ahead: filters.daysNextMatches || 3
            })
            if (error) throw error

            notificationsToInsert = (targets as any[]).map(t => ({
                user_id: t.user_id,
                title: data.title.replace('{group_name}', t.group_name),
                message: data.message.replace('{group_name}', t.group_name),
                type: data.type,
                is_read: false,
                data: {
                    group_id: t.group_id,
                    group_name: t.group_name,
                    link: `/groups/${t.group_id}`
                }
            }))
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
