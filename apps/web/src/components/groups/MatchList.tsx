'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, Filter, X, Info } from 'lucide-react'

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

    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
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
        return matches.filter(match => {
            const bet = bets[match.id]
            const hasExistingBet = bet && bet.home !== '' && bet.away !== '' && !bet.isDirty
            const homeTeam = getTeam(match.home_team)
            const awayTeam = getTeam(match.away_team)
            if (statusFilter === 'pending' && hasExistingBet) return false
            if (statusFilter === 'completed' && !hasExistingBet) return false
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
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        {['all', 'pending', 'completed'].map(f => (
                            <button key={f} onClick={() => setStatusFilter(f as any)} className={`px-3 py-1.5 text-xs font-bold rounded-md ${statusFilter === f ? 'bg-white dark:bg-slate-700 shadow-sm text-green-700 dark:text-green-400' : 'text-slate-500'}`}>
                                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Feitas'}
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
                        <div key={match.id} className={`border rounded-lg p-3 flex items-center justify-center relative transition-colors ${locked ? 'bg-gray-100 dark:bg-slate-800 opacity-75' : 'bg-white dark:bg-slate-800 hover:bg-gray-50'} ${hasExistingBet ? 'border-l-4 border-l-green-500' : 'border-slate-200 dark:border-slate-700'}`}>

                            {/* Center: Teams + Bet */}
                            <div className="flex items-center gap-2">
                                {homeTeam.logo_url && <img src={homeTeam.logo_url} className="w-6 h-6 object-contain" alt="" />}
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{homeTeam.short_name}</span>

                                <input type="number" inputMode="numeric" className={`w-10 h-10 text-center text-base font-bold border rounded-md focus:ring-2 focus:ring-green-500 ${bet?.isDirty ? 'bg-yellow-50 border-yellow-300 text-yellow-900' : 'bg-green-50 border-green-300 text-green-700'}`} value={bet?.home ?? ''} onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)} disabled={locked} min="0" placeholder="-" />
                                <span className="text-slate-400 font-bold text-sm">x</span>
                                <input type="number" inputMode="numeric" className={`w-10 h-10 text-center text-base font-bold border rounded-md focus:ring-2 focus:ring-green-500 ${bet?.isDirty ? 'bg-yellow-50 border-yellow-300 text-yellow-900' : 'bg-green-50 border-green-300 text-green-700'}`} value={bet?.away ?? ''} onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)} disabled={locked} min="0" placeholder="-" />

                                {awayTeam.logo_url && <img src={awayTeam.logo_url} className="w-6 h-6 object-contain" alt="" />}
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{awayTeam.short_name}</span>
                            </div>

                            {/* Right: Real Score + Points + Date (absolute) */}
                            <div className="absolute right-3 flex items-center gap-3">
                                {hasRealScore && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                        <span className="uppercase font-semibold">Real:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{match.home_score}-{match.away_score}</span>
                                    </div>
                                )}

                                {hasPoints && hasRealScore && (
                                    <div className="relative" onMouseEnter={() => setHoveredPoints(match.id)} onMouseLeave={() => setHoveredPoints(null)}>
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded cursor-help text-sm font-bold ${bet.points! > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            +{bet.points}pts
                                            <Info className="h-3 w-3" />
                                        </div>
                                        {hoveredPoints === match.id && (
                                            <div className="absolute right-0 bottom-full mb-2 z-[9999] w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl rounded-lg p-3 text-xs">
                                                <div className="font-bold text-green-700 dark:text-green-400 mb-1">+{bet.points} pontos</div>
                                                <div className="text-slate-700 dark:text-slate-200 font-medium mb-2">{getPointsExplanation(Number(bet.home), Number(bet.away), match.home_score, match.away_score, bet.points!)}</div>
                                                <div className="text-slate-500 dark:text-slate-400 space-y-1 border-t pt-2">
                                                    <div>Aposta: <span className="text-green-600 font-semibold">{bet.home}-{bet.away}</span></div>
                                                    <div>Resultado: <span className="text-slate-700 dark:text-slate-200 font-semibold">{match.home_score}-{match.away_score}</span></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="text-right text-xs text-slate-500 min-w-[70px]">
                                    <div>{format(new Date(match.match_date), 'dd/MM HH:mm', { locale: ptBR })}</div>
                                    {locked && <span className="text-red-500 font-bold">🔒 Fechado</span>}
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
