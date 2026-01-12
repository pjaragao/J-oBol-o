'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { TeamName } from '@/components/ui/TeamName'

export function BetModal({
    isOpen,
    onClose,
    match,
    groupId
}: {
    isOpen: boolean;
    onClose: () => void;
    match: any;
    groupId: string;
}) {
    const [homeScore, setHomeScore] = useState('')
    const [awayScore, setAwayScore] = useState('')
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    if (!isOpen) return null

    // Check if match is locked (starts in less than 5 minutes)
    const isMatchLocked = () => {
        const matchDate = new Date(match.match_date)
        const now = new Date()
        const fiveMinutesInMs = 5 * 60 * 1000
        return (matchDate.getTime() - now.getTime()) < fiveMinutesInMs
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Frontend validation
        if (isMatchLocked()) {
            alert('⚠️ Apostas encerradas! Este jogo começa em menos de 5 minutos ou já está em andamento.')
            return
        }

        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not found')

            console.log('Enviando aposta:', {
                userId: user.id,
                groupId,
                matchId: match.id,
                home: homeScore,
                away: awayScore
            })

            const { error } = await supabase
                .from('bets')
                .upsert({
                    user_id: user.id,
                    group_id: groupId,
                    match_id: match.id,
                    home_score_bet: parseInt(homeScore),
                    away_score_bet: parseInt(awayScore)
                }, {
                    onConflict: 'user_id,group_id,match_id'
                })

            if (error) {
                // Handle specific RLS error
                if (error.message.includes('row-level security')) {
                    throw new Error('Apostas encerradas para este jogo. O prazo expirou ou você não é membro do grupo.')
                }
                throw error
            }

            onClose()
        } catch (error: any) {
            alert('Erro ao salvar aposta: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-slate-900 rounded-lg max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-center mb-4 dark:text-white">Fazer Aposta</h3>

                <div className="flex justify-between items-center mb-6">
                    <div className="text-center w-24">
                        <img src={match.home_team.logo_url} className="w-12 h-12 mx-auto mb-2 object-contain" alt="" />
                        <TeamName
                            team={match.home_team}
                            variant="auto"
                            className="font-bold text-slate-800 dark:text-slate-200 justify-center w-full"
                        />
                    </div>
                    <div className="text-xl font-bold text-gray-300 dark:text-slate-600">X</div>
                    <div className="text-center w-24">
                        <img src={match.away_team.logo_url} className="w-12 h-12 mx-auto mb-2 object-contain" alt="" />
                        <TeamName
                            team={match.away_team}
                            variant="auto"
                            className="font-bold text-slate-800 dark:text-slate-200 justify-center w-full"
                        />
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="flex justify-center gap-4 mb-6">
                        <input
                            type="number"
                            min="0"
                            className="w-16 h-16 text-center text-3xl font-bold border rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none transition-all"
                            value={homeScore}
                            onChange={e => {
                                const val = e.target.value
                                setHomeScore(val !== '' && parseInt(val) < 0 ? '0' : val)
                            }}
                            required
                        />
                        <input
                            type="number"
                            min="0"
                            className="w-16 h-16 text-center text-3xl font-bold border rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none transition-all"
                            value={awayScore}
                            onChange={e => {
                                const val = e.target.value
                                setAwayScore(val !== '' && parseInt(val) < 0 ? '0' : val)
                            }}
                            required
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 py-2 rounded-md font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-green-600 text-white py-2 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-200 dark:shadow-none"
                        >
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
