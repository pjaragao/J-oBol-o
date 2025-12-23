'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MatchList } from '@/components/groups/MatchList'
import { Trophy, Layers, Filter } from 'lucide-react'

interface Group {
    id: string
    name: string
    event_id: string
    event: {
        id: string
        name: string
        logo_url: string
    }
}

interface BetsClientProps {
    initialGroups: Group[]
    userId: string
}

export default function BetsClient({ initialGroups, userId }: BetsClientProps) {
    const [selectedEventId, setSelectedEventId] = useState<string>('')
    const [selectedGroupId, setSelectedGroupId] = useState<string>('')
    const [matches, setMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Extract unique events
    const events = useMemo(() => {
        const uniqueEvents = new Map()
        initialGroups.forEach(g => {
            if (!uniqueEvents.has(g.event_id)) {
                uniqueEvents.set(g.event_id, g.event)
            }
        })
        return Array.from(uniqueEvents.values())
    }, [initialGroups])

    // Set initial event if not set
    useEffect(() => {
        if (events.length > 0 && !selectedEventId) {
            setSelectedEventId(events[0].id)
        }
    }, [events, selectedEventId])

    // Filter groups based on selected event
    const filteredGroups = useMemo(() => {
        const filtered = initialGroups.filter(g => g.event_id === selectedEventId)
        return filtered
    }, [initialGroups, selectedEventId])

    // Update selected group when event changes
    useEffect(() => {
        if (filteredGroups.length > 0) {
            // Prefer the current group if it belongs to the new event, else pick first
            const exists = filteredGroups.find(g => g.id === selectedGroupId)
            if (!exists) {
                setSelectedGroupId(filteredGroups[0].id)
            }
        } else {
            setSelectedGroupId('')
        }
    }, [filteredGroups, selectedGroupId])

    // Fetch matches for the selected event
    useEffect(() => {
        const fetchMatches = async () => {
            if (!selectedEventId) return

            setLoading(true)
            const { data } = await supabase
                .from('matches')
                .select(`
                    *,
                    home_team:teams!home_team_id(*),
                    away_team:teams!away_team_id(*)
                `)
                .eq('event_id', selectedEventId)
                .order('match_date', { ascending: true })

            setMatches(data || [])
            setLoading(false)
        }

        fetchMatches()
    }, [selectedEventId, supabase])

    if (initialGroups.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <h2 className="text-xl font-bold dark:text-white">Você ainda não participa de nenhum grupo</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Participe de um bolão para começar a apostar.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Context Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Event Selector */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        <Layers className="h-3 w-3" />
                        Campeonato / Liga
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white appearance-none"
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                        >
                            {events.map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Filter className="h-4 w-4" />
                        </div>
                    </div>
                </div>

                {/* Group Selector */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        <Trophy className="h-3 w-3" />
                        Grupo de Apostas
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white appearance-none"
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                        >
                            {filteredGroups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Filter className="h-4 w-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Matches List */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-1">
                {loading ? (
                    <div className="text-center py-20 text-slate-500 dark:text-slate-400 animate-pulse">
                        Sincronizando jogos...
                    </div>
                ) : (
                    <MatchList
                        matches={matches}
                        groupId={selectedGroupId}
                        userId={userId}
                    />
                )}
            </div>
        </div>
    )
}
