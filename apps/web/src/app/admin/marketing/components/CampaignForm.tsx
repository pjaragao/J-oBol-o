'use client'

import React, { useState, useEffect } from 'react'
import {
    Users,
    Target,
    Send,
    Info,
    AlertTriangle,
    Trophy,
    Star,
    CheckCircle2,
    Calendar,
    Layers,
    Search,
    Loader2
} from 'lucide-react'
import {
    getAudiencePreview,
    sendCampaign,
    CampaignFilters,
    CampaignData
} from '../actions'
import { cn } from '@/lib/utils'

export function CampaignForm() {
    const [filters, setFilters] = useState<CampaignFilters>({
        audience: 'all',
    })
    const [data, setData] = useState<CampaignData>({
        title: '',
        message: '',
        type: 'info',
        actionLinkType: 'fixed',
        fixedLink: ''
    })

    const [previewCount, setPreviewCount] = useState<number | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    // Update preview when filters change
    useEffect(() => {
        const fetchPreview = async () => {
            setLoadingPreview(true)
            const result = await getAudiencePreview(filters)
            if (result.success) {
                setPreviewCount(result.count)
            }
            setLoadingPreview(false)
        }

        const timer = setTimeout(fetchPreview, 500)
        return () => clearTimeout(timer)
    }, [filters])

    const handleSend = async () => {
        if (!data.title || !data.message) {
            setStatus({ type: 'error', message: 'Preencha o título e a mensagem da campanha.' })
            return
        }

        if (!window.confirm(`Confirmar envio para ${previewCount} alvos?`)) return

        setSending(true)
        setStatus(null)

        try {
            const result = await sendCampaign(filters, data)
            if (result.success) {
                setStatus({ type: 'success', message: result.message })
                // Optional: clear message but keep filters
                setData({ ...data, title: '', message: '' })
            } else {
                setStatus({ type: 'error', message: result.message || 'Erro ao enviar campanha.' })
            }
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message })
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Configuration */}
            <div className="lg:col-span-2 space-y-6">
                {/* Audience Selection */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-6">
                        <Target className="h-5 w-5 text-green-600" />
                        <h2 className="text-lg font-bold">1. Selecionar Audiência</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => setFilters({ ...filters, audience: 'all' })}
                            className={cn(
                                "p-4 rounded-xl border-2 text-left transition-all",
                                filters.audience === 'all'
                                    ? "border-green-600 bg-green-50/50 dark:bg-green-500/10"
                                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                            )}
                        >
                            <div className="font-bold flex items-center justify-between">
                                Todos os Usuários
                                {filters.audience === 'all' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Envia para toda a base cadastrada.</p>
                        </button>

                        <button
                            onClick={() => setFilters({ ...filters, audience: 'tier', tier: 'free' })}
                            className={cn(
                                "p-4 rounded-xl border-2 text-left transition-all",
                                filters.audience === 'tier'
                                    ? "border-green-600 bg-green-50/50 dark:bg-green-500/10"
                                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                            )}
                        >
                            <div className="font-bold flex items-center justify-between">
                                Por Plano (Assinatura)
                                {filters.audience === 'tier' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Filtre por Free, Premium ou Pro.</p>
                        </button>

                        <button
                            onClick={() => setFilters({ ...filters, audience: 'smart_group', daysNextMatches: 3 })}
                            className={cn(
                                "p-4 rounded-xl border-2 text-left transition-all",
                                filters.audience === 'smart_group'
                                    ? "border-green-600 bg-green-50/50 dark:bg-green-500/10"
                                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                            )}
                        >
                            <div className="font-bold flex items-center justify-between font-mono">
                                Campanha Inteligente ✨
                                {filters.audience === 'smart_group' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Lembretes automáticos por grupo.</p>
                        </button>
                    </div>

                    {/* Conditional Options */}
                    <div className="mt-6 pt-6 border-t border-dashed border-slate-100 dark:border-slate-800">
                        {filters.audience === 'tier' && (
                            <div className="flex gap-2">
                                {['free', 'premium', 'pro'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setFilters({ ...filters, tier: t as any })}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-xs font-bold capitalize transition-all",
                                            filters.tier === t
                                                ? "bg-green-600 text-white"
                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        )}

                        {filters.audience === 'smart_group' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                        Jogos nos próximos (dias):
                                    </label>
                                    <input
                                        type="number"
                                        value={filters.daysNextMatches}
                                        onChange={(e) => setFilters({ ...filters, daysNextMatches: parseInt(e.target.value) })}
                                        className="w-20 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                </div>
                                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-500/5 text-[11px] text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex gap-2">
                                    <Info className="h-4 w-4 shrink-0" />
                                    <p>Esta campanha gerará notificações individuais para cada grupo onde o usuário tem apostas pendentes. O link será dinâmico para cada grupo.</p>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Target className="h-4 w-4 text-green-600" />
                                                <span className="text-sm font-bold">Apenas Administradores</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Enviar apenas para donos e moderadores do grupo.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={filters.targetGroupAdmins}
                                                onChange={(e) => setFilters({ ...filters, targetGroupAdmins: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aba de Destino</label>
                                            <select
                                                value={filters.smartTargetTab || 'bets'}
                                                onChange={(e) => setFilters({ ...filters, smartTargetTab: e.target.value as any })}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                            >
                                                <option value="dashboard">Dashboard</option>
                                                <option value="bets">Apostas</option>
                                            </select>
                                        </div>
                                        {filters.smartTargetTab === 'bets' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtro de Partidas</label>
                                                <select
                                                    value={filters.smartMatchFilter || 'pending'}
                                                    onChange={(e) => setFilters({ ...filters, smartMatchFilter: e.target.value as any })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                                >
                                                    <option value="pending">Pendentes</option>
                                                    <option value="all">Todas</option>
                                                    <option value="completed">Feitas</option>
                                                    <option value="missed">Esquecidas</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Message Composition */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-6">
                        <Layers className="h-5 w-5 text-green-600" />
                        <h2 className="text-lg font-bold">2. Conteúdo da Campanha</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Título
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setData({ ...data, title: data.title + '{user_name}' })}
                                        className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400"
                                    >
                                        + {'{user_name}'}
                                    </button>
                                    {filters.audience === 'smart_group' && (
                                        <button
                                            onClick={() => setData({ ...data, title: data.title + '{group_name}' })}
                                            className="text-[10px] bg-green-100 dark:bg-green-900/30 hover:bg-green-200 px-2 py-0.5 rounded font-mono text-green-700 dark:text-green-400"
                                        >
                                            + {'{group_name}'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <input
                                type="text"
                                value={data.title}
                                onChange={(e) => setData({ ...data, title: e.target.value })}
                                placeholder={filters.audience === 'smart_group' ? "Não esqueça seu palpite em {group_name}!" : "Grande partida hoje!"}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Mensagem
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setData({ ...data, message: data.message + '{user_name}' })}
                                        className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400"
                                    >
                                        + {'{user_name}'}
                                    </button>
                                    {filters.audience === 'smart_group' && (
                                        <button
                                            onClick={() => setData({ ...data, message: data.message + '{group_name}' })}
                                            className="text-[10px] bg-green-100 dark:bg-green-900/30 hover:bg-green-200 px-2 py-0.5 rounded font-mono text-green-700 dark:text-green-400"
                                        >
                                            + {'{group_name}'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={data.message}
                                onChange={(e) => setData({ ...data, message: e.target.value })}
                                rows={3}
                                placeholder="Escreva aqui o texto da notificação..."
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none"
                            />
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                                <Info className="h-3 w-3" />
                                Dica: Use as tags acima para personalizar a mensagem para cada usuário.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                                    Tipo/Ícone
                                </label>
                                <select
                                    value={data.type}
                                    onChange={(e) => setData({ ...data, type: e.target.value as any })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    <option value="info">Informação (Azul)</option>
                                    <option value="success">Sucesso (Verde)</option>
                                    <option value="warning">Alerta (Laranja)</option>
                                    <option value="points">Pontos/Troféu (Ouro)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                                    Link de Ação
                                </label>
                                <select
                                    value={data.actionLinkType}
                                    onChange={(e) => setData({ ...data, actionLinkType: e.target.value as any })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    {filters.audience === 'smart_group' ? (
                                        <option value="fixed">Página do Grupo (Automático)</option>
                                    ) : (
                                        <>
                                            <option value="fixed">Link Fixo</option>
                                            <option value="none">Nenhum</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        {data.actionLinkType === 'fixed' && filters.audience !== 'smart_group' && (
                            <div>
                                <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                                    URL do Link
                                </label>
                                <input
                                    type="text"
                                    value={data.fixedLink}
                                    onChange={(e) => setData({ ...data, fixedLink: e.target.value })}
                                    placeholder="/plans ou https://..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Preview & Send */}
            <div className="flex flex-col gap-6">
                <div className="sticky top-24 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Send className="h-5 w-5 text-green-600" />
                            <h2 className="text-lg font-bold">3. Revisão e Envio</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Total de Destinatários</span>
                                <div className="flex items-center gap-3 mt-1 text-2xl font-black">
                                    {loadingPreview ? (
                                        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                                    ) : (
                                        <span>{previewCount ?? 0}</span>
                                    )}
                                    <Users className="h-6 w-6 text-slate-300" />
                                </div>
                            </div>

                            {status && (
                                <div className={cn(
                                    "p-4 rounded-xl flex gap-3 text-sm font-medium",
                                    status.type === 'success'
                                        ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-100 dark:border-green-900/50"
                                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-900/50"
                                )}>
                                    {status.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
                                    {status.message}
                                </div>
                            )}

                            <button
                                onClick={handleSend}
                                disabled={sending || previewCount === 0 || !data.title || !data.message}
                                className={cn(
                                    "w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                    sending || previewCount === 0 || !data.title || !data.message
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                                        : "bg-green-600 text-white hover:bg-green-700 shadow-green-600/20"
                                )}
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-5 w-5" />
                                        Enviar Campanha
                                    </>
                                )}
                            </button>

                            <p className="text-[10px] text-center text-slate-400 px-4">
                                Ao clicar em enviar, as notificações serão processadas e aparecerão em tempo real para os usuários ativos.
                            </p>
                        </div>
                    </div>

                    {/* Mockup Preview Inside Sticky */}
                    <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Preview no App</span>
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 flex gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                {data.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                                {data.type === 'success' && <Star className="h-4 w-4 text-green-500" />}
                                {data.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                {data.type === 'points' && <Trophy className="h-4 w-4 text-yellow-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {data.title.replace(/{user_name}/g, 'Paulo').replace(/{group_name}/g, 'Amigos do Futebol') || 'Título da Notificação'}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                    {data.message.replace(/{user_name}/g, 'Paulo').replace(/{group_name}/g, 'Amigos do Futebol') || 'Sua mensagem aparecerá aqui após ser digitada...'}
                                </p>
                                {data.actionLinkType !== 'none' && (
                                    <div className="mt-2">
                                        <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                            Ver Detalhes
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
