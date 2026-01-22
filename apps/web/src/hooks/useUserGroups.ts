'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserGroup {
    id: string
    name: string
    events?: {
        logo_url?: string | null
        name?: string
    } | null
}

export function useUserGroups(userId?: string) {
    const [groups, setGroups] = useState<UserGroup[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        const fetchGroups = async () => {
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('group_members')
                    .select(`
                        group_id,
                        groups (
                            id,
                            name,
                            events (
                                logo_url,
                                name
                            )
                        )
                    `)
                    .eq('user_id', userId)

                if (error) {
                    console.error('[useUserGroups] Error:', error)
                    setLoading(false)
                    return
                }

                if (data) {
                    const groupsList = data
                        .map((item: any) => item.groups)
                        .filter(Boolean) as UserGroup[]
                    setGroups(groupsList)
                }
            } catch (err) {
                console.error('[useUserGroups] Unexpected error:', err)
            }
            setLoading(false)
        }

        fetchGroups()
    }, [userId])

    return { groups, loading }
}
