'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock as LockIcon, ChevronRight, AlertCircle } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                if (error.message === 'Invalid login credentials') {
                    throw new Error('E-mail ou senha incorretos.')
                }
                throw error
            }

            const searchParams = new URLSearchParams(window.location.search)
            const redirect = searchParams.get('redirect')
            router.push(redirect || '/dashboard')
            router.refresh()
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="h-12 w-12 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-none">
                        <span className="text-white text-2xl font-black">J</span>
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                    JãoBolão
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                    Acesse sua conta para começar os palpites
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 sm:px-10">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl p-4 flex gap-3 animate-shake">
                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    E-mail
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
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Senha
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <LockIcon className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all sm:text-sm"
                                        placeholder="••••••••"
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
                                        Entrar No Jogo
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
                                <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 font-bold tracking-widest">Ou</span>
                            </div>
                        </div>

                        <div>
                            <Link
                                href="/register"
                                className="w-full flex justify-center items-center py-4 px-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                            >
                                Criar Nova Conta
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
