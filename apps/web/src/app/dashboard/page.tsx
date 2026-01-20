import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Plus, Trophy, Users, Ticket, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

async function UserGroupsCardList({ userId }: { userId: string }) {
    const t = await getTranslations('dashboard');
    const supabase = await createClient()

    const { data: members, error } = await supabase
        .from('group_members')
        .select(`
            role,
            groups (
                id,
                name,
                description,
                events ( name )
            )
        `)
        .eq('user_id', userId)

    if (error) return <p className="text-red-500">{t('loadError') || 'Erro ao carregar grupos.'}</p>

    if (!members || members.length === 0) {
        return (
            <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <Trophy className="h-12 w-12 mb-4 text-slate-300" />
                <p className="text-lg font-medium mb-1">{t('noGroupsTitle') || 'Nada por aqui ainda'}</p>
                <p className="text-sm mb-4">{t('noGroups') || 'Você ainda não participa de nenhum bolão.'}</p>
                <Link href="/groups/create" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm">
                    <Plus className="h-4 w-4" />
                    {t('createFirst') || 'Criar meu primeiro grupo'}
                </Link>
            </div>
        )
    }

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member: any) => (
                <Link
                    key={member.groups.id}
                    href={`/groups/${member.groups.id}`}
                    className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md hover:border-indigo-500/50 transition-all duration-200"
                >
                    <div className="p-5 flex-1">
                        <div className="flex items-start justify-between mb-2">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                                {member.groups.events.name}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${member.role === 'admin'
                                ? 'bg-purple-50 text-purple-700 ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30'
                                : 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/30'
                                }`}>
                                {member.role === 'admin' ? t('admin') || 'Admin' : t('member') || 'Membro'}
                            </span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                            {member.groups.name}
                        </h3>
                        {member.groups.description && (
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                                {member.groups.description}
                            </p>
                        )}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        <span>{t('viewDetails') || 'Ver Detalhes'}</span>
                        <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            ))}
        </div>
    )
}

export default async function DashboardPage() {
    const t = await getTranslations('dashboard');
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.is_admin || false

    // Fetch stats
    const { count: groupsCount } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    const { count: betsCount } = await supabase.from('bets').select('*', { count: 'exact', head: true }).eq('user_id', user.id)

    // Simplistic active tournaments count
    const { data: uniqueEvents } = await supabase
        .from('group_members')
        .select(`
            groups (
                events ( id )
            )
        `)
        .eq('user_id', user.id)

    const activeTournaments = Array.from(new Set(uniqueEvents?.map((m: any) => m.groups.events.id))).length

    return (
        <AppLayout user={user} profile={profile} isAdmin={isAdmin}>
            <div className="space-y-8">
                {/* Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-800 p-8 shadow-lg text-white">
                    <div className="relative z-10 max-w-2xl">
                        <h1 className="text-3xl font-bold mb-2">
                            {t('welcome')}, {profile?.display_name?.split(' ')[0] || 'Apostador'}! 👋
                        </h1>
                        <p className="text-green-50 text-lg opacity-90">
                            {t('welcomeMessage') || 'Pronto para fazer algumas previsões vencedoras? Vamos ver o que está acontecendo nos seus bolões.'}
                        </p>
                    </div>
                    {/* Abstract Shapes Decoration */}
                    <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="absolute right-20 bottom-0 -mb-10 h-40 w-40 rounded-full bg-yellow-400/20 blur-2xl"></div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="bg-white dark:bg-slate-800 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('groupsJoined') || 'Grupos Participados'}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{groupsCount || 0}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
                            <Ticket className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('betsMade') || 'Previsões Feitas'}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{betsCount || 0}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-lg">
                            <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('activeTournaments') || 'Torneios Ativos'}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeTournaments || 0}</p>
                        </div>
                    </div>
                </div>

                {/* Groups Section */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('yourGroups')}</h2>
                        <Link
                            href="/groups/create"
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            {t('createNewGroup') || 'Criar Novo Grupo'}
                        </Link>
                    </div>

                    <UserGroupsCardList userId={user.id} />
                </div>
            </div>
        </AppLayout>
    )
}
