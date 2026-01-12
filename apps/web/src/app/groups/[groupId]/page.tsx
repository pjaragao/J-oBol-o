import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { GroupTabs } from '@/components/groups/GroupTabs'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FinancialService } from '@/lib/financial-service'

export default async function GroupDetailsPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = await params
    const supabase = createClient()
    const { data: { user } } = await (await supabase).auth.getUser()

    if (!user) {
        redirect(`/login?redirect=/groups/${groupId}`)
    }

    const { data: group } = await (await supabase)
        .from('groups')
        .select(`
            *, 
            events(name, logo_url, start_date, end_date, online_fee_percent, offline_fee_per_slot, offline_base_fee), 
            group_members(count)
        `)
        .eq('id', groupId)
        .single()

    if (!group) {
        notFound()
    }

    // Check if current user is admin
    const { data: membership } = await (await supabase)
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user?.id)
        .single()

    const isAdmin = membership?.role === 'admin'

    const { data: matches } = await (await supabase)
        .from('matches')
        .select('*, home_team:teams!home_team_id(name, short_name, logo_url), away_team:teams!away_team_id(name, short_name, logo_url)')
        .eq('event_id', group.event_id)
        .order('match_date', { ascending: true })

    // Financial calculations for header
    const { count: paidCount } = await (await supabase)
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('payment_status', 'PAID')

    const eventData = group.events
    const config = {
        payment_method: group.payment_method,
        entry_fee: group.entry_fee,
        max_members: group.max_members
    }
    const potArgs = {
        online_fee_percent: eventData?.online_fee_percent || 10,
        offline_fee_per_slot: eventData?.offline_fee_per_slot || 0,
        offline_base_fee: eventData?.offline_base_fee || 0
    }

    const { grossPot } = FinancialService.calculatePrizePot(config, paidCount || 0, potArgs)
    const totalPot = grossPot;

    const startDate = eventData?.start_date ? format(new Date(eventData.start_date), 'dd/MM/yyyy') : null
    const endDate = eventData?.end_date ? format(new Date(eventData.end_date), 'dd/MM/yyyy') : null

    return (
        <div className="pb-12 bg-gray-50 dark:bg-slate-900 min-h-screen">
            {/* Header Compacto Moderno */}
            <div className="bg-gradient-to-b from-green-800 to-green-900 dark:from-slate-900 dark:to-slate-950 pb-12 sm:pb-24 pt-3 px-4 border-b border-green-700/50 dark:border-slate-800">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col gap-2">
                        {/* Título e Descrição */}
                        <div>
                            <h1 className="text-base sm:text-2xl font-bold tracking-tight text-white leading-tight">{group.name}</h1>
                            {group.description && <p className="text-green-100/60 text-[10px] sm:text-sm line-clamp-1">{group.description}</p>}
                        </div>

                        {/* Stats Bar - Scrollable on Mobile */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-[10px] sm:text-xs font-medium text-green-50/80">
                            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full whitespace-nowrap border border-white/5">
                                {eventData?.logo_url ? (
                                    <img src={eventData.logo_url} className="w-4 h-4 object-contain" alt="" />
                                ) : (
                                    <span>🏆</span>
                                )}
                                <span>{eventData?.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full whitespace-nowrap border border-white/5">
                                <span>👥</span>
                                <span>{group.group_members[0].count}</span>
                            </div>
                            {startDate && endDate && (
                                <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full whitespace-nowrap border border-white/5">
                                    <span>📅</span>
                                    <span>{startDate} - {endDate}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-green-500/20 px-2.5 py-1 rounded-full whitespace-nowrap border border-green-400/30 font-bold text-green-200">
                                <span>💰</span>
                                <span>Total em Disputa: R$ {totalPot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="-mt-12 sm:-mt-20 mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                <GroupTabs
                    groupId={groupId}
                    matches={matches || []}
                    group={group}
                    isAdmin={isAdmin}
                    userId={user?.id || ''}
                />
            </main>
        </div>
    )
}
