'use client'

import { useState, useTransition } from 'react'
import { Search, Users, Trophy, Globe, Shield, ArrowRight } from 'lucide-react'
import { searchPublicGroups } from '@/actions/groups'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type PublicGroup = {
    id: string
    name: string
    description: string | null
    is_public: boolean
    is_paid: boolean
    entry_fee: number
    event: {
        name: string
        logo_url: string | null
    }
    memberCount: number
    prizePool: number
}

export function PublicGroupsSearch() {
    const t = useTranslations('groups')
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PublicGroup[]>([])
    const [isPending, startTransition] = useTransition()
    const [hasSearched, setHasSearched] = useState(false)

    const handleSearch = () => {
        if (!query.trim()) return
        startTransition(async () => {
            const data = await searchPublicGroups(query)
            setResults(data as PublicGroup[])
            setHasSearched(true)
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <section className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 border-l-4 border-slate-300 pl-3">
                    <Search className="h-5 w-5 text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">{t('explorePublic')}</h2>
                </div>

                {/* Search Bar */}
                <div className="relative flex gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('searchPlaceholder')}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-green-500 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isPending || !query.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors"
                    >
                        {isPending ? '...' : t('search')}
                    </button>
                </div>
            </div>

            {/* Results */}
            {hasSearched && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {results.length === 0 ? (
                        <div className="col-span-full bg-slate-50 dark:bg-slate-900/40 p-10 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                            <Globe className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                            <p className="text-slate-500 dark:text-slate-400">{t('noPublicGroupsFound')}</p>
                        </div>
                    ) : (
                        results.map(group => (
                            <Link
                                key={group.id}
                                href={`/groups/join?code=${group.id}`}
                                className="group bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-500 hover:shadow-md transition-all shadow-sm block text-left"
                            >
                                {/* Header with Event Logo */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        {group.event?.logo_url && (
                                            <div className="relative w-6 h-6 bg-white dark:bg-white rounded-md p-0.5 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-300">
                                                <img
                                                    src={group.event.logo_url}
                                                    alt={group.event.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                                            {group.event?.name || t('event')}
                                        </span>
                                    </div>
                                    <Globe className="h-4 w-4 text-green-500" />
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
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        <span>{group.memberCount}</span>
                                    </div>
                                    {group.is_paid && group.prizePool > 0 && (
                                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                            <span>💰</span>
                                            <span>R$ {group.prizePool.toFixed(0)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-400">{t('public')}</span>
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        {t('joinGroup')} <ArrowRight className="h-3 w-3" />
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            )}

            {/* Coming Soon Message (when not searched) */}
            {!hasSearched && (
                <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                    <Globe className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">{t('searchToExplore')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                        {t('searchToExploreDesc')}
                    </p>
                </div>
            )}
        </section>
    )
}
