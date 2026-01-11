'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, DollarSign, Trophy, Users, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FinancialService } from '@/lib/financial-service'

// --- Validation Schema ---
const createGroupSchema = z.object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    description: z.string().optional(),
    event_id: z.string().min(1, "Selecione um campeonato"),
    min_members: z.number().min(5, "Mínimo de 5 participantes"),
    max_members: z.number().nullable().optional(), // Required for offline only, validated manually
    is_paid: z.boolean().default(false),
    payment_method: z.enum(['ONLINE', 'OFFLINE']),
    entry_fee: z.number().min(0),
    // Scoring Rules
    score_exact: z.number().min(1),
    score_winner_goals: z.number().min(1),
    score_winner: z.number().min(1),
    score_draw: z.number().min(0).optional(),
})

type CreateGroupForm = z.infer<typeof createGroupSchema>

export default function CreateGroupPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [events, setEvents] = useState<any[]>([])
    const [step, setStep] = useState(1)
    const [creatorFee, setCreatorFee] = useState(0)

    const form = useForm<CreateGroupForm>({
        resolver: zodResolver(createGroupSchema),
        defaultValues: {
            name: '',
            description: '',
            min_members: 5,
            max_members: null,
            is_paid: false,
            payment_method: 'ONLINE',
            entry_fee: 0,
            score_exact: 10,
            score_winner_goals: 7,
            score_winner: 5,
            score_draw: 0
        }
    })

    const { watch, setValue, register, formState: { errors } } = form
    const paymentMethod = watch('payment_method')
    const isPaid = watch('is_paid')
    const maxMembers = watch('max_members')
    const entryFee = watch('entry_fee')
    const selectedEventId = watch('event_id')

    // Load Events
    useEffect(() => {
        const fetchEvents = async () => {
            const { data } = await supabase.from('events').select('*').eq('is_active', true)
            if (data) setEvents(data)
        }
        fetchEvents()
    }, [])

    // Calculate Creator Fee Live
    useEffect(() => {
        if (paymentMethod === 'OFFLINE' && isPaid && maxMembers && selectedEventId) {
            const event = events.find(e => e.id === selectedEventId)
            if (event) {
                // Mock fees if not in DB yet or use defaults
                const fees = {
                    online_fee_percent: event.online_fee_percent || 10,
                    offline_fee_per_slot: event.offline_fee_per_slot || 2, // Default fallback
                    offline_base_fee: event.offline_base_fee || 10
                }
                const fee = FinancialService.calculateOfflineCreatorFee(maxMembers, fees)
                setCreatorFee(fee)
            }
        } else {
            setCreatorFee(0)
        }
    }, [paymentMethod, isPaid, maxMembers, selectedEventId, events])


    const onSubmit = async (data: CreateGroupForm) => {
        setLoading(true)
        try {
            // Validate Logic
            if (data.is_paid && data.entry_fee < 20) {
                throw new Error("O valor mínimo de entrada para grupos pagos é R$ 20,00")
            }
            if (data.is_paid && data.payment_method === 'OFFLINE' && (!data.max_members || data.max_members < 5)) {
                throw new Error("Para grupos offline, é obrigatório definir um limite máximo de participantes.")
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Usuário não autenticado")

            const scoringRules = {
                exact: data.score_exact,
                winner_goals: data.score_winner_goals,
                winner: data.score_winner,
                draw: data.score_draw || 0
            }

            const { data: group, error } = await supabase
                .from('groups')
                .insert({
                    name: data.name,
                    description: data.description,
                    event_id: data.event_id,
                    created_by: user.id,
                    is_paid: data.is_paid,
                    payment_method: data.payment_method,
                    entry_fee: data.is_paid ? data.entry_fee : 0,
                    min_members: data.min_members,
                    max_members: data.max_members,
                    scoring_rules: scoringRules,
                    prize_distribution_strategy: { mode: 'WINNER_TAKES_ALL' } // Default for now
                })
                .select()
                .single()

            if (error) throw error

            // If OFFLINE and PAID, create the Creator Fee Transaction
            if (data.is_paid && data.payment_method === 'OFFLINE' && creatorFee > 0) {
                await supabase.from('transactions').insert({
                    group_id: group.id,
                    type: 'CREATOR_ADMISSION_FEE',
                    amount: creatorFee,
                    status: 'PENDING',
                    user_id: user.id,
                    metadata: { max_members: data.max_members }
                })
            }

            router.push(`/groups/${group.id}`)
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    const nextStep = () => setStep(s => s + 1)
    const prevStep = () => setStep(s => s - 1)

    return (
        <div className="max-w-3xl mx-auto py-10 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Novo Bolão</h1>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`h-2 flex-1 rounded-full ${s <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                    ))}
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* STEP 1: Basic Info */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2"><Trophy className="w-5 h-5" /> Informações Básicas</h2>
                                <div>
                                    <Label>Nome do Grupo</Label>
                                    <Input {...register('name')} placeholder="Ex: Bolão dafirma" />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                                </div>
                                <div>
                                    <Label>Descrição</Label>
                                    <Textarea {...register('description')} placeholder="Regras, combinados, etc..." />
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Championship & Limits */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="w-5 h-5" /> Campeonato e Vagas</h2>
                                <div>
                                    <Label>Campeonato</Label>
                                    <Select onValueChange={(v) => setValue('event_id', v)} defaultValue={watch('event_id')}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um campeonato" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {events.map(e => (
                                                <SelectItem key={e.id} value={e.id}>{e.display_name || e.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.event_id && <p className="text-sm text-red-500">{errors.event_id.message}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Mínimo de Participantes</Label>
                                        <Input type="number" {...register('min_members', { valueAsNumber: true })} />
                                        <p className="text-xs text-gray-500">Mínimo global: 5</p>
                                        {errors.min_members && <p className="text-sm text-red-500">{errors.min_members.message}</p>}
                                    </div>
                                    <div>
                                        <Label>Máximo (Vagas)</Label>
                                        <Input type="number" {...register('max_members', { valueAsNumber: true })} placeholder="Ilimitado (Online)" />
                                        {errors.max_members && <p className="text-sm text-red-500">{errors.max_members.message}</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Financial */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5" /> Financeiro</h2>

                                <div className="flex items-center justify-between border p-4 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Bolão Pago?</Label>
                                        <p className="text-sm text-muted-foreground">Cobrar entrada dos participantes e distribuir prêmios.</p>
                                    </div>
                                    <Switch checked={isPaid} onCheckedChange={(v) => setValue('is_paid', v)} />
                                </div>

                                {isPaid && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                        <div>
                                            <Label>Valor da Entrada (Por pessoa)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                                                <Input
                                                    type="number"
                                                    className="pl-10"
                                                    {...register('entry_fee', { valueAsNumber: true })}
                                                />
                                            </div>
                                            {entryFee < 20 && <p className="text-sm text-yellow-600 mt-1">Mínimo sugerido: R$ 20,00</p>}
                                        </div>

                                        <div>
                                            <Label>Método de Pagamento</Label>
                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                <div
                                                    className={`border rounded-lg p-4 cursor-pointer hover:bg-slate-50 ${paymentMethod === 'ONLINE' ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                                                    onClick={() => setValue('payment_method', 'ONLINE')}
                                                >
                                                    <h3 className="font-bold">Pela Plataforma (BETA)</h3>
                                                    <p className="text-xs text-gray-500 mt-1">Nós gerenciamos o dinheiro. Prêmios automáticos.</p>
                                                    <span className="inline-block mt-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Taxa: 10% do pote</span>
                                                </div>
                                                <div
                                                    className={`border rounded-lg p-4 cursor-pointer hover:bg-slate-50 ${paymentMethod === 'OFFLINE' ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                                                    onClick={() => setValue('payment_method', 'OFFLINE')}
                                                >
                                                    <h3 className="font-bold">Direto com Você</h3>
                                                    <p className="text-xs text-gray-500 mt-1">Você cobra e paga os prêmios externamente.</p>
                                                    {creatorFee > 0 && (
                                                        <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                            Taxa Criação: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creatorFee)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {paymentMethod === 'OFFLINE' && !maxMembers && (
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Atenção</AlertTitle>
                                                <AlertDescription>Para grupos Offline, você DEVE definir um Limite Máximo de Vagas na etapa anterior para calcularmos a taxa de uso.</AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 4: Scoring */}
                        {step === 4 && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold">Regras de Pontuação</h2>
                                <p className="text-sm text-muted-foreground">Personalize quantos pontos vale cada tipo de acerto.</p>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label>Placar Exato (Na Mosca)</Label>
                                        <Input type="number" {...register('score_exact', { valueAsNumber: true })} />
                                    </div>
                                    <div>
                                        <Label>Vencedor + Gols de um time</Label>
                                        <Input type="number" {...register('score_winner_goals', { valueAsNumber: true })} />
                                    </div>
                                    <div>
                                        <Label>Apenas Vencedor</Label>
                                        <Input type="number" {...register('score_winner', { valueAsNumber: true })} />
                                    </div>
                                    <div>
                                        <Label>Empate (Sem acertar placar)</Label>
                                        <Input type="number" {...register('score_draw', { valueAsNumber: true })} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between pt-6 border-t mt-6">
                            {step > 1 ? (
                                <Button type="button" variant="outline" onClick={prevStep}>Voltar</Button>
                            ) : <div />}

                            {step < 4 ? (
                                <Button type="button" onClick={nextStep}>Próximo</Button>
                            ) : (
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Criar Bolão
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
