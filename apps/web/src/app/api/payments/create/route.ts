import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { preferenceClient } from '@/lib/mercadopago/client'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://jaobolao-black.vercel.app'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // 1. Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { groupId } = body

        if (!groupId) {
            return NextResponse.json(
                { error: 'groupId é obrigatório' },
                { status: 400 }
            )
        }

        // 2. Validate user is a member of the group with PENDING payment
        const { data: membership, error: memberError } = await supabase
            .from('group_members')
            .select('id, payment_status')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .single()

        if (memberError || !membership) {
            return NextResponse.json(
                { error: 'Você não é membro deste grupo' },
                { status: 403 }
            )
        }

        if (membership.payment_status === 'PAID') {
            return NextResponse.json(
                { error: 'Pagamento já realizado' },
                { status: 400 }
            )
        }

        // 3. Fetch group details
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select(`
                id, name, entry_fee, is_paid, payment_method,
                events!event_id (name, display_name)
            `)
            .eq('id', groupId)
            .single()

        if (groupError || !group) {
            return NextResponse.json(
                { error: 'Grupo não encontrado' },
                { status: 404 }
            )
        }

        if (!group.is_paid || !group.entry_fee || group.entry_fee <= 0) {
            return NextResponse.json(
                { error: 'Este grupo não requer pagamento' },
                { status: 400 }
            )
        }

        // 4. Fetch user profile for payer email
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, display_name')
            .eq('id', user.id)
            .single()

        const eventInfo = Array.isArray(group.events) ? group.events[0] : group.events
        const eventName = eventInfo?.display_name || eventInfo?.name || ''
        const itemTitle = `Taxa de Participação — ${group.name}${eventName ? ` (${eventName})` : ''}`

        // 5. Create Mercado Pago Preference
        const externalReference = `entry_fee:${groupId}:${user.id}`

        const result = await preferenceClient.create({
            body: {
                items: [
                    {
                        id: `entry-${groupId}-${user.id}`,
                        title: itemTitle,
                        description: `Entrada no bolão "${group.name}"`,
                        quantity: 1,
                        unit_price: Number(group.entry_fee),
                        currency_id: 'BRL',
                    },
                ],
                payer: {
                    email: profile?.email || user.email || '',
                    name: profile?.display_name || undefined,
                },
                external_reference: externalReference,
                back_urls: {
                    success: `${APP_URL}/groups/${groupId}?payment=success`,
                    failure: `${APP_URL}/groups/${groupId}?payment=failure`,
                    pending: `${APP_URL}/groups/${groupId}?payment=pending`,
                },
                auto_return: 'approved',
                notification_url: `${APP_URL}/api/webhooks/mercadopago`,
                metadata: {
                    group_id: groupId,
                    user_id: user.id,
                    type: 'ENTRY_FEE',
                    group_name: group.name,
                },
                statement_descriptor: 'JAOBOLAO',
                expires: false,
            },
        })

        // 6. Create pending transaction record
        await supabase.from('transactions').insert({
            group_id: groupId,
            user_id: user.id,
            type: 'ENTRY_FEE',
            amount: Number(group.entry_fee),
            status: 'PENDING',
            metadata: {
                provider: 'mercadopago',
                mp_preference_id: result.id,
                external_reference: externalReference,
            },
        })

        // 7. Return the checkout URL
        return NextResponse.json({
            init_point: result.init_point,
            sandbox_init_point: result.sandbox_init_point,
            preference_id: result.id,
        })

    } catch (error: any) {
        console.error('[Payments Create] Error:', error)
        return NextResponse.json(
            { error: 'Erro ao criar pagamento', details: error.message },
            { status: 500 }
        )
    }
}
