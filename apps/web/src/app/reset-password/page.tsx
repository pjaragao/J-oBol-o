'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock as LockIcon, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

export default function ResetPasswordPage() {
    const t = useTranslations('auth.resetPassword')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [checkingSession, setCheckingSession] = useState(true)
    const [isSessionValid, setIsSessionValid] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        let mounted = true

        async function checkSession() {
            // First check if a session is already present
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    if (mounted) {
                        setIsSessionValid(true)
                        setCheckingSession(false)
                    }
                    return
                }

                // If not found, subscribe to auth state changes to capture it once parsed
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (session && mounted) {
                        setIsSessionValid(true)
                        setCheckingSession(false)
                        subscription.unsubscribe()
                    }
                })

                // If after 4 seconds we still don't have a session, show error
                setTimeout(() => {
                    if (mounted) {
                        supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
                            if (!finalSession && mounted) {
                                setIsSessionValid(false)
                                setError(t('error') || 'Sessão inválida ou link expirado.')
                                setCheckingSession(false)
                                subscription.unsubscribe()
                            }
                        })
                    }
                }, 4000)

            } catch (err) {
                if (mounted) {
                    setIsSessionValid(false)
                    setError(t('error') || 'Erro ao validar a sessão.')
                    setCheckingSession(false)
                }
            }
        }

        checkSession()

        return () => {
            mounted = false
        }
    }, [supabase, t])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError(t('passwordMismatch'))
            return
        }

        if (password.length < 6) {
            setError(t('passwordTooShort'))
            return
        }

        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            })

            if (error) {
                throw error
            }

            setMessage(t('success'))
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push('/dashboard')
                router.refresh()
            }, 2000)
        } catch (err: any) {
            setError(err.message || t('error'))
            setLoading(false)
        }
    }

    if (checkingSession) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center py-12 px-4">
                <div className="h-8 w-8 border-4 border-green-600/30 border-t-green-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    {useTranslations('common')('loading') || 'Carregando...'}
                </p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="relative w-32 h-32">
                        <Image
                            src="/logo-new.png"
                            alt="Logo JãoBolão"
                            fill
                            className="object-contain drop-shadow-lg rounded-3xl"
                            priority
                        />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                    {t('title')}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('subtitle')}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 sm:px-10">
                    {!isSessionValid ? (
                        <div className="space-y-6">
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl p-4 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                                    {error || 'O link de recuperação é inválido ou expirou.'}
                                </p>
                            </div>
                            <Link
                                href="/login"
                                className="w-full flex justify-center items-center py-4 px-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                            >
                                {useTranslations('auth.login')('doLogin') || 'Fazer Login'}
                            </Link>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl p-4 flex gap-3 animate-shake">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                                </div>
                            )}

                            {message && (
                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-xl p-4 flex gap-3">
                                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">{message}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {t('password')}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <LockIcon className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            id="password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                            placeholder={t('passwordPlaceholder')}
                                            disabled={loading || !!message}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {t('confirmPassword')}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <LockIcon className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            id="confirmPassword"
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                            placeholder={t('passwordPlaceholder')}
                                            disabled={loading || !!message}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading || !!message}
                                    className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-black uppercase tracking-widest text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-50 shadow-green-200 dark:shadow-none"
                                >
                                    {loading ? (
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            {t('submit')}
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
