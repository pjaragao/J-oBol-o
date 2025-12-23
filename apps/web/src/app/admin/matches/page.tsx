'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            'scheduled': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Agendado' },
            'live': { bg: 'bg-green-100', text: 'text-green-800', label: 'Ao Vivo' },
            'finished': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Encerrado' },
            'postponed': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Adiado' },
            'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
        }
        const badge = badges[status] || badges['scheduled']
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Jogos</h1>
                <div className="text-sm text-gray-500">
                    {matches.length} jogos
                </div>
            </div>

            {/* Event Filter */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Campeonato</label>
                <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="w-full max-w-md border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Selecione um campeonato</option>
                    {events.map(event => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                </select>
            </div>

            {loading && <div className="text-center py-8">Carregando...</div>}

            {!loading && !selectedEvent && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
                    Selecione um campeonato para ver os jogos
                </div>
            )}

            {!loading && selectedEvent && matches.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
                    Nenhum jogo encontrado. Clique em "Importar Jogos" na página de Campeonatos.
                </div>
            )}

            {/* Matches Table */}
            {!loading && matches.length > 0 && (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rodada</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mandante</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Placar</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Visitante</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Local</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {matches.map((match) => (
                                <tr key={match.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {new Date(match.match_date).toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {match.round || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="font-medium text-sm">{match.home_team?.short_name}</span>
                                            {match.home_team?.logo_url && (
                                                <img src={match.home_team.logo_url} alt="" className="w-6 h-6" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <span className="font-bold text-lg">
                                            {match.status === 'finished' || match.status === 'live'
                                                ? `${match.home_score ?? '-'} x ${match.away_score ?? '-'}`
                                                : 'x'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-left">
                                        <div className="flex items-center gap-2">
                                            {match.away_team?.logo_url && (
                                                <img src={match.away_team.logo_url} alt="" className="w-6 h-6" />
                                            )}
                                            <span className="font-medium text-sm">{match.away_team?.short_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 max-w-[150px] truncate" title={match.venue || ''}>
                                        {match.venue || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {getStatusBadge(match.status)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
