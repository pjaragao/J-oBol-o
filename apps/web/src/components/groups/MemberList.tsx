'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Mail, Loader2, UserPlus, Link as LinkIcon, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { notifyUserOfInvite } from '@/actions/groups'

interface Member {
    id: string
    user_id: string
    role: 'admin' | 'moderator' | 'member'
    joined_at: string
    payment_status: 'PENDING' | 'PAID' | 'EXEMPT'
    paid_at: string | null
    profiles: {
        display_name: string
        email: string
        avatar_url: string | null
    }
}

interface Invitation {
    id: string
    invited_email: string
    status: string
    created_at: string
    invited_by: string
    invited_user_id?: string
    invited_profile?: {
        display_name: string
        email: string
        avatar_url: string | null
    }
}

interface PendingMember {
    id: string
    group_id: string
    user_id: string
    status: 'pending' | 'approved' | 'rejected'
    requested_at: string
    profiles: {
        display_name: string
        email: string
        avatar_url: string | null
    }
}

export function MemberList({ groupId }: { groupId: string }) {
    const t = useTranslations('group');
    const [members, setMembers] = useState<Member[]>([])
    const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])
    const [pendingJoinRequests, setPendingJoinRequests] = useState<PendingMember[]>([])
    const [allowMemberInvites, setAllowMemberInvites] = useState(false)
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteMode, setInviteMode] = useState<'email' | 'link'>('email')
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviting, setInviting] = useState(false)
    const [inviteLink, setInviteLink] = useState<string | null>(null)
    const [copying, setCopying] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        fetchMembers()
    }, [groupId])

    const [groupIsPaid, setGroupIsPaid] = useState(false)

    // ... existing state ...

    const fetchMembers = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            setCurrentUserId(user?.id || null)

            // 1. Fetch group settings
            const { data: group } = await supabase
                .from('groups')
                .select('allow_member_invites, is_paid')
                .eq('id', groupId)
                .single()

            setAllowMemberInvites(group?.allow_member_invites || false)
            setGroupIsPaid(group?.is_paid || false)

            // 2. Fetch members
            const { data: membersData, error: membersError } = await supabase
                .from('group_members')
                .select(`
                    id,
                    user_id,
                    role,
                    joined_at,
                    payment_status,
                    paid_at,
                    profiles (
                        display_name,
                        email,
                        avatar_url
                    )
                `)
                .eq('group_id', groupId)
                .order('role', { ascending: true })

            if (membersError) throw membersError

            // ... normalization ...
            const normalizedMembers = (membersData || []).map(m => ({
                ...m,
                profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
            })) as any

            setMembers(normalizedMembers)

            // Determine current user role
            const myMembership = membersData?.find(m => m.user_id === user?.id)
            setCurrentUserRole(myMembership?.role || null)

            // ... invites fetching ...
            const { data: invitesData } = await supabase
                .from('group_invitations')
                .select(`
                    *,
                    invited_profile:invited_user_id (
                        display_name,
                        email,
                        avatar_url
                    )
                `)
                .eq('group_id', groupId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            setPendingInvites(invitesData || [] as any)

            // 4. Fetch pending join requests (if admin)
            if (myMembership?.role === 'admin') {
                const { data: joinRequestsData } = await supabase
                    .from('pending_members')
                    .select(`
                        id,
                        group_id,
                        user_id,
                        status,
                        requested_at,
                        profiles:user_id (
                            display_name,
                            email,
                            avatar_url
                        )
                    `)
                    .eq('group_id', groupId)
                    .eq('status', 'pending')
                    .order('requested_at', { ascending: false })

                const normalizedRequests = (joinRequestsData || []).map(r => ({
                    ...r,
                    profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
                })) as any

                setPendingJoinRequests(normalizedRequests)
            } else {
                setPendingJoinRequests([])
            }

        } catch (error) {
            console.error('Error fetching members:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTogglePaymentStatus = async (memberId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID'
        const confirmMsg = newStatus === 'PAID'
            ? 'Confirmar pagamento deste membro?'
            : 'Remover status de pago deste membro?'

        if (!confirm(confirmMsg)) return

        try {
            const updates: any = {
                payment_status: newStatus,
                paid_at: newStatus === 'PAID' ? new Date().toISOString() : null
            }

            const { error } = await supabase
                .from('group_members')
                .update(updates)
                .eq('id', memberId)

            if (error) throw error

            // Create transaction record if marking as PAID
            if (newStatus === 'PAID') {
                // ideally this should be a backend function to ensure atomic transaction, 
                // but for MVP we do it here or let trigger handle it if we had one.
                // We'll leave the transaction creation for now as it might be complex on client.
                // TODO: Create transaction entry
            }

            fetchMembers()
        } catch (error: any) {
            alert('Erro ao atualizar pagamento: ' + error.message)
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Tem certeza que deseja remover este membro?')) return
        // ... existing remove logic
        try {
            const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('id', memberId)

            if (error) throw error

            alert('Membro removido com sucesso')
            fetchMembers() // Refresh list
        } catch (error: any) {
            alert('Erro ao remover membro: ' + error.message)
        }
    }

    const handleProcessJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
        try {
            setLoading(true)
            const res = await fetch(`/api/groups/approve-member?id=${requestId}&action=${action}`)

            if (res.ok) {
                alert(action === 'approve' ? 'Membro aprovado com sucesso!' : 'Solicitação recusada.')
                fetchMembers()
            } else {
                const data = await res.json()
                throw new Error(data.error || 'Erro ao processar solicitação')
            }
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCancelInvite = async (inviteId: string) => {
        if (!confirm('Tem certeza que deseja cancelar este convite?')) return

        try {
            const { error } = await supabase
                .from('group_invitations')
                .delete()
                .eq('id', inviteId)

            if (error) throw error

            alert('Convite cancelado com sucesso')
            fetchMembers()
        } catch (error: any) {
            alert('Erro ao cancelar convite: ' + error.message)
        }
    }

    const handleSendEmailInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inviteEmail) return

        setInviting(true)
        try {
            // 1. Search for user by email
            const { data: profile, error: searchError } = await supabase
                .from('profiles')
                .select('id, display_name')
                .eq('email', inviteEmail.trim().toLowerCase())
                .maybeSingle()

            if (searchError) throw searchError

            // 2. Get current user's profile for the notification message
            const { data: { user } } = await supabase.auth.getUser()
            const { data: myProfile } = await supabase
                .from('profiles')
                .select('display_name, email')
                .eq('id', user?.id)
                .single()

            // 3. Get group name
            const { data: group } = await supabase
                .from('groups')
                .select('name')
                .eq('id', groupId)
                .single()

            if (profile) {
                // 3. Create invitation record for existing user
                const { error: inviteError } = await supabase
                    .from('group_invitations')
                    .insert({
                        group_id: groupId,
                        invited_email: inviteEmail.trim().toLowerCase(),
                        invited_by: user?.id,
                        invited_user_id: profile.id,
                        status: 'pending'
                    })

                if (inviteError && inviteError.code !== '23505') throw inviteError // Ignore if already invited

                // 4. Create internal notification
                const { error: notifyError } = await supabase
                    .from('notifications')
                    .insert({
                        user_id: profile.id,
                        title: 'Convite para grupo',
                        message: `${myProfile?.display_name || myProfile?.email} te convidou para o grupo ${group?.name}`,
                        type: 'group_invite',
                        data: {
                            group_id: groupId,
                            group_name: group?.name
                        }
                    })

                if (notifyError) throw notifyError

                if (notifyError) throw notifyError

                // Notify via Push (Server Action)
                await notifyUserOfInvite(profile.id, groupId)

                alert('Convite enviado com sucesso! O usuário aparecerá na lista de pendentes até aceitar.')
                setInviteEmail('')
                setShowInviteModal(false)
                fetchMembers()
            } else {
                // User doesn't exist, recommend share link
                if (confirm('Este usuário ainda não está cadastrado no JãoBolão. Deseja gerar um link de convite para enviar para ele?')) {
                    setInviteMode('link')
                    handleGenerateInviteLink()
                }
            }
        } catch (error: any) {
            console.error('Error sending invite:', error)
            alert('Erro ao enviar convite: ' + error.message)
        } finally {
            setInviting(false)
        }
    }

    const handleGenerateInviteLink = async () => {
        setInviting(true)
        try {
            // Check if there's already a public link token for this group
            // We'll use a placeholder email 'public_link@jaobolao.com' for discovery
            const placeholderEmail = `link_${groupId}@jaobolao.com`

            let { data: existing, error: fetchError } = await supabase
                .from('group_invitations')
                .select('invite_token, expires_at')
                .eq('group_id', groupId)
                .eq('invited_email', placeholderEmail)
                .eq('status', 'pending')
                .maybeSingle()

            if (fetchError) throw fetchError

            let token = existing?.invite_token

            if (!token || (existing?.expires_at && new Date(existing.expires_at) < new Date())) {
                // Create new generic invitation
                const { data: { user } } = await supabase.auth.getUser()
                const { data: newInvite, error: insertError } = await supabase
                    .from('group_invitations')
                    .insert({
                        group_id: groupId,
                        invited_email: placeholderEmail,
                        invited_by: user?.id,
                        status: 'pending'
                    })
                    .select('invite_token')
                    .single()

                if (insertError) throw insertError
                token = newInvite.invite_token
            }

            const baseUrl = window.location.origin
            setInviteLink(`${baseUrl}/groups/join?token=${token}`)
        } catch (error: any) {
            console.error('Error generating link:', error)
            alert('Erro ao gerar link de convite: ' + error.message)
        } finally {
            setInviting(false)
        }
    }

    const copyToClipboard = () => {
        if (!inviteLink) return
        navigator.clipboard.writeText(inviteLink)
        setCopying(true)
        setTimeout(() => setCopying(false), 2000)
    }

    if (loading) return <div className="text-center py-8">{t('loadingMembers') || 'Carregando membros...'}</div>

    return (
        <div className="space-y-4">
            {/* Pending Join Requests (for Admins) */}
            {currentUserRole === 'admin' && pendingJoinRequests.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        {t('joinRequests') || 'Solicitações de Entrada'}
                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">
                            {pendingJoinRequests.length}
                        </span>
                    </h3>
                    <div className="overflow-hidden bg-white dark:bg-slate-900 shadow sm:rounded-md border border-green-100 dark:border-green-900/20">
                        <ul role="list" className="divide-y divide-gray-200 dark:divide-slate-800">
                            {pendingJoinRequests.map((request) => (
                                <li key={request.id}>
                                    <div className="flex items-center px-4 py-4 sm:px-6 hover:bg-green-50/10 transition-colors">
                                        <div className="flex min-w-0 flex-1 items-center">
                                            <div className="flex-shrink-0">
                                                {request.profiles?.avatar_url ? (
                                                    <img className="h-10 w-10 rounded-full" src={request.profiles.avatar_url} alt="" />
                                                ) : (
                                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-400 dark:bg-slate-700 text-white">
                                                        {request.profiles?.display_name?.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 px-4">
                                                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{request.profiles?.display_name}</p>
                                                <p className="text-xs text-slate-500">{request.profiles?.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleProcessJoinRequest(request.id, 'approve')}
                                                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-green-700 transition-all"
                                            >
                                                <Check className="h-3 w-3" /> {t('approve') || 'Aprovar'}
                                            </button>
                                            <button
                                                onClick={() => handleProcessJoinRequest(request.id, 'reject')}
                                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 transition-all"
                                            >
                                                <X className="h-3 w-3" /> {t('reject') || 'Recusar'}
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {(currentUserRole === 'admin' || allowMemberInvites) && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95"
                    >
                        <UserPlus className="h-4 w-4" />
                        {t('inviteMember')}
                    </button>
                </div>
            )}

            <div className="overflow-hidden bg-white dark:bg-slate-900 shadow sm:rounded-md border border-gray-100 dark:border-slate-800">
                <ul role="list" className="divide-y divide-gray-200 dark:divide-slate-800">
                    {members.map((member) => {
                        const profile = member.profiles
                        const isAdmin = currentUserRole === 'admin'

                        return (
                            <li key={member.id}>
                                <div className="flex items-center px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex min-w-0 flex-1 items-center">
                                        <div className="flex-shrink-0">
                                            {profile?.avatar_url ? (
                                                <img className="h-10 w-10 rounded-full border border-gray-200 dark:border-slate-700" src={profile.avatar_url} alt="" />
                                            ) : (
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-400 dark:bg-slate-700">
                                                    <span className="font-medium leading-none text-white dark:text-slate-200">
                                                        {profile?.display_name?.charAt(0).toUpperCase()}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                                            <div>
                                                <p className="truncate text-sm font-medium text-green-700 dark:text-green-400">{profile?.display_name}</p>
                                                <p className="mt-2 flex items-center text-xs text-gray-500 dark:text-slate-500">
                                                    <span className="truncate">{profile?.email}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* Status de Pagamento (se for grupo pago) */}
                                        {groupIsPaid && (
                                            <div className="hidden sm:flex flex-col items-end mr-2">
                                                <span className={cn(
                                                    "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase",
                                                    member.payment_status === 'PAID' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                                                        member.payment_status === 'EXEMPT' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                                                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500"
                                                )}>
                                                    {member.payment_status === 'PAID' ? 'Pago' :
                                                        member.payment_status === 'EXEMPT' ? 'Isento' : 'Pendente'}
                                                </span>
                                                {member.paid_at && (
                                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                                        {new Date(member.paid_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${member.role === 'admin'
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
                                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800/50'
                                            }`}>
                                            {member.role === 'admin' ? t('administrator') : t('member_role')}
                                        </span>

                                        {isAdmin && (
                                            <div className="flex items-center gap-2">
                                                {/* Botão de Toggle Pagamento */}
                                                {groupIsPaid && (
                                                    <button
                                                        onClick={() => handleTogglePaymentStatus(member.id, member.payment_status)}
                                                        className={cn(
                                                            "p-1.5 rounded-md transition-colors",
                                                            member.payment_status === 'PAID'
                                                                ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                        )}
                                                        title={member.payment_status === 'PAID' ? "Marcar como Pendente" : "Marcar como Pago"}
                                                    >
                                                        {member.payment_status === 'PAID' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                                    </button>
                                                )}

                                                {member.role !== 'admin' && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium transition-colors"
                                                    >
                                                        {t('remove')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </div>

            {pendingInvites.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        {t('pendingInvites') || 'Convites Pendentes'}
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                            {pendingInvites.length}
                        </span>
                    </h3>
                    <div className="overflow-hidden bg-white dark:bg-slate-900 shadow sm:rounded-md border border-gray-100 dark:border-slate-800">
                        <ul role="list" className="divide-y divide-gray-200 dark:divide-slate-800">
                            {pendingInvites.map((invite) => {
                                const isLinkInvite = invite.invited_email.startsWith('link_')
                                const hasProfile = !!invite.invited_profile
                                const canCancel = currentUserRole === 'admin' || invite.invited_by === currentUserId

                                return (
                                    <li key={invite.id}>
                                        <div className="flex items-center px-4 py-3 sm:px-6 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <div className="flex min-w-0 flex-1 items-center">
                                                <div className="flex-shrink-0">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                                        {hasProfile ? (
                                                            invite.invited_profile?.avatar_url ? (
                                                                <img className="h-10 w-10 rounded-full" src={invite.invited_profile.avatar_url} alt="" />
                                                            ) : (
                                                                <span className="text-sm font-bold text-slate-500">{invite.invited_profile?.display_name?.charAt(0)}</span>
                                                            )
                                                        ) : isLinkInvite ? (
                                                            <LinkIcon className="h-5 w-5 text-slate-400" />
                                                        ) : (
                                                            <Mail className="h-5 w-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1 px-4">
                                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {hasProfile
                                                            ? invite.invited_profile?.display_name
                                                            : isLinkInvite ? 'Link de Convite Ativo' : invite.invited_email}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        {hasProfile ? invite.invited_profile?.email : `Enviado ${new Date(invite.created_at).toLocaleDateString('pt-BR')}`}
                                                        {hasProfile && ` • Enviado ${new Date(invite.created_at).toLocaleDateString('pt-BR')}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                                                    Pendente
                                                </span>
                                                {canCancel && (
                                                    <button
                                                        onClick={() => handleCancelInvite(invite.id)}
                                                        className="text-xs font-semibold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                                    >
                                                        {t('cancel') || 'Cancelar'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('inviteMember')}</h3>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="mb-6 flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <button
                                onClick={() => setInviteMode('email')}
                                className={cn(
                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                    inviteMode === 'email'
                                        ? "bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                {t('byEmail') || 'Por E-mail'}
                            </button>
                            <button
                                onClick={() => {
                                    setInviteMode('link')
                                    if (!inviteLink) handleGenerateInviteLink()
                                }}
                                className={cn(
                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                    inviteMode === 'link'
                                        ? "bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                {t('inviteLink') || 'Link de Convite'}
                            </button>
                        </div>

                        {inviteMode === 'email' ? (
                            <form onSubmit={handleSendEmailInvite} className="space-y-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Convidar alguém que já possui conta no JãoBolão. A pessoa receberá uma notificação instantânea.
                                </p>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        E-mail do convidado
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Mail className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input
                                            type="email"
                                            id="email"
                                            required
                                            className="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 pl-10 text-sm text-slate-900 focus:border-green-500 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 dark:focus:border-green-500 dark:focus:ring-green-500"
                                            placeholder="exemplo@email.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowInviteModal(false)}
                                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        disabled={inviting}
                                    >
                                        {t('cancel') || 'Cancelar'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={inviting || !inviteEmail}
                                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {inviting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Buscando...
                                            </>
                                        ) : (
                                            t('invite') || 'Convidar'
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Compartilhe este link com quem você deseja convidar. Funciona para usuários novos e antigos.
                                </p>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Link de convite do grupo
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                readOnly
                                                className="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                                value={inviting ? 'Gerando link...' : (inviteLink || '')}
                                            />
                                        </div>
                                        <button
                                            onClick={copyToClipboard}
                                            disabled={inviting || !inviteLink}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm",
                                                copying
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    : "bg-green-600 text-white hover:bg-green-700"
                                            )}
                                        >
                                            {copying ? t('copied') || 'Copiado!' : t('copy') || 'Copiar'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-center pt-2">
                                    <button
                                        onClick={() => setShowInviteModal(false)}
                                        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        {t('close') || 'Fechar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
