import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { GroupTabs } from '@/components/groups/GroupTabs'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FinancialService } from '@/lib/financial-service'
import { Info } from 'lucide-react'

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
            <div className="bg-gradient-to-b from-green-800 to-green-900 dark:from-slate-900 dark:to-slate-950 pb-12 sm:pb-32 pt-10 px-4 border-b border-green-700/50 dark:border-slate-800">
                <div className="max-w-4xl mx-auto">
                    {/* Layout Refinado: Foco no Grupo e Integração Fluida */}
                    <div className="flex flex-col gap-6 sm:gap-10">
                        {/* 1. Nome do Grupo (Destaque Principal) */}
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                                {group.name}
                            </h1>
                            {group.description && (
                                <div className="cursor-help transition-transform hover:scale-110" title={group.description}>
                                    <Info className="w-4 h-4 text-green-300/50 hover:text-green-300" />
                                </div>
                            )}
                        </div>

                        {/* 2. Conteúdo da Competição e Prêmio */}
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 sm:gap-6">
                            {/* Bloco da Competição: Logo + Nome (Sempre Lado a Lado) */}
                            <div className="flex items-center gap-4 sm:gap-5">
                                {/* Logo Redimensionado */}
                                <div className="shrink-0">
                                    <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl p-2 flex items-center justify-center shadow-xl border-2 border-white/20 transition-transform hover:rotate-2">
                                        {eventData?.logo_url ? (
                                            <img src={eventData.logo_url} className="w-full h-full object-contain" alt="" />
                                        ) : (
                                            <span className="text-2xl sm:text-3xl">🏆</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {/* Nome da Competição (Mais Discreto) */}
                                    <h2 className="text-lg sm:text-2xl font-black text-white/90 tracking-tight italic uppercase leading-none">
                                        {eventData?.name}
                                    </h2>

                                    {/* Infos Secundárias (Membros e Datas) */}
                                    <div className="flex flex-wrap items-center gap-3 text-white/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/20 rounded border border-white/5">
                                            <span className="text-green-400">👥</span>
                                            <span>{group.group_members[0].count} Participantes</span>
                                        </div>
                                        {startDate && endDate && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/20 rounded border border-white/5">
                                                <span className="text-green-400">📅</span>
                                                <span>{startDate} - {endDate}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 3. Bloco de Prêmio (Design Compacto e Elegante) */}
                            <div className="shrink-0 border-l-4 border-green-500/30 pl-4 sm:pl-0 sm:border-0">
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-[10px] font-black text-green-400/80 uppercase tracking-widest mb-1">Total em Disputa</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-green-200/40 leading-none">R$</span>
                                        <span className="text-3xl sm:text-5xl font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-[0_4px_12px_rgba(74,222,128,0.2)]">
                                            {totalPot.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                            <span className="text-xl sm:text-2xl opacity-30">,00</span>
                                        </span>
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
        </div >
    )
}
