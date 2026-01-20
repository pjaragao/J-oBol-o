'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { User, Mail, Lock as LockIcon, CreditCard, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import type { Locale } from '@/i18n/config'

// Masks helpers
const maskCPF = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1')
}

export default function RegisterPage() {
    const router = useRouter()
    const supabase = createClient()
    const t = useTranslations('auth.register')
    const tCommon = useTranslations('common')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Form states
    const [formData, setFormData] = useState({
        displayName: '',
        fullName: '',
        cpf: '',
        email: '',
        password: '',
        confirmPassword: '',
        locale: 'pt' as Locale
    })

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError(t('passwordMismatch'))
            setLoading(false)
            return
        }

        if (formData.password.length < 6) {
            setError(t('passwordTooShort'))
            setLoading(false)
            return
        }

        try {
            // 1. Sign Up
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        display_name: formData.displayName,
                        full_name: formData.fullName,
                        cpf: formData.cpf,
                        locale: formData.locale
                    }
                }
            })

            if (signUpError) throw signUpError

            if (data.user) {
                // 2. Explicitly upsert profile to ensure it exists immediately
                // This is useful if the database trigger is slow or doesn't exist
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        email: formData.email,
                        display_name: formData.displayName,
                        full_name: formData.fullName,
                        cpf: formData.cpf,
                        locale: formData.locale,
                        updated_at: new Date().toISOString(),
                    })

                if (profileError) {
                    console.error('Error creating profile:', profileError.message)
                    // We don't throw here because the user is already created in Auth
                }

                setSuccess(true)
                setTimeout(() => {
                    router.push('/dashboard')
                    router.refresh()
                }, 1500)
            }
        } catch (err: any) {
            setError(err.message || t('errorCreating'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
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

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 sm:px-10">
                    {success ? (
                        <div className="text-center py-8 space-y-4">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30">
                                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('success')}</h3>
                            <p className="text-slate-500 dark:text-slate-400">{t('redirecting')}</p>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleRegister}>
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl p-4 flex gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-6">
                                {/* Seletor de Idioma */}
                                <LanguageSelector
                                    variant="inline"
                                    value={formData.locale}
                                    onChange={(locale) => setFormData({ ...formData, locale })}
                                    showLabel={true}
                                />

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {t('displayName')}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={formData.displayName}
                                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                            className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                            placeholder={t('displayNamePlaceholder')}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {t('fullName')}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                        placeholder={t('fullNamePlaceholder')}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-1">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {t('cpf')}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <CreditCard className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={formData.cpf}
                                                onChange={(e) => setFormData({ ...formData, cpf: maskCPF(e.target.value) })}
                                                className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                                placeholder={t('cpfPlaceholder')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {t('email')}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {t('password')}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <LockIcon className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <input
                                                type="password"
                                                required
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                                placeholder={t('passwordPlaceholder')}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {t('confirmPassword')}
                                        </label>
                                        <input
                                            type="password"
                                            required
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                            placeholder={t('passwordPlaceholder')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
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

                            <div className="text-center mt-4">
                                <p className="text-sm text-slate-500">
                                    {t('alreadyHaveAccount')}{' '}
                                    <Link href="/login" className="font-bold text-green-600 hover:text-green-500 transition-colors">
                                        {t('doLogin')}
                                    </Link>
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
