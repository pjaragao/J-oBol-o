'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

export default function ForgotPasswordPage() {
    const t = useTranslations('auth.forgotPassword')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) {
                throw error
            }

            setMessage(t('success'))
        } catch (err: any) {
            setError(err.message || t('error'))
        } finally {
            setLoading(false)
        }
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
                                <label htmlFor="email" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {t('email')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                        placeholder={t('emailPlaceholder')}
                                        suppressHydrationWarning
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

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm uppercase">
                                <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 font-bold tracking-widest">
                                    {useTranslations('auth.login')('or')}
                                </span>
                            </div>
                        </div>

                        <div>
                            <Link
                                href="/login"
                                className="w-full flex justify-center items-center py-4 px-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                            >
                                {t('backToLogin')}
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
