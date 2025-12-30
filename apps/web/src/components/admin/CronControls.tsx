'use client'

import { useState } from 'react'
import { manualUpdateMatches, manualUpdateLiveMatches, manualSendReminders } from '@/app/admin/actions'
import { RefreshCw, Zap, Bell, CheckCircle2, AlertCircle } from 'lucide-react'

export function CronControls() {
    const [loading, setLoading] = useState<string | null>(null)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    const handleAction = async (actionName: string, actionFn: () => Promise<any>) => {
        setLoading(actionName)
        setStatus(null)
        try {
            const res = await actionFn()
            if (res.success) {
                setStatus({ type: 'success', message: res.message })
            } else {
                setStatus({ type: 'error', message: res.message })
            }
        } catch (e) {
            setStatus({ type: 'error', message: 'Erro inesperado na operação' })
        } finally {
            setLoading(null)
            // Clear status after 5s
            setTimeout(() => setStatus(null), 5000)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                {/* Full Sync */}
                <button
                    onClick={() => handleAction('matches', manualUpdateMatches)}
                    disabled={!!loading}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group disabled:opacity-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                            <RefreshCw className={`h-4 w-4 ${loading === 'matches' ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Sincronização Completa</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Atualiza todas as partidas pendentes e novos times.</p>
                        </div>
                    </div>
                </button>

                {/* Live Only Sync */}
                <button
                    onClick={() => handleAction('live', manualUpdateLiveMatches)}
                    disabled={!!loading}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-red-500 dark:hover:border-red-500 transition-all group disabled:opacity-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors text-red-600 dark:text-red-400">
                            <Zap className={`h-4 w-4 ${loading === 'live' ? 'animate-pulse' : ''}`} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Atualizar Ao Vivo</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Foca apenas em jogos de hoje. Mais rápido.</p>
                        </div>
                    </div>
                </button>

                {/* Reminders */}
                <button
                    onClick={() => handleAction('reminders', manualSendReminders)}
                    disabled={!!loading}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-500 dark:hover:border-amber-500 transition-all group disabled:opacity-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors text-amber-600 dark:text-amber-400">
                            <Bell className={`h-4 w-4 ${loading === 'reminders' ? 'animate-bounce' : ''}`} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Enviar Lembretes</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Notifica usuários sem palpite em jogos iminentes.</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Status Message */}
            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm animate-in slide-in-from-top-2 duration-300 ${status.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {status.message}
                </div>
            )}
        </div>
    )
}
