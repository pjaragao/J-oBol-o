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
    Loader2,
    Gamepad2,
    Shield
} from 'lucide-react'
import {
    getAudiencePreview,
    sendCampaign,
    CampaignFilters,
    CampaignData,
    getEvents,
    searchUsers,
    searchGroups,
    getAdminGroups
} from '../actions'
import { cn } from '@/lib/utils'

export function CampaignForm() {
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const [previewCount, setPreviewCount] = useState<number | null>(null)
    const [events, setEvents] = useState<{ id: string, name: string }[]>([])
    const [useSmartDays, setUseSmartDays] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<{ id: string, name?: string, display_name?: string, email?: string }[]>([])
    const [searching, setSearching] = useState(false)
    const [selectedItems, setSelectedItems] = useState<{ id: string, name: string }[]>([])
    const [adminGroups, setAdminGroups] = useState<{ id: string, name: string, eventId: string, eventName?: string }[]>([])
    const [loadingAdminGroups, setLoadingAdminGroups] = useState(false)
    const [adminGroupsFilter, setAdminGroupsFilter] = useState<string>('')

    const handleSearch = async (query: string) => {
        setSearchQuery(query)
        if (query.length < 2) {
            setSearchResults([])
            return
        }

        setSearching(true)
        let result
        if (filters.audience === 'manual' || filters.audience === 'admin_groups') {
            result = await searchUsers(query)
        } else if (filters.audience === 'groups') {
            result = await searchGroups(query)
        }

        if (result?.success) {
            setSearchResults(result.data.map((item: any) => ({
                id: item.id,
                name: item.display_name || item.name || item.email,
                email: item.email
            })))
        }
        setSearching(true)
        setSearching(false)
    }

    const toggleItem = async (item: { id: string, name: string }) => {
        const isSelected = selectedItems.find(i => i.id === item.id)
        let newItems
        if (isSelected) {
            newItems = selectedItems.filter(i => i.id !== item.id)
            if (filters.audience === 'admin_groups') {
                setAdminGroups([])
            }
        } else {
            // For admin_groups, we only allow one admin (to simplify UI/UX for now)
            if (filters.audience === 'admin_groups') {
                newItems = [item]
                setLoadingAdminGroups(true)
                const result = await getAdminGroups(item.id)
                if (result.success) setAdminGroups(result.data)
                setLoadingAdminGroups(false)
            } else {
                newItems = [...selectedItems, item]
            }
        }
        setSelectedItems(newItems)

        // Sync with filters
        if (filters.audience === 'manual') {
            setFilters({ ...filters, selectedUserIds: newItems.map(i => i.id) })
        } else if (filters.audience === 'groups') {
            setFilters({ ...filters, groupIds: newItems.map(i => i.id) })
        } else if (filters.audience === 'admin_groups') {
            setFilters({ ...filters, adminUserId: newItems[0]?.id, groupIds: [] }) // Reset specific groups when admin changes
        }
    }

    const [filters, setFilters] = useState<CampaignFilters>({
        audience: 'all',
        tier: 'free',
        daysNextMatches: 3,
        daysInactive: 7,
        targetGroupAdmins: false,
        isSystemAdmin: false,
        eventId: undefined,
        selectedUserIds: [],
        groupIds: [],
        adminUserId: undefined
    })

    const [data, setData] = useState<CampaignData>({
        title: '',
        message: '',
        type: 'info',
        actionLinkType: 'fixed',
        fixedLink: '',
        targetTab: 'bets',
        matchFilter: 'pending'
    })

    useEffect(() => {
        async function loadEvents() {
            const { success, data } = await getEvents()
            if (success && data) setEvents(data)
        }
        loadEvents()
    }, [])

    useEffect(() => {
        const fetchPreview = async () => {
            setLoadingPreview(true)
            const result = await getAudiencePreview(filters)
            if (result.success) {
                setPreviewCount(result.count)
                setStatus(null)
            } else {
                setPreviewCount(0)
                setStatus({ type: 'error', message: `Erro no Preview: ${result.message}` })
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

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { id: 'all', label: 'Todos os Usuários', icon: Users, desc: 'Toda a base' },
                            { id: 'tier', label: 'Por Plano', icon: Star, desc: 'Free/Premium/Pro' },
                            { id: 'smart_group', label: 'Campanha Inteligente', icon: Gamepad2, desc: 'Lembretes por grupo' },
                            { id: 'groups', label: 'Grupos Específicos', icon: Trophy, desc: 'Selecionar grupos' },
                            { id: 'admin_groups', label: 'Por Admin', icon: Shield, desc: 'Grupos de um admin' },
                            { id: 'manual', label: 'Usuários Específicos', icon: Target, desc: 'Seleção individual' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => {
                                    setFilters({ ...filters, audience: btn.id as any })
                                    setSelectedItems([])
                                    setSearchResults([])
                                    setSearchQuery('')
                                }}
                                className={cn(
                                    "p-3 rounded-xl border-2 text-left transition-all",
                                    filters.audience === btn.id
                                        ? "border-green-600 bg-green-50/50 dark:bg-green-500/10"
                                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                                )}
                            >
                                <div className="font-bold text-xs flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <btn.icon className={cn("h-3.5 w-3.5", filters.audience === btn.id ? "text-green-600" : "text-slate-400")} />
                                        {btn.label}
                                    </div>
                                    {filters.audience === btn.id && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">{btn.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Manual / Group / Admin Search Section */}
                    {(filters.audience === 'manual' || filters.audience === 'groups' || filters.audience === 'admin_groups') && (
                        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                                {filters.audience === 'manual' ? 'Buscar Usuários' : filters.audience === 'groups' ? 'Buscar Grupos' : 'Buscar Admin do Grupo'}
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder="Digite para buscar..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                />
                                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-green-600" />}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                                    {searchResults.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleItem({ id: item.id, name: item.name! })}
                                            className={cn(
                                                "w-full px-3 py-2 rounded-lg text-left text-xs transition-all flex items-center justify-between",
                                                selectedItems.find(i => i.id === item.id)
                                                    ? "bg-green-600 text-white"
                                                    : "bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                            )}
                                        >
                                            <div>
                                                <p className="font-bold">{item.name}</p>
                                                {item.email && <p className={cn("text-[9px]", selectedItems.find(i => i.id === item.id) ? "text-green-100" : "text-slate-500")}>{item.email}</p>}
                                            </div>
                                            {selectedItems.find(i => i.id === item.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5 opacity-20" />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Selected Items Tags */}
                            {selectedItems.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex flex-wrap gap-2">
                                        {selectedItems.map(item => (
                                            <div key={item.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold border border-green-200 dark:border-green-800/50 animate-in zoom-in-95">
                                                {item.name}
                                                <button onClick={() => toggleItem(item)} className="hover:text-green-900 dark:hover:text-green-200">
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin Groups Selection (Specific for admin_groups audience) */}
                            {filters.audience === 'admin_groups' && selectedItems.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grupos deste Admin</label>
                                        <select
                                            value={adminGroupsFilter}
                                            onChange={(e) => setAdminGroupsFilter(e.target.value)}
                                            className="text-[10px] py-1 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                                        >
                                            <option value="">Filtrar por Campeonato</option>
                                            {[...new Set(adminGroups.map(g => g.eventName))].filter(Boolean).map(evtName => (
                                                <option key={evtName} value={evtName!}>{evtName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {loadingAdminGroups ? (
                                        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <p className="text-[10px]">Carregando grupos...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 pb-2">
                                            {adminGroups
                                                .filter(g => !adminGroupsFilter || g.eventName === adminGroupsFilter)
                                                .map(group => {
                                                    const isSelected = filters.groupIds?.includes(group.id)
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => {
                                                                const newIds = isSelected
                                                                    ? (filters.groupIds || []).filter(id => id !== group.id)
                                                                    : [...(filters.groupIds || []), group.id]
                                                                setFilters({ ...filters, groupIds: newIds })
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all",
                                                                isSelected
                                                                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20"
                                                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                                                isSelected ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                                                            )}>
                                                                <Trophy className={cn("h-4 w-4", isSelected ? "text-white" : "text-slate-400")} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold truncate">{group.name}</p>
                                                                <p className={cn("text-[9px] uppercase font-medium", isSelected ? "text-blue-100" : "text-slate-500")}>
                                                                    {group.eventName || 'Campeonato Indefinido'}
                                                                </p>
                                                            </div>
                                                            {isSelected && <CheckCircle2 className="h-4 w-4" />}
                                                        </button>
                                                    )
                                                })}
                                            {adminGroups.length === 0 && (
                                                <p className="col-span-full py-4 text-center text-[10px] text-slate-500 italic">
                                                    Nenhum grupo encontrado para este administrador.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-[9px] text-slate-400 italic">
                                        * Se nenhum grupo for selecionado acima, a campanha será enviada para TODOS os grupos deste administrador.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Conditional Options */}
                    <div className="mt-6 pt-6 border-t border-dashed border-slate-100 dark:border-slate-800 space-y-6">
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

                        {/* Additional Filters: Event & System Admin (Shared by most audiences) */}
                        {(filters.audience === 'all' || filters.audience === 'tier' || filters.audience === 'smart_group') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por Campeonato</label>
                                    <div className="relative">
                                        <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <select
                                            value={filters.eventId || ''}
                                            onChange={(e) => setFilters({ ...filters, eventId: e.target.value || undefined })}
                                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none appearance-none"
                                        >
                                            <option value="">Todos os Campeonatos</option>
                                            {events.map(ev => (
                                                <option key={ev.id} value={ev.id}>{ev.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {(filters.audience === 'all' || filters.audience === 'tier') && (
                                    <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <Shield className="h-3.5 w-3.5 text-blue-600" />
                                                <span className="text-sm font-bold">Apenas Admins do Sistema</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">Apenas usuários com 'is_admin = true'.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={filters.isSystemAdmin}
                                                onChange={(e) => setFilters({ ...filters, isSystemAdmin: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

                        {filters.audience === 'smart_group' && (
                            <div className="space-y-4 pt-2">
                                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-500/5 text-[11px] text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex gap-2">
                                    <Info className="h-4 w-4 shrink-0" />
                                    <p>Esta campanha gerará notificações individuais para cada grupo que atenda aos filtros.</p>
                                </div>

                                <div className="flex flex-col gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Gamepad2 className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-bold">Critério de Jogos Próximos</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={useSmartDays}
                                                onChange={(e) => {
                                                    setUseSmartDays(e.target.checked)
                                                    setFilters({ ...filters, daysNextMatches: e.target.checked ? 3 : undefined })
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>

                                    {useSmartDays && (
                                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase shrink-0">Jogos nos próximos:</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border rounded-md text-sm outline-none"
                                                    value={filters.daysNextMatches || ''}
                                                    onChange={(e) => setFilters({ ...filters, daysNextMatches: parseInt(e.target.value) || 0 })}
                                                />
                                                <span className="text-xs text-slate-500">dias</span>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-500">
                                        {useSmartDays
                                            ? "Notifica usuários que esqueceram de apostar em jogos próximos."
                                            : "Notifica todos os membros dos grupos filtrados."}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <Target className="h-4 w-4 text-green-600" />
                                                <span className="text-sm font-bold">Apenas Admins</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">Apenas donos de grupo.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={filters.targetGroupAdmins}
                                                onChange={(e) => setFilters({ ...filters, targetGroupAdmins: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </label>
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
                                    {['smart_group', 'groups', 'admin_groups'].includes(filters.audience) && (
                                        <button
                                            onClick={() => setData({ ...data, title: data.title + '{group_name}' })}
                                            className="text-[10px] bg-green-100 dark:bg-green-900/30 hover:bg-green-200 px-2 py-0.5 rounded font-mono text-green-700 dark:text-green-400 animate-in zoom-in-95"
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
                                placeholder={['smart_group', 'groups', 'admin_groups'].includes(filters.audience) ? "Não esqueça seu palpite em {group_name}!" : "Grande partida hoje!"}
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
                                    {['smart_group', 'groups', 'admin_groups'].includes(filters.audience) && (
                                        <button
                                            onClick={() => setData({ ...data, message: data.message + '{group_name}' })}
                                            className="text-[10px] bg-green-100 dark:bg-green-900/30 hover:bg-green-200 px-2 py-0.5 rounded font-mono text-green-700 dark:text-green-400 animate-in zoom-in-95"
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
                                Dica: Use {'{user_name}'} e {['smart_group', 'groups', 'admin_groups'].includes(filters.audience) ? '{group_name}' : ''} para personalizar a mensagem.
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
                                    <option value="fixed">Link Fixo</option>
                                    <option value="dynamic">Página do Grupo (Dinâmico)</option>
                                    <option value="none">Nenhum</option>
                                </select>
                            </div>
                        </div>

                        {data.actionLinkType === 'fixed' && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                                    URL do Link Fixo
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

                        {data.actionLinkType === 'dynamic' && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
                                <div className="flex items-center gap-2 mb-1">
                                    <Target className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Configurações do Link Dinâmico</span>
                                </div>

                                {['all', 'tier', 'manual'].includes(filters.audience) && (
                                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/5 text-[10px] text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex gap-2">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        <p>O link dinâmico requer um contexto de grupo (Smart, Grupos Específicos ou Por Admin). Para esta audiência, ele pode não funcionar como esperado.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aba de Destino</label>
                                        <select
                                            value={data.targetTab || 'bets'}
                                            onChange={(e) => setData({ ...data, targetTab: e.target.value as any })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                                        >
                                            <option value="dashboard">Dashboard</option>
                                            <option value="bets">Apostas</option>
                                            <option value="ranking">Ranking</option>
                                            <option value="members">Membros</option>
                                            <option value="settings">Configurações</option>
                                        </select>
                                    </div>

                                    {data.targetTab === 'bets' && (
                                        <div className="space-y-1.5 animate-in fade-in zoom-in-95">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtro de Partidas</label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: 'all', label: 'Todas' },
                                                    { id: 'pending', label: 'Pendentes' },
                                                    { id: 'completed', label: 'Feitas' },
                                                    { id: 'missed', label: 'Esquecidas' }
                                                ].map(f => (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => setData({ ...data, matchFilter: f.id as any })}
                                                        className={cn(
                                                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                                                            data.matchFilter === f.id
                                                                ? "bg-blue-600 text-white border-blue-600"
                                                                : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                        )}
                                                    >
                                                        {f.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
