import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Trophy, Users, Search, ArrowRight, Shield, Globe } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

async function UserGroupsList({ userId }: { userId: string }) {
    const supabase = await createClient()

    // 1. Fetch groups where user is a member
    const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
            role,
            groups (
                id,
                name,
                description,
                is_public,
                events ( name )
            )
        `)
        .eq('user_id', userId)

    const { data: pending, error: pendingError } = await supabase
        .from('pending_members')
        .select(`
            status,
            groups (
                id,
                name,
                description,
                is_public,
                events ( name )
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')

    // 3. For groups where user is admin, fetch if there are pending requests to notify
    const { data: adminMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('role', 'admin')

    const adminGroupIds = adminMemberships?.map(m => m.group_id) || []
    let groupsWithPendingRequests: string[] = []

    if (adminGroupIds.length > 0) {
        const { data: pendingCounts } = await supabase
            .from('pending_members')
            .select('group_id')
            .in('group_id', adminGroupIds)
            .eq('status', 'pending')

        if (pendingCounts) {
            groupsWithPendingRequests = Array.from(new Set(pendingCounts.map(p => p.group_id)))
        }
    }

    if (membersError || pendingError) return <p className="text-red-500">Erro ao carregar seus grupos.</p>

    const allItems = [
        ...(members || []).map(m => ({ ...m, status: 'approved' })),
        ...(pending || []).map(p => ({ ...p, role: 'pending', status: 'pending' }))
    ].filter(item => item.groups)

    if (allItems.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 dark:text-slate-400">Você ainda não participa de nenhum grupo.</p>
                <Link href="/groups/create" className="text-green-600 font-bold hover:underline mt-2 inline-block">
                    Criar meu primeiro grupo
                </Link>
            </div>
        )
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allItems.map((item: any) => {
                const isPendingItem = item.status === 'pending'
                const cardStyles = cn(
                    "group bg-white dark:bg-slate-800 p-5 rounded-xl border transition-all shadow-sm block text-left",
                    isPendingItem
                        ? "border-amber-200 dark:border-amber-900/30 opacity-80 cursor-default"
                        : "border-slate-200 dark:border-slate-700 hover:border-green-500"
                )

                const cardContent = (
                    <>
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                                {item.groups.events?.name || 'Evento'}
                            </span>
                            <div className="flex items-center gap-2">
                                {isPendingItem && (
                                    <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                        Pendente
                                    </span>
                                )}
                                {!item.groups.is_public ? (
                                    <Shield className="h-4 w-4 text-slate-400" />
                                ) : (
                                    <Globe className="h-4 w-4 text-slate-400" />
                                )}
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-green-600 transition-colors">
                            {item.groups.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 mb-4">
                            {item.groups.description || 'Sem descrição'}
                        </p>
                        <div className="flex items-center justify-between text-xs font-bold pt-3 border-t border-slate-100 dark:border-slate-700">
                            <span className={cn(
                                item.role === 'admin' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400',
                                isPendingItem && 'text-amber-600'
                            )}>
                                {isPendingItem ? 'Aguardando aprovação' : (item.role === 'admin' ? 'Fundador' : 'Membro')}
                            </span>

                            {item.role === 'admin' && groupsWithPendingRequests.includes(item.groups.id) && (
                                <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full animate-pulse">
                                    <Users className="h-3 w-3" />
                                    <span className="text-[10px] font-black uppercase">Solicitações</span>
                                </div>
                            )}
                            <div className={cn(
                                "flex items-center gap-1",
                                isPendingItem ? "text-amber-600" : "text-green-600"
                            )}>
                                {isPendingItem ? 'Aguarde' : 'Entrar'} <ArrowRight className="h-3 w-3" />
                            </div>
                        </div>
                    </>
                )

                if (isPendingItem) {
                    return (
                        <div key={item.groups.id} className={cardStyles}>
                            {cardContent}
                        </div>
                    )
                }

                return (
                    <Link key={item.groups.id} href={`/groups/${item.groups.id}`} className={cardStyles}>
                        {cardContent}
                    </Link>
                )
            })}
        </div>
    )
}

export default async function GroupsHubPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10">
            {/* Header com CTA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">MEUS GRUPOS</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Gerencie seus bolões ativos ou encontre novos desafios.</p>
                </div>
                <Link
                    href="/groups/create"
                    className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-green-200 dark:shadow-none whitespace-nowrap"
                >
                    <Plus className="h-5 w-5" />
                    CRIAR NOVO GRUPO
                </Link>
            </div>

            {/* Listagem de Grupos Atuais */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 border-l-4 border-green-500 pl-3">
                    <Trophy className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Ativos</h2>
                </div>
                <UserGroupsList userId={user.id} />
            </section>

            {/* Exploração de Grupos Públicos */}
            <section className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 border-l-4 border-slate-300 pl-3">
                        <Search className="h-5 w-5 text-slate-500" />
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Explorar Públicos</h2>
                    </div>

                    {/* Barra de Busca Simples (Placeholder para funcionalidade futura) */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar grupos públicos..."
                            disabled
                            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-green-500 dark:text-white cursor-not-allowed opacity-60"
                        />
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                    <Globe className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">Em Breve</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                        Você poderá buscar e participar de grupos públicos de outros usuários para testar seus conhecimentos.
                    </p>
                </div>
            </section>
        </div>
    )
}
