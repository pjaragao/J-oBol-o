'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MatchList } from './MatchList'
import { RankingList } from './RankingList'
import { MemberList } from './MemberList'
import { GroupSettings } from './GroupSettings'
import { GroupBottomNav } from './GroupBottomNav'
import GroupDashboard from './GroupDashboard'
import { useTranslations } from 'next-intl'

interface GroupTabsProps {
    groupId: string
    matches: any[]
    group: any
    isAdmin: boolean
    userId: string
}

export function GroupTabs({ groupId, matches, group, isAdmin, userId }: GroupTabsProps) {
    const t = useTranslations('group');
    const searchParams = useSearchParams()
    const router = useRouter()

    // Get tab from URL or fallback to dashboard
    const tabFromUrl = searchParams.get('tab') as any
    const validTabs = ['dashboard', 'bets', 'ranking', 'members', 'settings']
    const initialTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'dashboard'

    const [activeTab, setActiveTab] = useState<'dashboard' | 'bets' | 'ranking' | 'members' | 'settings'>(initialTab)

    // Sync state with URL when it changes (for notifications/links)
    useEffect(() => {
        if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl)
        }
    }, [tabFromUrl])

    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab)
        // Update URL without full reload
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        router.replace(`?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm px-3 py-4 sm:px-6 sm:py-6 min-h-[400px] mb-20 sm:mb-0">
            {/* Desktop Tabs */}
            <div className="hidden sm:flex gap-6 border-b border-gray-100 dark:border-slate-800 mb-6 font-medium text-sm">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`pb-3 border-b-2 transition-colors ${activeTab === 'dashboard'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    {t('dashboard')}
                </button>
                <button
                    onClick={() => setActiveTab('bets')}
                    className={`pb-3 border-b-2 transition-colors ${activeTab === 'bets'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    {t('bets')}
                </button>
                <button
                    onClick={() => handleTabChange('ranking')}
                    className={`pb-3 border-b-2 transition-colors ${activeTab === 'ranking'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    {t('ranking')}
                </button>
                <button
                    onClick={() => handleTabChange('members')}
                    className={`pb-3 border-b-2 transition-colors ${activeTab === 'members'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    {t('members')}
                </button>

                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-3 border-b-2 transition-colors ${activeTab === 'settings'
                            ? 'border-green-600 text-green-700 dark:text-green-400'
                            : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                    >
                        {t('configurations')}
                    </button>
                )}
            </div>

            {activeTab === 'dashboard' && (
                <GroupDashboard
                    groupId={groupId}
                    eventId={group.event_id}
                    userId={userId}
                />
            )}

            {activeTab === 'bets' && (
                <>
                    <h2 className="hidden sm:block text-xl font-bold mb-4 dark:text-white">{t('availableGames')}</h2>
                    <MatchList matches={matches || []} groupId={groupId} userId={userId} />
                </>
            )}

            {activeTab === 'ranking' && (
                <>
                    <h2 className="text-xl font-bold mb-4 dark:text-white">{t('rankingSummary_full') || 'Classificação Geral'}</h2>
                    <RankingList groupId={groupId} eventId={group.event_id} currentUserId={userId} />
                </>
            )}

            {activeTab === 'members' && (
                <MemberList groupId={groupId} />
            )}

            {activeTab === 'settings' && isAdmin && (
                <GroupSettings group={group} matches={matches} userId={userId} />
            )}

            {/* Mobile Bottom Navigation */}
            <GroupBottomNav activeTab={activeTab} setActiveTab={handleTabChange} isAdmin={isAdmin} />
        </div>
    )
}
