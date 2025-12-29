'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, Filter, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    if (points === 10) return "Placar exato (Cravada)"
    if (points === 7) return "Vencedor + diferença correta"
    if (points === 5) return "Vencedor correto"
    if (points === 2) return "Um placar certo"
    return "Nenhum acerto"
}

export function MatchList({ matches, groupId, userId }: MatchListProps) {
    const [bets, setBets] = useState<BetState>({})
    const [saving, setSaving] = useState(false)
    const [initialBetsLoaded, setInitialBetsLoaded] = useState(false)
    const [hoveredPoints, setHoveredPoints] = useState<string | null>(null)

    const getTeam = (team: any) => Array.isArray(team) ? team[0] : team

    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'missed'>('all')
    const [roundFilter, setRoundFilter] = useState<string>('all')
    const [groupFilter, setGroupFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        const fetchBets = async () => {
            if (!userId) return
            const { data } = await supabase
                .from('bets')
                .select('match_id, home_score_bet, away_score_bet, points')
                .eq('group_id', groupId)
                .eq('user_id', userId)

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
            setInitialBetsLoaded(true)
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
    }

    const isMatchLocked = (matchDate: string) => {
        const date = new Date(matchDate)
        const now = new Date()
        return (date.getTime() - now.getTime()) < 5 * 60 * 1000
    }

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
            const isLocked = isMatchLocked(match.match_date)
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

    const handleSaveAll = async () => {
        setSaving(true)
        const dirtyBets = Object.entries(bets).filter(([_, bet]) => bet.isDirty && bet.home !== '' && bet.away !== '')
        if (dirtyBets.length === 0) { setSaving(false); return }

        const betsToUpsert = dirtyBets.map(([matchId, bet]) => ({
            user_id: userId, group_id: groupId, match_id: matchId,
            home_score_bet: Number(bet.home), away_score_bet: Number(bet.away),
            updated_at: new Date().toISOString()
        }))

        try {
            const { error } = await supabase.from('bets').upsert(betsToUpsert, { onConflict: 'user_id,group_id,match_id' })
            if (error) {
                alert('Erro ao salvar algumas apostas.')
            } else {
                setBets(prev => {
                    const next = { ...prev }
                    dirtyBets.forEach(([id]) => { if (next[id]) next[id].isDirty = false })
                    return next
                })
            }
        } catch (error) {
            alert('Erro inesperado ao salvar apostas.')
        } finally {
            setSaving(false)
        }
    }

    if (!initialBetsLoaded) return <div className="text-center py-8 text-slate-500 dark:text-slate-400">Carregando apostas...</div>

    const dirtyCount = getDirtyBetsCount()

    return (
        <>
            {/* Filter Toolbar */}
            <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input type="text" placeholder="Buscar time..." className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-green-500 dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-4 w-4" /></button>}
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
                        {['all', 'pending', 'completed', 'missed'].map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f as any)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all",
                                    statusFilter === f
                                        ? "bg-white dark:bg-slate-700 shadow-sm text-green-700 dark:text-green-400"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'completed' ? 'Feitas' : 'Esquecidas'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border ${showFilters ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-500'}`}><Filter className="h-5 w-5" /></button>
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
                    const locked = isMatchLocked(match.match_date)
                    const bet = bets[match.id]
                    const hasExistingBet = bet && bet.home !== '' && bet.away !== '' && !bet.isDirty
                    const homeTeam = getTeam(match.home_team)
                    const awayTeam = getTeam(match.away_team)
                    const hasRealScore = match.home_score !== null && match.away_score !== null
                    const hasPoints = bet && bet.points !== undefined && bet.points !== null

                    return (
                        <div key={match.id} className={cn(
                            "border rounded-xl p-3 sm:p-0 sm:h-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-center relative transition-colors",
                            locked ? "bg-slate-50 dark:bg-slate-800/50 opacity-80" : "bg-white dark:bg-slate-800 hover:border-green-500/50",
                            hasExistingBet ? "border-l-4 border-l-green-500 shadow-sm" : "border-slate-200 dark:border-slate-700"
                        )}>

                            {/* Mobile Header / Desktop Info (will be absolute on desktop) */}
                            <div className="flex justify-between items-center sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 flex-row-reverse sm:flex-row gap-3">
                                {/* Date & Round */}
                                <div className="text-right text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                                    <div className="font-medium bg-slate-100 dark:bg-slate-700 sm:bg-transparent px-1.5 py-0.5 sm:p-0 rounded">
                                        {format(new Date(match.match_date), 'dd/MM HH:mm', { locale: ptBR })}
                                    </div>
                                    {match.round && <div className="hidden sm:block opacity-60 text-[10px]">{match.round}</div>}
                                </div>

                                {/* Status / Real Score / Points */}
                                <div className="flex items-center gap-2">
                                    {hasRealScore && (
                                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] bg-slate-100 dark:bg-slate-700 sm:bg-slate-100/50 px-2 py-0.5 rounded">
                                            <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase hidden sm:inline">Real:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                {match.home_score}-{match.away_score}
                                            </span>
                                        </div>
                                    )}

                                    {hasPoints && hasRealScore && (
                                        <div className="relative" onMouseEnter={() => setHoveredPoints(match.id)} onMouseLeave={() => setHoveredPoints(null)}>
                                            <div className={cn(
                                                "flex items-center gap-1 px-2 py-0.5 rounded-full cursor-help text-[10px] sm:text-xs font-bold transition-transform hover:scale-105",
                                                bet.points! > 0 ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                                            )}>
                                                <span className="hidden sm:inline">+{bet.points}pts</span>
                                                <span className="sm:hidden">{bet.points}</span>
                                                <Info className="h-3 w-3 opacity-50" />
                                            </div>
                                            {hoveredPoints === match.id && (
                                                <div className="absolute right-0 bottom-full mb-2 z-[9999] w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl rounded-lg p-3 text-xs">
                                                    <div className="font-bold text-green-700 dark:text-green-400 mb-1">+{bet.points} pontos</div>
                                                    <div className="text-slate-700 dark:text-slate-200 font-medium mb-2">{getPointsExplanation(Number(bet.home), Number(bet.away), match.home_score, match.away_score, bet.points!)}</div>
                                                    <div className="text-slate-500 dark:text-slate-400 space-y-1 border-t dark:border-slate-700 pt-2">
                                                        <div>Aposta: <span className="text-green-600 font-semibold">{bet.home}-{bet.away}</span></div>
                                                        <div>Resultado: <span className="text-slate-700 dark:text-slate-200 font-semibold">{match.home_score}-{match.away_score}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {locked && (
                                        <span className="flex items-center gap-1 text-red-500 font-bold uppercase tracking-wider text-[9px] sm:text-[10px] bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-500/20" title="Fechado para apostas">
                                            🔒 <span className="hidden sm:inline">Fechado</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Center: Teams + Prediction Inputs */}
                            <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 py-2 sm:py-0 sm:flex-1">
                                {/* Home Team */}
                                <div className="flex-1 flex items-center justify-end gap-2 text-right min-w-0">
                                    <span className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 truncate">{homeTeam.short_name}</span>
                                    {homeTeam.logo_url && <img src={homeTeam.logo_url} className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0" alt="" />}
                                </div>

                                {/* Prediction Inputs */}
                                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        className={cn(
                                            "w-9 h-9 sm:w-11 sm:h-11 text-center text-sm sm:text-base font-bold border rounded-lg transition-all focus:ring-2 focus:ring-green-500",
                                            bet?.isDirty ? "bg-yellow-50 border-yellow-300 text-yellow-900 shadow-sm scale-110 sm:scale-105" : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                                        )}
                                        value={bet?.home ?? ''}
                                        onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                                        disabled={locked}
                                        placeholder="-"
                                    />
                                    <span className="text-slate-300 dark:text-slate-600 font-black text-[10px] sm:text-xs">X</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        className={cn(
                                            "w-9 h-9 sm:w-11 sm:h-11 text-center text-sm sm:text-base font-bold border rounded-lg transition-all focus:ring-2 focus:ring-green-500",
                                            bet?.isDirty ? "bg-yellow-50 border-yellow-300 text-yellow-900 shadow-sm scale-110 sm:scale-105" : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                                        )}
                                        value={bet?.away ?? ''}
                                        onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                                        disabled={locked}
                                        placeholder="-"
                                    />
                                </div>

                                {/* Away Team */}
                                <div className="flex-1 flex items-center justify-start gap-2 text-left min-w-0">
                                    {awayTeam.logo_url && <img src={awayTeam.logo_url} className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0" alt="" />}
                                    <span className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 truncate">{awayTeam.short_name}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {(!matches || matches.length === 0) && <p className="text-center text-slate-500 py-8">Nenhum jogo encontrado.</p>}
            </div>

            {/* Floating Save Button */}
            {dirtyCount > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
                    <button onClick={handleSaveAll} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2">
                        {saving ? 'Salvando...' : `Salvar ${dirtyCount} Aposta(s) ✓`}
                    </button>
                </div>
            )}
        </>
    )
}
