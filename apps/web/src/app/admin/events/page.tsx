'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { EditEventModal } from '@/components/admin/EditEventModal'
import { Calendar, Edit, Trash2, Download, Plus, Info, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

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

    const handleImportChampionship = async () => {
        if (!competitionCode) return

        setImporting(true)
        try {
            const response = await fetch('/api/admin/import-championship', {
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

    const handleUpdateEvent = async (event: Event) => {
        setImportingFixtures(event.id)
        try {
            const response = await fetch('/api/admin/update-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: event.id })
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
            // Cascade delete via API or manual (Supabase usually handles cascades if set in DB)
            // But since the current code does manual delete, I'll keep it but optimize
            const { data: groups } = await supabase
                .from('groups')
                .select('id')
                .eq('event_id', deletingEvent.id)

            if (groups && groups.length > 0) {
                const groupIds = groups.map(g => g.id)
                const { data: matches } = await supabase.from('matches').select('id').eq('event_id', deletingEvent.id)
                if (matches && matches.length > 0) {
                    await supabase.from('bets').delete().in('match_id', matches.map(m => m.id))
                }
                await supabase.from('group_members').delete().in('group_id', groupIds)
                await supabase.from('groups').delete().eq('event_id', deletingEvent.id)
            }
            await supabase.from('matches').delete().eq('event_id', deletingEvent.id)
            const { error } = await supabase.from('events').delete().eq('id', deletingEvent.id)

            if (error) throw error
            fetchEvents()
            setDeletingEvent(null)
        } catch (error: any) {
            alert('Erro ao deletar: ' + error.message)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <div className="text-center py-20 animate-pulse text-slate-500">Carregando campeonatos...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campeonatos</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie as competições e importe dados do Football-Data.</p>
                </div>
                <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus className="h-4 w-4" />
                    Novo Campeonato
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Campeonato</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Código</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Partidas</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {events.map((event) => (
                                <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                                                {event.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                    {event.display_name || event.name}
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">{event.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-400">
                                        {event.description?.match(/- (\w+)$/)?.[1] || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <a
                                            href={`/admin/matches?event=${event.id}`}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                        >
                                            <Calendar className="h-3 w-3" />
                                            {event.matches?.[0]?.count || 0} jogos
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={cn(
                                            "px-2.5 py-1 inline-flex text-[10px] font-bold uppercase rounded-full tracking-wider",
                                            event.is_active
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        )}>
                                            {event.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => handleUpdateEvent(event)}
                                            disabled={importingFixtures === event.id}
                                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-flex"
                                            title="Atualizar Partidas"
                                        >
                                            {importingFixtures === event.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        </button>
                                        <button
                                            onClick={() => setEditingEvent(event)}
                                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex"
                                            title="Editar"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeletingEvent(event)}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors inline-flex"
                                            title="Deletar"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                                <Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Importar Campeonato</h3>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                Selecione a Competição
                            </label>
                            <select
                                value={competitionCode}
                                onChange={(e) => setCompetitionCode(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-200"
                            >
                                {COMPETITIONS.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl mb-8 flex gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed font-medium">
                                A importação unificada traz os detalhes da liga, todos os times participantes e o calendário completo de jogos em uma única etapa.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportChampionship}
                                disabled={importing}
                                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm shadow-lg shadow-indigo-200 dark:shadow-none inline-flex items-center justify-center gap-2"
                            >
                                {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                                {importing ? 'Importando...' : 'Confirmar'}
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
                <div className="fixed inset-0 bg-red-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200">
                        <div className="h-14 w-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <Trash2 className="h-7 w-7 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Excluir Campeonato?</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6 font-medium">
                            Você está prestes a excluir permanentemente <span className="font-bold text-slate-800 dark:text-slate-200">"{deletingEvent.display_name || deletingEvent.name}"</span>.
                        </p>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-8 flex gap-3 text-red-700 dark:text-red-300">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="text-xs font-bold leading-relaxed">
                                ATENÇÃO: Todos os grupos, jogos e milhares de apostas associadas serão apagados para sempre.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingEvent(null)}
                                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteEvent}
                                disabled={deleting}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-all text-sm shadow-lg shadow-red-200 dark:shadow-none"
                            >
                                {deleting ? 'Aguarde...' : 'Sim, Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function RefreshCw(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("lucide lucide-refresh-cw", props.className)}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
}

function AlertCircle(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("lucide lucide-alert-circle", props.className)}><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
}
