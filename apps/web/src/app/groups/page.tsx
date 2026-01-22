import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Trophy, Users, Search, ArrowRight, Lock, Globe } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import { PublicGroupsSearch } from '@/components/groups/PublicGroupsSearch'

async function UserGroupsList({ userId }: { userId: string }) {
    const t = await getTranslations('groups');
    const supabase = await createClient()

    // 1. Fetch groups where user is a member with enriched data
    const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
            role,
            groups (
                id,
                name,
                description,
                is_public,
                is_paid,
                entry_fee,
                payment_method,
                events ( 
                    name,
                    logo_url,
                    online_fee_percent,
                    offline_fee_per_slot,
                    offline_base_fee
                )
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
                is_paid,
                entry_fee,
                events ( name, logo_url )
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')

    // For groups where user is admin, fetch if there are pending requests to notify
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

    if (membersError || pendingError) return <p className="text-red-500">{t('loadError')}</p>

    const allItems = [
        ...(members || []).map(m => ({ ...m, status: 'approved' })),
        ...(pending || []).map(p => ({ ...p, role: 'pending', status: 'pending' }))
    ].filter(item => item.groups)

    if (allItems.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 dark:text-slate-400">{t('noGroups')}</p>
                <Link href="/groups/create" className="text-green-600 font-bold hover:underline mt-2 inline-block">
                    {t('createFirst')}
                </Link>
            </div>
        )
    }

    // Fetch member counts for all groups
    const groupIds = allItems.map(item => item.groups.id)
    const { data: memberCounts } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)

    const memberCountMap = new Map<string, number>()
    memberCounts?.forEach(mc => {
        memberCountMap.set(mc.group_id, (memberCountMap.get(mc.group_id) || 0) + 1)
    })

    // Fetch paid member counts for paid groups
    const paidGroupIds = allItems.filter(item => item.groups.is_paid).map(item => item.groups.id)
    const paidCountMap = new Map<string, number>()

    if (paidGroupIds.length > 0) {
        const { data: paidMembers } = await supabase
            .from('group_members')
            .select('group_id')
            .in('group_id', paidGroupIds)
            .eq('payment_status', 'PAID')

        paidMembers?.forEach(pm => {
            paidCountMap.set(pm.group_id, (paidCountMap.get(pm.group_id) || 0) + 1)
        })
    }

    // Fetch user rankings for each group
    const { data: allBets } = await supabase
        .from('bets')
        .select('user_id, group_id, points')
        .in('group_id', groupIds)

    const rankingMap = new Map<string, { rank: number; total: number }>()

    // Calculate rankings per group
    groupIds.forEach(groupId => {
        const groupBets = allBets?.filter(b => b.group_id === groupId) || []
        const userPoints = new Map<string, number>()

        groupBets.forEach(bet => {
            userPoints.set(bet.user_id, (userPoints.get(bet.user_id) || 0) + (bet.points || 0))
        })

        const sortedUsers = Array.from(userPoints.entries())
            .sort((a, b) => b[1] - a[1])

        const userRank = sortedUsers.findIndex(([uid]) => uid === userId) + 1

        if (userRank > 0) {
            rankingMap.set(groupId, { rank: userRank, total: sortedUsers.length })
        }
    })

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allItems.map((item: any) => {
                const isPendingItem = item.status === 'pending'
                const group = item.groups
                const event = Array.isArray(group.events) ? group.events[0] : group.events
                const memberCount = memberCountMap.get(group.id) || 0
                const ranking = rankingMap.get(group.id)
                const paidCount = paidCountMap.get(group.id) || 0

                // Calculate prize pool if paid group
                let prizePool = 0
                if (group.is_paid && paidCount > 0) {
                    const grossPot = group.entry_fee * paidCount
                    if (group.payment_method === 'ONLINE') {
                        const feePercent = event?.online_fee_percent || 10
                        prizePool = grossPot * (1 - feePercent / 100)
                    } else {
                        prizePool = grossPot
                    }
                }

                const cardStyles = cn(
                    "group bg-white dark:bg-slate-800 p-4 rounded-xl border transition-all shadow-sm block text-left",
                    isPendingItem
                        ? "border-amber-200 dark:border-amber-900/30 opacity-80 cursor-default"
                        : "border-slate-200 dark:border-slate-700 hover:border-green-500 hover:shadow-md"
                )

                const cardContent = (
                    <>
                        {/* Header with Event Logo and Privacy Icon */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                {event?.logo_url && (
                                    <div className="relative w-6 h-6 bg-white dark:bg-white rounded-md p-0.5 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-300">
                                        <img
                                            src={event.logo_url}
                                            alt={event.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                )}
                                <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                                    {event?.name || t('event')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {isPendingItem && (
                                    <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                        {t('pending')}
                                    </span>
                                )}
                                {!group.is_public ? (
                                    <Lock className="h-4 w-4 text-slate-400" />
                                ) : (
                                    <Globe className="h-4 w-4 text-slate-400" />
                                )}
                            </div>
                        </div>

                        {/* Group Name and Description */}
                        <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                            {group.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 mb-3">
                            {group.description || t('noDescription')}
                        </p>

                        {/* Stats Row */}
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                            {ranking && !isPendingItem && (
                                <div className="flex items-center gap-1">
                                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                                    <span>#{ranking.rank}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                <span>{memberCount}</span>
                            </div>
                            {group.is_paid && prizePool > 0 && (
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <span>💰</span>
                                    <span>R$ {prizePool.toFixed(0)}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className={cn(
                                item.role === 'admin' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400',
                                isPendingItem && 'text-amber-600'
                            )}>
                                {isPendingItem ? t('waitingApproval') : (item.role === 'admin' ? t('founder') : t('member'))}
                            </span>

                            {item.role === 'admin' && groupsWithPendingRequests.includes(group.id) && (
                                <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full animate-pulse">
                                    <Users className="h-3 w-3" />
                                    <span className="text-[10px] font-black uppercase">{t('requests')}</span>
                                </div>
                            )}
                            <div className={cn(
                                "flex items-center gap-1",
                                isPendingItem ? "text-amber-600" : "text-green-600 dark:text-green-400"
                            )}>
                                {isPendingItem ? t('wait') : t('enter')} <ArrowRight className="h-3 w-3" />
                            </div>
                        </div>
                    </>
                )

                if (isPendingItem) {
                    return (
                        <div key={group.id} className={cardStyles}>
                            {cardContent}
                        </div>
                    )
                }

                return (
                    <Link key={group.id} href={`/groups/${group.id}`} className={cardStyles}>
                        {cardContent}
                    </Link>
                )
            })}
        </div>
    )
}

export default async function GroupsHubPage() {
    const t = await getTranslations('groups');
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
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('myGroups')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t('subtitle')}</p>
                </div>
                <Link
                    href="/groups/create"
                    className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-green-200 dark:shadow-none whitespace-nowrap"
                >
                    <Plus className="h-5 w-5" />
                    {t('createNew')}
                </Link>
            </div>

            {/* Listagem de Grupos Atuais */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 border-l-4 border-green-500 pl-3">
                    <Trophy className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">{t('active')}</h2>
                </div>
                <UserGroupsList userId={user.id} />
            </section>

            {/* Exploração de Grupos Públicos */}
            <PublicGroupsSearch />
        </div>
    )
}
