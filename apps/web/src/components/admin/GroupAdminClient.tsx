'use client'

import * as React from 'react'
import { Trophy, Users, Search, ChevronDown, ChevronUp, Shield, DollarSign, Calendar, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CreatorProfile {
    id: string
    display_name: string
    email: string
    avatar_url: string | null
}

interface GroupMember {
    role: string
    payment_status: 'PENDING' | 'PAID' | 'EXEMPT'
    joined_at: string
    profile: {
        id: string
        display_name: string
        email: string
        avatar_url: string | null
    } | null
}

interface GroupData {
    id: string
    name: string
    description: string | null
    created_at: string
    entry_fee: number
    is_public: boolean
    max_members: number
    payment_method: 'ONLINE' | 'OFFLINE'
    created_by: string
    creator: CreatorProfile | null
    group_members: GroupMember[]
}

interface GroupAdminClientProps {
    initialGroups: GroupData[]
}

export function GroupAdminClient({ initialGroups }: GroupAdminClientProps) {
    const [searchQuery, setSearchQuery] = React.useState('')
    const [expandedGroupId, setExpandedGroupId] = React.useState<string | null>(null)

    // Calculate Stats
    const totalGroups = initialGroups.length
    const totalMembers = initialGroups.reduce((acc, g) => acc + g.group_members.length, 0)
    
    const paidMembers = initialGroups.reduce((acc, g) => {
        return acc + g.group_members.filter(m => m.payment_status === 'PAID').length
    }, 0)

    const totalVolume = initialGroups.reduce((acc, g) => {
        const paidCount = g.group_members.filter(m => m.payment_status === 'PAID').length
        return acc + (Number(g.entry_fee) * paidCount)
    }, 0)

    // Filter Groups
    const filteredGroups = React.useMemo(() => {
        if (!searchQuery.trim()) return initialGroups

        const query = searchQuery.toLowerCase()
        return initialGroups.filter(group => {
            const groupName = group.name.toLowerCase()
            const groupDesc = (group.description || '').toLowerCase()
            const creatorName = (group.creator?.display_name || '').toLowerCase()
            const creatorEmail = (group.creator?.email || '').toLowerCase()

            return groupName.includes(query) || 
                   groupDesc.includes(query) || 
                   creatorName.includes(query) || 
                   creatorEmail.includes(query)
        })
    }, [initialGroups, searchQuery])

    const toggleExpand = (groupId: string) => {
        setExpandedGroupId(prev => (prev === groupId ? null : groupId))
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Link 
                            href="/admin" 
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">Admin</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Administração de Grupos
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Visualize e gerencie todos os bolões criados no JãoBolão, seus organizadores e participantes.
                    </p>
                </div>
            </div>

            {/* Stats Summary Card Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total de Grupos</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{totalGroups}</p>
                        </div>
                        <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                            <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total de Membros</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{totalMembers}</p>
                        </div>
                        <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
                            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Membros Pagos</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                                {paidMembers}
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium ml-1">
                                    ({totalMembers > 0 ? Math.round((paidMembers / totalMembers) * 100) : 0}%)
                                </span>
                            </p>
                        </div>
                        <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                            <Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Volume Arrecadado</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVolume)}
                            </p>
                        </div>
                        <div className="h-12 w-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                            <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter controls */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
                <input
                    type="text"
                    placeholder="Filtrar por nome do grupo, nome do criador ou e-mail..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm py-1"
                />
            </div>

            {/* Groups Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Grupo</th>
                                <th className="px-6 py-4">Criador</th>
                                <th className="px-6 py-4 text-center">Participantes</th>
                                <th className="px-6 py-4 text-right">Inscrição</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        Nenhum grupo encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                filteredGroups.map((group) => {
                                    const isExpanded = expandedGroupId === group.id
                                    const totalGroupMembers = group.group_members.length
                                    const paidGroupMembers = group.group_members.filter(m => m.payment_status === 'PAID').length

                                    return (
                                        <React.Fragment key={group.id}>
                                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 dark:text-white">
                                                            {group.name}
                                                        </span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 max-w-xs">
                                                            {group.description || 'Sem descrição'}
                                                        </span>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                                group.is_public 
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                            }`}>
                                                                {group.is_public ? 'Público' : 'Privado'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {format(new Date(group.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {group.creator ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 flex-shrink-0">
                                                                {group.creator.avatar_url ? (
                                                                    <img src={group.creator.avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" />
                                                                ) : (
                                                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                                                                        <span className="font-bold text-xs leading-none text-slate-600 dark:text-slate-300">
                                                                            {group.creator.display_name.charAt(0).toUpperCase()}
                                                                        </span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                    {group.creator.display_name}
                                                                </span>
                                                                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                    <Mail className="h-3 w-3" />
                                                                    {group.creator.email}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-slate-400">Criador desconhecido</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                            {totalGroupMembers} / {group.max_members}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 mt-1">
                                                            {paidGroupMembers} pagos
                                                        </span>
                                                        <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                                                            <div 
                                                                className="bg-green-600 h-full rounded-full" 
                                                                style={{ width: `${Math.min(100, (totalGroupMembers / group.max_members) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(group.entry_fee)}
                                                        </span>
                                                        <span className={`text-[10px] font-extrabold uppercase mt-1 px-1.5 py-0.5 rounded ${
                                                            group.payment_method === 'ONLINE' 
                                                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' 
                                                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                                        }`}>
                                                            {group.payment_method}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleExpand(group.id)}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    >
                                                        {isExpanded ? (
                                                            <>
                                                                Ocultar <ChevronUp className="h-3.5 w-3.5" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                Membros ({totalGroupMembers}) <ChevronDown className="h-3.5 w-3.5" />
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                            
                                            {/* Collapsible Members Sub-table */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30">
                                                        <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-800 p-4 shadow-inner">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                                                                    <Users className="h-4 w-4 text-green-600" />
                                                                    Lista de Participantes ({group.group_members.length})
                                                                </h4>
                                                            </div>
                                                            {group.group_members.length === 0 ? (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                                                                    Este grupo não possui participantes ainda.
                                                                </p>
                                                            ) : (
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs border-collapse">
                                                                        <thead>
                                                                            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 pb-2">
                                                                                <th className="pb-2 font-bold uppercase">Nome</th>
                                                                                <th className="pb-2 font-bold uppercase">E-mail</th>
                                                                                <th className="pb-2 font-bold uppercase text-center">Função</th>
                                                                                <th className="pb-2 font-bold uppercase text-center">Pagamento</th>
                                                                                <th className="pb-2 font-bold uppercase text-right">Data de Entrada</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                                                            {group.group_members.map((member, mIdx) => {
                                                                                const mProfile = member.profile
                                                                                if (!mProfile) return null

                                                                                return (
                                                                                    <tr key={mProfile.id || mIdx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/5">
                                                                                        <td className="py-2.5">
                                                                                            <div className="flex items-center gap-2.5">
                                                                                                <div className="h-7 w-7 flex-shrink-0">
                                                                                                    {mProfile.avatar_url ? (
                                                                                                        <img src={mProfile.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                                                                                                    ) : (
                                                                                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                                                                                                            <span className="font-bold text-[10px] leading-none text-slate-600 dark:text-slate-300">
                                                                                                                {mProfile.display_name.charAt(0).toUpperCase()}
                                                                                                            </span>
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                                                    {mProfile.display_name}
                                                                                                </span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="py-2.5 text-slate-500 dark:text-slate-400">
                                                                                            {mProfile.email}
                                                                                        </td>
                                                                                        <td className="py-2.5 text-center">
                                                                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                                                                                member.role === 'admin' 
                                                                                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                                                                                                    : member.role === 'moderator'
                                                                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                                                            }`}>
                                                                                                {member.role}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2.5 text-center">
                                                                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                                                                                member.payment_status === 'PAID' 
                                                                                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                                                                                                    : member.payment_status === 'EXEMPT'
                                                                                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                                                                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                                                            }`}>
                                                                                                {member.payment_status}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2.5 text-right text-slate-400 dark:text-slate-500">
                                                                                            {format(new Date(member.joined_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                                                                        </td>
                                                                                    </tr>
                                                                                )
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
