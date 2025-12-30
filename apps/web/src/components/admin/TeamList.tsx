'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EditTeamModal } from './EditTeamModal'
import { Search, Edit, ChevronLeft, ChevronRight, Users, Hash, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Team {
    id: string
    name: string
    short_name: string
    code: string
    logo_url: string
    created_at: string
}

export function TeamList() {
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [editingTeam, setEditingTeam] = useState<Team | null>(null)

    const pageSize = 20
    const supabase = createClient()

    const fetchTeams = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('teams')
                .select('*', { count: 'exact' })
                .order('name', { ascending: true })
                .range((page - 1) * pageSize, page * pageSize - 1)

            if (search) {
                query = query.ilike('name', `%${search}%`)
            }

            const { data, count, error } = await query

            if (error) throw error

            setTeams(data || [])
            setTotalPages(Math.ceil((count || 0) / pageSize))
        } catch (error) {
            console.error('Error fetching teams:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timeout = setTimeout(fetchTeams, 300) // Debounce search
        return () => clearTimeout(timeout)
    }, [search, page])

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Times Cadastrados</h2>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-200"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-500 dark:text-slate-400 animate-pulse">Carregando times...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Logo</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nome</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Abreviação</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">API ID</th>
                                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {teams.map((team) => (
                                <tr key={team.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="h-10 w-10 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center">
                                            {team.logo_url ? (
                                                <img
                                                    src={team.logo_url}
                                                    alt={team.name}
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40?text=?')}
                                                />
                                            ) : (
                                                <Shield className="h-5 w-5 text-slate-300 dark:text-slate-700" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-200">{team.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-medium">{team.short_name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pt-6">
                                        <Hash className="h-3 w-3" />
                                        {team.code || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => setEditingTeam(team)}
                                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-flex"
                                            title="Editar Time"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {teams.length === 0 && (
                        <div className="p-12 text-center">
                            <Users className="h-12 w-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum time encontrado para sua busca.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center bg-slate-50/30 dark:bg-slate-900/20 gap-4">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Página {page} de {totalPages || 1}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 transition-all font-bold"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 transition-all font-bold"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {editingTeam && (
                <EditTeamModal
                    isOpen={!!editingTeam}
                    team={editingTeam}
                    onClose={() => setEditingTeam(null)}
                    onSave={fetchTeams}
                />
            )}
        </div>
    )
}
