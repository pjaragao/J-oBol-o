import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, Terminal, CheckCircle2, XCircle, Info, Clock, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function AdminLogsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Check admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin) redirect('/')

    // Fetch logs
    const { data: logs } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)

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
                            {logs?.map((log) => (
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
                                        <div className="max-w-md">
                                            {log.error_message ? (
                                                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                                                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium break-all">{log.error_message}</p>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                                                    <Database className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-300 dark:text-slate-600" />
                                                    <p className="text-xs font-medium break-all line-clamp-2" title={JSON.stringify(log.details)}>
                                                        {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : 'Operação realizada com sucesso.'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {(!logs || logs.length === 0) && (
                        <div className="p-20 text-center">
                            <Terminal className="h-12 w-12 text-slate-100 dark:text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Nenhum log de sincronização encontrado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
