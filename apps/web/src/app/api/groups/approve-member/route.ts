import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const pendingMemberId = searchParams.get('id')
    const action = searchParams.get('action') // 'approve' or 'reject'

    if (!pendingMemberId || !action) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = await createClient()

    try {
        // 1. Get the pending member details
        const { data: pendingMember, error: fetchError } = await supabase
            .from('pending_members')
            .select('*')
            .eq('id', pendingMemberId)
            .single()

        if (fetchError || !pendingMember) {
            return NextResponse.json({ error: 'Pedido não encontrado ou já processado' }, { status: 404 })
        }

        // 2. Security Check: Is the current user an admin of this group?
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const { data: adminMember, error: adminError } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', pendingMember.group_id)
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single()

        if (adminError || !adminMember) {
            return NextResponse.json({ error: 'Apenas administradores podem processar solicitações' }, { status: 403 })
        }

        // 3. Process Action
        if (action === 'approve') {
            // Update pending status
            const { error: updateError } = await supabase
                .from('pending_members')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user.id
                })
                .eq('id', pendingMemberId)

            if (updateError) throw updateError

            // Add to group_members
            const { error: joinError } = await supabase
                .from('group_members')
                .insert({
                    group_id: pendingMember.group_id,
                    user_id: pendingMember.user_id,
                    role: 'member'
                })

            if (joinError && joinError.code !== '23505') { // Ignore if already a member
                throw joinError
            }

            // Redirect to members list with success
            return NextResponse.redirect(new URL(`/groups/${pendingMember.group_id}?tab=members&approved=true`, request.url))

        } else if (action === 'reject') {
            const { error: updateError } = await supabase
                .from('pending_members')
                .update({
                    status: 'rejected',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user.id
                })
                .eq('id', pendingMemberId)

            if (updateError) throw updateError

            return NextResponse.redirect(new URL(`/groups/${pendingMember.group_id}?tab=members&rejected=true`, request.url))
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

    } catch (error: any) {
        console.error('Error processing approval:', error)
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
    }
}
