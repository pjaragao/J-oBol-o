'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EditTeamModal } from './EditTeamModal'

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
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Gerenciar Times</h2>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar time..."
                        className="border border-gray-300 rounded-md p-2 w-64 focus:ring-indigo-500 focus:border-indigo-500"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10">Carregando...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Logo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abreviação</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {teams.map((team) => (
                                <tr key={team.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {team.logo_url && (
                                            <img src={team.logo_url} alt="" className="h-8 w-8 object-contain" onError={(e) => (e.currentTarget.src = 'https://placehold.co/32x32?text=?')} />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{team.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{team.short_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{team.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => setEditingTeam(team)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {teams.length === 0 && (
                        <p className="text-center text-gray-500 py-8">Nenhum time encontrado.</p>
                    )}
                </div>
            )}

            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">
                    Página {page} de {totalPages || 1}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        Próxima
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
