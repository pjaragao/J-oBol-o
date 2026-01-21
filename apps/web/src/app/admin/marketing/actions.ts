'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CampaignFilters {
    audience: 'all' | 'tier' | 'smart_group' | 'manual' | 'groups' | 'admin_groups'
    tier?: 'free' | 'premium' | 'pro'
    daysNextMatches?: number
    daysInactive?: number
    targetGroupAdmins?: boolean
    isSystemAdmin?: boolean
    eventId?: string
    selectedUserIds?: string[]
    groupIds?: string[]
    adminUserId?: string
}

export interface CampaignData {
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'group_invite' | 'points'
    actionLinkType: 'fixed' | 'dynamic' | 'none'
    fixedLink?: string
    targetTab?: 'dashboard' | 'bets' | 'ranking' | 'members' | 'settings'
    matchFilter?: 'all' | 'pending' | 'completed' | 'missed'
    translations?: Record<string, { title: string, message: string }>
}

export async function translateCampaign(title: string, message: string, targetLocales: string[]) {
    // This is a mock AI translation service. 
    // In a real app, you would call OpenAI, Anthropic, or a translation API here.
    try {
        const results: Record<string, { title: string, message: string }> = {};

        for (const locale of targetLocales) {
            // Simulated AI translations
            if (locale === 'en') {
                results.en = {
                    title: `[AI EN] ${title}`,
                    message: `[AI EN] ${message}`
                };
            } else if (locale === 'es') {
                results.es = {
                    title: `[AI ES] ${title}`,
                    message: `[AI ES] ${message}`
                };
            }
        }

        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        return { success: true, translations: results };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getAdminGroups(userId: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('group_members')
            .select('group_id, groups(id, name, event_id, events(name))')
            .eq('user_id', userId)
            .eq('role', 'admin')

        if (error) throw error
        return {
            success: true, data: (data || []).map((m: any) => ({
                id: m.groups.id,
                name: m.groups.name,
                eventId: m.groups.event_id,
                eventName: m.groups.events?.name
            }))
        }
    } catch (error: any) {
        return { success: false, message: error.message, data: [] }
    }
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

export async function searchUsers(query: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(10)
        if (error) throw error
        return { success: true, data }
    } catch (error: any) {
        return { success: false, message: error.message, data: [] }
    }
}

export async function searchGroups(query: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('groups')
            .select('id, name')
            .ilike('name', `%${query}%`)
            .limit(10)
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

                const ids = Array.from(new Set((userIdsInEvent || []).map(m => m.user_id)))
                query = query.in('id', ids)
            }

            const { count: c, error } = await query
            if (error) throw error
            count = c || 0
        } else if (filters.audience === 'manual') {
            count = filters.selectedUserIds?.length || 0
        } else if (filters.audience === 'groups') {
            const { count: c, error } = await supabase
                .from('group_members')
                .select('user_id', { count: 'exact', head: true })
                .in('group_id', filters.groupIds || [])

            if (error) throw error
            count = c || 0
        } else if (filters.audience === 'admin_groups') {
            if (filters.adminUserId) {
                // Find all groups where this user is admin
                const { data: adminGroups } = await supabase
                    .from('group_members')
                    .select('group_id')
                    .eq('user_id', filters.adminUserId)
                    .eq('role', 'admin')

                const groupIds = (adminGroups || []).map(g => g.group_id)

                if (groupIds.length > 0) {
                    const { count: c, error } = await supabase
                        .from('group_members')
                        .select('user_id', { count: 'exact', head: true })
                        .in('group_id', groupIds)

                    if (error) throw error
                    count = c || 0
                }
            }
        } else if (filters.audience === 'smart_group') {
            const { data, error } = await supabase.rpc('get_smart_campaign_preview', {
                p_days_ahead: filters.daysNextMatches || null,
                p_only_admins: filters.targetGroupAdmins || false,
                p_event_id: filters.eventId || null
            })
            if (error) throw error
            count = data || 0
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

                const ids = Array.from(new Set((userIdsInEvent || []).map(m => m.user_id)))
                query = query.in('id', ids)
            }

            const { data: users, error } = await query
            if (error) throw error

            const { data: userLocales } = await supabase.from('profiles').select('id, locale').in('id', users.map(u => u.id))
            const localeMap = Object.fromEntries((userLocales || []).map(u => [u.id, u.locale || 'pt']))

            notificationsToInsert = users.map(u => {
                const userName = u.display_name || 'Usuário'
                const userLocale = localeMap[u.id] || 'pt'

                const campaignTitle = (userLocale !== 'pt' && data.translations?.[userLocale])
                    ? data.translations[userLocale].title
                    : data.title
                const campaignMsg = (userLocale !== 'pt' && data.translations?.[userLocale])
                    ? data.translations[userLocale].message
                    : data.message

                return {
                    user_id: u.id,
                    title: campaignTitle.replace(/{user_name}/g, userName),
                    message: campaignMsg.replace(/{user_name}/g, userName),
                    type: data.type,
                    is_read: false,
                    data: {
                        link: data.actionLinkType === 'fixed' ? data.fixedLink : undefined
                    }
                }
            })
        } else if (filters.audience === 'manual') {
            const { data: users, error } = await supabase
                .from('profiles')
                .select('id, display_name, locale')
                .in('id', filters.selectedUserIds || [])

            if (error) throw error

            notificationsToInsert = users.map(u => {
                const userName = u.display_name || 'Usuário'
                const userLocale = u.locale || 'pt'

                const campaignTitle = (userLocale !== 'pt' && data.translations?.[userLocale])
                    ? data.translations[userLocale].title
                    : data.title
                const campaignMsg = (userLocale !== 'pt' && data.translations?.[userLocale])
                    ? data.translations[userLocale].message
                    : data.message

                return {
                    user_id: u.id,
                    title: campaignTitle.replace(/{user_name}/g, userName),
                    message: campaignMsg.replace(/{user_name}/g, userName),
                    type: data.type,
                    is_read: false,
                    data: {
                        link: data.actionLinkType === 'fixed' ? data.fixedLink : undefined
                    }
                }
            })
        } else if (filters.audience === 'groups' || filters.audience === 'admin_groups') {
            let targetGroupIds: string[] = []

            if (filters.audience === 'groups') {
                targetGroupIds = filters.groupIds || []
            } else {
                // admin_groups
                // If filters.groupIds is provided, use it (it means user selected specific groups from admin)
                // If not, fetch all groups from this admin
                if (filters.groupIds && filters.groupIds.length > 0) {
                    targetGroupIds = filters.groupIds
                } else {
                    const { data: adminGroups } = await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('user_id', filters.adminUserId || '')
                        .eq('role', 'admin')
                    targetGroupIds = (adminGroups || []).map(g => g.group_id)
                }
            }

            if (targetGroupIds.length > 0) {
                // To support {group_name} and dynamic links per group, we should send one per group-user pair
                const { data: members, error } = await supabase
                    .from('group_members')
                    .select('user_id, group_id, groups(name), profiles(id, display_name, locale)')
                    .in('group_id', targetGroupIds)

                if (error) throw error

                notificationsToInsert = (members as any[]).map(m => {
                    const userName = m.profiles.display_name || 'Usuário'
                    const groupName = m.groups.name
                    const groupId = m.group_id
                    const userLocale = m.profiles.locale || 'pt'

                    const campaignTitle = (userLocale !== 'pt' && data.translations?.[userLocale])
                        ? data.translations[userLocale].title
                        : data.title
                    const campaignMsg = (userLocale !== 'pt' && data.translations?.[userLocale])
                        ? data.translations[userLocale].message
                        : data.message

                    let link = data.actionLinkType === 'fixed' ? data.fixedLink : undefined
                    if (data.actionLinkType === 'dynamic') {
                        link = `/groups/${groupId}?tab=${data.targetTab || 'dashboard'}${data.targetTab === 'bets' ? `&filter=${data.matchFilter || 'all'}` : ''}`
                    }

                    return {
                        user_id: m.user_id,
                        title: campaignTitle.replace(/{user_name}/g, userName).replace(/{group_name}/g, groupName),
                        message: campaignMsg.replace(/{user_name}/g, userName).replace(/{group_name}/g, groupName),
                        type: data.type,
                        is_read: false,
                        data: {
                            group_id: groupId,
                            group_name: groupName,
                            link
                        }
                    }
                })
            }
        } else if (filters.audience === 'smart_group') {
            const { data: targets, error } = await supabase.rpc('get_smart_campaign_targets', {
                p_days_ahead: filters.daysNextMatches || null,
                p_only_admins: filters.targetGroupAdmins || false,
                p_event_id: filters.eventId || null
            })
            if (error) throw error

            const userIds = Array.from(new Set((targets as any[]).map(t => t.user_id)))
            const { data: users } = await supabase.from('profiles').select('id, display_name, locale').in('id', userIds)
            const userMap = Object.fromEntries((users || []).map(u => [u.id, { name: u.display_name, locale: u.locale || 'pt' }]))

            notificationsToInsert = (targets as any[]).map(t => {
                const userData = userMap[t.user_id] || { name: 'Usuário', locale: 'pt' }
                const userName = userData.name || 'Usuário'
                const userLocale = userData.locale || 'pt'

                const campaignTitle = (userLocale !== 'pt' && data.translations?.[userLocale])
                    ? data.translations[userLocale].title
                    : data.title
                const campaignMsg = (userLocale !== 'pt' && data.translations?.[userLocale])
                    ? data.translations[userLocale].message
                    : data.message

                let link = data.actionLinkType === 'fixed' ? data.fixedLink : undefined
                if (data.actionLinkType === 'dynamic') {
                    link = `/groups/${t.group_id}?tab=${data.targetTab || 'dashboard'}${data.targetTab === 'bets' ? `&filter=${data.matchFilter || 'all'}` : ''}`
                }

                return {
                    user_id: t.user_id,
                    title: campaignTitle.replace(/{user_name}/g, userName).replace(/{group_name}/g, t.group_name),
                    message: campaignMsg.replace(/{user_name}/g, userName).replace(/{group_name}/g, t.group_name),
                    type: data.type,
                    is_read: false,
                    data: {
                        group_id: t.group_id,
                        group_name: t.group_name,
                        link
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

        // Trigger actual push notification delivery via Edge Function
        const uniqueUserIds = Array.from(new Set(notificationsToInsert.map(n => n.user_id)))
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            // Determine push message content
            const pushTitle = data.title
            const pushBody = data.message
            const pushUrl = data.actionLinkType === 'fixed' ? data.fixedLink : '/notifications'

            // Send push in batches of 50 users
            const pushBatchSize = 50
            let pushSuccessCount = 0
            let pushFailCount = 0

            for (let i = 0; i < uniqueUserIds.length; i += pushBatchSize) {
                const batch = uniqueUserIds.slice(i, i + pushBatchSize)
                try {
                    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                        },
                        body: JSON.stringify({
                            user_ids: batch,
                            title: pushTitle,
                            body: pushBody,
                            url: pushUrl
                        })
                    })
                    const result = await response.json()
                    pushSuccessCount += result.sent_count || 0
                    pushFailCount += result.failed_count || 0
                    console.log(`[Campaign Push] Batch ${i / pushBatchSize + 1}: ${result.sent_count || 0} sent, ${result.failed_count || 0} failed`)
                } catch (err: any) {
                    console.error('[Campaign Push] Batch failed:', err.message)
                    // Continue with next batch, don't fail the campaign
                }
            }
            console.log(`[Campaign Push] Total: ${pushSuccessCount} sent, ${pushFailCount} failed`)
        } else {
            console.warn('[Campaign Push] Missing Supabase config, skipping push delivery')
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
