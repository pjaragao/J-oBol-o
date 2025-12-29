'use client'

import { Home, Ticket, Trophy, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GroupBottomNavProps {
    activeTab: 'dashboard' | 'bets' | 'ranking' | 'members' | 'settings'
    setActiveTab: (tab: 'dashboard' | 'bets' | 'ranking' | 'members' | 'settings') => void
    isAdmin: boolean
}

export function GroupBottomNav({ activeTab, setActiveTab, isAdmin }: GroupBottomNavProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe sm:hidden">
            <div className={cn("grid h-16 items-center px-2", isAdmin ? "grid-cols-5" : "grid-cols-4")}>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 h-full w-full transition-colors active:scale-95",
                        activeTab === 'dashboard' ? "text-green-600 dark:text-green-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                    )}
                >
                    <Home className={cn("h-6 w-6", activeTab === 'dashboard' && "fill-current")} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Início</span>
                </button>

                <button
                    onClick={() => setActiveTab('bets')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 h-full w-full transition-colors active:scale-95",
                        activeTab === 'bets' ? "text-green-600 dark:text-green-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                    )}
                >
                    <Ticket className={cn("h-6 w-6", activeTab === 'bets' && "fill-current")} strokeWidth={activeTab === 'bets' ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Apostas</span>
                </button>

                <button
                    onClick={() => setActiveTab('ranking')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 h-full w-full transition-colors active:scale-95",
                        activeTab === 'ranking' ? "text-green-600 dark:text-green-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                    )}
                >
                    <Trophy className={cn("h-6 w-6", activeTab === 'ranking' && "fill-current")} strokeWidth={activeTab === 'ranking' ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Ranking</span>
                </button>

                <button
                    onClick={() => setActiveTab('members')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 h-full w-full transition-colors active:scale-95",
                        activeTab === 'members' ? "text-green-600 dark:text-green-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                    )}
                >
                    <Users className={cn("h-6 w-6", activeTab === 'members' && "fill-current")} strokeWidth={activeTab === 'members' ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">Membros</span>
                </button>

                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 h-full w-full transition-colors active:scale-95",
                            activeTab === 'settings' ? "text-green-600 dark:text-green-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                        )}
                    >
                        <Settings className={cn("h-6 w-6", activeTab === 'settings' && "fill-current")} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">Admin</span>
                    </button>
                )}
            </div>
        </div>
    )
}
