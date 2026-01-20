'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Crown, LayoutDashboard, Trophy, Ticket, Settings, Menu, X, ExternalLink, ChevronLeft, ChevronRight, Megaphone, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    isAdmin?: boolean
}

export function AppSidebar({ className, isOpen, setIsOpen, isAdmin }: SidebarProps) {
    const pathname = usePathname()
    const t = useTranslations('sidebar')

    // Menu items com traduções
    const sidebarItems = [
        { title: t('dashboard'), icon: LayoutDashboard, href: '/dashboard' },
        { title: t('myGroups'), icon: Trophy, href: '/groups' },
        { title: t('myBets'), icon: Ticket, href: '/bets' },
    ]

    const adminItems = [
        { title: t('adminHome'), icon: LayoutDashboard, href: '/admin' },
        { title: t('manageEvents'), icon: Settings, href: '/admin/events' },
        { title: t('manageTeams'), icon: Crown, href: '/admin/teams' },
        { title: t('marketing'), icon: Megaphone, href: '/admin/marketing' },
        { title: t('syncLogs'), icon: ExternalLink, href: '/admin/logs' },
        { title: t('translations'), icon: Languages, href: '/admin/i18n' },
    ]

    // Local state for desktop collapse, defaulting to false (expanded)
    const [isCollapsed, setIsCollapsed] = React.useState(false)

    // Close mobile sidebar on route change
    React.useEffect(() => {
        setIsOpen(false)
    }, [pathname, setIsOpen])

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out lg:static lg:inset-auto flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    isCollapsed ? "lg:w-20" : "lg:w-64",
                    "w-64", // Mobile always 64
                    className
                )}
            >
                {/* Header */}
                <div className={cn("flex h-16 items-center bg-green-700 transition-all duration-300", isCollapsed ? "justify-center px-0" : "justify-between px-6")}>
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight overflow-hidden whitespace-nowrap text-white">
                        <div className="relative h-8 w-8 flex-shrink-0">
                            <Image
                                src="/logo-new.png"
                                alt="JãoBolão"
                                fill
                                className="object-cover rounded-xl" // Rounded corners fix
                            />
                        </div>
                        <span className={cn("transition-opacity duration-300", isCollapsed ? "opacity-0 w-0" : "opacity-100")}>JãoBolão</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden text-white/80 hover:text-white"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Desktop Toggle Button */}
                <div className="hidden lg:flex justify-end p-2 border-b border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={isCollapsed ? t('expand') : t('collapse')}
                    >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>

                {/* Nav Items */}
                <div className="flex flex-col gap-6 p-4 flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="space-y-1">
                        {sidebarItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={isCollapsed ? item.title : ''}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                                        isActive
                                            ? "bg-green-600 text-white shadow-sm shadow-green-200 dark:shadow-none"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                                        isCollapsed && "justify-center px-2"
                                    )}
                                >
                                    <item.icon className={cn("h-4 w-4 flex-shrink-0 transition-transform", isActive ? "scale-110" : "")} />
                                    <span className={cn("transition-all duration-300", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100")}>
                                        {item.title}
                                    </span>
                                </Link>
                            )
                        })}
                    </div>

                    {isAdmin && (
                        <div>
                            <div className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap overflow-hidden transition-all", isCollapsed ? "opacity-0 h-0 my-0" : "opacity-100")}>
                                {t('admin')}
                            </div>
                            <div className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                                {adminItems.map((item) => {
                                    const isActive = item.href === '/admin'
                                        ? pathname === '/admin'
                                        : pathname.startsWith(item.href)
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={isCollapsed ? item.title : ''}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                                                isActive
                                                    ? "bg-green-600 text-white shadow-sm shadow-green-200 dark:shadow-none"
                                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                                                isCollapsed && "justify-center px-2"
                                            )}
                                        >
                                            <item.icon className={cn("h-4 w-4 flex-shrink-0 transition-transform", isActive ? "scale-110" : "")} />
                                            <span className={cn("transition-all duration-300", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100")}>
                                                {item.title}
                                            </span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={cn("p-4 transition-all duration-300", isCollapsed ? "items-center" : "")}>
                    <div className={cn("rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 overflow-hidden whitespace-nowrap transition-colors", isCollapsed ? "p-2 bg-transparent border-0" : "")}>
                        {!isCollapsed && (
                            <>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('version')}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t('madeWith')}</p>
                            </>
                        )}
                        {isCollapsed && <div className="w-2 h-2 rounded-full bg-green-500 mx-auto" title="Online" />}
                    </div>
                </div>
            </div>
        </>
    )
}
