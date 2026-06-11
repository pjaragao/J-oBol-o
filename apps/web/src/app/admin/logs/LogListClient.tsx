'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Terminal, CheckCircle2, XCircle, Info, Clock, Database, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Log {
    id: string
    started_at: string
    reosurce_type: string
    status: string
    details: any
    error_message: string | null
    created_by: string | null
}

interface LogListClientProps {
    initialLogs: Log[]
}

export default function LogListClient({ initialLogs }: LogListClientProps) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
    const [onlyScoreChanges, setOnlyScoreChanges] = useState(false)

    // Parse logs and detect score changes
    const processedLogs = useMemo(() => {
        return initialLogs.map(log => {
            let scoreChanges: any[] = []
            let statusChanges: any[] = []
            let hasScoreChanges = false

            if (log.details) {
                // Determine if it has score changes
                hasScoreChanges = !!log.details.has_score_changes

                if (log.details.score_changes) {
                    scoreChanges = log.details.score_changes
                }
                if (log.details.status_changes) {
                    statusChanges = log.details.status_changes
                }
                if (log.details.results) {
                    log.details.results.forEach((r: any) => {
                        if (r.score_changes && r.score_changes.length > 0) {
                            scoreChanges.push(...r.score_changes)
                            hasScoreChanges = true
                        }
                        if (r.status_changes && r.status_changes.length > 0) {
                            statusChanges.push(...r.status_changes)
                        }
                    })
                }
            }

            return {
                ...log,
                scoreChanges,
                statusChanges,
                hasScoreChanges
            }
        })
    }, [initialLogs])

    // Filtered logs
    const filteredLogs = useMemo(() => {
        return processedLogs.filter(log => {
            // Status filter
            if (statusFilter === 'success' && log.status !== 'success') return false
            if (statusFilter === 'error' && log.status !== 'error') return false

            // Score changes filter
            if (onlyScoreChanges && !log.hasScoreChanges) return false

            // Search filter
            if (search) {
                const searchLower = search.toLowerCase()
                const resourceMatch = log.reosurce_type?.toLowerCase().includes(searchLower)
                const errorMatch = log.error_message?.toLowerCase().includes(searchLower)
                
                // Search in teams/scores
                const teamsMatch = log.scoreChanges.some(c => c.teams?.toLowerCase().includes(searchLower)) ||
                                   log.statusChanges.some(c => c.teams?.toLowerCase().includes(searchLower))

                if (!resourceMatch && !errorMatch && !teamsMatch) return false
            }

            return true
        })
    }, [processedLogs, statusFilter, onlyScoreChanges, search])

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
            case 'error':
                return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
            default:
                return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center text-left">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logs de Sincronização</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Histórico detalhado das execuções de cron e atualizações.</p>
                </div>
                <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                    <Terminal className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
            </div>

            {/* FILTERS PANEL */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm">
                <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar nos logs (recurso, erro, times)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 dark:text-slate-100"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="success">Apenas Sucesso</option>
                        <option value="error">Apenas Erro</option>
                    </select>

                    <button
                        onClick={() => setOnlyScoreChanges(!onlyScoreChanges)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-bold transition-all shadow-sm",
                            onlyScoreChanges
                                ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-200 dark:shadow-none"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <span className="text-base">⚽</span>
                        Alterações de Placar {onlyScoreChanges ? "ON" : "OFF"}
                    </button>
                </div>
            </div>

            {/* LOGS TABLE */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recurso / Data</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
                                                {log.reosurce_type || 'SYSTEM'}
                                            </span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1 font-medium">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                            getStatusStyles(log.status)
                                        )}>
                                            {log.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : log.status === 'error' ? <XCircle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                                            {log.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-xl text-left">
                                            {log.error_message ? (
                                                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                                                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium break-all">{log.error_message}</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {/* Score Changes */}
                                                    {log.scoreChanges.length > 0 && (
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gols / Alterações de Placar:</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {log.scoreChanges.map((change, i) => (
                                                                    <div key={i} className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-lg border border-green-100 dark:border-green-900/20">
                                                                        <span className="font-extrabold">⚽ {change.teams}</span>
                                                                        <span className="text-[10px] bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded font-black tabular-nums">{change.old_score}</span>
                                                                        <span className="text-slate-400">➡️</span>
                                                                        <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded font-black tabular-nums">{change.new_score}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Status Changes */}
                                                    {log.statusChanges.length > 0 && (
                                                        <div className="flex flex-col gap-1.5 mt-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status da Partida:</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {log.statusChanges.map((change, i) => (
                                                                    <div key={i} className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/20">
                                                                        <span>🕒 {change.teams}</span>
                                                                        <span className="text-[10px] bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded font-black uppercase tracking-tight">{change.old_status}</span>
                                                                        <span className="text-slate-400">➡️</span>
                                                                        <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tight">{change.new_status}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Raw details fallback if no changes to show */}
                                                    {log.scoreChanges.length === 0 && log.statusChanges.length === 0 && (
                                                        <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                                                            <Database className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-300 dark:text-slate-600" />
                                                            <p className="text-xs font-medium break-all line-clamp-2" title={JSON.stringify(log.details)}>
                                                                {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : 'Operação realizada com sucesso.'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredLogs.length === 0 && (
                        <div className="p-20 text-center">
                            <Terminal className="h-12 w-12 text-slate-100 dark:text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Nenhum log de sincronização encontrado para os filtros selecionados.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
