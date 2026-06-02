'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle, Home, Users } from 'lucide-react'

export default function SlugRedirectPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()
    
    const slug = params?.slug as string
    const [status, setStatus] = useState<'loading' | 'error'>('loading')
    const [message, setMessage] = useState('Localizando o bolão...')

    useEffect(() => {
        if (!slug) {
            setStatus('error')
            setMessage('Endereço inválido.')
            return
        }

        async function resolveSlug() {
            try {
                // 1. Try to fetch via RPC function (most secure & fast, handles RLS definition)
                const { data, error: rpcError } = await supabase
                    .rpc('get_group_by_slug', { p_slug: slug })
                
                let group = data && data.length > 0 ? data[0] : null

                // 2. Fallback: If RPC is not defined or error occurs, try direct query (in-memory normalize search)
                if (rpcError || !group) {
                    console.warn('RPC slug query failed or returned no results, trying in-memory fallback...', rpcError)
                    const { data: allGroups } = await supabase
                        .from('groups')
                        .select('id, name, invite_code')

                    const clean = (s: string) => 
                        s.normalize('NFD')
                         .replace(/[\u0300-\u036f]/g, '') // remove accents
                         .replace(/[^a-zA-Z0-9]/g, '')     // remove special chars
                         .toLowerCase()

                    const targetSlug = clean(slug)
                    group = allGroups?.find(g => clean(g.name) === targetSlug) || null
                }

                if (!group) {
                    setStatus('error')
                    setMessage(`Não encontramos nenhum bolão com o nome "${slug}". Verifique se o endereço está correto.`)
                    return
                }

                // 3. Group found, redirect to official join flow using its invite code
                setMessage(`Bolão "${group.name}" localizado! Redirecionando...`)
                router.replace(`/groups/join?code=${group.invite_code}`)
            } catch (error) {
                console.error('Slug resolution error:', error)
                setStatus('error')
                setMessage('Ocorreu um erro ao processar seu link de convite.')
            }
        }

        resolveSlug()
    }, [slug, supabase, router])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/30">
                        {status === 'loading' ? (
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                        ) : (
                            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {status === 'loading' ? 'Conectando ao Bolão' : 'Ops, bolão não encontrado'}
                    </h1>
                </div>

                <div className="text-center mb-8">
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                {status === 'error' && (
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => router.push('/groups')}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Users className="w-4 h-4" />
                            Ver meus bolões
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750 transition-all"
                        >
                            <Home className="w-4 h-4" />
                            Ir para o início
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
