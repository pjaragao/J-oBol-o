import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { GroupTabs } from '@/components/groups/GroupTabs'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FinancialService } from '@/lib/financial-service'
import { Info, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeaderSetter } from '@/components/layout/HeaderSetter'

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

    // Fetch user membership
    const { data: membership } = await (await supabase)
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle()

    const isAdmin = membership?.role === 'admin'

    // Check for existing pending request
    const { data: pendingMember } = await (await supabase)
        .from('pending_members')
        .select('status')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()

    const isPending = !!pendingMember

    // If pending, redirect to main groups page where they can see their status
    if (isPending) {
        redirect('/groups?pending=true')
    }

    // If not a member and group is not public, redirect
    if (!membership && !group.is_public) {
        redirect('/groups')
    }

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

    const startDate = eventData?.start_date ? format(new Date(eventData.start_date), 'dd/MM/yy') : null
    const endDate = eventData?.end_date ? format(new Date(eventData.end_date), 'dd/MM/yy') : null

    return (
        <div className="pb-12 bg-gray-50 dark:bg-slate-900 min-h-screen">
            {/* HeaderSetter atualiza o título no AppHeader global */}
            <HeaderSetter title={group.name} />

            {/* Header Reduzido e Integrado */}
            <div className="bg-gradient-to-b from-green-800 to-green-900 dark:from-slate-900 dark:to-slate-950 pb-8 sm:pb-20 pt-2 px-4 border-b border-green-700/50 dark:border-slate-800">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col gap-3">
                        {/* Linha 1: Competição e Prêmio */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                {/* Logo Compacto */}
                                <div className="shrink-0">
                                    <div className="relative w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-lg border border-white/10">
                                        {eventData?.logo_url ? (
                                            <img src={eventData.logo_url} className="w-full h-full object-contain" alt="" />
                                        ) : (
                                            <span className="text-xl sm:text-2xl">🏆</span>
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0">
                                    <h2 className="text-sm sm:text-xl font-black text-white italic uppercase leading-none tracking-tight truncate">
                                        {group.events?.name}
                                    </h2>
                                    {/* Link sutil para descrição/info do grupo se necessário */}
                                    {group.description && (
                                        <p className="hidden sm:block text-[10px] text-white/40 mt-1 truncate max-w-xs">{group.description}</p>
                                    )}
                                </div>
                            </div>

                            {/* Prêmio (Sempre à direita) */}
                            <div className="shrink-0 text-right">
                                <span className="block text-[8px] sm:text-[10px] font-black text-green-400/80 uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Prêmio Total</span>
                                <div className="flex items-baseline justify-end gap-1">
                                    <span className="text-[10px] sm:text-sm font-bold text-green-200/40 leading-none">R$</span>
                                    <span className="text-base sm:text-3xl font-black text-white tabular-nums leading-none tracking-tighter">
                                        {totalPot.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                        <span className="text-[10px] sm:text-xl opacity-30">,00</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Linha 2: Participantes e Datas (Lado a Lado) */}
                        <div className="flex items-center gap-4 text-white/60 text-[9px] sm:text-xs font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                                <span className="text-green-400">👥</span>
                                <span>{(group.group_members?.[0]?.count || 0)} Participantes</span>
                            </div>
                            {startDate && endDate && (
                                <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                                    <span className="text-green-400">📅</span>
                                    <span>{startDate} - {endDate}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <main className="-mt-10 sm:-mt-16 mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
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
