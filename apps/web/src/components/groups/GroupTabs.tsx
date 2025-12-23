'use client'

import { useState } from 'react'
import { MatchList } from './MatchList'
import { RankingList } from './RankingList'
import { MemberList } from './MemberList'
import { GroupSettings } from './GroupSettings'
import GroupDashboard from './GroupDashboard'

interface GroupTabsProps {
    groupId: string
    matches: any[]
    group: any
    isAdmin: boolean
    userId: string
}

export function GroupTabs({ groupId, matches, group, isAdmin, userId }: GroupTabsProps) {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'bets' | 'ranking' | 'members' | 'settings'>('dashboard')

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow px-5 py-6 sm:px-6 min-h-[400px]">
            <div className="flex gap-6 border-b border-gray-200 dark:border-slate-700 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`pb-3 border-b-2 font-medium whitespace-nowrap ${activeTab === 'dashboard'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('bets')}
                    className={`pb-3 border-b-2 font-medium whitespace-nowrap ${activeTab === 'bets'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    Apostas
                </button>
                <button
                    onClick={() => setActiveTab('ranking')}
                    className={`pb-3 border-b-2 font-medium whitespace-nowrap ${activeTab === 'ranking'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    Ranking
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={`pb-3 border-b-2 font-medium whitespace-nowrap ${activeTab === 'members'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                        }`}
                >
                    Membros
                </button>

                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-3 border-b-2 font-medium whitespace-nowrap ${activeTab === 'settings'
                            ? 'border-green-600 text-green-700 dark:text-green-400'
                            : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                    >
                        Configurações
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
                    <h2 className="text-xl font-bold mb-4 dark:text-white">Jogos Disponíveis</h2>
                    <MatchList matches={matches || []} groupId={groupId} userId={userId} />
                </>
            )}

            {activeTab === 'ranking' && (
                <>
                    <h2 className="text-xl font-bold mb-4 dark:text-white">Classificação Geral</h2>
                    <RankingList groupId={groupId} />
                </>
            )}

            {activeTab === 'members' && (
                <>
                    <h2 className="text-xl font-bold mb-4 dark:text-white">Membros do Grupo</h2>
                    <MemberList groupId={groupId} />
                </>
            )}

            {activeTab === 'settings' && isAdmin && (
                <GroupSettings group={group} matches={matches} />
            )}
        </div>
    )
}
