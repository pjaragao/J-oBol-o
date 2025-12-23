'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu, Moon, Sun, User, LogOut, Settings as SettingsIcon, Bell } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { NotificationBell } from './NotificationBell'

interface HeaderProps {
    setSidebarOpen: (open: boolean) => void
    user?: any
    profile?: any
}

export function AppHeader({ setSidebarOpen, user, profile }: HeaderProps) {
    const { theme, setTheme } = useTheme()
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false) // Simple state for now
    const supabase = createClient()
    const router = useRouter()

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.refresh()
    }

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
            <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
            >
                <Menu className="h-6 w-6" />
            </button>

            <div className="flex flex-1 gap-4 lg:hidden">
                <span className="font-bold text-green-700 dark:text-green-500 ml-2 text-lg">JãoBolão</span>
            </div>

            <div className="flex flex-1 justify-end items-center gap-2 sm:gap-4">
                {user && <NotificationBell userId={user.id} />}

                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute top-2 left-2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </button>

                {user && (
                    <div className="relative ml-2">
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center gap-2 rounded-full bg-slate-100 p-1 pr-3 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white overflow-hidden">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="font-bold text-xs">{profile?.display_name?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:block max-w-[100px] truncate">
                                {profile?.display_name || 'Usuário'}
                            </span>
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-800 dark:ring-slate-700 animate-in fade-in zoom-in duration-200">
                                <Link
                                    href="/profile"
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                                    onClick={() => setIsUserMenuOpen(false)}
                                >
                                    <User className="h-4 w-4" />
                                    Meu Perfil
                                </Link>
                                <button
                                    onClick={handleSignOut}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    )
}
