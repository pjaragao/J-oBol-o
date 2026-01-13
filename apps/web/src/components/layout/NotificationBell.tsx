'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, Info, AlertTriangle, Trophy, Star, Settings, X, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Notification {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'group_invite' | 'points' | 'join_request' | 'join_request_result'
    is_read: boolean
    created_at: string
    data?: {
        group_id?: string
        group_name?: string
        link?: string
        pending_member_id?: string
        user_name?: string
        action?: 'approve' | 'reject'
    }
}

export function NotificationBell({ userId }: { userId: string }) {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        if (!userId) return

        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)

            if (data) {
                setNotifications(data as Notification[])
                setUnreadCount(data.filter(n => !n.is_read).length)
            }
        }

        fetchNotifications()

        // Subscribe to real-time notifications
        const channel = supabase
            .channel(`public:notifications:user_id=eq.${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 10))
                setUnreadCount(prev => prev + 1)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const markAllAsRead = async () => {
        if (unreadCount === 0) return

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        }
    }

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
    }

    const acceptInvitation = async (notification: Notification) => {
        if (!notification.data?.group_id) return

        try {
            // 1. Join group
            const { error: joinError } = await supabase
                .from('group_members')
                .insert({
                    group_id: notification.data.group_id,
                    user_id: userId,
                    role: 'member'
                })

            if (joinError) {
                if (joinError.code === '23505') {
                    alert('Você já é membro deste grupo!')
                } else {
                    throw joinError
                }
            }

            // 2. Mark notification as read
            await markAsRead(notification.id)

            alert('Convite aceito com sucesso!')
            setIsOpen(false)

            // 3. Redirect to group page
            router.push(`/groups/${notification.data.group_id}`)
        } catch (error: any) {
            console.error('Error accepting invitation:', error)
            alert('Erro ao aceitar convite: ' + error.message)
        }
    }

    const declineInvitation = async (notificationId: string) => {
        await markAsRead(notificationId)
        alert('Convite recusado.')
    }

    const handleJoinRequest = async (notification: Notification, action: 'approve' | 'reject') => {
        if (!notification.data?.pending_member_id) return

        try {
            const res = await fetch(`/api/groups/approve-member?id=${notification.data.pending_member_id}&action=${action}`)
            if (res.ok) {
                alert(action === 'approve' ? 'Solicitação aprovada!' : 'Solicitação recusada.')
                await markAsRead(notification.id)
                if (action === 'approve' && notification.data.group_id) {
                    router.push(`/groups/${notification.data.group_id}`)
                }
            } else {
                const data = await res.json()
                throw new Error(data.error || 'Erro ao processar')
            }
        } catch (error: any) {
            alert(error.message)
        }
    }

    const getIcon = (type?: string) => {
        if (!type) return <Info className="h-4 w-4 text-blue-500" />
        switch (type) {
            case 'success': return <Star className="h-4 w-4 text-green-500" />
            case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />
            case 'points': return <Trophy className="h-4 w-4 text-yellow-500" />
            case 'group_invite': return <Users className="h-4 w-4 text-purple-500" />
            case 'join_request': return <Users className="h-4 w-4 text-blue-500" />
            case 'join_request_result': return <Check className="h-4 w-4 text-green-500" />
            default: return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border-2 border-white dark:border-slate-950">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    {/* Backdrop for mobile */}
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 sm:hidden animate-in fade-in duration-200"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className={cn(
                        "fixed inset-x-4 top-20 bottom-4 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-80 sm:max-h-96 origin-top-right rounded-2xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-900 dark:ring-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col sm:block",
                        "sm:top-full"
                    )}>
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações</h3>
                            <div className="flex items-center gap-3">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs font-semibold text-slate-400 hover:text-green-600 dark:hover:text-green-500 transition-colors"
                                        title="Marcar todas como lidas"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                )}
                                <Link
                                    href="/notifications?tab=settings"
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    title="Configurações de Notificação"
                                >
                                    <Settings className="h-4 w-4" />
                                </Link>
                                <Link
                                    href="/notifications"
                                    onClick={() => setIsOpen(false)}
                                    className="text-xs font-semibold text-green-600 hover:text-green-700 dark:text-green-500 border-l border-slate-100 dark:border-slate-800 pl-3"
                                >
                                    Ver Todas
                                </Link>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto sm:max-h-96">
                            {notifications.length > 0 ? (
                                notifications.filter(Boolean).map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => {
                                            if (!notification.is_read) markAsRead(notification.id)
                                            if (notification.data?.link) {
                                                router.push(notification.data.link)
                                                setIsOpen(false)
                                            }
                                        }}
                                        className={cn(
                                            "flex gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-100/50 dark:border-slate-800/30",
                                            !notification.is_read && "bg-green-50/30 dark:bg-green-500/5",
                                            notification.data?.link && "hover:border-l-4 hover:border-l-green-500"
                                        )}
                                    >
                                        <div className="mt-1 flex-shrink-0">
                                            {getIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={cn(
                                                    "text-xs font-bold truncate",
                                                    notification.is_read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                    {notification.created_at ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR }) : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                {notification.message}
                                            </p>

                                            {notification.type === 'group_invite' && !notification.is_read && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            acceptInvitation(notification)
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Aceitar
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            declineInvitation(notification.id)
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Recusar
                                                    </button>
                                                </div>
                                            )}

                                            {notification.type === 'join_request' && !notification.is_read && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleJoinRequest(notification, 'approve')
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Aprovar
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleJoinRequest(notification, 'reject')
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Recusar
                                                    </button>
                                                </div>
                                            )}

                                            {notification.data?.link && notification.type !== 'group_invite' && (
                                                <div className="mt-3">
                                                    <button
                                                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                                                    >
                                                        Ver Detalhes
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {!notification.is_read && (
                                            <div className="mt-1.5 h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center h-full flex flex-col items-center justify-center">
                                    <Bell className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-slate-500 dark:text-slate-500">Nenhuma notificação por aqui.</p>
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 text-center border-t border-slate-100 dark:border-slate-800 shrink-0">
                                <span className="text-[10px] font-medium text-slate-400">Fique por dentro de tudo!</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
