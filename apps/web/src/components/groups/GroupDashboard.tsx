'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR, enUS, es } from 'date-fns/locale'
import { Trophy, Gamepad2, Eye, Lock, CheckCircle2, MoreHorizontal, X, ArrowUp, ArrowDown, Minus, RefreshCw, DollarSign, AlertTriangle, Wallet, Crown, Calendar, ChevronRight, BarChart2, Plus, Users } from 'lucide-react'
import { calculateLivePoints } from '@/lib/utils/points'
import { BetSecurityService } from '@/lib/bet-security'
import { TeamName } from '@/components/ui/TeamName'
import { manualUpdateLiveMatches } from '@/app/admin/actions'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

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
    venue?: string | null
    user_bet?: {
        home_score_bet: number
        away_score_bet: number
        points: number
    }
}

interface GroupFinancials {
    is_paid: boolean
    payment_method: 'ONLINE' | 'OFFLINE'
    entry_fee: number
    min_members: number
    max_members: number | null
    paid_members_count: number
    total_pot: number
    net_pot: number
    platform_fee: number
}

interface RankingItem {
    user_id: string
    display_name: string
    avatar_url: string | null
    total_points: number
    live_points?: number
    rank_variation?: number
    exact_scores?: number
    estimated_prize?: number
    stats: {
        exact: number
        winnerDiff: number
        winner: number
        consolation: number
    }
}

interface RankingItem {
    user_id: string
    display_name: string
    avatar_url: string | null
    total_points: number
    live_points?: number
    rank_variation?: number
    exact_scores?: number
    stats: {
        exact: number
        winnerDiff: number
        winner: number
        consolation: number
    }
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
    const t = useTranslations('group');
    const locale = useLocale();
    const dateLocale = locale === 'pt' ? ptBR : locale === 'es' ? es : enUS;
    const isEnglish = locale === 'en';

    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
    const [liveMatches, setLiveMatches] = useState<Match[]>([])
    const [recentMatches, setRecentMatches] = useState<Match[]>([])
    const [topRanking, setTopRanking] = useState<RankingItem[]>([])
    const [loading, setLoading] = useState(true)

    // New states for betting and viewing
    const [betsModal, setBetsModal] = useState<{ matchId: string; bets: BetWithUser[] } | null>(null)
    const [inlineBets, setInlineBets] = useState<{ [matchId: string]: { home: string; away: string; isDirty?: boolean } }>({})
    const [savingMap, setSavingMap] = useState<Record<string, 'saving' | 'saved'>>({})
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
    const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
    const [isRefreshing, setIsRefreshing] = useState(false)

    const [financials, setFinancials] = useState<GroupFinancials | null>(null)
    const [isFinished, setIsFinished] = useState(false)
    const [userPaymentStatus, setUserPaymentStatus] = useState<'PENDING' | 'PAID' | 'EXEMPT'>('PENDING')
    const [isMember, setIsMember] = useState<boolean | null>(null)
    const [groupData, setGroupData] = useState<any>(null)

    const supabase = createClient()

    useEffect(() => {
        fetchDashboardData()
    }, [groupId, eventId, userId, supabase])

