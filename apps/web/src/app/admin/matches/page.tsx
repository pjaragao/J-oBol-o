'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, MapPin, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Match {
    id: string
    match_date: string
    venue: string | null
    round: string | null
    status: string
    home_score: number | null
    away_score: number | null
    api_id: number | null
    home_team: { name: string; short_name: string; logo_url: string }
    away_team: { name: string; short_name: string; logo_url: string }
    events: { name: string }
}

interface Event {
    id: string
    name: string
}

export default function AdminMatchesPage() {
    const [matches, setMatches] = useState<Match[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState<string>('')

    const searchParams = useSearchParams()
    const supabase = createClient()

    useEffect(() => {
        fetchEvents()
    }, [])

    useEffect(() => {
        const eventParam = searchParams.get('event')
        if (eventParam) {
            setSelectedEvent(eventParam)
        }
    }, [searchParams])

    useEffect(() => {
        if (selectedEvent) {
            fetchMatches(selectedEvent)
        }
    }, [selectedEvent])

    const fetchEvents = async () => {
        const { data } = await supabase
            .from('events')
            .select('id, name')
            .order('name')

        setEvents(data || [])
        setLoading(false)
    }

    const fetchMatches = async (eventId: string) => {
        setLoading(true)
        const { data } = await supabase
            .from('matches')
            .select(`
                *,
                home_team:teams!home_team_id(name, short_name, logo_url),
                away_team:teams!away_team_id(name, short_name, logo_url),
                events(name)
            `)
            .eq('event_id', eventId)
            .order('match_date', { ascending: true })

        setMatches(data || [])
        setLoading(false)
    }

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { classes: string; label: string }> = {
            'scheduled': { classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', label: 'Agendado' },
            'live': { classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 animate-pulse', label: 'Ao Vivo' },
            'finished': { classes: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400', label: 'Encerrado' },
            'postponed': { classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', label: 'Adiado' },
            'cancelled': { classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', label: 'Cancelado' },
        }
        const badge = badges[status] || badges['scheduled']
        return (
            <span className={cn("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full", badge.classes)}>
                {badge.label}
            </span>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jogos</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie as partidas importadas</p>
                </div>
                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {matches.length} jogos
                </div>
            </div>

            {/* Event Filter */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Campeonato
                </label>
                <div className="relative">
                    <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full max-w-md appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all cursor-pointer"
                    >
                        <option value="">Selecione um campeonato</option>
                        {events.map(event => (
                            <option key={event.id} value={event.id}>{event.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="text-center py-12 animate-pulse text-slate-500 dark:text-slate-400">
                    Carregando...
                </div>
            )}

            {/* Empty States */}
            {!loading && !selectedEvent && (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <Calendar className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Selecione um campeonato para ver os jogos
                    </p>
                </div>
            )}

            {!loading && selectedEvent && matches.length === 0 && (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <Calendar className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Nenhum jogo encontrado para este campeonato.
                    </p>
                </div>
            )}

            {/* Matches Table */}
            {!loading && matches.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Data</th>
                                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Rodada</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Mandante</th>
                                    <th className="px-4 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Placar</th>
                                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Visitante</th>
                                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">Local</th>
                                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {matches.map((match) => (
                                    <tr key={match.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-medium">
                                            {new Date(match.match_date).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                                                {match.round || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                    {match.home_team?.short_name || match.home_team?.name}
                                                </span>
                                                {match.home_team?.logo_url && (
                                                    <img
                                                        src={match.home_team.logo_url}
                                                        alt=""
                                                        className="w-6 h-6 object-contain"
                                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <span className={cn(
                                                "font-bold text-lg",
                                                match.status === 'live'
                                                    ? "text-green-600 dark:text-green-400"
                                                    : "text-slate-900 dark:text-white"
                                            )}>
                                                {match.status === 'finished' || match.status === 'live'
                                                    ? `${match.home_score ?? '-'} × ${match.away_score ?? '-'}`
                                                    : '×'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-left">
                                            <div className="flex items-center gap-2">
                                                {match.away_team?.logo_url && (
                                                    <img
                                                        src={match.away_team.logo_url}
                                                        alt=""
                                                        className="w-6 h-6 object-contain"
                                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                    />
                                                )}
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                    {match.away_team?.short_name || match.away_team?.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-[180px]">
                                                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="truncate" title={match.venue || ''}>
                                                    {match.venue || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {getStatusBadge(match.status)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
