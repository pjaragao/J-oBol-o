'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

import { useRouter } from 'next/navigation'

interface GroupSettingsProps {
    group: {
        id: string
        name: string
        description: string | null
        scoring_rules: any
        is_public: boolean
        allow_member_invites?: boolean
    }
    matches: any[]
}

export function GroupSettings({ group, matches }: GroupSettingsProps) {
    const [name, setName] = useState(group.name)
    const [description, setDescription] = useState(group.description || '')
    const [isPublic, setIsPublic] = useState(group.is_public)
    const [allowMemberInvites, setAllowMemberInvites] = useState(group.allow_member_invites ?? false)

    // Default rules (matching SQL logic 10/7/5/2)
    const defaultRules = { exact: 10, winner_diff: 7, winner: 5, one_score: 2 }
    const [rules, setRules] = useState({ ...defaultRules, ...group.scoring_rules })

    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Check if championship has started (any match match_date < now)
    const hasStarted = matches?.some(m => new Date(m.match_date) < new Date())
    // Or strictly if there is a match with result/finished status?
    // User asked "após o inicio do campeonato". Time based is safer.


    const handleDelete = async () => {
        // Validation moved to modal confirm
        setLoading(true)
        try {
            // 1. Delete all bets first (to avoid RLS cascade issues)
            const { error: betsError } = await supabase
                .from('bets')
                .delete()
                .eq('group_id', group.id)

            if (betsError) throw new Error('Falha ao limpar apostas: ' + betsError.message)

            // 2. Delete all members
            const { error: membersError } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', group.id)

            if (membersError) throw new Error('Falha ao limpar membros: ' + membersError.message)

            // 3. Delete the group
            const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', group.id)

            if (error) throw error

            alert('Grupo deletado com sucesso.')
            router.push('/dashboard')
        } catch (error: any) {
            console.error('Delete error:', error)
            alert('Erro ao deletar grupo: ' + error.message)
            setLoading(false)
        } finally {
            setShowDeleteConfirm(false)
        }
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .from('groups')
                .update({
                    name,
                    description,
                    is_public: isPublic,
                    allow_member_invites: allowMemberInvites,
                    scoring_rules: rules
                })
                .eq('id', group.id)

            if (error) throw error

            alert('Configurações atualizadas com sucesso!')
        } catch (error: any) {
            alert('Erro ao atualizar: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900 px-4 py-5 shadow sm:rounded-lg sm:p-6 relative border border-gray-100 dark:border-slate-800">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-6">Configurações do Grupo</h3>

            <form onSubmit={handleUpdate}>
                {/* ... existing form fields ... */}
                <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="group-name" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nome do Grupo</label>
                        <input
                            type="text"
                            name="group-name"
                            id="group-name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border transition-colors"
                        />
                    </div>

                    <div className="col-span-6">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descrição</label>
                        <textarea
                            name="description"
                            id="description"
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border transition-colors"
                        />
                    </div>

                    <div className="col-span-6">
                        <div className="flex items-start">
                            <div className="flex h-5 items-center">
                                <input
                                    id="is_public"
                                    name="is_public"
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={e => setIsPublic(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-green-600 focus:ring-green-500 dark:bg-slate-800"
                                />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="is_public" className="font-medium text-gray-700 dark:text-slate-300">Grupo Público</label>
                                <p className="text-gray-500 dark:text-slate-500">Permite que qualquer pessoa encontre e entre no grupo.</p>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-6">
                        <div className="flex items-start">
                            <div className="flex h-5 items-center">
                                <input
                                    id="allow_member_invites"
                                    name="allow_member_invites"
                                    type="checkbox"
                                    checked={allowMemberInvites}
                                    onChange={e => setAllowMemberInvites(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-green-600 focus:ring-green-500 dark:bg-slate-800"
                                />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="allow_member_invites" className="font-medium text-gray-700 dark:text-slate-300">Membros podem convidar</label>
                                <p className="text-gray-500 dark:text-slate-500">Se ativado, qualquer participante do grupo poderá enviar convites e ver o código.</p>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-6 pt-6 border-t dark:border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-md font-medium text-gray-900 dark:text-white">Regras de Pontuação</h4>
                            {hasStarted && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50">
                                    🔒 Bloqueado: Campeonato em andamento
                                </span>
                            )}
                        </div>
                        {hasStarted && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-md border border-gray-200 dark:border-slate-700">
                                As regras de pontuação não podem ser alteradas pois o campeonato já começou.
                            </p>
                        )}
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="points-exact" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Placar Exato (Cravada)</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        id="points-exact"
                                        value={rules.exact}
                                        onChange={e => setRules({ ...rules, exact: parseInt(e.target.value) })}
                                        disabled={hasStarted}
                                        className={`block w-full flex-1 rounded-l-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border transition-colors ${hasStarted ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 text-gray-500 dark:text-slate-400 sm:text-sm">pts</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">Acertar o placar exato do jogo.</p>
                            </div>

                            <div>
                                <label htmlFor="points-winner-diff" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Vencedor + Diferença</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        id="points-winner-diff"
                                        value={rules.winner_diff}
                                        onChange={e => setRules({ ...rules, winner_diff: parseInt(e.target.value) })}
                                        disabled={hasStarted}
                                        className={`block w-full flex-1 rounded-l-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border transition-colors ${hasStarted ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 text-gray-500 dark:text-slate-400 sm:text-sm">pts</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">Acertar vencedor e a diferença de gols (ex: Apostou 2-0, foi 3-1).</p>
                            </div>

                            <div>
                                <label htmlFor="points-winner" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Apenas Vencedor</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        id="points-winner"
                                        value={rules.winner}
                                        onChange={e => setRules({ ...rules, winner: parseInt(e.target.value) })}
                                        disabled={hasStarted}
                                        className={`block w-full flex-1 rounded-l-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border transition-colors ${hasStarted ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 text-gray-500 dark:text-slate-400 sm:text-sm">pts</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">Acertar quem ganhou (ou empate) mas errar placar/diferença.</p>
                            </div>

                            <div>
                                <label htmlFor="points-one-score" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Um Placar Correto</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        id="points-one-score"
                                        value={rules.one_score}
                                        onChange={e => setRules({ ...rules, one_score: parseInt(e.target.value) })}
                                        disabled={hasStarted}
                                        className={`block w-full flex-1 rounded-l-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border transition-colors ${hasStarted ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 text-gray-500 dark:text-slate-400 sm:text-sm">pts</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">Acertar os gols de pelo menos um time (Consolação).</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form >

            <div className="mt-10 pt-6 border-t border-red-200 dark:border-red-900/50">
                <h4 className="text-md font-medium text-red-600 dark:text-red-400 mb-4 font-bold">Zona de Perigo</h4>
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-md p-4 flex items-center justify-between">
                    <div>
                        <h5 className="text-sm font-bold text-red-800 dark:text-red-300">Deletar este grupo</h5>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">Uma vez deletado, não há volta. Todas as apostas e rankings serão perdidos.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={loading}
                        className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-red-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-red-200 dark:shadow-none"
                    >
                        Deletar Grupo
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {
                showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-opacity">
                        <div className="bg-white dark:bg-slate-900 rounded-lg max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800 transform transition-all">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-center mb-2 text-gray-900 dark:text-white">Deletar Grupo?</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-6">
                                Tem certeza que deseja DELETAR este grupo? <br />
                                <span className="font-bold text-red-600 dark:text-red-400 block mt-2">Esta ação apagará todas as apostas e rankings e não pode ser desfeita.</span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={loading}
                                    className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 py-2 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? 'Deletando...' : 'Sim, Deletar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
