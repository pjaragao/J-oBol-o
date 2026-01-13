'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Users, AlertCircle, CheckCircle2 } from 'lucide-react'

function JoinGroupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const code = searchParams.get('code')
    const supabase = createClient()

    const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'checking_auth'>('loading')
    const [message, setMessage] = useState('Processando seu convite...')
    const [groupName, setGroupName] = useState<string | null>(null)

    useEffect(() => {
        if (!token && !code) {
            setStatus('error')
            setMessage('Código ou token de convite não encontrado.')
            return
        }

        async function processJoin() {
            try {
                let groupId: string
                let inviteType: 'token' | 'code' = token ? 'token' : 'code'
                let invitationStatus: string | null = null
                let invitedEmail: string | null = null
                let requiresApproval = false

                // 1. Validate Invite (either via token or code)
                if (token) {
                    const { data: invitations, error: rpcError } = await supabase
                        .rpc('get_group_by_invite_token', { p_token: token })

                    const invitation = invitations && invitations.length > 0 ? invitations[0] : null

                    if (rpcError || !invitation) {
                        setStatus('error')
                        setMessage('Este convite é inválido ou já expirou.')
                        return
                    }

                    if (invitation.status !== 'pending' && !invitation.invited_email.startsWith('link_')) {
                        setStatus('error')
                        setMessage('Este convite já foi utilizado.')
                        return
                    }

                    if (new Date(invitation.expires_at) < new Date()) {
                        setStatus('error')
                        setMessage('Este convite expirou.')
                        return
                    }

                    groupId = invitation.group_id
                    invitationStatus = invitation.status
                    invitedEmail = invitation.invited_email
                    setGroupName(invitation.group_name || 'Grupo')
                    requiresApproval = invitation.join_requires_approval || false
                } else {
                    // Code-based join
                    const { data: groups, error: rpcError } = await supabase
                        .rpc('get_group_by_invite_code', { p_code: code })

                    const group = groups && groups.length > 0 ? groups[0] : null

                    if (rpcError || !group) {
                        setStatus('error')
                        setMessage('Código de grupo inválido.')
                        return
                    }

                    groupId = group.id
                    setGroupName(group.name)
                    requiresApproval = group.join_requires_approval || false
                }

                // 2. Check Authentication
                setStatus('checking_auth')
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    const redirectUrl = encodeURIComponent(`/groups/join?${token ? `token=${token}` : `code=${code}`}`)
                    setMessage('Você precisa estar logado para entrar no grupo. Redirecionando para o login...')
                    setTimeout(() => {
                        router.push(`/login?redirect=${redirectUrl}`)
                    }, 2000)
                    return
                }

                // 3. Check if already a member
                const { data: existingMember } = await supabase
                    .from('group_members')
                    .select('id')
                    .eq('group_id', groupId)
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (existingMember) {
                    setStatus('success')
                    setMessage('Você já é membro deste grupo!')
                    setTimeout(() => router.push(`/groups/${groupId}`), 2000)
                    return
                }

                // 4. Handle Join Flow
                setStatus('loading')

                if (requiresApproval) {
                    setMessage(`Enviando solicitação para entrar no grupo ${groupName || ''}...`)

                    const { error: pendingError } = await supabase
                        .from('pending_members')
                        .upsert({
                            group_id: groupId,
                            user_id: user.id,
                            status: 'pending'
                        }, { onConflict: 'group_id,user_id' })

                    if (pendingError) throw pendingError

                    setStatus('success')
                    setMessage('Sua solicitação de entrada foi enviada e aguarda aprovação do administrador.')
                    setTimeout(() => router.push('/groups'), 3000)
                } else {
                    setMessage(`Entrando no grupo ${groupName || ''}...`)

                    const { error: joinError } = await supabase
                        .from('group_members')
                        .insert({
                            group_id: groupId,
                            user_id: user.id,
                            role: 'member'
                        })

                    if (joinError) throw joinError

                    // Joined successfully
                    setStatus('success')
                    setMessage(`Bem-vindo ao grupo ${groupName || ''}!`)

                    // Mark specific person invite as accepted
                    if (inviteType === 'token' && invitedEmail && !invitedEmail.startsWith('link_')) {
                        await supabase
                            .from('group_invitations')
                            .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                            .eq('invite_token', token)
                    }

                    setTimeout(() => router.push(`/groups/${groupId}`), 2000)
                }

            } catch (error: any) {
                console.error('Group join error:', error)
                setStatus('error')
                setMessage('Erro ao processar convite: ' + (error.message || 'Erro desconhecido'))
            }
        }

        processJoin()
    }, [token, code, supabase, router, groupName])

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
