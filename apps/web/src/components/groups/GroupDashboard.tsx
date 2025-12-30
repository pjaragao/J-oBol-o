'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy, Gamepad2, Eye, Lock, CheckCircle2, MoreHorizontal, X } from 'lucide-react'

interface GroupDashboardProps {
    groupId: string
    eventId: string
    userId: string
}

interface Match {
    id: string
    home_team: { name: string; logo_url: string; short_name: string } | any
    away_team: { name: string; logo_url: string; short_name: string } | any
    match_date: string
    home_score: number | null
    away_score: number | null
    status: string
    user_bet?: {
        home_score_bet: number
        away_score_bet: number
        points: number
    }
}

interface RankingItem {
    user_id: string
    display_name: string
    avatar_url: string | null
    total_points: number
}

interface BetWithUser {
    home_score_bet: number
    away_score_bet: number
    points: number | null
    profiles: {
        display_name: string
        avatar_url: string | null
    }
}

export default function GroupDashboard({ groupId, eventId, userId }: GroupDashboardProps) {
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
    const [recentMatches, setRecentMatches] = useState<Match[]>([])
    const [topRanking, setTopRanking] = useState<RankingItem[]>([])
    const [loading, setLoading] = useState(true)

    // New states for betting and viewing
    const [betsModal, setBetsModal] = useState<{ matchId: string; bets: BetWithUser[] } | null>(null)
    const [inlineBets, setInlineBets] = useState<{ [matchId: string]: { home: string; away: string; isDirty?: boolean } }>({})
    const [savingMap, setSavingMap] = useState<Record<string, 'saving' | 'saved'>>({})
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        fetchDashboardData()
    }, [groupId, eventId, userId, supabase])

    const fetchDashboardData = async () => {
        setLoading(true)

        // 1. Fetch Upcoming Matches (Next 3)
        const { data: upcoming } = await supabase
            .from('matches')
            .select(`
                id,
                match_date,
                status,
                home_score,
                away_score,
                home_team:teams!home_team_id(name, logo_url, short_name),
                away_team:teams!away_team_id(name, logo_url, short_name)
            `)
            .eq('event_id', eventId)
            .in('status', ['scheduled', 'live', 'timed'])
            .gte('match_date', new Date().toISOString())
            .order('match_date', { ascending: true })
            .limit(3)

        // 2. Fetch Recent Matches (Last 3 Finished)
        const { data: recent } = await supabase
            .from('matches')
            .select(`
                id,
                match_date,
                status,
                home_score,
                away_score,
                home_team:teams!home_team_id(name, logo_url, short_name),
                away_team:teams!away_team_id(name, logo_url, short_name)
            `)
            .eq('event_id', eventId)
            .in('status', ['finished', 'FT', 'AET', 'PEN'])
            .order('match_date', { ascending: false })
            .limit(3)

        // Fetch user bets
        const matchIds = [...(upcoming || []).map(m => m.id), ...(recent || []).map(m => m.id)]

        if (matchIds.length > 0) {
            const { data: bets } = await supabase
                .from('bets')
                .select('match_id, home_score_bet, away_score_bet, points')
                .eq('group_id', groupId)
                .eq('user_id', userId)
                .in('match_id', matchIds)

            const betsMap = new Map(bets?.map(b => [b.match_id, b]) || [])

            if (upcoming) {
                setUpcomingMatches(upcoming.map(m => ({ ...m, user_bet: betsMap.get(m.id) })) as any)
            }
            if (recent) {
                setRecentMatches(recent.map(m => ({ ...m, user_bet: betsMap.get(m.id) })) as any)
            }
        } else {
            if (upcoming) setUpcomingMatches(upcoming as any)
            if (recent) setRecentMatches(recent as any)
        }

        // 3. Fetch Top Ranking
        const { data: rankingData } = await supabase
            .from('group_rankings')
            .select('user_id, display_name, avatar_url, total_points')
            .eq('group_id', groupId)
            .order('total_points', { ascending: false })
            .limit(5)

        if (rankingData) {
            setTopRanking(rankingData)
        }

        setLoading(false)
    }

    const handleViewBets = async (matchId: string, matchDate: string) => {
        // Validate if match has started
        if (new Date(matchDate) > new Date()) {
            alert("⏳ Os palpites só são visíveis após o início do jogo!")
            return
        }

        const { data } = await supabase
            .from('bets')
            .select(`
                home_score_bet,
                away_score_bet,
                points,
                profiles(display_name, avatar_url)
            `)
            .eq('group_id', groupId)
            .eq('match_id', matchId)

        setBetsModal({
            matchId,
            bets: (data || []).map((bet: any) => ({
                ...bet,
                profiles: Array.isArray(bet.profiles) ? bet.profiles[0] : bet.profiles
            })) as BetWithUser[]
        })
    }

    const handleInlineBetChange = (matchId: string, type: 'home' | 'away', value: string) => {
        let finalValue = value
        if (value !== '' && parseInt(value) < 0) finalValue = '0'

        setInlineBets(prev => ({
            ...prev,
            [matchId]: {
                ...prev[matchId] || { home: '', away: '' },
                [type]: finalValue,
                isDirty: true
            }
        }))

        // Reset saved status when user starts typing again
        if (savingMap[matchId] === 'saved') {
            setSavingMap(prev => {
                const next = { ...prev }
                delete next[matchId]
                return next
            })
        }
    }

    const handleInlineFocus = (matchId: string, type: 'home' | 'away') => {
        if (activeMatchId && activeMatchId !== matchId) {
            handleSaveInlineBet(activeMatchId)
        }
        setActiveMatchId(matchId)
    }

    // Debounce save when both fields are filled
    useEffect(() => {
        if (!activeMatchId) return
        const bet = inlineBets[activeMatchId]
        if (bet?.isDirty && bet.home !== '' && bet.away !== '') {
            const timer = setTimeout(() => {
                handleSaveInlineBet(activeMatchId)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [inlineBets, activeMatchId])

    const handleSaveInlineBet = async (matchId: string) => {
        const bet = inlineBets[matchId]
        if (!bet || !bet.isDirty || bet.home === '' || bet.away === '') {
            return
        }

        setSavingMap(prev => ({ ...prev, [matchId]: 'saving' }))
        try {
            const { error } = await supabase
                .from('bets')
                .upsert({
                    user_id: userId,
                    group_id: groupId,
                    match_id: matchId,
                    home_score_bet: Number(bet.home),
                    away_score_bet: Number(bet.away),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,group_id,match_id' })

            if (!error) {
                // Update local state only (no full refresh)
                setUpcomingMatches(prev => prev.map(m => {
                    if (m.id === matchId) {
                        return {
                            ...m,
                            user_bet: {
                                home_score_bet: Number(bet.home),
                                away_score_bet: Number(bet.away),
                                points: 0 // Will be calculated when match finishes
                            }
                        }
                    }
                    return m
                }))
                // Mark as not dirty in inlineBets
                setInlineBets(prev => ({
                    ...prev,
                    [matchId]: { ...prev[matchId], isDirty: false }
                }))
                setSavingMap(prev => ({ ...prev, [matchId]: 'saved' }))

                // Clear inline bet after a delay to show saved status
                setTimeout(() => {
                    setInlineBets(prev => {
                        const next = { ...prev }
                        delete next[matchId]
                        return next
                    })
                    setSavingMap(prev => {
                        const next = { ...prev }
                        delete next[matchId]
                        return next
                    })
                }, 2000)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const getTeam = (team: any) => Array.isArray(team) ? team[0] : team

    if (loading) return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        </div>
    )

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans text-slate-800 dark:text-slate-100">

                {/* Col 1: Ranking Resumido */}
                <div className="bg-[#FDFDF7] dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-[#15803d] dark:text-green-400">
                        <Trophy className="h-5 w-5" />
                        <h3 className="font-bold text-lg">Ranking Resumido</h3>
                    </div>

                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 min-h-[200px] flex flex-col justify-center">
                        {topRanking.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 text-sm">
                                Nenhuma previsão feita ainda, ou o ranking ainda está calculando.
                            </p>
                        ) : (
                            <div className="space-y-3 w-full">
                                {topRanking.map((user, idx) => (
                                    <div key={user.user_id} className="flex items-center justify-between border-b border-green-50 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                                                 ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}
                                             `}>
                                                {idx + 1}
                                            </div>
                                            <span className="font-medium text-sm truncate max-w-[120px] dark:text-slate-200">{user.display_name}</span>
                                        </div>
                                        <span className="font-bold text-green-700 dark:text-green-400 text-sm">{user.total_points} pts</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Col 2: Minhas Apostas */}
                <div className="bg-[#FDFDF7] dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-[#15803d] dark:text-green-400">
                        <Gamepad2 className="h-5 w-5" />
                        <h3 className="font-bold text-lg">Minhas Apostas</h3>
                    </div>

                    <div className="space-y-6">
                        {/* Próximas Apostas */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1">
                                → Próximas Apostas
                            </h4>
                            {upcomingMatches.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Nenhum jogo próximo.</p>
                            ) : (
                                <div className="space-y-2">
                                    {upcomingMatches.map(match => {
                                        const home = getTeam(match.home_team)
                                        const away = getTeam(match.away_team)
                                        const hasBet = !!match.user_bet
                                        const inlineBet = inlineBets[match.id]
                                        const isEditing = !!inlineBet

                                        return (
                                            <div key={match.id} className="bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <img src={home.logo_url} alt={home.short_name} className="w-5 h-5 object-contain" />

                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="tel"
                                                                    inputMode="numeric"
                                                                    className="w-8 h-8 text-center text-sm font-bold border rounded focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                                                    value={inlineBet.home}
                                                                    onChange={(e) => handleInlineBetChange(match.id, 'home', e.target.value)}
                                                                    onFocus={(e) => {
                                                                        handleInlineFocus(match.id, 'home')
                                                                        e.target.select()
                                                                    }}
                                                                    onBlur={() => {
                                                                        setTimeout(() => {
                                                                            if (activeMatchId === match.id) handleSaveInlineBet(match.id)
                                                                        }, 200)
                                                                    }}
                                                                    placeholder="-"
                                                                />
                                                                {savingMap[match.id] === 'saving' && (
                                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${hasBet ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-600 dark:text-slate-300'}`}>
                                                                {hasBet ? match.user_bet?.home_score_bet : '-'}
                                                            </div>
                                                        )}

                                                        <span className="text-xs text-slate-400">x</span>

                                                        {isEditing ? (
                                                            <input
                                                                type="tel"
                                                                inputMode="numeric"
                                                                className="w-8 h-8 text-center text-sm font-bold border rounded focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                                                value={inlineBet.away}
                                                                onChange={(e) => handleInlineBetChange(match.id, 'away', e.target.value)}
                                                                onFocus={(e) => {
                                                                    handleInlineFocus(match.id, 'away')
                                                                    e.target.select()
                                                                }}
                                                                onBlur={() => {
                                                                    setTimeout(() => {
                                                                        if (activeMatchId === match.id) handleSaveInlineBet(match.id)
                                                                    }, 200)
                                                                }}
                                                                placeholder="-"
                                                            />
                                                        ) : (
                                                            <div className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${hasBet ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-600 dark:text-slate-300'}`}>
                                                                {hasBet ? match.user_bet?.away_score_bet : '-'}
                                                            </div>
                                                        )}

                                                        <img src={away.logo_url} alt={away.short_name} className="w-5 h-5 object-contain" />
                                                    </div>

                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1.5 min-w-[40px] justify-end">
                                                            {savingMap[match.id] === 'saved' ? (
                                                                <span className="text-[10px] text-green-600 font-bold animate-in fade-in zoom-in duration-300">Salvo!</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setInlineBets(prev => { const n = { ...prev }; delete n[match.id]; return n })
                                                                        setSavingMap(prev => { const n = { ...prev }; delete n[match.id]; return n })
                                                                    }}
                                                                    className="text-xs text-slate-400 px-1 py-1 hover:text-red-500 transition-colors"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : hasBet ? (
                                                        <button
                                                            onClick={() => setInlineBets(prev => ({ ...prev, [match.id]: { home: String(match.user_bet?.home_score_bet ?? ''), away: String(match.user_bet?.away_score_bet ?? '') } }))}
                                                            className="text-xs text-slate-400 hover:text-green-600"
                                                        >
                                                            ✏️
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setInlineBets(prev => ({ ...prev, [match.id]: { home: '', away: '' } }))}
                                                            className="text-xs text-green-600 dark:text-green-400 hover:underline"
                                                        >
                                                            Apostar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Últimas Apostas */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1">
                                ↺ Últimas Apostas
                            </h4>
                            {recentMatches.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-4">Nenhuma aposta finalizada.</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentMatches.map(match => {
                                        const home = getTeam(match.home_team)
                                        const away = getTeam(match.away_team)
                                        return (
                                            <div key={match.id} className="bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 p-3 flex items-center justify-between shadow-sm opacity-80">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>{home.short_name}</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{match.home_score}</span>
                                                    <span>x</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{match.away_score}</span>
                                                    <span>{away.short_name}</span>
                                                </div>
                                                {match.user_bet?.points !== undefined && (
                                                    <span className={`text-xs font-bold px-1.5 rounded ${match.user_bet.points > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                        {match.user_bet.points > 0 ? `+${match.user_bet.points}` : '0'} pts
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Col 3: Apostas da Galera */}
                <div className="bg-[#FDFDF7] dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-[#15803d] dark:text-green-400">
                        <Eye className="h-5 w-5" />
                        <h3 className="font-bold text-lg">Apostas da Galera</h3>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1">
                                ↺ Últimos Jogos
                            </h4>
                            {recentMatches.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Sem dados recentes.</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentMatches.map(match => {
                                        const home = getTeam(match.home_team)
                                        const away = getTeam(match.away_team)
                                        return (
                                            <div key={match.id} className="flex items-center justify-between text-sm py-2 px-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <img src={home.logo_url} className="w-4 h-4" />
                                                    <span className="font-bold text-xs dark:text-slate-300">{home.short_name}</span>
                                                    <span className="text-xs text-slate-600 dark:text-slate-400">{match.home_score}-{match.away_score}</span>
                                                    <span className="font-bold text-xs dark:text-slate-300">{away.short_name}</span>
                                                    <img src={away.logo_url} className="w-4 h-4" />
                                                </div>
                                                <button
                                                    onClick={() => handleViewBets(match.id, match.match_date)}
                                                    className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                                >
                                                    Ver palpites
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1">
                                → Próximos Jogos
                            </h4>
                            {upcomingMatches.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Sem jogos futuros.</p>
                            ) : (
                                <div className="space-y-2">
                                    {upcomingMatches.map(match => {
                                        const home = getTeam(match.home_team)
                                        const away = getTeam(match.away_team)
                                        return (
                                            <div key={match.id} className="flex items-center justify-between text-sm py-2 px-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <img src={home.logo_url} className="w-5 h-5" />
                                                    <span className="font-bold text-xs dark:text-slate-300">vs</span>
                                                    <img src={away.logo_url} className="w-5 h-5" />
                                                </div>
                                                <div className="text-xs flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                                    <MoreHorizontal className="h-3 w-3" />
                                                    <span>Apostas</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Bets Modal */}
            {betsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBetsModal(null)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Palpites da Galera</h3>
                            <button onClick={() => setBetsModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {betsModal.bets.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">Nenhum palpite ainda</p>
                        ) : (
                            <div className="space-y-3">
                                {betsModal.bets.map((bet, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {bet.profiles.avatar_url ? (
                                                <img src={bet.profiles.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-sm">
                                                    {bet.profiles.display_name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{bet.profiles.display_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{bet.home_score_bet}-{bet.away_score_bet}</span>
                                            {bet.points !== null && (
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${bet.points > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'}`}>
                                                    +{bet.points}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
