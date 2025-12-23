'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { EditEventModal } from '@/components/admin/EditEventModal'

interface Event {
    id: string
    name: string
    display_name: string | null
    description: string
    api_id: number | null
    is_active: boolean
    start_date: string
    end_date: string
    matches: { count: number }[]
}

// Free tier available competitions
const COMPETITIONS = [
    { code: 'PL', name: 'Premier League (Inglaterra)' },
    { code: 'BL1', name: 'Bundesliga (Alemanha)' },
    { code: 'SA', name: 'Serie A (Itália)' },
    { code: 'PD', name: 'La Liga (Espanha)' },
    { code: 'FL1', name: 'Ligue 1 (França)' },
    { code: 'BSA', name: 'Brasileirão Série A (Brasil)' },
    { code: 'PPL', name: 'Primeira Liga (Portugal)' },
    { code: 'DED', name: 'Eredivisie (Holanda)' },
    { code: 'ELC', name: 'Championship (Inglaterra)' },
    { code: 'CL', name: 'UEFA Champions League' },
    { code: 'WC', name: 'Copa do Mundo FIFA' },
]

export default function AdminEventsPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [importingFixtures, setImportingFixtures] = useState<string | null>(null)
    const [editingEvent, setEditingEvent] = useState<Event | null>(null)
    const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Import form
    const [showImportModal, setShowImportModal] = useState(false)
    const [competitionCode, setCompetitionCode] = useState('PL')

    const supabase = createClient()

    useEffect(() => {
        fetchEvents()
    }, [])

    const fetchEvents = async () => {
        const { data } = await supabase
            .from('events')
            .select('*, matches(count)')
            .order('created_at', { ascending: false })

        setEvents(data || [])
        setLoading(false)
    }

    const handleImportLeague = async () => {
        if (!competitionCode) return

        setImporting(true)
        try {
            const response = await fetch('/api/admin/import-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ competitionCode })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error)
            }

            setShowImportModal(false)
            fetchEvents()
            alert(`${data.message}`)
        } catch (error: any) {
            alert('❌ Erro: ' + error.message)
        } finally {
            setImporting(false)
        }
    }

    const handleImportFixtures = async (event: Event) => {
        // Extract competition code from description (format: "TYPE - CODE")
        const codeMatch = event.description?.match(/- (\w+)$/)
        const code = codeMatch?.[1]

        if (!code) {
            alert('Este campeonato não tem código de competição. Reimporte-o usando o botão acima.')
            return
        }

        setImportingFixtures(event.id)
        try {
            const response = await fetch('/api/admin/import-fixtures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    competitionCode: code,
                    eventId: event.id
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error)
            }

            fetchEvents()
            alert(`${data.message}`)
        } catch (error: any) {
            alert('❌ Erro: ' + error.message)
        } finally {
            setImportingFixtures(null)
        }
    }

    const handleDeleteEvent = async () => {
        if (!deletingEvent) return
        setDeleting(true)

        try {
            // Delete in cascade order: bets -> group_members -> groups -> matches -> event
            // First get all groups for this event
            const { data: groups } = await supabase
                .from('groups')
                .select('id')
                .eq('event_id', deletingEvent.id)

            if (groups && groups.length > 0) {
                const groupIds = groups.map(g => g.id)

                // Delete bets for matches in this event
                const { data: matches } = await supabase
                    .from('matches')
                    .select('id')
                    .eq('event_id', deletingEvent.id)

                if (matches && matches.length > 0) {
                    await supabase
                        .from('bets')
                        .delete()
                        .in('match_id', matches.map(m => m.id))
                }

                // Delete group_members
                await supabase
                    .from('group_members')
                    .delete()
                    .in('group_id', groupIds)

                // Delete groups
                await supabase
                    .from('groups')
                    .delete()
                    .eq('event_id', deletingEvent.id)
            }

            // Delete matches
            await supabase
                .from('matches')
                .delete()
                .eq('event_id', deletingEvent.id)

            // Finally delete event
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', deletingEvent.id)

            if (error) throw error

            fetchEvents()
            setDeletingEvent(null)
            alert('Campeonato deletado com sucesso!')
        } catch (error: any) {
            alert('Erro ao deletar: ' + error.message)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Carregando...</div>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Campeonatos</h1>
                <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                    + Importar Campeonato
                </button>
            </div>

            {/* Events Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jogos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {events.map((event) => (
                            <tr key={event.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                        {event.display_name || event.name}
                                    </div>
                                    {event.display_name && (
                                        <div className="text-xs text-gray-400">{event.name}</div>
                                    )}
                                    <div className="text-sm text-gray-500">{event.description}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {event.description?.match(/- (\w+)$/)?.[1] || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <a href={`/admin/matches?event=${event.id}`} className="text-indigo-600 hover:text-indigo-900">
                                        {event.matches?.[0]?.count || 0} jogos
                                    </a>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${event.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {event.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                    <button
                                        onClick={() => handleImportFixtures(event)}
                                        disabled={importingFixtures === event.id}
                                        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                                    >
                                        {importingFixtures === event.id ? 'Importando...' : 'Jogos'}
                                    </button>
                                    <button
                                        onClick={() => setEditingEvent(event)}
                                        className="text-gray-600 hover:text-gray-900"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => setDeletingEvent(event)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Deletar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {events.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow mt-4">
                    Nenhum campeonato cadastrado. Clique em "Importar Campeonato" para começar.
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Importar Campeonato</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Usando football-data.org (temporada atual)
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Campeonato
                            </label>
                            <select
                                value={competitionCode}
                                onChange={(e) => setCompetitionCode(e.target.value)}
                                className="w-full border rounded-md px-3 py-2"
                            >
                                {COMPETITIONS.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-md mb-4">
                            <p className="text-xs text-blue-700">
                                💡 Ao importar, a liga e todos os times serão cadastrados automaticamente.
                                Depois clique em "Importar Jogos" para trazer as partidas.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportLeague}
                                disabled={importing}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {importing ? 'Importando...' : 'Importar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Event Modal */}
            {editingEvent && (
                <EditEventModal
                    isOpen={!!editingEvent}
                    event={editingEvent}
                    onClose={() => setEditingEvent(null)}
                    onSave={fetchEvents}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deletingEvent && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ Deletar Campeonato</h3>
                        <p className="text-gray-600 mb-4">
                            Você está prestes a deletar <strong>{deletingEvent.display_name || deletingEvent.name}</strong>.
                        </p>
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded mb-4">
                            Isso também deletará todos os grupos, jogos e apostas associados a este campeonato.
                            Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingEvent(null)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteEvent}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting ? 'Deletando...' : 'Sim, Deletar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
