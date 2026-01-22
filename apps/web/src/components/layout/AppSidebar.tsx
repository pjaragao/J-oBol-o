'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Crown, LayoutDashboard, Trophy, Ticket, Settings, Menu, X, ExternalLink, ChevronLeft, ChevronRight, Megaphone, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useUserGroups } from '@/hooks/useUserGroups'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    isAdmin?: boolean
    userId?: string
}

export function AppSidebar({ className, isOpen, setIsOpen, isAdmin, userId }: SidebarProps) {
    const pathname = usePathname()
    const t = useTranslations('sidebar')
    const { groups, loading } = useUserGroups(userId)

    // Menu items com traduções
    const sidebarItems = [
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
                                sizes="32px"
                                className="object-cover rounded-xl" // Rounded corners fix
                            />
                        </div>
                        <span className={cn("transition-opacity duration-300", isCollapsed ? "opacity-0 w-0" : "opacity-100")}>JãoBolão</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden text-white/80 hover:text-white"
                        suppressHydrationWarning
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
                <div className="flex flex-col gap-6 p-4 flex-1 overflow-hidden">
                    <div className="space-y-1">
                        {sidebarItems.map((item, index) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                            const isMyGroupsItem = item.href === '/groups'

                            // For "My Groups" item, render with subitems
                            if (isMyGroupsItem && !isCollapsed) {
                                return (
                                    <div key={item.href} className="space-y-1">
                                        {/* Main Item */}
                                        <Link
                                            href={item.href}
                                            title={isCollapsed ? item.title : ''}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                                                isActive
                                                    ? "bg-green-600 text-white shadow-sm shadow-green-200 dark:shadow-none"
                                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                                            )}
                                        >
                                            <item.icon className={cn("h-4 w-4 flex-shrink-0 transition-transform", isActive ? "scale-110" : "")} />
                                            <span className="transition-all duration-300">
                                                {item.title}
                                            </span>
                                        </Link>

                                        {/* Subitems (Groups) - Always visible */}
                                        {groups.length > 0 && (
                                            <div className="pl-9 space-y-0.5 pt-1">
                                                {loading ? (
                                                    <div className="py-2 px-2 text-xs text-slate-400">
                                                        Loading...
                                                    </div>
                                                ) : (
                                                    <>
                                                        {groups.slice(0, 5).map((group) => {
                                                            const isGroupActive = pathname === `/groups/${group.id}` || pathname.startsWith(`/groups/${group.id}/`)

                                                            return (
                                                                <Link
                                                                    key={group.id}
                                                                    href={`/groups/${group.id}`}
                                                                    className={cn(
                                                                        "flex items-center gap-2 py-1.5 px-2 rounded-md text-xs font-medium transition-all group/subitem",
                                                                        isGroupActive
                                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                                                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
                                                                    )}
                                                                >
                                                                    {/* Event Logo or Indicator */}
                                                                    {group.events?.logo_url ? (
                                                                        <div className="w-4 h-4 flex-shrink-0 bg-white dark:bg-white rounded p-0.5 shadow-sm border border-slate-200">
                                                                            <img
                                                                                src={group.events.logo_url}
                                                                                alt=""
                                                                                className="w-full h-full object-contain"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className={cn(
                                                                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                                                            isGroupActive ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                                                                        )} />
                                                                    )}
                                                                    <span className="truncate flex-1">{group.name}</span>
                                                                </Link>
                                                            )
                                                        })}

                                                        {groups.length > 5 && (
                                                            <Link
                                                                href="/groups"
                                                                className="flex items-center gap-2 py-1.5 px-2 text-[10px] font-semibold text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                                                            >
                                                                <span>+ {t('viewAllGroups')} ({groups.length})</span>
                                                            </Link>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            }

                            // Regular items (My Bets, etc.) or collapsed My Groups
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
            </div>
        </>
    )
}
