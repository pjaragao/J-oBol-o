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
            <div className="bg-gradient-to-b from-green-800 to-green-900 dark:from-slate-900 dark:to-slate-950 pb-12 sm:pb-28 pt-8 px-4 border-b border-green-700/50 dark:border-slate-800">
                <div className="max-w-4xl mx-auto">
                    {/* Layout Orgânico sem "Boxes" aninhados */}
                    <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                        {/* Logo da Competição com Destaque e Contraste */}
                        <div className="shrink-0 group">
                            <div className="relative w-16 h-16 sm:w-24 sm:h-24 bg-white rounded-[2rem] p-3 flex items-center justify-center shadow-2xl border-4 border-white/20 transition-transform hover:scale-105 active:scale-95 duration-300">
                                {eventData?.logo_url ? (
                                    <img src={eventData.logo_url} className="w-full h-full object-contain" alt="" />
                                ) : (
                                    <span className="text-4xl sm:text-5xl">🏆</span>
                                )}
                                {/* Badge de "Live" ou similar se necessário no futuro */}
                            </div>
                        </div>

                        <div className="flex flex-col flex-1 min-w-[280px]">
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                                <div className="min-w-0">
                                    {/* Identidade do Grupo (Integrada e Sutil) */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-green-400/20 px-2 py-0.5 rounded text-[10px] font-black text-green-300 uppercase tracking-widest border border-green-400/20">
                                            Grupo: {group.name}
                                        </div>
                                        {group.description && (
                                            <div className="cursor-help transition-transform hover:scale-110" title={group.description}>
                                                <Info className="w-3.5 h-3.5 text-green-300/60" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Título da Competição (O Grande Destaque) */}
                                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tighter italic uppercase leading-none drop-shadow-lg">
                                        {eventData?.name}
                                    </h2>

                                    {/* Infos de Apoio (Membros e Datas) */}
                                    <div className="mt-4 flex flex-wrap items-center gap-4 text-white/60 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-green-400">👥</span>
                                            <span>{group.group_members[0].count} Participantes</span>
                                        </div>
                                        {startDate && endDate && (
                                            <div className="flex items-center gap-1.5 pl-4 border-l border-white/10">
                                                <span className="text-green-400">📅</span>
                                                <span>{startDate} - {endDate}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bloco de Prêmio (Design Minimalista mas Potente) */}
                                <div className="shrink-0 sm:pb-1">
                                    <div className="flex flex-col items-start sm:items-end">
                                        <span className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1 opacity-80">Total em Disputa</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-bold text-green-400 leading-none">R$</span>
                                            <span className="text-4xl sm:text-6xl font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-[0_0_20px_rgba(74,222,128,0.3)]">
                                                {totalPot.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                                <span className="text-xl sm:text-2xl opacity-40">,00</span>
                                            </span>
                                        </div>
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
