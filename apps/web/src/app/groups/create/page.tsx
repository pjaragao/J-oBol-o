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
import { Loader2, DollarSign, Trophy, Users, AlertCircle, Shield, Settings, Check, Trash } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from "../../../components/ui/checkbox"
import { FinancialService } from '@/lib/financial-service'

// --- Validation Schema ---
const createGroupSchema = z.object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    description: z.string().optional(),
    event_id: z.string().min(1, "Selecione um campeonato"),
    min_members: z.number().min(10, "Mínimo de 10 participantes"),
    max_members: z.number().nullable().optional(), // Required for offline only, validated manually
    is_paid: z.boolean().default(true),
    payment_method: z.enum(['ONLINE', 'OFFLINE']),
    entry_fee: z.number().min(0),
    is_public: z.boolean().default(true),
    allow_member_invites: z.boolean().default(true),
    join_requires_approval: z.boolean().default(false),
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
            min_members: 10,
            max_members: null,
            is_paid: true,
            payment_method: 'ONLINE',
            entry_fee: 0,
            is_public: true,
            allow_member_invites: true,
            join_requires_approval: false,
            score_exact: 10,
            score_winner_goals: 7,
            score_winner: 5,
            score_draw: 2
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
            if (data && data.length > 0) {
                setEvents(data)
                // Auto-select World Cup
                const worldCup = data.find((e: any) => 
                    e.name?.toLowerCase().includes('world cup') || 
                    e.name?.toLowerCase().includes('copa do mundo') ||
                    e.display_name?.toLowerCase().includes('world cup') || 
                    e.display_name?.toLowerCase().includes('copa do mundo') ||
                    e.code === 'WC'
                ) || data[0]
                if (worldCup && !selectedEventId) {
                    setValue('event_id', worldCup.id)
                }
            }
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


    const [prizeStrategy, setPrizeStrategy] = useState<any>({
        mode: 'PERCENTAGE',
        tiers: [
            { rank: 1, value: 65 },
            { rank: 2, value: 25 },
            { rank: 3, value: 10 }
        ]
    })


    const onSubmit = async (data: CreateGroupForm) => {
        setLoading(true)
        try {
            // Validate Logic
            if (data.is_paid && data.entry_fee < 20) {
                throw new Error("O valor mínimo de entrada para grupos pagos é R$ 20,00")
            }
            if (data.is_paid && data.payment_method === 'OFFLINE' && (!data.max_members || data.max_members < 10)) {
                throw new Error("Para grupos offline, é obrigatório definir um limite máximo de pelo menos 10 participantes.")
            }

            // Validate prize strategy
            if (prizeStrategy.mode === 'PERCENTAGE') {
                const totalPct = prizeStrategy.tiers.reduce((acc: number, tier: any) => acc + tier.value, 0)
                if (totalPct > 100) {
                    throw new Error("A soma das porcentagens de premiação não pode ultrapassar 100%.")
                }
                if (prizeStrategy.tiers.some((t: any) => t.value <= 0)) {
                    throw new Error("As porcentagens de premiação devem ser maiores que 0%.")
                }
                if (data.max_members && prizeStrategy.tiers.length > data.max_members) {
                    throw new Error(`O número de posições premiadas (${prizeStrategy.tiers.length}) não pode ser maior que o limite de vagas (${data.max_members}).`)
                }
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
                    is_public: data.is_public,
                    allow_member_invites: data.allow_member_invites,
                    join_requires_approval: data.join_requires_approval,
                    scoring_rules: scoringRules,
                    prize_distribution_strategy: prizeStrategy
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

    // Prevent Enter key from submitting the form accidentally
    const preventEnterSubmit = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
        }
    }

    const [readyToSubmit, setReadyToSubmit] = useState(false)

    useEffect(() => {
        if (step === 5) {
            setReadyToSubmit(false)
            const timer = setTimeout(() => setReadyToSubmit(true), 1000)
            return () => clearTimeout(timer)
        }
    }, [step])

    return (
        <div className="max-w-3xl mx-auto py-10 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Novo Bolão</h1>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${s <= step ? (step === 2 ? 'bg-emerald-500' : step === 3 ? 'bg-amber-500' : step === 5 ? 'bg-green-500' : 'bg-indigo-600') : 'bg-gray-200 dark:bg-slate-800'}`} />
                    ))}
                </div>
            </div>

            <div className={`transition-all duration-700 ${step === 2 ? 'rounded-2xl ring-8 ring-emerald-500/10' : ''}`}>

                <Card>
                    <CardContent className="pt-6">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* ... steps ... */}
                            {/* We are replacing the container to keep context, but actually I need to target the end of the file for the button logic */}

                            {/* STEP 1: Basic Info & Championship */}
                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <h2 className="text-xl font-semibold flex items-center gap-2"><Trophy className="w-5 h-5" /> Identidade do Bolão</h2>
                                    <div>
                                        <Label>Nome do Grupo</Label>
                                        <Input {...register('name')} placeholder="Ex: Bolão da Firma" className="bg-slate-50 dark:bg-slate-900 border-none h-12 text-lg" />
                                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                                    </div>
                                    <div>
                                        <Label>Descrição</Label>
                                        <Textarea {...register('description')} placeholder="Regras, combinados, etc..." className="bg-slate-50 dark:bg-slate-900 border-none min-h-[100px]" />
                                    </div>
                                    <div>
                                        <Label>Campeonato</Label>
                                        {(() => {
                                            const selectedEvent = events.find(e => e.id === selectedEventId) || events.find(e => 
                                                e.name?.toLowerCase().includes('world cup') || 
                                                e.name?.toLowerCase().includes('copa do mundo') ||
                                                e.display_name?.toLowerCase().includes('world cup') || 
                                                e.display_name?.toLowerCase().includes('copa do mundo')
                                            )
                                            return (
                                                <div className="bg-slate-50 dark:bg-slate-900 border-none h-12 rounded-lg flex items-center px-4 font-bold text-slate-700 dark:text-slate-200 opacity-80 cursor-not-allowed">
                                                    {selectedEvent ? `🏆 ${selectedEvent.display_name || selectedEvent.name}` : 'Carregando...'}
                                                </div>
                                            )
                                        })()}
                                        <input type="hidden" {...register('event_id')} value={selectedEventId || ''} />
                                        {errors.event_id && <p className="text-sm text-red-500">{errors.event_id.message}</p>}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Privacy, Financial & Limits */}
                            {step === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="space-y-4">
                                        <h2 className="text-xl font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                            <Shield className="w-5 h-5" /> Configurações e Financeiro
                                        </h2>

                                        {/* Privacy Options */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex items-start space-x-3 space-y-0 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                                                <Checkbox
                                                    id="is_public"
                                                    checked={watch('is_public')}
                                                    onCheckedChange={(v: boolean) => setValue('is_public', v)}
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <label htmlFor="is_public" className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                        Grupo Público
                                                    </label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Qualquer pessoa poderá encontrar seu bolão na busca.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-3 space-y-0 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                                                <Checkbox
                                                    id="allow_member_invites"
                                                    checked={watch('allow_member_invites')}
                                                    onCheckedChange={(v: boolean) => setValue('allow_member_invites', v)}
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <label htmlFor="allow_member_invites" className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                        Membros podem convidar
                                                    </label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Participantes poderão ver o código e convidar amigos.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-3 space-y-0 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                                                <Checkbox
                                                    id="join_requires_approval"
                                                    checked={watch('join_requires_approval')}
                                                    onCheckedChange={(v: boolean) => setValue('join_requires_approval', v)}
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <label htmlFor="join_requires_approval" className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                        Aprovação Manual
                                                    </label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Administradores devem aprovar cada novo membro.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-lg font-bold">Método de Pagamento</Label>
                                            <div className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                <DollarSign className="w-3 h-3" /> Bolão Pago
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div
                                                className={`relative overflow-hidden transition-all duration-300 border-2 rounded-2xl p-5 cursor-pointer hover:shadow-xl ${paymentMethod === 'ONLINE' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-900'}`}
                                                onClick={() => setValue('payment_method', 'ONLINE')}
                                            >
                                                {paymentMethod === 'ONLINE' && <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full"><Check className="w-3 h-3" /></div>}
                                                <h3 className="font-bold text-lg mb-1">Pela Plataforma</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">Nós gerenciamos o dinheiro, cobranças e prêmios automáticos. A taxa é cobrada por cima da inscrição.</p>
                                                <span className="inline-flex items-center text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-1 rounded uppercase">Taxa: 5% por cima</span>
                                            </div>

                                            <div
                                                className={`relative overflow-hidden transition-all duration-300 border-2 rounded-2xl p-5 cursor-pointer hover:shadow-xl ${paymentMethod === 'OFFLINE' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-900'}`}
                                                onClick={() => setValue('payment_method', 'OFFLINE')}
                                            >
                                                {paymentMethod === 'OFFLINE' && <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full"><Check className="w-3 h-3" /></div>}
                                                <h3 className="font-bold text-lg mb-1">Direto com Você</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">Você é o responsável por cobrar e pagar os prêmios por fora.</p>
                                                {creatorFee > 0 ? (
                                                    <span className="inline-flex items-center text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded uppercase">
                                                        Taxa Criação: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creatorFee)}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] font-black bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 px-2 py-1 rounded uppercase">Taxa por vaga</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold">Valor da Entrada</Label>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Por pessoa</span>
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500">R$</span>
                                                <Input
                                                    type="number"
                                                    className="pl-12 h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold"
                                                    onKeyDown={preventEnterSubmit}
                                                    onFocus={(e) => e.target.select()}
                                                    {...register('entry_fee', { valueAsNumber: true })}
                                                />
                                            </div>
                                            <p className={`text-[10px] font-bold transition-colors ${entryFee < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                Mínimo sugerido: R$ 20,00
                                            </p>
                                            {paymentMethod === 'ONLINE' && entryFee > 0 && (
                                                <div className="bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 mt-2">
                                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold leading-relaxed">
                                                        💵 Total do participante: <span className="font-black text-sm text-emerald-800 dark:text-emerald-300">R$ {(entryFee * 1.05).toFixed(2)}</span>
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                        (R$ {entryFee.toFixed(2)} inscrição + R$ {(entryFee * 0.05).toFixed(2)} taxa administrativa de 5%)
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold">Limite de Participantes</Label>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Mín. 10 jogadores</span>
                                            </div>
                                            <div className="relative group">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
                                                <Input
                                                    type="number"
                                                    className="pl-12 h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold"
                                                    onKeyDown={preventEnterSubmit}
                                                    {...register('max_members', { valueAsNumber: true })}
                                                    placeholder={paymentMethod === 'ONLINE' ? 'Ilimitado' : 'Obrigatório'}
                                                />
                                            </div>
                                            {paymentMethod === 'OFFLINE' && !maxMembers && (
                                                <p className="text-[10px] text-red-500 font-bold animate-pulse">Obrigatório p/ calcular taxa</p>
                                            )}
                                        </div>
                                    </div>

                                    {paymentMethod === 'OFFLINE' && !maxMembers && (
                                        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle className="font-black text-xs uppercase tracking-tight">Limite Obrigatório</AlertTitle>
                                            <AlertDescription className="text-xs">Para grupos Offline, você DEVE definir o limite de vagas para calcularmos a taxa de uso.</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: Premiação */}
                            {step === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                            <Trophy className="w-5 h-5" /> Estratégia de Premiação
                                        </h2>
                                        <span className="inline-flex items-center text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            Distribuição
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Escolha como o pote acumulado das inscrições será distribuído entre os vencedores.
                                        Esta regra será usada para cálculo de prêmios {isPaid && paymentMethod === 'ONLINE' && 'e futuramente para transferências automáticas via Mercado Pago'}.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div
                                            className={`relative overflow-hidden transition-all duration-300 border-2 rounded-2xl p-5 cursor-pointer hover:shadow-xl ${prizeStrategy.mode === 'WINNER_TAKES_ALL' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-900'}`}
                                            onClick={() => setPrizeStrategy({ ...prizeStrategy, mode: 'WINNER_TAKES_ALL' })}
                                        >
                                            {prizeStrategy.mode === 'WINNER_TAKES_ALL' && <div className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full"><Check className="w-3 h-3" /></div>}
                                            <h3 className="font-bold text-lg mb-1">Vencedor Leva Tudo</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">O 1º colocado do ranking final fica com 100% do prêmio acumulado.</p>
                                        </div>

                                        <div
                                            className={`relative overflow-hidden transition-all duration-300 border-2 rounded-2xl p-5 cursor-pointer hover:shadow-xl ${prizeStrategy.mode === 'PERCENTAGE' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-900'}`}
                                            onClick={() => setPrizeStrategy({ ...prizeStrategy, mode: 'PERCENTAGE' })}
                                        >
                                            {prizeStrategy.mode === 'PERCENTAGE' && <div className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full"><Check className="w-3 h-3" /></div>}
                                            <h3 className="font-bold text-lg mb-1">Divisão Personalizada</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">Distribua o prêmio entre múltiplas posições por porcentagem.</p>
                                        </div>
                                    </div>

                                    {prizeStrategy.mode === 'PERCENTAGE' && (() => {
                                        const hasMaxMembers = typeof maxMembers === 'number' && !isNaN(maxMembers) && maxMembers > 0;
                                        return (
                                            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80">
                                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Posições Premiadas</h4>
                                                
                                                <div className="space-y-3">
                                                    {prizeStrategy.tiers.map((tier: any, index: number) => {
                                                        const simulatedPot = (entryFee || 0) * (watch('min_members') || 10);
                                                        const projectedPrize = (simulatedPot * tier.value) / 100;
                                                        
                                                        return (
                                                            <div key={tier.rank} className="flex items-center gap-4 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="flex items-center gap-2 min-w-[80px]">
                                                                    <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-black">
                                                                        {tier.rank}º
                                                                    </span>
                                                                    <span className="text-xs font-bold text-slate-500">Lugar</span>
                                                                </div>
                                                                
                                                                <div className="relative flex-1 max-w-[120px]">
                                                                    <Input
                                                                        type="number"
                                                                        value={tier.value}
                                                                        onChange={(e) => {
                                                                            const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                                                            const newTiers = [...prizeStrategy.tiers];
                                                                            newTiers[index] = { ...newTiers[index], value: val };
                                                                            setPrizeStrategy({ ...prizeStrategy, tiers: newTiers });
                                                                        }}
                                                                        className="pr-8 font-bold text-right"
                                                                        min={0}
                                                                        max={100}
                                                                    />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                                                                </div>

                                                                {entryFee > 0 && (
                                                                    <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                                                                        Estimativa (mín. {watch('min_members') || 10} part.): <span className="font-bold text-slate-700 dark:text-slate-200">R$ {projectedPrize.toFixed(2)}</span>
                                                                    </div>
                                                                )}

                                                                {prizeStrategy.tiers.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            const newTiers = prizeStrategy.tiers
                                                                                .filter((_: any, idx: number) => idx !== index)
                                                                                .map((t: any, idx: number) => ({ ...t, rank: idx + 1 }));
                                                                            setPrizeStrategy({ ...prizeStrategy, tiers: newTiers });
                                                                        }}
                                                                        className="ml-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                                    >
                                                                        <Trash className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {(!hasMaxMembers || prizeStrategy.tiers.length < maxMembers) && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => {
                                                            const nextRank = prizeStrategy.tiers.length + 1;
                                                            const currentSum = prizeStrategy.tiers.reduce((acc: number, t: any) => acc + t.value, 0);
                                                            const remaining = Math.max(0, 100 - currentSum);
                                                            setPrizeStrategy({
                                                                ...prizeStrategy,
                                                                tiers: [...prizeStrategy.tiers, { rank: nextRank, value: remaining }]
                                                            });
                                                        }}
                                                        className="w-full border-dashed border-2 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 font-semibold"
                                                    >
                                                        + Adicionar Posição Premiada
                                                    </Button>
                                                )}

                                                {hasMaxMembers && prizeStrategy.tiers.length >= maxMembers && (
                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                                        ⚠️ Limite de posições atingido (máximo de participantes definido: {maxMembers}).
                                                    </p>
                                                )}

                                                {/* Sum Calculation and Warning */}
                                                {(() => {
                                                    const totalPct = prizeStrategy.tiers.reduce((acc: number, t: any) => acc + t.value, 0);
                                                    return (
                                                        <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                            <div className="text-xs">
                                                                Soma das Porcentagens: <span className={`font-black text-sm ${totalPct === 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-500'}`}>{totalPct}%</span>
                                                            </div>
                                                            {totalPct !== 100 && (
                                                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold max-w-[320px] leading-tight">
                                                                    ℹ️ A soma deve idealmente ser de 100% para distribuir todo o pote. {totalPct < 100 ? `Restam ${100 - totalPct}% sem premiação.` : `Passou do limite em ${totalPct - 100}%.`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* STEP 4: Scoring */}
                            {step === 4 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <h2 className="text-xl font-semibold flex items-center gap-2"><Settings className="w-5 h-5" /> Regras de Pontuação</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">Personalize quanto vale cada tipo de acerto em seu bolão.</p>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">🎯 Placar Exato</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 10</span>
                                            </div>
                                            <Input type="number" onKeyDown={preventEnterSubmit} {...register('score_exact', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">📊 Vencedor + Dif. Gols</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 7</span>
                                            </div>
                                            <Input type="number" onKeyDown={preventEnterSubmit} {...register('score_winner_goals', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">✓ Só Vencedor</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 5</span>
                                            </div>
                                            <Input type="number" onKeyDown={preventEnterSubmit} {...register('score_winner', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">🎯 Um Placar Correto</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 2</span>
                                            </div>
                                            <Input type="number" onKeyDown={preventEnterSubmit} {...register('score_draw', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: Confirmation */}
                            {step === 5 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <h2 className="text-xl font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
                                        <Check className="w-5 h-5" /> Confirme seu Bolão
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nome</p>
                                            <p className="font-bold text-lg truncate">{watch('name') || '-'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Campeonato</p>
                                            <p className="font-bold text-lg truncate">{events.find(e => e.id === watch('event_id'))?.display_name || events.find(e => e.id === watch('event_id'))?.name || '-'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-center">
                                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Entrada</p>
                                            <p className="font-bold text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(watch('entry_fee') || 0)}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
                                            <p className="text-[10px] font-black text-slate-500 uppercase">Vagas</p>
                                            <p className="font-bold text-lg">{watch('max_members') || '∞'}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-center">
                                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Método</p>
                                            <p className="font-bold text-sm">{watch('payment_method') === 'ONLINE' ? 'Plataforma' : 'Direto'}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
                                            <p className="text-[10px] font-black text-slate-500 uppercase">Aprovação</p>
                                            <p className="font-bold text-sm">{watch('join_requires_approval') ? 'Manual' : 'Livre'}</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Premiação</p>
                                        <div className="text-sm font-bold">
                                            {prizeStrategy.mode === 'WINNER_TAKES_ALL' ? (
                                                <span>🏆 1º Lugar: 100% do Pote</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-x-6 gap-y-1">
                                                    {prizeStrategy.tiers.map((t: any) => (
                                                        <span key={t.rank}>🥇 {t.rank}º Lugar: {t.value}%</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Pontuação</p>
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <span><strong>🎯 Exato:</strong> {watch('score_exact')} pts</span>
                                            <span><strong>📊 Venc+Dif:</strong> {watch('score_winner_goals')} pts</span>
                                            <span><strong>✓ Vencedor:</strong> {watch('score_winner')} pts</span>
                                            <span><strong>🎯 1 Placar:</strong> {watch('score_draw')} pts</span>
                                        </div>
                                    </div>

                                    {creatorFee > 0 && (
                                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                                <strong>Taxa de Criação:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creatorFee)} (será cobrada após criação)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between pt-6 border-t mt-6">
                                {step > 1 ? (
                                    <Button type="button" variant="ghost" onClick={prevStep} className="font-bold">Voltar</Button>
                                ) : <div />}

                                {step < 5 ? (
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        className={`px-8 font-black transition-all duration-300 ${step === 2 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none' : step === 3 ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'}`}
                                    >
                                        Próximo
                                    </Button>
                                ) : (
                                    <Button type="submit" disabled={loading || !readyToSubmit} className="bg-green-600 hover:bg-green-700 font-black px-10 shadow-lg shadow-green-200 dark:shadow-none transition-opacity duration-300">
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Criando...
                                            </>
                                        ) : !readyToSubmit ? (
                                            <>Aguarde...</>
                                        ) : (
                                            <>🚀 Criar Bolão</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
