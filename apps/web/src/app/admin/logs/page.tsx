import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default async function AdminLogsPage() {
    const supabase = createClient()
    const { data: { user } } = await (await supabase).auth.getUser()

    if (!user) redirect('/login')

    // Check admin
    const { data: profile } = await (await supabase)
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin) redirect('/')

    // Fetch logs
    const { data: logs } = await (await supabase)
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Logs de Sincronização</h1>
                <button className="text-sm text-indigo-600 hover:text-indigo-800" disabled>Atualizar</button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <ul className="divide-y divide-gray-200">
                    {logs?.map((log) => (
                        <li key={log.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <p className="text-sm font-medium text-indigo-600 truncate uppercase">
                                        {log.reosurce_type} {/* typo from DB */}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                    </p>
                                </div>
                                <div className="ml-2 flex-shrink-0 flex">
                                    <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-800' :
                                            log.status === 'error' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {log.status}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-2 sm:flex sm:justify-between">
                                <div className="sm:flex">
                                    <p className="flex items-center text-sm text-gray-500">
                                        {log.error_message ? (
                                            <span className="text-red-600 truncate max-w-md" title={log.error_message}>{log.error_message}</span>
                                        ) : (
                                            <span className="truncate max-w-md">{JSON.stringify(log.details)}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                    {(!logs || logs.length === 0) && (
                        <li className="px-4 py-8 text-center text-gray-500">
                            Nenhum log encontrado.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    )
}
