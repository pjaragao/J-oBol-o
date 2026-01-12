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
                        {/* Título e Descrição do Grupo */}
                        <div className="mb-4">
                            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-sm">{group.name}</h1>
                            {group.description && <p className="text-green-100/70 text-xs sm:text-base font-medium line-clamp-1 mt-1">{group.description}</p>}
                        </div>

                        {/* Destaque da Competição e Prêmio */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-white/5 dark:bg-black/20 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                            {/* Logo Maior */}
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                                <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-xl p-2 flex items-center justify-center border border-white/20 shadow-inner">
                                    {eventData?.logo_url ? (
                                        <img src={eventData.logo_url} className="w-full h-full object-contain" alt="" />
                                    ) : (
                                        <span className="text-2xl sm:text-3xl">🏆</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    {/* Nome da Competição em Destaque */}
                                    <div>
                                        <span className="text-[10px] sm:text-xs font-bold text-green-300/80 uppercase tracking-widest block mb-0.5">Competição</span>
                                        <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight truncate">
                                            {eventData?.name}
                                        </h2>
                                    </div>

                                    {/* Valor em Disputa em Grande Destaque */}
                                    <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-[1px] rounded-xl shadow-lg shadow-green-900/40">
                                        <div className="bg-green-950/80 px-4 py-2 rounded-[11px] backdrop-blur-md flex flex-col items-end">
                                            <span className="text-[10px] font-black text-green-400 uppercase tracking-tighter leading-none mb-1">Total em Disputa</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-green-100/60 leading-none">R$</span>
                                                <span className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none">
                                                    {totalPot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Secundária (Membros e Datas) */}
                                <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3">
                                    <div className="flex items-center gap-2 text-white/60 text-[11px] sm:text-xs font-medium">
                                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                            <span>👥</span>
                                            <span>{group.group_members[0].count} membros</span>
                                        </div>
                                        {startDate && endDate && (
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                <span>📅</span>
                                                <span>{startDate} - {endDate}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