    // Real-time polling
    useEffect(() => {
        let intervalId: NodeJS.Timeout

        if (isRealtimeEnabled) {
            intervalId = setInterval(() => {
                fetchDashboardData(true) // Silent update
            }, 60000) // 1 minute
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [isRealtimeEnabled, groupId, eventId, userId, supabase])

    const [betCounts, setBetCounts] = useState<Record<string, number>>({})


    const [errorState, setErrorState] = useState<string | null>(null)

    const fetchDashboardData = async (silent = false) => {
        if (!userId) return
        if (!silent) setLoading(true)
        else setIsRefreshing(true)
        setErrorState(null)

        try {

            const now = new Date().toISOString()
            const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

            // 0. Fetch Group Details & Event Fees (for Financials)
            const { data: groupDataFromDB } = await supabase
                .from('groups')
                .select(`
                is_paid, payment_method, entry_fee, min_members, max_members, prize_distribution_strategy, is_finished,
                invite_code, created_by,
                events!event_id (online_fee_percent, offline_fee_per_slot, offline_base_fee)
            `)
                .eq('id', groupId)
                .single()

            if (groupDataFromDB) {
                setGroupData(groupDataFromDB)
                setIsFinished(groupDataFromDB.is_finished)
            }

            const { data: memberData, error: memberError } = await supabase
                .from('group_members')
                .select('payment_status')
                .eq('group_id', groupId)
                .eq('user_id', userId)
                .single()

            if (memberError && memberError.code !== 'PGRST116') {
                throw memberError
            }

            if (memberData) {
                setUserPaymentStatus(memberData.payment_status)
                setIsMember(true)
            } else {
                setIsMember(false)
            }

            // Fetch Paid Count
            const { count: paidCount } = await supabase
                .from('group_members')
                .select('id', { count: 'exact', head: true })
                .eq('group_id', groupId)
                .eq('payment_status', 'PAID')

            if (groupData?.is_paid) {
                const eventFees = Array.isArray(groupData.events) ? groupData.events[0] : groupData.events
                const config = {
                    payment_method: groupData.payment_method,
                    entry_fee: groupData.entry_fee,
                    max_members: groupData.max_members
                }
                const potArgs = {
                    online_fee_percent: eventFees?.online_fee_percent || 10,
                    offline_fee_per_slot: eventFees?.offline_fee_per_slot || 0,
                    offline_base_fee: eventFees?.offline_base_fee || 0
                }

                // Lazy load FinancialService to avoid server/client issues if any
                const { FinancialService } = await import('@/lib/financial-service')
                const { grossPot, platformFee, netPot } = FinancialService.calculatePrizePot(config, paidCount || 0, potArgs)

                setFinancials({
                    is_paid: true,
                    payment_method: groupData.payment_method,
                    entry_fee: groupData.entry_fee,
                    min_members: groupData.min_members,
                    max_members: groupData.max_members,
                    paid_members_count: paidCount || 0,
                    total_pot: grossPot,
                    net_pot: netPot,
                    platform_fee: platformFee
                })
            }

            // 1. Fetch Upcoming Matches (Next 3 strictly in future)
            const { data: upcoming } = await supabase
                .from('matches')
                .select(`
                id,
                match_date,
                status,
                home_score,
                away_score,
                venue,
                home_team:teams!home_team_id(name, logo_url, short_name, tla),
                away_team:teams!away_team_id(name, logo_url, short_name, tla)
            `)
                .eq('event_id', eventId)
                .in('status', ['scheduled', 'timed'])
                .gte('match_date', now)
                .order('match_date', { ascending: true })
                .limit(3)

            // 2. Fetch Live/InProgress Matches
            // Criteria: status is 'live' OR (status is not finished AND date is in the last 3 hours or slightly future which started)
            const { data: live } = await supabase
                .from('matches')
                .select(`
                id,
                match_date,
                status,
                home_score,
                away_score,
                venue,
                home_team:teams!home_team_id(name, logo_url, short_name, tla),
                away_team:teams!away_team_id(name, logo_url, short_name, tla),
                updated_at
            `)
                .eq('event_id', eventId)
                .not('status', 'in', '("finished", "FT", "AET", "PEN")')
                .lt('match_date', now)
                .gt('match_date', threeHoursAgo)
                .order('match_date', { ascending: true })

            // 3. SMART SYNC CHECK (Client trigger)
            // If there are live matches, check if the data is stale (older than 2 mins)
            if (live && live.length > 0) {
                const lastLiveUpdate = live.reduce((latest, match) => {
                    const matchTime = new Date(match.updated_at).getTime()
                    return matchTime > latest ? matchTime : latest
                }, 0)

                const twoMinutesAgo = Date.now() - 2 * 60 * 1000

                // If the latest update is older than 2 minutes, trigger a background refresh
                if (lastLiveUpdate < twoMinutesAgo) {
                    console.log('[SmartSync] Data is stale. Triggering background update...')
                    // We call the server action without awaiting to not block the UI render
                    manualUpdateLiveMatches().then(res => {
                        if (res.success) {
                            console.log('[SmartSync] Triggered successfully. Will refresh in next poll.')
                            // Optionally set a flag to refresh sooner
                        } else {
                            console.log('[SmartSync] Skipped:', res.message)
                        }
                    })
                }
            }

            // 3. Fetch Recent Matches (Last 3 Finished)
            const { data: recent } = await supabase
                .from('matches')
                .select(`
                id,
                match_date,
                status,
                home_score,
                away_score,
                venue,
                home_team:teams!home_team_id(name, logo_url, short_name, tla),
                away_team:teams!away_team_id(name, logo_url, short_name, tla)
            `)
                .eq('event_id', eventId)
                .in('status', ['finished', 'FT', 'AET', 'PEN'])
                .order('match_date', { ascending: false })
                .limit(3)

            // Fetch user data and all bets for ranking
            const { data: members } = await supabase
                .from('group_members')
                .select('user_id, profiles(display_name, avatar_url)')
                .eq('group_id', groupId)
                .limit(5000)

            const { data: allBets } = await supabase
                .from('bets')
                .select('user_id, match_id, points, home_score_bet, away_score_bet')
                .eq('group_id', groupId)
                .limit(5000)

            if (members) {
                // Aggregate Ranking (both without and with live points)
                const pointsMapBase = new Map<string, number>()
                const pointsMapLiveTotal = new Map<string, number>()
                const livePointsOnlyMap = new Map<string, number>()
                const exactScoresMap = new Map<string, number>()
                const statsMap = new Map<string, { exact: number; winnerDiff: number; winner: number; consolation: number }>()

                const liveMatchesMap = new Map(live?.map(m => [m.id, m]) || [])

                allBets?.forEach(bet => {
                    const basePoints = bet.points || 0
                    const userId = bet.user_id

                    pointsMapBase.set(userId, (pointsMapBase.get(userId) || 0) + basePoints)
                    pointsMapLiveTotal.set(userId, (pointsMapLiveTotal.get(userId) || 0) + basePoints)

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

                    // Track exact scores (tie-breaker)
                    if (bet.points === 10) {
                        exactScoresMap.set(userId, (exactScoresMap.get(userId) || 0) + 1)
                    }

                    // Calculate live points if this match is currently live
                    // Note: we check for null OR 0 to be safe before the DB migration propagates
                    if ((bet.points === null || bet.points === 0) && liveMatchesMap.has(bet.match_id)) {
                        const match = liveMatchesMap.get(bet.match_id)!
                        const lp = calculateLivePoints(bet.home_score_bet, bet.away_score_bet, match.home_score || 0, match.away_score || 0)
                        if (lp > 0) {
                            pointsMapLiveTotal.set(userId, pointsMapLiveTotal.get(userId)! + lp)
                            livePointsOnlyMap.set(userId, (livePointsOnlyMap.get(userId) || 0) + lp)

                            // Also count live exact scores for live ranking tie-breaker
                            if (lp === 10) {
                                exactScoresMap.set(userId, (exactScoresMap.get(userId) || 0) + 1)
                            }
                        }
                    }
                })

                // Calculate Initial Positions (Without Live)
                const rankingWithoutLive = members.map(m => {
                    const userId = m.user_id
                    return {
                        userId,
                        points: pointsMapBase.get(userId) || 0,
                        exacts: exactScoresMap.get(userId) || 0
                    }
                }).sort((a, b) => b.points - a.points || b.exacts - a.exacts)

                const initialPosMap = new Map(rankingWithoutLive.map((item, idx) => [item.userId, idx]))

                // Calculate Final Positions (With Live)
                const fullRanking: RankingItem[] = members.map(m => {
                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                    const userId = m.user_id
                    const totalWithLive = pointsMapLiveTotal.get(userId) || 0
                    return {
                        user_id: userId,
                        display_name: profile?.display_name || 'Usuário',
                        avatar_url: profile?.avatar_url,
                        total_points: totalWithLive,
                        live_points: livePointsOnlyMap.get(userId) || 0,
                        exact_scores: exactScoresMap.get(userId) || 0,
                        rank_variation: 0,
                        stats: statsMap.get(userId) || { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 }
                    }
                }).sort((a, b) => b.total_points - a.total_points || (b.exact_scores || 0) - (a.exact_scores || 0))

                // Add rank variation and Estimated Prize
                // Note: Distribution depends on rank, so we calculate after sorting
                let prizeDistribution: Record<number, number> = {}
                if (financials) {
                    const { FinancialService } = require('@/lib/financial-service')
                    prizeDistribution = FinancialService.calculateDistribution(
                        financials.payment_method === 'ONLINE' ? financials.net_pot : financials.total_pot,
                        groupData?.prize_distribution_strategy
                    )
                }

                fullRanking.forEach((user, currentIdx) => {
                    const initialIdx = initialPosMap.get(user.user_id) ?? currentIdx
                    user.rank_variation = initialIdx - currentIdx
                    // Assign Prize if available for this rank (1-indexed)
                    user.estimated_prize = prizeDistribution[currentIdx + 1] || 0
                })

                setTopRanking(fullRanking)

                // Bet Counts for Upcoming
                const counts: Record<string, number> = {}
                upcoming?.forEach(m => {
                    counts[m.id] = allBets?.filter(b => b.match_id === m.id).length || 0
                })
                setBetCounts(counts)
            }

            // Fetch specific user bets for display
            const matchIds = [
                ...(upcoming || []).map(m => m.id),
                ...(live || []).map(m => m.id),
                ...(recent || []).map(m => m.id)
            ]
            if (matchIds.length > 0) {
                const { data: userBets } = await supabase
                    .from('bets')
                    .select('match_id, home_score_bet, away_score_bet, points')
                    .eq('group_id', groupId)
                    .eq('user_id', userId)
                    .in('match_id', matchIds)

                const betsMap = new Map(userBets?.map(b => [b.match_id, b]) || [])

                if (upcoming) {
                    setUpcomingMatches(upcoming.map(m => ({ ...m, user_bet: betsMap.get(m.id) })) as any)
                }
                if (live) {
                    setLiveMatches(live.map(m => ({ ...m, user_bet: betsMap.get(m.id) })) as any)
                }
                if (recent) {
                    setRecentMatches(recent.map(m => ({ ...m, user_bet: betsMap.get(m.id) })) as any)
                }
            } else {
                if (upcoming) setUpcomingMatches(upcoming as any)
                if (live) setLiveMatches(live as any)
                if (recent) setRecentMatches(recent as any)
            }

            setLastUpdated(new Date())

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error)
            setErrorState(t('errorLoadingDashboard'))
        } finally {
            if (!silent) setLoading(false)
            else {
                setTimeout(() => setIsRefreshing(false), 500)
            }
        }
    }


    const handlePayMock = async () => {
        setLoading(true)
        try {
            // 1. Create Transaction (Mocking successful payment)
            await supabase.from('transactions').insert({
                group_id: groupId,
                user_id: userId,
                type: 'ENTRY_FEE',
                amount: financials?.entry_fee || 0,
                status: 'COMPLETED'
            })

            // 2. Update Member Status
            await supabase
                .from('group_members')
                .update({ payment_status: 'PAID', paid_at: new Date().toISOString() })
                .eq('group_id', groupId)
                .eq('user_id', userId)

            alert(t('paymentConfirmed'))
            fetchDashboardData()
        } catch (error) {
            console.error('Error in mock payment:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleViewBets = async (matchId: string, matchDate: string) => {
        // Validate visibility using Security Service
        // Lazy load or use helper if imported. Assuming I will add import in next step or use direct logic now to avoid complexity of multiple edits.
        // Actually, let's just implement the logic directly using the Service if I can import it. 
        // Since I cannot see top of file cheaply to check if I can add import there easily without offset shifts...
        // I will use direct logic for now matching the service: 5 min before match.
        // Wait, the service says "Opponent bets visible only AFTER match start".
        // Service: `isBetVisible` -> return now >= matchDate
        // So `!isBetVisible` -> now < matchDate.

        // Let's stick to the previous hardcoded logic `new Date(matchDate) > new Date()` which effectively means "Future matches are hidden".
        // The user requirement says "opponent bets hidden until match start".
        // So `new Date() < new Date(matchDate)` is correct.
        // The service might have `isBetVisible` logic.
        // Let's try to import it to be consistent.
        const { BetSecurityService } = await import('@/lib/bet-security') // Dynamic import to avoid top-level issues with existing imports

        if (!BetSecurityService.isBetVisible(matchDate, false)) {
            alert(t('betsVisibleAfterStart'))
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
            }, 1000) // Reduced from 3000ms to 1000ms for faster response while typing
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
            }
        } catch (error) {
            console.error(error)
        }
    }

