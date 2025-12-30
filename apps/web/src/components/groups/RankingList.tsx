'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface RankingItem {
    id: string
    display_name: string
    avatar_url: string | null
    total_points: number
    stats: {
        exact: number          // 10 pts - Cravadas
        winnerDiff: number     // 7 pts - Vencedor + Diferença
        winner: number         // 5 pts - Vencedor
        consolation: number    // 2 pts - Consolação
    }
}

export function RankingList({ groupId, currentUserId }: { groupId: string, currentUserId?: string }) {
    const [ranking, setRanking] = useState<RankingItem[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchRanking() {
            const { data: members, error } = await supabase
                .from('group_members')
                .select(`
                    user_id,
                    profiles (
                        id,
                        display_name,
                        avatar_url
                    )
                `)
                .eq('group_id', groupId)

            if (error) {
                console.error('Error fetching members:', error)
                setLoading(false)
                return
            }

            if (!members) {
                setLoading(false)
                return
            }

            // Fetch all bets for this group
            const { data: bets } = await supabase
                .from('bets')
                .select('user_id, points')
                .eq('group_id', groupId)

            // Aggregate points by criteria
            const statsMap = new Map<string, { exact: number; winnerDiff: number; winner: number; consolation: number }>()
            const pointsMap = new Map<string, number>()

            bets?.forEach(bet => {
                const userId = bet.user_id
                const points = bet.points || 0

                // Initialize stats if not exists
                if (!statsMap.has(userId)) {
                    statsMap.set(userId, { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 })
                }

                const stats = statsMap.get(userId)!

                // Categorize by points
                if (points === 10) stats.exact++
                else if (points === 7) stats.winnerDiff++
                else if (points === 5) stats.winner++
                else if (points === 2) stats.consolation++

                // Sum total points
                const currentTotal = pointsMap.get(userId) || 0
                pointsMap.set(userId, currentTotal + points)
            })

            const leaderboard = members.map(m => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                const userId = m.user_id
                return {
                    id: m.user_id, // Use user_id as stable id
                    display_name: profile?.display_name || 'Usuário',
                    avatar_url: profile?.avatar_url,
                    total_points: pointsMap.get(userId) || 0,
                    stats: statsMap.get(userId) || { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 }
                }
            }).sort((a, b) => b.total_points - a.total_points)

            setRanking(leaderboard)
            setLoading(false)
        }

        fetchRanking()
    }, [groupId])

    if (loading) {
        return <div className="text-center py-8">Carregando ranking...</div>
    }

    if (ranking.length === 0) {
        return <div className="text-center py-8 text-gray-500">Nenhum participante ainda.</div>
    }

    return (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 shadow sm:rounded-lg border border-gray-100 dark:border-slate-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Pos
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Jogador
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                            Total
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            <div className="flex flex-col items-center">
                                <span>🎯 Cravadas</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">(10pts)</span>
                            </div>
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            <div className="flex flex-col items-center">
                                <span>📊 Venc+Diff</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">(7pts)</span>
                            </div>
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            <div className="flex flex-col items-center">
                                <span>✓ Vencedor</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">(5pts)</span>
                            </div>
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            <div className="flex flex-col items-center">
                                <span>~ Consolação</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">(2pts)</span>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {ranking.map((user, index) => {
                        const isCurrentUser = user.id === currentUserId
                        return (
                            <tr key={user.id} className={`${isCurrentUser ? 'bg-green-50 dark:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'} transition-colors`}>
                                {/* Position */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                        index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300' :
                                            index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400' :
                                                'text-gray-500 dark:text-slate-500'
                                        }`}>
                                        {index + 1}
                                    </span>
                                </td>

                                {/* Player */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            {user.avatar_url ? (
                                                <img className="h-10 w-10 rounded-full border border-gray-200 dark:border-slate-700" src={user.avatar_url} alt="" />
                                            ) : (
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-400 dark:bg-slate-700">
                                                    <span className="font-medium leading-none text-white dark:text-slate-200">
                                                        {user.display_name?.charAt(0).toUpperCase()}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className={`text-sm ${isCurrentUser ? 'font-bold text-green-800 dark:text-green-400' : 'font-medium text-slate-900 dark:text-slate-100'}`}>
                                                {user.display_name} {isCurrentUser && '(Você)'}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Total Points */}
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-base font-bold border ${isCurrentUser
                                        ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-200 border-green-300 dark:border-green-700'
                                        : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800/50'
                                        }`}>
                                        {user.total_points}
                                    </span>
                                </td>

                                {/* Exact Score (10pts) */}
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                    <div className="text-sm">
                                        <div className="font-bold text-slate-900 dark:text-slate-100">{user.stats.exact}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">({user.stats.exact * 10}pts)</div>
                                    </div>
                                </td>

                                {/* Winner + Diff (7pts) */}
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                    <div className="text-sm">
                                        <div className="font-bold text-slate-900 dark:text-slate-100">{user.stats.winnerDiff}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">({user.stats.winnerDiff * 7}pts)</div>
                                    </div>
                                </td>

                                {/* Winner (5pts) */}
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                    <div className="text-sm">
                                        <div className="font-bold text-slate-900 dark:text-slate-100">{user.stats.winner}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">({user.stats.winner * 5}pts)</div>
                                    </div>
                                </td>

                                {/* Consolation (2pts) */}
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                    <div className="text-sm">
                                        <div className="font-bold text-slate-900 dark:text-slate-100">{user.stats.consolation}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">({user.stats.consolation * 2}pts)</div>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
