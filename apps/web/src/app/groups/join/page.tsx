'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Users, AlertCircle, CheckCircle2 } from 'lucide-react'

function JoinGroupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const supabase = createClient()

    const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'checking_auth'>('loading')
    const [message, setMessage] = useState('Processando seu convite...')
    const [groupName, setGroupName] = useState<string | null>(null)

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setMessage('Token de convite não encontrado ou inválido.')
            return
        }

        async function processJoin() {
            try {
                // 1. Validate Token and get Group Name
                const { data: invitation, error: inviteError } = await supabase
                    .from('group_invitations')
                    .select('group_id, invited_email, groups(name), status, expires_at')
                    .eq('invite_token', token)
                    .single()

                if (inviteError || !invitation) {
                    setStatus('error')
                    setMessage('Este convite é inválido ou já expirou.')
                    return
                }

                if (invitation.status !== 'pending' && !invitation.invited_email.startsWith('link_')) {
                    // Only generic links (startsWith link_) can be reused multiple times easily
                    // But we'll allow multiple joins if it's a link-type invitation
                    setStatus('error')
                    setMessage('Este convite já foi utilizado.')
                    return
                }

                if (new Date(invitation.expires_at) < new Date()) {
                    setStatus('error')
                    setMessage('Este convite expirou.')
                    return
                }

                const groupData = Array.isArray(invitation.groups) ? invitation.groups[0] : invitation.groups
                setGroupName(groupData?.name || 'Grupo')

                // 2. Check Authentication
                setStatus('checking_auth')
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    // Store the join intent in session storage or just rely on the redirect param
                    const redirectUrl = encodeURIComponent(`/groups/join?token=${token}`)
                    setMessage('Você precisa estar logado para entrar no grupo. Redirecionando para o login...')
                    setTimeout(() => {
                        router.push(`/login?redirect=${redirectUrl}`)
                    }, 2000)
                    return
                }

                // 3. Join Group
                setStatus('loading')
                setMessage(`Entrando no grupo ${groupData?.name || ''}...`)

                const { error: joinError } = await supabase
                    .from('group_members')
                    .insert({
                        group_id: invitation.group_id,
                        user_id: user.id,
                        role: 'member'
                    })

                if (joinError) {
                    if (joinError.code === '23505') {
                        // Already a member
                        setStatus('success')
                        setMessage('Você já é membro deste grupo!')
                        setTimeout(() => router.push(`/groups/${invitation.group_id}`), 2000)
                    } else {
                        throw joinError
                    }
                } else {
                    // Joined successfully
                    setStatus('success')
                    setMessage(`Bem-vindo ao grupo ${groupData?.name || ''}!`)

                    // Mark specific person invite as accepted
                    if (!invitation.invited_email.startsWith('link_')) {
                        await supabase
                            .from('group_invitations')
                            .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                            .eq('invite_token', token)
                    }

                    setTimeout(() => router.push(`/groups/${invitation.group_id}`), 2000)
                }

            } catch (error: any) {
                console.error('Group join error:', error)
                setStatus('error')
                setMessage('Erro ao processar convite: ' + (error.message || 'Erro desconhecido'))
            }
        }

        processJoin()
    }, [token, supabase, router])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        {status === 'loading' || status === 'checking_auth' ? (
                            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                        ) : status === 'success' ? (
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        ) : status === 'error' ? (
                            <AlertCircle className="h-8 w-8 text-red-600" />
                        ) : (
                            <Users className="h-8 w-8 text-green-600" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {status === 'error' ? 'Ops!' : 'Convite de Grupo'}
                    </h1>
                    {groupName && status !== 'error' && (
                        <p className="mt-1 text-lg font-medium text-green-600 dark:text-green-400">
                            {groupName}
                        </p>
                    )}
                </div>

                <div className="text-center">
                    <p className="text-slate-600 dark:text-slate-400">
                        {message}
                    </p>
                </div>

                {status === 'error' && (
                    <div className="mt-8 flex flex-col gap-3">
                        <button
                            onClick={() => router.push('/groups')}
                            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-all"
                        >
                            Ver meus grupos
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function JoinGroupPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
        }>
            <JoinGroupContent />
        </Suspense>
    )
}
