'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Bell,
    Check,
    Trash2,
    Info,
    Star,
    Trophy,
    AlertTriangle,
    CheckCircle2,
    Filter,
    Settings,
    MoreVertical,
    Users,
    X as CloseIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR, enUS, es } from 'date-fns/locale'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { AppLayout } from '@/components/layout/AppLayout'
// ... (skip lines 54-340 handled by context matching or separate edits if logic is split? No, I need to insert specific blocks)
// I will split this into multiple chunks for safety.

// Chunk 1: Import


interface Notification {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'group_invite' | 'points' | 'join_request' | 'join_request_result'
    is_read: boolean
    created_at: string
    data?: any
}

function NotificationsContent() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const searchParams = useSearchParams()
    const router = useRouter()
    const supabase = createClient()
    const t = useTranslations('notifications')
    const locale = useLocale()
    const [mounted, setMounted] = useState(false)
    const { isSupported, subscription, subscribeToPush, testPush, loading: pushLoading, error: pushError } = usePushNotifications()

    useEffect(() => {
        setMounted(true)
    }, [])

    const getLocale = () => {
        switch (locale) {
            case 'en': return enUS
            case 'es': return es
            default: return ptBR
        }
    }

    const translateNotification = (text: string, data?: any) => {
        if (!text) return ''
        if (text.startsWith('notifications.')) {
            const key = text.substring('notifications.'.length)
            try {
                return t(key, data)
            } catch (e) {
                return text
            }
        }
        return text
    }

    // Sync filter with URL
    const filter = (searchParams.get('tab') || 'all') as 'all' | 'unread' | 'read' | 'invites' | 'settings'

    const fetchNotifications = useCallback(async (userId: string) => {
        if (filter === 'settings') {
            setLoading(false)
            return
        }

        setLoading(true)
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (filter === 'unread') {
            query = query.eq('is_read', false)
        } else if (filter === 'read') {
            query = query.eq('is_read', true)
        } else if (filter === 'invites') {
            query = query.eq('type', 'group_invite')
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching notifications:', error)
        } else {
            setNotifications(data as Notification[])
        }
        setLoading(false)
    }, [filter, supabase])

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
            setProfile(profile)
            setIsAdmin(profile?.is_admin || profile?.is_super_admin)

            fetchNotifications(user.id)
        }
        getUser()
    }, [supabase, router, fetchNotifications])

    const markAsRead = async (id: string, isRead: boolean) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: !isRead })
            .eq('id', id)

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: !isRead } : n))
        }
    }

    const markAllAsRead = async () => {
        if (!user) return
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        }
    }

    const deleteNotification = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)

        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id))
        }
    }

    const acceptInvitation = async (notification: Notification) => {
        if (!user || !notification.data?.group_id) return

        try {
            // 1. Join group (trigger 008 will handle invitation status)
            const { error: joinError } = await supabase
                .from('group_members')
                .insert({
                    group_id: notification.data.group_id,
                    user_id: user.id,
                    role: 'member'
                })

            if (joinError) {
                if (joinError.code === '23505') { // Already a member
                    alert(t('status.alreadyMember'))
                } else {
                    throw joinError
                }
            }

            // 2. Mark notification as read
            await markAsRead(notification.id, false)

            alert(t('status.acceptSuccess'))

            // 3. Redirect to group page
            router.push(`/groups/${notification.data.group_id}`)
        } catch (error: any) {
            console.error('Error accepting invitation:', error)
            alert(t('status.acceptError') + error.message)
        }
    }

    const declineInvitation = async (notificationId: string) => {
        // Just mark as read / archive
        await markAsRead(notificationId, false)
        alert(t('status.declineSuccess'))
    }

    const handleJoinRequest = async (notification: Notification, action: 'approve' | 'reject') => {
        if (!notification.data?.pending_member_id) return

        try {
            const res = await fetch(`/api/groups/approve-member?id=${notification.data.pending_member_id}&action=${action}`)
            if (res.ok) {
                alert(action === 'approve' ? t('status.approveSuccess') : t('status.rejectSuccess'))
                await markAsRead(notification.id, false)
                if (action === 'approve' && notification.data.group_id) {
                    router.push(`/groups/${notification.data.group_id}`)
                }
            } else {
                const data = await res.json()
                throw new Error(data.error || t('status.processError'))
            }
        } catch (error: any) {
            alert(error.message)
        }
    }

    const getIcon = (type?: string) => {
        if (!type) return <Info className="h-5 w-5 text-blue-500" />
        switch (type) {
            case 'success': return <Star className="h-5 w-5 text-green-500" />
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />
            case 'points': return <Trophy className="h-5 w-5 text-yellow-500" />
            case 'group_invite': return <Users className="h-5 w-5 text-purple-500" />
            case 'join_request': return <Users className="h-5 w-5 text-blue-500" />
            case 'join_request_result': return <Check className="h-5 w-5 text-green-500" />
            default: return <Info className="h-5 w-5 text-blue-500" />
        }
    }

    const setTab = (tab: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (tab === 'all') {
            params.delete('tab')
        } else {
            params.set('tab', tab)
        }
        router.push(`/notifications?${params.toString()}`)
    }

    return (
        <AppLayout user={user} profile={profile} isAdmin={isAdmin}>
            <HeaderSetter title={t('title')} />
            <div className="mx-auto max-w-4xl">
                <div className="mb-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex-1">{t('stayTuned')}</p>
                        <button
                            onClick={markAllAsRead}
                            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-green-600/10 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-green-600 transition-all hover:bg-green-600 hover:text-white active:scale-95 disabled:opacity-50 dark:bg-green-500/10 dark:text-green-500 dark:hover:bg-green-500 dark:hover:text-white"
                            disabled={notifications.filter(n => !n.is_read).length === 0}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('markAsRead')}
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setTab('all')}
                        className={cn(
                            "px-2 py-2 text-sm font-medium transition-all relative flex-shrink-0",
                            filter === 'all'
                                ? "text-green-600 dark:text-green-500 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-green-600 dark:after:bg-green-500"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {t('all')}
                    </button>
                    <button
                        onClick={() => setTab('unread')}
                        className={cn(
                            "px-2 py-2 text-sm font-medium transition-all relative flex-shrink-0",
                            filter === 'unread'
                                ? "text-green-600 dark:text-green-500 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-green-600 dark:after:bg-green-500"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {t('unread')}
                        {notifications.filter(n => !n.is_read).length > 0 && filter !== 'unread' && (
                            <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                {notifications.filter(n => !n.is_read).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('read')}
                        className={cn(
                            "px-2 py-2 text-sm font-medium transition-all relative flex-shrink-0",
                            filter === 'read'
                                ? "text-green-600 dark:text-green-500 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-green-600 dark:after:bg-green-500"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {t('read')}
                    </button>
                    <button
                        onClick={() => setTab('invites')}
                        className={cn(
                            "px-2 py-2 text-sm font-medium transition-all relative flex-shrink-0",
                            filter === 'invites'
                                ? "text-green-600 dark:text-green-500 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-green-600 dark:after:bg-green-500"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {t('invites')}
                        {notifications.filter(n => n.type === 'group_invite' && !n.is_read).length > 0 && filter !== 'invites' && (
                            <span className="ml-2 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                {notifications.filter(n => n.type === 'group_invite' && !n.is_read).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('settings')}
                        className={cn(
                            "px-2 py-2 text-sm font-medium transition-all relative flex-shrink-0",
                            filter === 'settings'
                                ? "text-green-600 dark:text-green-500 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-green-600 dark:after:bg-green-500"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                        title={t('settings')}
                    >
                        <Settings className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                {filter === 'settings' ? (
                    <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('settings')}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('settingsDesc')}</p>
                        </div>

                        <div className="space-y-4 pt-4">
                            {/* Push Notifications Section */}
                            <div className="rounded-lg bg-green-50 p-4 border border-green-100 dark:bg-green-950/10 dark:border-green-900/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-green-900 dark:text-green-400">Notificações Push (App)</h3>
                                        <p className="text-sm text-green-800/80 dark:text-green-500/80">
                                            Receba alertas no seu dispositivo mesmo com o app fechado via PWA.
                                        </p>
                                    </div>
                                    {!isSupported ? (
                                        <span className="text-xs text-red-500 font-medium">Navegador não suportado</span>
                                    ) : (
                                        <button
                                            onClick={subscription ? () => { } : subscribeToPush}
                                            disabled={pushLoading || !!subscription}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                                subscription
                                                    ? "bg-green-200 text-green-800 cursor-default"
                                                    : "bg-green-600 text-white hover:bg-green-700 active:scale-95 shadow-sm"
                                            )}
                                        >
                                            {pushLoading ? 'Carregando...' : subscription ? 'Ativado ✓' : 'Ativar Agora'}
                                        </button>
                                    )}
                                </div>
                                {subscription && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <button onClick={testPush} className="text-xs font-semibold text-green-700 underline hover:text-green-800 dark:text-green-500 dark:hover:text-green-400">
                                            Testar Notificação
                                        </button>
                                    </div>
                                )}
                                {pushError && <p className="mt-2 text-xs text-red-500 font-medium">{pushError}</p>}
                            </div>

                            {[
                                { id: 'new_member', label: t('preferences.newMemberTitle'), desc: t('preferences.newMemberDesc') },
                                { id: 'points_rank', label: t('preferences.pointsRankTitle'), desc: t('preferences.pointsRankDesc') },
                                { id: 'rule_change', label: t('preferences.ruleChangeTitle'), desc: t('preferences.ruleChangeDesc') },
                                { id: 'bet_reminder', label: t('preferences.betReminderTitle'), desc: t('preferences.betReminderDesc') }
                            ].map((setting) => (
                                <div key={setting.id} className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{setting.label}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{setting.desc}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={profile?.notification_settings?.[setting.id] !== false}
                                            onChange={async (e) => {
                                                const newVal = e.target.checked
                                                const newSettings = {
                                                    ...(profile?.notification_settings || {
                                                        new_member: true,
                                                        points_rank: true,
                                                        rule_change: true,
                                                        bet_reminder: true
                                                    }),
                                                    [setting.id]: newVal
                                                }

                                                const { error } = await supabase
                                                    .from('profiles')
                                                    .update({ notification_settings: newSettings })
                                                    .eq('id', user.id)

                                                if (!error) {
                                                    setProfile({ ...profile, notification_settings: newSettings })
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Notifications List */
                    <div className="space-y-3">
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-white dark:bg-slate-900 shadow-sm" />
                                ))}
                            </div>
                        ) : notifications.length > 0 ? (
                            notifications.filter(Boolean).map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => {
                                        if (!notification.is_read) markAsRead(notification.id, false)
                                        if (notification.data?.link) {
                                            router.push(notification.data.link)
                                        }
                                    }}
                                    className={cn(
                                        "group relative flex gap-4 rounded-xl border p-4 transition-all duration-200 cursor-pointer",
                                        notification.is_read
                                            ? "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                                            : "bg-green-50/50 border-green-100 dark:bg-green-950/10 dark:border-green-900/30 shadow-sm",
                                        notification.data?.link && "hover:border-green-500 dark:hover:border-green-500"
                                    )}
                                >
                                    <div className="mt-1 flex-shrink-0">
                                        <div className={cn(
                                            "flex h-10 w-10 items-center justify-center rounded-full",
                                            notification.is_read ? "bg-slate-100 dark:bg-slate-800" : "bg-green-100 dark:bg-green-900/40"
                                        )}>
                                            {getIcon(notification.type)}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <h3 className={cn(
                                                "text-sm font-bold",
                                                notification.is_read ? "text-slate-700 dark:text-slate-300" : "text-green-900 dark:text-green-400"
                                            )}>
                                                {translateNotification(notification.title, notification.data)}
                                            </h3>
                                            <span className="text-xs text-slate-400" suppressHydrationWarning>
                                                {mounted && notification.created_at ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: getLocale() }) : ''}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                            {translateNotification(notification.message, notification.data)}
                                        </p>

                                        {notification.type === 'group_invite' && !notification.is_read && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        acceptInvitation(notification)
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    {t('acceptInvite')}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        declineInvitation(notification.id)
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 active:scale-95"
                                                >
                                                    <CloseIcon className="h-3.5 w-3.5" />
                                                    {t('decline')}
                                                </button>
                                            </div>
                                        )}

                                        {notification.type === 'join_request' && !notification.is_read && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleJoinRequest(notification, 'approve')
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    {t('approveRequest')}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleJoinRequest(notification, 'reject')
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 active:scale-95"
                                                >
                                                    <CloseIcon className="h-3.5 w-3.5" />
                                                    {t('decline')}
                                                </button>
                                            </div>
                                        )}

                                        {notification.data?.link && notification.type !== 'group_invite' && notification.type !== 'join_request' && (
                                            <div className="mt-4">
                                                <button
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                                                >
                                                    {t('viewDetails')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-shrink-0 items-start gap-1 ml-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                markAsRead(notification.id, notification.is_read)
                                            }}
                                            className={cn(
                                                "p-2 rounded-lg transition-colors",
                                                notification.is_read
                                                    ? "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    : "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40"
                                            )}
                                            title={notification.is_read ? t('markAsUnread') : t('markAsRead')}
                                        >
                                            {notification.is_read ? <Bell className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteNotification(notification.id)
                                            }}
                                            className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors"
                                            title={t('delete')}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
                                    <Bell className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('empty')}</h3>
                                <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                                    {filter === 'unread'
                                        ? t('emptyUnread')
                                        : t('emptyAll')}
                                </p>
                                <button
                                    onClick={() => setTab('all')}
                                    className="mt-6 text-sm font-semibold text-green-600 hover:text-green-700 dark:text-green-500"
                                >
                                    {t('viewAll')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}

function NotificationsLoading() {
    const t = useTranslations('notifications')
    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
                <p className="text-slate-500 dark:text-slate-400 animate-pulse">{t('loading')}</p>
            </div>
        </div>
    )
}

export default function NotificationsPage() {
    return (
        <Suspense fallback={<NotificationsLoading />}>
            <NotificationsContent />
        </Suspense>
    )
}