    const getTeam = (team: any) => Array.isArray(team) ? team[0] : team

    if (isMember === false) return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-full mb-6 text-green-600 dark:text-green-400">
                <Lock className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">{t('notInGroupTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                {t('notInGroupDesc')}
            </p>
            <Link
                href={`/groups/join?code=${groupData?.invite_code || ''}`}
                className="bg-green-600 hover:bg-green-700 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-green-200 dark:shadow-none transition-all hover:scale-105 active:scale-95"
            >
                {t('joinNow')}
            </Link>
        </div>
    )

    if (errorState) return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-900/20 shadow-sm">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{errorState}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
                {t('loadErrorDesc')}
            </p>
            <button
                onClick={() => fetchDashboardData()}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2 rounded-xl font-bold transition-all"
            >
                <RefreshCw className="w-4 h-4" />
                {t('tryAgain')}
            </button>
        </div>
    )

    if (loading) return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        </div>
    )

    return (
        <>

            {/* Jogos ao Vivo - Unificado */}
            {liveMatches.length > 0 && (
                <div className="mb-6 bg-white dark:bg-slate-800 border-2 border-red-500 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 pb-4 border-b border-red-100 dark:border-red-900/20">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                            <h3 className="font-bold text-lg uppercase tracking-tight">{t('liveMatches')}</h3>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg border border-red-50/50 dark:border-red-900/10">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-2">
                                {format(lastUpdated, "HH:mm:ss", { locale: dateLocale })}
                            </p>
                            <button
                                onClick={() => setIsRealtimeEnabled(!isRealtimeEnabled)}
                                className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${isRealtimeEnabled
                                    ? 'bg-green-500 text-white shadow-lg shadow-green-200 dark:shadow-none'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${isRealtimeEnabled ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                                {t('realTime')}: {isRealtimeEnabled ? t('realTimeOn') : t('realTimeOff')}
                            </button>

                            <button
                                onClick={() => fetchDashboardData(true)}
                                disabled={isRefreshing}
                                className="flex items-center justify-center p-1.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                title={t('viewFolksBetsTitle')}
                            >
                                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-green-500' : ''}`} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveMatches.map(match => {
                            const home = getTeam(match.home_team)
                            const away = getTeam(match.away_team)
                            const bet = match.user_bet
                            const livePoints = bet ? calculateLivePoints(bet.home_score_bet, bet.away_score_bet, match.home_score || 0, match.away_score || 0) : 0

                            return (
                                <div key={match.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-red-100 dark:border-red-900/20 flex items-center justify-between gap-3">
                                    <div className="flex flex-col items-center justify-center min-w-[50px] border-r border-red-100 dark:border-red-900/20 pr-3 my-1">
                                        <span className="text-[10px] text-red-500 font-extrabold leading-tight animate-pulse">LIVE</span>
                                        <span className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                                            {match.home_score ?? 0}:{match.away_score ?? 0}
                                        </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1 mb-2">
                                            <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
                                                <TeamName
                                                    team={home}
                                                    variant="auto"
                                                    className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 justify-end"
                                                />
                                                <img src={home.logo_url} className="w-4 h-4 sm:w-6 sm:h-6 object-contain shrink-0" />
                                            </div>
                                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-300 uppercase shrink-0">vs</span>
                                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                                <img src={away.logo_url} className="w-4 h-4 sm:w-6 sm:h-6 object-contain shrink-0" />
                                                <TeamName
                                                    team={away}
                                                    variant="auto"
                                                    className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 justify-start"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center gap-4 bg-white/60 dark:bg-black/20 rounded py-1 border border-slate-100 dark:border-slate-800">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[8px] text-slate-400 uppercase font-bold">{t('myBet')}</span>
                                                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                                                    {bet ? `${bet.home_score_bet} x ${bet.away_score_bet}` : '- x -'}
                                                </span>
                                            </div>
                                            <div className="w-px h-6 bg-slate-100 dark:bg-slate-800" />
                                            <div className="flex flex-col items-center">
                                                <span className="text-[8px] text-slate-400 uppercase font-bold">{t('points')}</span>
                                                <span className={`text-xs font-black ${livePoints > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                                    +{livePoints}
                                                </span>
                                            </div>
                                            {match.venue && (
                                                <>
                                                    <div className="w-px h-6 bg-slate-100 dark:bg-slate-800" />
                                                    <div className="flex flex-col items-start max-w-[100px]">
                                                        <span className="text-[8px] text-slate-400 uppercase font-bold">{t('stadium')}</span>
                                                        <span className="text-[9px] font-medium text-slate-500 truncate w-full">
                                                            {match.venue}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleViewBets(match.id, match.match_date)}
                                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-200 dark:shadow-none transition-all hover:scale-105 shrink-0"
                                        title={t('viewFolksBetsTitle')}
                                    >
                                        <Eye className="h-5 w-5" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Payment Warning Banner */}
            {financials && financials.is_paid && userPaymentStatus === 'PENDING' && (
                <div className="mb-6 p-4 rounded-xl border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full">
                            <DollarSign className="w-5 h-5 text-yellow-700 dark:text-yellow-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-yellow-900 dark:text-yellow-200 text-sm">{t('pendingPayment')}</h4>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 leading-tight">
                                {financials.payment_method === 'ONLINE'
                                    ? t('payEntryOnline', { amount: `R$ ${financials.entry_fee.toFixed(2)}` })
                                    : t('payEntryOffline', { amount: `R$ ${financials.entry_fee.toFixed(2)}` })}
                            </p>
                        </div>
                    </div>
                    {financials.payment_method === 'ONLINE' && (
                        <button
                            onClick={handlePayMock}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                        >
                            {t('payNow')} (BETA)
                        </button>
                    )}
                </div>
            )}





            {isFinished && (
                <div className="mb-6 p-6 rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-900/10 flex flex-col items-center text-center gap-2 animate-in bounce-in">
                    <Trophy className="w-12 h-12 text-yellow-500 mb-2" />
                    <h3 className="text-2xl font-black text-green-900 dark:text-green-200">{t('groupFinishedTitle')}</h3>
                    <p className="text-sm text-green-700 dark:text-green-400">
                        {t('groupFinishedDesc')}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[35%_65%] gap-6 font-sans text-slate-800 dark:text-slate-100 items-stretch">

                {/* Col 1: Ranking Resumido */}
                <div className="bg-[#FDFDF7] dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-3 shadow-sm flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-2 text-[#15803d] dark:text-green-400">
                        <Trophy className="h-5 w-5" />
                        <h3 className="font-bold text-lg">{t('rankingSummary')}</h3>
                    </div>

                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2 flex-1 flex flex-col">
                        {topRanking.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 text-sm my-auto">
                                {t('noBetsMade')}
                            </p>
                        ) : (
                            <div className="space-y-1 w-full">
                                {(() => {
                                    const userIndex = topRanking.findIndex(r => r.user_id === userId)
                                    const showLimit = 12
                                    const itemsToDisplay = topRanking.slice(0, showLimit)

                                    // If current user is not in top 5, append them
                                    if (userIndex >= showLimit) {
                                        itemsToDisplay.push(topRanking[userIndex])
                                    }

                                    return itemsToDisplay.map((user) => {
                                        const globalIdx = topRanking.findIndex(r => r.user_id === user.user_id)
                                        const isCurrentUser = user.user_id === userId

                                        return (
                                            <div key={user.user_id} className={`flex items-center justify-between border-b border-green-50 dark:border-slate-700 py-1 last:border-0 last:pb-0 ${isCurrentUser ? 'bg-green-50/50 dark:bg-green-900/10 -mx-1 px-1 rounded-md' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className={`
                                                              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                                                              ${globalIdx === 0 ? 'bg-yellow-400' : globalIdx === 1 ? 'bg-gray-400' : globalIdx === 2 ? 'bg-orange-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}
                                                          `}>
                                                            {globalIdx + 1}
                                                        </div>
                                                        {user.rank_variation !== 0 && (
                                                            <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] border border-white dark:border-slate-800 ${user.rank_variation! > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                                                {user.rank_variation! > 0 ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={`text-sm truncate max-w-[120px] ${isCurrentUser ? 'font-bold text-green-700 dark:text-green-400' : 'font-medium dark:text-slate-200'}`}>
                                                        {user.display_name} {isCurrentUser && `(${t('you')})`}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <div className="group relative">
                                                        <div className="flex flex-col items-end cursor-help">
                                                            <div className="flex items-center gap-1">
                                                                <span className={`font-bold text-sm ${isCurrentUser ? 'text-green-800 dark:text-green-300' : 'text-green-700 dark:text-green-400'}`}>
                                                                    {user.total_points} pts
                                                                </span>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
                                                                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                                                                </svg>
                                                            </div>
                                                            {user.live_points! > 0 && (
                                                                <span className="text-[10px] text-red-500 font-bold leading-none animate-pulse">
                                                                    (+{user.live_points}) live
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Tooltip for stats breakdown */}
                                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-100 dark:border-slate-700 p-3 z-50 invisible group-hover:visible transition-all opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-2 border-b border-gray-50 dark:border-slate-700/50 pb-1 text-center">{t('pointsDistribution')}</div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                                        <span>🎯</span>
                                                                        <span>{t('exactScores_label')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] text-slate-400 font-medium">x{user.stats.exact}</span>
                                                                        <span className="inline-flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded px-1 py-0.5 text-[10px] font-bold min-w-[30px]">
                                                                            {user.stats.exact * 10}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                                        <span>📊</span>
                                                                        <span>{t('winnerPlusDiff_label')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] text-slate-400 font-medium">x{user.stats.winnerDiff}</span>
                                                                        <span className="inline-flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded px-1 py-0.5 text-[10px] font-bold min-w-[30px]">
                                                                            {user.stats.winnerDiff * 7}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                                        <span className="text-green-500 font-bold">✓</span>
                                                                        <span>{t('winner_label')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] text-slate-400 font-medium">x{user.stats.winner}</span>
                                                                        <span className="inline-flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded px-1 py-0.5 text-[10px] font-bold min-w-[30px]">
                                                                            {user.stats.winner * 5}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                                        <span className="text-slate-400 font-bold">~</span>
                                                                        <span>{t('oneScore_label')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] text-slate-400 font-medium">x{user.stats.consolation}</span>
                                                                        <span className="inline-flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded px-1 py-0.5 text-[10px] font-bold min-w-[30px]">
                                                                            {user.stats.consolation * 2}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Col 2: Jogos (Unificado) */}
                <div className="space-y-6">
                    {/* Próximos Jogos */}
                    <div className="bg-[#FDFDF7] dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-[#15803d] dark:text-green-400">
                            <Gamepad2 className="h-5 w-5" />
                            <h3 className="font-bold text-lg">{t('upcomingMatches')}</h3>
                        </div>

                        {upcomingMatches.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-8">
                                {t('noUpcomingMatches')}
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {upcomingMatches.map(match => {
                                    const home = getTeam(match.home_team)
                                    const away = getTeam(match.away_team)
                                    const hasBet = !!match.user_bet
                                    const inlineBet = inlineBets[match.id]
                                    const isEditing = !!inlineBet
                                    const betCount = betCounts[match.id] || 0
                                    const matchDate = new Date(match.match_date)

                                    return (
                                        <div key={match.id} className="bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm overflow-hidden flex flex-col h-fit">
                                            {/* Parte Superior: Aposta */}
                                            <div className="p-2 flex items-center gap-3">
                                                <div className="flex flex-col items-center justify-center min-w-[45px] border-r border-slate-100 dark:border-slate-600 pr-3">
                                                    <span className="text-[10px] text-slate-400 font-bold leading-tight">{format(matchDate, isEnglish ? "MM/dd" : "dd/MM", { locale: dateLocale })}</span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-300 font-black leading-tight">{format(matchDate, isEnglish ? "hh:mm a" : "HH:mm", { locale: dateLocale })}</span>
                                                </div>

                                                <div className="flex items-center justify-between gap-0.5 sm:gap-1 flex-1 min-w-0">
                                                    {/* Home Team */}
                                                    <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
                                                        <TeamName
                                                            team={home}
                                                            variant="auto"
                                                            className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 justify-end flex-1 min-w-0"
                                                        />
                                                        <img src={home.logo_url} alt={home.short_name} className="w-4 h-4 sm:w-6 sm:h-6 object-contain shrink-0" />
                                                    </div>

                                                    {/* Score Inputs / Box */}
                                                    <div
                                                        onClick={() => !isEditing && setInlineBets(prev => ({ ...prev, [match.id]: { home: String(match.user_bet?.home_score_bet ?? ''), away: String(match.user_bet?.away_score_bet ?? '') } }))}
                                                        className={`px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center gap-0.5 sm:gap-1.5 shrink-0 min-w-[55px] sm:min-w-[70px] justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors border-2 ${isEditing ? 'border-green-500' : 'border-transparent'}`}
                                                    >
                                                        {isEditing ? (
                                                            <>
                                                                <input
                                                                    type="tel"
                                                                    inputMode="numeric"
                                                                    className="w-5 h-6 sm:w-6 sm:h-7 text-center text-xs sm:text-sm font-black border-0 bg-white dark:bg-slate-700 dark:text-white p-0 rounded-sm focus:ring-0"
                                                                    value={inlineBet.home}
                                                                    onChange={(e) => handleInlineBetChange(match.id, 'home', e.target.value)}
                                                                    onFocus={(e) => {
                                                                        handleInlineFocus(match.id, 'home')
                                                                        e.target.select()
                                                                    }}
                                                                    onBlur={() => {
                                                                        if (activeMatchId === match.id) handleSaveInlineBet(match.id)
                                                                    }}
                                                                    autoFocus
                                                                    placeholder="-"
                                                                />
                                                                <span className="text-[10px] sm:text-xs text-slate-400">×</span>
                                                                <input
                                                                    type="tel"
                                                                    inputMode="numeric"
                                                                    className="w-5 h-6 sm:w-6 sm:h-7 text-center text-xs sm:text-sm font-black border-0 bg-white dark:bg-slate-700 dark:text-white p-0 rounded-sm focus:ring-0"
                                                                    value={inlineBet.away}
                                                                    onChange={(e) => handleInlineBetChange(match.id, 'away', e.target.value)}
                                                                    onFocus={(e) => {
                                                                        handleInlineFocus(match.id, 'away')
                                                                        e.target.select()
                                                                    }}
                                                                    onBlur={() => {
                                                                        if (activeMatchId === match.id) handleSaveInlineBet(match.id)
                                                                    }}
                                                                    placeholder="-"
                                                                />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className={`text-xs sm:text-sm font-black ${hasBet ? 'text-green-700 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                    {hasBet ? match.user_bet?.home_score_bet : '-'}
                                                                </span>
                                                                <span className="text-[8px] sm:text-[10px] text-slate-300">×</span>
                                                                <span className={`text-xs sm:text-sm font-black ${hasBet ? 'text-green-700 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                    {hasBet ? match.user_bet?.away_score_bet : '-'}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Away Team */}
                                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                                        <img src={away.logo_url} alt={away.short_name} className="w-4 h-4 sm:w-6 sm:h-6 object-contain shrink-0" />
                                                        <TeamName
                                                            team={away}
                                                            variant="auto"
                                                            className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 justify-start flex-1 min-w-0"
                                                        />
                                                    </div>

                                                </div>
                                            </div>

                                            {/* Parte Inferior: Grupo & Estadio */}
                                            <div className="px-3 py-1 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-600/50 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {match.venue && (
                                                        <>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight shrink-0">🏟️ {t('stadium')}:</span>
                                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{match.venue}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {betCount} {betCount === 1 ? t('bet') : t('bets_plural')}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Últimos Jogos */}
                    <div className="bg-[#FDFDF7] dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-[#15803d] dark:text-green-400">
                            <CheckCircle2 className="h-5 w-5" />
                            <h3 className="font-bold text-lg">{t('recentMatches')}</h3>
                        </div>

                        {recentMatches.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-8">
                                {t('noRecentFinish')}
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {recentMatches.map(match => {
                                    const home = getTeam(match.home_team)
                                    const away = getTeam(match.away_team)
                                    const bet = match.user_bet
                                    const matchDate = new Date(match.match_date)

                                    return (
                                        <div key={match.id} className="bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm overflow-hidden flex flex-col h-fit">
                                            {/* Parte Superior: Minha Aposta */}
                                            <div className="p-2 flex items-center gap-3">
                                                <div className="flex flex-col items-center justify-center min-w-[45px] border-r border-slate-100 dark:border-slate-600 pr-3">
                                                    <span className="text-[10px] text-slate-400 font-bold leading-tight">{format(matchDate, isEnglish ? "MM/dd" : "dd/MM", { locale: dateLocale })}</span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-300 font-black leading-tight">{format(matchDate, isEnglish ? "hh:mm a" : "HH:mm", { locale: dateLocale })}</span>
                                                </div>

                                                <div className="flex items-center justify-between gap-1 flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                                                        <TeamName
                                                            team={home}
                                                            variant="auto"
                                                            className="text-xs font-bold text-slate-700 dark:text-slate-300 justify-end flex-1 min-w-0"
                                                        />
                                                        <img src={home.logo_url} className="w-6 h-6 object-contain shrink-0" />
                                                    </div>

                                                    <div className="px-2 py-1 bg-green-50/50 dark:bg-green-900/10 rounded-lg flex items-center gap-1.5 shrink-0 min-w-[70px] justify-center border border-green-100/50 dark:border-green-900/30">
                                                        <span className="text-sm font-black text-green-700 dark:text-green-400">{bet ? bet.home_score_bet : '-'}</span>
                                                        <span className="text-[10px] text-slate-300">x</span>
                                                        <span className="text-sm font-black text-green-700 dark:text-green-400">{bet ? bet.away_score_bet : '-'}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <img src={away.logo_url} className="w-6 h-6 object-contain shrink-0" />
                                                        <TeamName
                                                            team={away}
                                                            variant="auto"
                                                            className="text-xs font-bold text-slate-700 dark:text-slate-300 justify-start flex-1 min-w-0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Parte Inferior: Placar Real + Pontos + Apostas */}
                                            <div className="px-3 py-1 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-600/50 flex items-center justify-between">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-tighter">{t('realScore')}:</span>
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{match.home_score} x {match.away_score}</span>
                                                    </div>
                                                    {match.venue && (
                                                        <div className="flex items-center gap-1 opacity-60">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{t('stadium')}:</span>
                                                            <span className="text-[8px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{match.venue}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {bet?.points !== undefined && (
                                                    <div className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${bet.points > 0 ? 'bg-green-500 text-white shadow-sm shadow-green-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                        +{bet.points} {t('points_short') || 'PTS'}
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => handleViewBets(match.id, match.match_date)}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                                    title={t('viewFolksBetsTitle')}
                                                >
                                                    <Users className="w-3.5 h-3.5" />
                                                    <span>{t('folks')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div >

            {/* Bets Modal */}
            {
                betsModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBetsModal(null)}>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('folksBetsTitle')}</h3>
                                <button onClick={() => setBetsModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {betsModal.bets.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">{t('noFolksBets')}</p>
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
                )
            }
        </>
    )
}
