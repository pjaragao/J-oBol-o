import { createClient } from '@/lib/supabase/server'
import { CronControls } from '@/components/admin/CronControls'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy, Users, Calendar, Activity, AlertCircle, Clock } from 'lucide-react'

export default async function AdminDashboard() {
    const supabase = await createClient()

    // Parallel fetch for stats
    const [
        { count: usersCount },
        { count: groupsCount },
        { count: matchesCount },
        { data: events }
    ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('groups').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*, matches(updated_at)').eq('is_active', true)
    ])

    // Process events to get match count and last update
    const eventStats = events?.map(event => {
        const matchUpdates = (event.matches as any[])?.map(m => m.updated_at).filter(Boolean)
        const lastUpdate = matchUpdates && matchUpdates.length > 0
            ? new Date(Math.max(...matchUpdates.map(d => new Date(d).getTime())))
            : null

        return {
            id: event.id,
            name: event.name,
            matchCount: (event.matches as any[])?.length || 0,
            lastUpdate
        }
    })

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Centro de Administração
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gerencie usuários, grupos e sincronização de dados.
                </p>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total de Usuários</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{usersCount || 0}</p>
                        </div>
                        <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
                            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total de Grupos</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{groupsCount || 0}</p>
                        </div>
                        <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                            <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Partidas no Sistema</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{matchesCount || 0}</p>
                        </div>
                        <div className="h-12 w-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Championships Status */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-green-500" />
                                Status das Competições
                            </h3>
                            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold uppercase">
                                Ativas
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {eventStats && eventStats.length > 0 ? eventStats.map((event) => (
                                <div key={event.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                                            {event.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 leading-none">{event.name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {event.matchCount} partidas cadastradas
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Última Atualização</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center justify-end gap-1.5 mt-0.5">
                                            <Clock className="h-3 w-3 text-slate-400" />
                                            {event.lastUpdate
                                                ? format(event.lastUpdate, "dd/MM 'às' HH:mm", { locale: ptBR })
                                                : 'Nunca'}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center">
                                    <p className="text-slate-500 dark:text-slate-400">Nenhuma competição ativa encontrada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Maintenance Controls */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2 text-lg">
                            <div className="h-8 w-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            Controle de Sincronização
                        </h3>
                        <CronControls />
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                        <h4 className="font-bold text-lg mb-2">Dica do Administrador</h4>
                        <p className="text-indigo-50 text-xs leading-relaxed">
                            A sincronização completa de partidas pode levar alguns segundos. Use o botão <strong>Ao Vivo</strong> para atualizações rápidas durante os jogos.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
