'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy, Gamepad2, Eye, Lock, CheckCircle2, MoreHorizontal, X, ArrowUp, ArrowDown, Minus, Info, Search, Filter, ChevronDown, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BetSecurityService } from '@/lib/bet-security'
import { TeamName } from '@/components/ui/TeamName'

interface MatchListProps {
    matches: any[]
    groupId: string
    userId: string
}

interface BetState {
    [matchId: string]: {
        home: number | string
        away: number | string
        points?: number | null
        isDirty?: boolean
    }
}

function getPointsExplanation(betHome: number, betAway: number, realHome: number, realAway: number, points: number) {
    if (points === 10) return "Placar Exato (Cravada)"
    if (points === 7) return "Vencedor + Diferença de Gols"
    if (points === 5) return "Só Vencedor"
    if (points === 2) return "Um Placar Correto"
    return "Nenhum acerto"
}

export function MatchList({ matches, groupId, userId }: MatchListProps) {
    const [bets, setBets] = useState<BetState>({})
    const [initialBetsLoaded, setInitialBetsLoaded] = useState(false)
    const [hoveredPoints, setHoveredPoints] = useState<string | null>(null)
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
    const [savingMap, setSavingMap] = useState<Record<string, 'saving' | 'saved'>>({})

    const getTeam = (team: any) => Array.isArray(team) ? team[0] : team

    const searchParams = useSearchParams()
    const router = useRouter()

    const filterFromUrl = searchParams.get('filter') as any
    const validFilters = ['all', 'pending', 'completed', 'missed']
    const initialFilter = validFilters.includes(filterFromUrl) ? filterFromUrl : 'all'

    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'missed'>(initialFilter)
    const [roundFilter, setRoundFilter] = useState<string>('all')
    const [groupFilter, setGroupFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    // Sync filter from URL
    useEffect(() => {
        if (filterFromUrl && validFilters.includes(filterFromUrl) && filterFromUrl !== statusFilter) {
            setStatusFilter(filterFromUrl)
        }
    }, [filterFromUrl])

    const handleFilterChange = (f: typeof statusFilter) => {
        setStatusFilter(f)
        const params = new URLSearchParams(searchParams.toString())
        params.set('filter', f)
        router.replace(`?${params.toString()}`, { scroll: false })
    }

    const supabase = createClient()

    useEffect(() => {
        const fetchBets = async () => {
            if (!userId) {
                setInitialBetsLoaded(true)
                return
            }
            try {
                const { data, error } = await supabase
                    .from('bets')
                    .select('match_id, home_score_bet, away_score_bet, points')
                    .eq('group_id', groupId)
                    .eq('user_id', userId)

                if (error) throw error

                const betsMap: BetState = {}
                data?.forEach(bet => {
                    betsMap[bet.match_id] = {
                        home: bet.home_score_bet,
                        away: bet.away_score_bet,
                        points: bet.points,
                        isDirty: false
                    }
                })
                setBets(betsMap)
            } catch (err) {
                console.error('Error fetching bets:', err)
            } finally {
                setInitialBetsLoaded(true)
            }
        }
        fetchBets()
    }, [groupId, userId, supabase])

    const handleScoreChange = (matchId: string, type: 'home' | 'away', value: string) => {
        let finalValue = value
        if (value !== '' && parseInt(value) < 0) finalValue = '0'
        setBets(prev => ({
            ...prev,
            [matchId]: { ...prev[matchId] || { home: '', away: '' }, [type]: finalValue, isDirty: true }
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

    const handleFocus = (matchId: string, type: 'home' | 'away') => {
        if (activeMatchId && activeMatchId !== matchId) {
            saveOneBet(activeMatchId)
        }
        setActiveMatchId(matchId)
    }

    const saveOneBet = async (matchId: string) => {
        const bet = bets[matchId]
        if (!bet || !bet.isDirty || bet.home === '' || bet.away === '') return

        setSavingMap(prev => ({ ...prev, [matchId]: 'saving' }))

        try {
            const { error } = await supabase.from('bets').upsert({
                user_id: userId,
                group_id: groupId,
                match_id: matchId,
                home_score_bet: Number(bet.home),
                away_score_bet: Number(bet.away),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,group_id,match_id' })

            if (!error) {
                setBets(prev => ({
                    ...prev,
                    [matchId]: { ...prev[matchId], isDirty: false }
                }))
                setSavingMap(prev => ({ ...prev, [matchId]: 'saved' }))

                // Keep "Salvo!" for 3 seconds before clearing
                setTimeout(() => {
                    setSavingMap(prev => {
                        const next = { ...prev }
                        if (next[matchId] === 'saved') delete next[matchId]
                        return next
                    })
                }, 3000)
            }
        } catch (error) {
            console.error('Error saving bet:', error)
        }
    }

    // Debounce save when both fields are filled
    useEffect(() => {
        if (!activeMatchId) return
        const bet = bets[activeMatchId]
        if (bet?.isDirty && bet.home !== '' && bet.away !== '') {
            const timer = setTimeout(() => {
                saveOneBet(activeMatchId)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [bets, activeMatchId])




    const getDirtyBetsCount = () => Object.values(bets).filter(b => b.isDirty && b.home !== '' && b.away !== '').length

    const rounds = useMemo(() => {
        const uniqueRounds = Array.from(new Set(matches?.map(m => m.round).filter(Boolean)))
        return (uniqueRounds as string[]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    }, [matches])

    const matchGroups = useMemo(() => {
        const uniqueGroups = Array.from(new Set(matches?.map(m => m.group_name).filter(Boolean)))
        return uniqueGroups.sort()
    }, [matches])

    const filteredMatches = useMemo(() => {
        if (!matches) return []
        const now = new Date()

        return matches.filter(match => {
            const bet = bets[match.id]
            const isLocked = BetSecurityService.isBettingLocked(match.match_date)
            const isExpired = isLocked || new Date(match.match_date) < now

            // hasStoredBet: Ja foi salvo no banco (nao esta sujo)
            const hasStoredBet = bet && bet.home !== '' && bet.away !== '' && !bet.isDirty
            // hasEntry: Tem algum valor digitado (salvo ou nao)
            const hasEntry = bet && bet.home !== '' && bet.away !== ''

            // Lógica de Filtros de Status
            if (statusFilter === 'pending') {
                // Pendentes: Apenas jogos futuros que ainda NÃO foram salvos
                if (hasStoredBet || isExpired) return false
            } else if (statusFilter === 'completed') {
                // Feitas: Qualquer jogo que tenha algum palpite (salvo ou em edição)
                if (!hasEntry) return false
            } else if (statusFilter === 'missed') {
                // Esquecidas: Jogos que já passaram/fecharam e NÃO têm palpite
                if (!isExpired || hasEntry) return false
            }

            // Filtros Auxiliares
            const homeTeam = getTeam(match.home_team)
            const awayTeam = getTeam(match.away_team)

            if (roundFilter !== 'all' && match.round !== roundFilter) return false
            if (groupFilter !== 'all' && match.group_name !== groupFilter) return false

            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                if (!homeTeam.name?.toLowerCase().includes(query) && !homeTeam.short_name?.toLowerCase().includes(query) &&
                    !awayTeam.name?.toLowerCase().includes(query) && !awayTeam.short_name?.toLowerCase().includes(query)) return false
            }
            return true
        })
    }, [matches, bets, statusFilter, roundFilter, groupFilter, searchQuery])

    // Unified save handled by individual match focus logic
    const handleSaveAll = async () => { }

    if (!initialBetsLoaded) return <div className="text-center py-8 text-slate-500 dark:text-slate-400">Carregando apostas...</div>

    const dirtyCount = getDirtyBetsCount()

    return (
        <>
            {/* Filter Toolbar */}
            <div className="mb-2 sm:mb-4 space-y-2 sm:space-y-3">
                {/* Filter Toolbar - Mobile Compact */}
                <div className="mb-2 sm:mb-4 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar time..."
                                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-green-500 dark:text-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-3.5 w-3.5" /></button>}
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border shrink-0 ${showFilters ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex bg-slate-50 dark:bg-slate-800/30 p-0.5 rounded-lg border border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-hide">
                        <div className="flex gap-0.5 min-w-full sm:min-w-0">
                            {['all', 'pending', 'completed', 'missed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => handleFilterChange(f as any)}
                                    className={cn(
                                        "px-2.5 py-1 text-[10px] font-bold rounded-md whitespace-nowrap transition-all flex-1 sm:flex-none uppercase tracking-tight",
                                        statusFilter === f
                                            ? "bg-white dark:bg-slate-700 shadow-sm text-green-700 dark:text-green-400"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    )}
                                >
                                    {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'completed' ? 'Feitas' : 'Esquecidas'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {showFilters && (
                        <div className="flex flex-wrap gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                            {rounds.length > 0 && (
                                <select className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 dark:text-white" value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)}>
                                    <option value="all">Todas Rodadas</option>
                                    {rounds.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            )}
                            {matchGroups.length > 0 && (
                                <select className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 dark:text-white" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                                    <option value="all">Todos Grupos</option>
                                    {matchGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            )}
                            <button onClick={() => { setRoundFilter('all'); setGroupFilter('all'); setStatusFilter('all'); setSearchQuery('') }} className="text-xs text-slate-400 hover:text-red-500 underline">Limpar</button>
                        </div>
                    )}
                </div>

                {/* Matches List */}
                <div className="space-y-2 pb-20">
                    {filteredMatches?.map((match: any) => {
                        const locked = BetSecurityService.isBettingLocked(match.match_date)
                        const bet = bets[match.id]
                        const hasExistingBet = bet && bet.home !== '' && bet.away !== '' && !bet.isDirty
                        const homeTeam = getTeam(match.home_team)
                        const awayTeam = getTeam(match.away_team)
                        const hasRealScore = match.home_score !== null && match.away_score !== null
                        const hasPoints = bet && bet.points !== undefined && bet.points !== null

                        return (
                            <div key={match.id} className={cn(
                                "border rounded-xl p-2.5 sm:p-0 flex flex-col items-stretch relative transition-colors bg-white dark:bg-slate-800",
                                locked ? "bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800" : "hover:border-green-500/50 border-slate-200 dark:border-slate-700",
                                hasExistingBet ? "border-l-4 border-l-green-500 shadow-sm" : ""
                            )}>

                                {/* Mobile Top Info Row */}
                                <div className="flex justify-between items-center mb-2 sm:hidden">
                                    <span className="text-[10px] font-medium text-slate-400">
                                        {format(new Date(match.match_date), 'dd/MM HH:mm', { locale: ptBR })}
                                        {match.round && <span className="ml-1 opacity-60">• {match.round.replace('Rodada', 'R')}</span>}
                                    </span>
                                    {locked && <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded leading-none">🔒 FECHADO</span>}
                                </div>

                                {/* Desktop Info (Absolute) */}
                                <div className="hidden sm:flex absolute right-4 top-4 flex-col items-end gap-0.5 pointer-events-none">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-tighter leading-none mb-1">
                                        {match.round}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                            {format(new Date(match.match_date), 'dd/MM - HH:mm', { locale: ptBR })}
                                        </div>
                                        {locked && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-1 py-0.5 rounded border border-red-100 dark:border-red-500/20 leading-none">🔒</span>}
                                    </div>
                                    {match.venue && (
                                        <div className="text-[9px] text-slate-400 mt-0.5 italic flex items-center gap-1">
                                            <span>🏟️</span> {match.venue}
                                        </div>
                                    )}
                                </div>


                                {/* Center: Teams + Prediction Inputs */}
                                <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 sm:flex-1">
                                    {/* Home Team */}
                                    <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-2 text-right min-w-0">
                                        <TeamName
                                            team={homeTeam}
                                            variant="auto"
                                            className="font-bold text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 justify-end"
                                        />
                                        {homeTeam.logo_url && <img src={homeTeam.logo_url} className="w-5 h-5 sm:w-8 sm:h-8 object-contain shrink-0" alt="" />}
                                    </div>

                                    {/* Prediction Inputs - COMPACT */}
                                    <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            className={cn(
                                                "w-8 h-8 sm:w-11 sm:h-11 text-center text-sm sm:text-base font-bold border rounded-md sm:rounded-lg transition-all focus:ring-1 sm:focus:ring-2 focus:ring-green-500 p-0",
                                                bet?.isDirty ? "bg-yellow-50 border-yellow-300 text-yellow-900 shadow-sm" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                            )}
                                            value={bet?.home ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                                            onFocus={(e) => {
                                                handleFocus(match.id, 'home')
                                                e.target.select()
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    if (activeMatchId === match.id) saveOneBet(match.id)
                                                }, 200)
                                            }}
                                            disabled={locked}
                                            placeholder="-"
                                        />
                                        <span className="text-slate-300 dark:text-slate-600 font-black text-[10px] sm:text-xs">✕</span>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            className={cn(
                                                "w-8 h-8 sm:w-11 sm:h-11 text-center text-sm sm:text-base font-bold border rounded-md sm:rounded-lg transition-all focus:ring-1 sm:focus:ring-2 focus:ring-green-500 p-0",
                                                bet?.isDirty ? "bg-yellow-50 border-yellow-300 text-yellow-900 shadow-sm" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                            )}
                                            value={bet?.away ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                                            onFocus={(e) => {
                                                handleFocus(match.id, 'away')
                                                e.target.select()
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    if (activeMatchId === match.id) saveOneBet(match.id)
                                                }, 200)
                                            }}
                                            disabled={locked}
                                            placeholder="-"
                                        />
                                    </div>

                                    {/* Away Team */}
                                    <div className="flex-1 flex items-center justify-start gap-1.5 sm:gap-2 text-left min-w-0">
                                        {awayTeam.logo_url && <img src={awayTeam.logo_url} className="w-5 h-5 sm:w-8 sm:h-8 object-contain shrink-0" alt="" />}
                                        <TeamName
                                            team={awayTeam}
                                            variant="auto"
                                            className="font-bold text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 justify-start"
                                        />
                                    </div>
                                </div>


                                {/* Footer: Real Score & Points - Boxed Footer */}
                                {(hasRealScore || hasPoints || savingMap[match.id]) && (
                                    <div className="flex items-center justify-center gap-4 mt-2 px-3 py-1.5 sm:px-4 -mx-2.5 sm:mx-0 -mb-2.5 sm:mb-0 rounded-b-xl sm:rounded-none border-t border-slate-100 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700/50">
                                        {savingMap[match.id] && (
                                            <div className="flex items-center gap-1.5">
                                                {savingMap[match.id] === 'saving' ? (
                                                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                                                ) : (
                                                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest animate-in fade-in zoom-in duration-300">
                                                        ✓ Salvo!
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {hasRealScore && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placar Real</span>
                                                <span className="text-base font-black text-slate-700 dark:text-slate-200 tabular-nums">
                                                    {match.home_score} <span className="text-slate-300 mx-1">×</span> {match.away_score}
                                                </span>
                                            </div>
                                        )}

                                        {hasPoints && bet && (
                                            <>
                                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                                <div
                                                    className={cn(
                                                        "flex items-center gap-2 text-xs font-bold transition-all relative group cursor-help",
                                                        (bet.points ?? 0) > 0 ? "text-green-600 dark:text-green-400" : "text-slate-400"
                                                    )}
                                                    onMouseEnter={() => setHoveredPoints(match.id)}
                                                    onMouseLeave={() => setHoveredPoints(null)}
                                                >
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pontos:</span>
                                                    <span className="text-base font-black">{(bet.points ?? 0) > 0 ? '+' : ''}{bet?.points}</span>
                                                    <Info className="h-3 w-3 opacity-50" />

                                                    {hoveredPoints === match.id && (
                                                        <div className="absolute right-0 bottom-full mb-3 z-[9999] w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl p-3 text-xs pointer-events-none animate-in fade-in slide-in-from-bottom-2">
                                                            <div className="font-bold text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1.5">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                <span>+{bet.points} pontos ganhos</span>
                                                            </div>
                                                            <div className="text-slate-500 dark:text-slate-400 leading-snug">
                                                                {getPointsExplanation(Number(bet.home), Number(bet.away), match.home_score, match.away_score, bet.points!)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {(!matches || matches.length === 0) && <p className="text-center text-slate-500 py-8">Nenhum jogo encontrado.</p>}
                </div>

                {/* Floating Save Button */}
                {/* Floating Save Button Removed */}
            </div>
        </>
    )
}
