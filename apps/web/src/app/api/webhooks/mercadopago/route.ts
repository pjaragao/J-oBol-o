import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateWebhookSignature, parseExternalReference } from '@/lib/mercadopago/webhook-validator'
import { paymentClient } from '@/lib/mercadopago/client'

// Use service role client since webhooks come from Mercado Pago (no user session)
function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // 1. Extract notification data
        const { type, data, action } = body
        const xSignature = request.headers.get('x-signature')
        const xRequestId = request.headers.get('x-request-id')

        // 2. Validate webhook signature (if secret is configured)
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
        if (webhookSecret && xSignature && xRequestId && data?.id) {
            const isValid = validateWebhookSignature(
                xSignature,
                xRequestId,
                String(data.id),
                webhookSecret
            )

            if (!isValid) {
                console.error('[MP Webhook] Invalid signature')
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 403 }
                )
            }
        }

        // 3. We only process payment notifications
        if (type !== 'payment') {
            console.log(`[MP Webhook] Ignoring event type: ${type}`)
            return NextResponse.json({ received: true }, { status: 200 })
        }

        const paymentId = data?.id
        if (!paymentId) {
            console.error('[MP Webhook] Missing payment ID')
            return NextResponse.json({ received: true }, { status: 200 })
        }

        // 4. Fetch full payment details from Mercado Pago API
        const payment = await paymentClient.get({ id: paymentId })

        if (!payment) {
            console.error(`[MP Webhook] Payment not found: ${paymentId}`)
            return NextResponse.json({ received: true }, { status: 200 })
        }

        console.log(`[MP Webhook] Payment ${paymentId}: status=${payment.status}, action=${action}`)

        // 5. Parse external_reference to get groupId and userId
        const ref = parseExternalReference(payment.external_reference || '')
        if (!ref || ref.type !== 'entry_fee') {
            console.log(`[MP Webhook] Not an entry_fee payment, skipping. Ref: ${payment.external_reference}`)
            return NextResponse.json({ received: true }, { status: 200 })
        }

        const { groupId, userId } = ref
        const supabase = getServiceClient()

        // 6. Idempotency check: see if we already processed this payment
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('id, status')
            .eq('metadata->>provider_payment_id', String(paymentId))
            .single()

        if (existingTx?.status === 'COMPLETED') {
            console.log(`[MP Webhook] Payment ${paymentId} already processed. Skipping.`)
            return NextResponse.json({ received: true }, { status: 200 })
        }

        // 7. Process based on payment status
        switch (payment.status) {
            case 'approved': {
                // Update or create transaction as COMPLETED
                if (existingTx) {
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'COMPLETED',
                            metadata: {
                                provider: 'mercadopago',
                                provider_payment_id: String(paymentId),
                                mp_status: payment.status,
                                mp_status_detail: payment.status_detail,
                                mp_payment_method: payment.payment_method_id,
                                paid_at: payment.date_approved,
                            },
                        })
                        .eq('id', existingTx.id)
                } else {
                    await supabase.from('transactions').insert({
                        group_id: groupId,
                        user_id: userId,
                        type: 'ENTRY_FEE',
                        amount: payment.transaction_amount || 0,
                        status: 'COMPLETED',
                        metadata: {
                            provider: 'mercadopago',
                            provider_payment_id: String(paymentId),
                            mp_status: payment.status,
                            mp_status_detail: payment.status_detail,
                            mp_payment_method: payment.payment_method_id,
                            paid_at: payment.date_approved,
                        },
                    })
                }

                // Update group_members payment status to PAID
                await supabase
                    .from('group_members')
                    .update({
                        payment_status: 'PAID',
                        paid_at: new Date().toISOString(),
                    })
                    .eq('group_id', groupId)
                    .eq('user_id', userId)

                // Notify the group admin
                const { data: groupData } = await supabase
                    .from('groups')
                    .select('name, created_by')
                    .eq('id', groupId)
                    .single()

                const { data: payerProfile } = await supabase
                    .from('profiles')
                    .select('display_name, email')
                    .eq('id', userId)
                    .single()

                const payerName = payerProfile?.display_name || payerProfile?.email || 'Membro'

                if (groupData && groupData.created_by !== userId) {
                    await supabase.from('notifications').insert({
                        user_id: groupData.created_by,
                        title: 'Pagamento confirmado!',
                        message: `${payerName} pagou a taxa de entrada do grupo "${groupData.name}"`,
                        type: 'success',
                        data: {
                            group_id: groupId,
                            payer_id: userId,
                            payment_id: String(paymentId),
                            link: `/groups/${groupId}`,
                        },
                    })
                }

                // Notify the payer
                await supabase.from('notifications').insert({
                    user_id: userId,
                    title: 'Pagamento aprovado!',
                    message: `Seu pagamento para o grupo "${groupData?.name || ''}" foi confirmado. Suas apostas agora valem pontos!`,
                    type: 'success',
                    data: {
                        group_id: groupId,
                        payment_id: String(paymentId),
                        link: `/groups/${groupId}`,
                    },
                })

                console.log(`[MP Webhook] ✅ Payment approved for user ${userId} in group ${groupId}`)
                break
            }

            case 'pending':
            case 'in_process': {
                // Update transaction metadata but keep PENDING
                if (existingTx) {
                    await supabase
                        .from('transactions')
                        .update({
                            metadata: {
                                provider: 'mercadopago',
                                provider_payment_id: String(paymentId),
                                mp_status: payment.status,
                                mp_status_detail: payment.status_detail,
                            },
                        })
                        .eq('id', existingTx.id)
                }

                console.log(`[MP Webhook] ⏳ Payment pending for user ${userId} in group ${groupId}`)
                break
            }

            case 'rejected':
            case 'cancelled': {
                // Mark transaction as FAILED
                if (existingTx) {
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'FAILED',
                            metadata: {
                                provider: 'mercadopago',
                                provider_payment_id: String(paymentId),
                                mp_status: payment.status,
                                mp_status_detail: payment.status_detail,
                            },
                        })
                        .eq('id', existingTx.id)
                }

                // Notify user about failure
                const { data: failGroupData } = await supabase
                    .from('groups')
                    .select('name')
                    .eq('id', groupId)
                    .single()

                await supabase.from('notifications').insert({
                    user_id: userId,
                    title: 'Pagamento não concluído',
                    message: `Seu pagamento para o grupo "${failGroupData?.name || ''}" não foi aprovado. Tente novamente.`,
                    type: 'warning',
                    data: {
                        group_id: groupId,
                        payment_id: String(paymentId),
                        link: `/groups/${groupId}`,
                    },
                })

                console.log(`[MP Webhook] ❌ Payment ${payment.status} for user ${userId} in group ${groupId}`)
                break
            }

            case 'refunded':
            case 'charged_back': {
                // Revert payment status
                if (existingTx) {
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'FAILED',
                            metadata: {
                                provider: 'mercadopago',
                                provider_payment_id: String(paymentId),
                                mp_status: payment.status,
                                mp_status_detail: payment.status_detail,
                                refunded: true,
                            },
                        })
                        .eq('id', existingTx.id)
                }

                // Revert group_members to PENDING
                await supabase
                    .from('group_members')
                    .update({ payment_status: 'PENDING', paid_at: null })
                    .eq('group_id', groupId)
                    .eq('user_id', userId)

                console.log(`[MP Webhook] 🔄 Payment refunded for user ${userId} in group ${groupId}`)
                break
            }

            default:
                console.log(`[MP Webhook] Unhandled payment status: ${payment.status}`)
        }

        // Always return 200 to acknowledge receipt
        return NextResponse.json({ received: true }, { status: 200 })

    } catch (error: any) {
        console.error('[MP Webhook] Error:', error)
        // Still return 200 to prevent Mercado Pago from retrying indefinitely
        return NextResponse.json(
            { received: true, error: error.message },
            { status: 200 }
        )
    }
}
