'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { calculateLivePoints } from '@/lib/utils/points'

interface RankingItem {
    id: string
    display_name: string
    avatar_url: string | null
    total_points: number
    live_points?: number
    rank_variation?: number
    stats: {
        exact: number          // 10 pts - Cravadas
        winnerDiff: number     // 7 pts - Vencedor + Diferença
        winner: number         // 5 pts - Vencedor
        consolation: number    // 2 pts - Consolação
    }
}

export function RankingList({ groupId, eventId, currentUserId }: { groupId: string, eventId: string, currentUserId?: string }) {
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

            // Fetch live matches and all bets
            const now = new Date().toISOString()
            const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

            const { data: liveMatches } = await supabase
                .from('matches')
                .select('id, home_score, away_score')
                .eq('event_id', eventId)
                .not('status', 'in', '("finished", "FT", "AET", "PEN")')
                .lt('match_date', now)
                .gt('match_date', threeHoursAgo)

            const liveMatchesMap = new Map(liveMatches?.map(m => [m.id, m]) || [])

            const { data: bets } = await supabase
                .from('bets')
                .select('user_id, match_id, points, home_score_bet, away_score_bet')
                .eq('group_id', groupId)

            // Aggregate points and positions
            const statsMap = new Map<string, { exact: number; winnerDiff: number; winner: number; consolation: number }>()
            const pointsMapBase = new Map<string, number>()
            const pointsMapLiveTotal = new Map<string, number>()
            const livePointsOnlyMap = new Map<string, number>()

            bets?.forEach(bet => {
                const userId = bet.user_id
                const basePoints = bet.points || 0

                // Sum base points
                pointsMapBase.set(userId, (pointsMapBase.get(userId) || 0) + basePoints)
                pointsMapLiveTotal.set(userId, (pointsMapLiveTotal.get(userId) || 0) + basePoints)

                // Sum live points if applicable
                if (bet.points === null && liveMatchesMap.has(bet.match_id)) {
                    const match = liveMatchesMap.get(bet.match_id)!
                    const lp = calculateLivePoints(bet.home_score_bet, bet.away_score_bet, match.home_score || 0, match.away_score || 0)
                    if (lp > 0) {
                        pointsMapLiveTotal.set(userId, pointsMapLiveTotal.get(userId)! + lp)
                        livePointsOnlyMap.set(userId, (livePointsOnlyMap.get(userId) || 0) + lp)
                    }
                }

                // Stats calculation (only for finished games)
                if (bet.points !== null) {
                    if (!statsMap.has(userId)) {
                        statsMap.set(userId, { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 })
                    }
                    const stats = statsMap.get(userId)!
                    if (basePoints === 10) stats.exact++
                    else if (basePoints === 7) stats.winnerDiff++
                    else if (basePoints === 5) stats.winner++
                    else if (basePoints === 2) stats.consolation++
                }
            })

            // Calculate ranks
            const rankingWithoutLive = members.map(m => {
                const userId = m.user_id
                return { userId, points: pointsMapBase.get(userId) || 0 }
            }).sort((a, b) => b.points - a.points)

            const initialPosMap = new Map(rankingWithoutLive.map((item, idx) => [item.userId, idx]))

            const leaderboard: RankingItem[] = members.map(m => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                const userId = m.user_id
                const totalWithLive = pointsMapLiveTotal.get(userId) || 0
                return {
                    id: userId,
                    display_name: profile?.display_name || 'Usuário',
                    avatar_url: profile?.avatar_url,
                    total_points: totalWithLive,
                    live_points: livePointsOnlyMap.get(userId) || 0,
                    rank_variation: 0,
                    stats: statsMap.get(userId) || { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 }
                }
            }).sort((a, b) => b.total_points - a.total_points)

            leaderboard.forEach((user, currentIdx) => {
                const initialIdx = initialPosMap.get(user.id) ?? currentIdx
                user.rank_variation = initialIdx - currentIdx
            })

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
                                    <div className="flex flex-col items-center justify-center">
                                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                            index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300' :
                                                index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400' :
                                                    'text-gray-500 dark:text-slate-500'
                                            }`}>
                                            {index + 1}
                                        </span>
                                        {user.rank_variation !== 0 && (
                                            <div className={`mt-1 flex items-center gap-0.5 text-[10px] font-bold ${user.rank_variation! > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {user.rank_variation! > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                {Math.abs(user.rank_variation!)}
                                            </div>
                                        )}
                                    </div>
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
                                    <div className="flex flex-col items-center">
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-base font-bold border ${isCurrentUser
                                            ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-200 border-green-300 dark:border-green-700'
                                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800/50'
                                            }`}>
                                            {user.total_points}
                                        </span>
                                        {user.live_points! > 0 && (
                                            <span className="text-[10px] text-red-500 font-bold animate-pulse mt-0.5">
                                                (+{user.live_points}) live
                                            </span>
                                        )}
                                    </div>
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
