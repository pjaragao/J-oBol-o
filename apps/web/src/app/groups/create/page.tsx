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
import { Loader2, DollarSign, Trophy, Users, AlertCircle, Shield, Settings, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from "../../../components/ui/checkbox"
import { FinancialService } from '@/lib/financial-service'

// --- Validation Schema ---
const createGroupSchema = z.object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    description: z.string().optional(),
    event_id: z.string().min(1, "Selecione um campeonato"),
    min_members: z.number().min(5, "Mínimo de 5 participantes"),
    max_members: z.number().nullable().optional(), // Required for offline only, validated manually
    is_paid: z.boolean().default(true),
    payment_method: z.enum(['ONLINE', 'OFFLINE']),
    entry_fee: z.number().min(0),
    is_public: z.boolean().default(true),
    allow_member_invites: z.boolean().default(true),
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
            is_paid: true,
            payment_method: 'ONLINE',
            entry_fee: 0,
            is_public: true,
            allow_member_invites: true,
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
                    is_public: data.is_public,
                    allow_member_invites: data.allow_member_invites,
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

    // Prevent Enter key from submitting the form accidentally
    const preventEnterSubmit = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-10 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Novo Bolão</h1>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${s <= step ? (step === 2 ? 'bg-emerald-500' : step === 4 ? 'bg-green-500' : 'bg-indigo-600') : 'bg-gray-200 dark:bg-slate-800'}`} />
                    ))}
                </div>
            </div>

            <div className={`transition-all duration-700 ${step === 2 ? 'rounded-2xl ring-8 ring-emerald-500/10' : ''}`}>

                <Card>
                    <CardContent className="pt-6">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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
                                        <Select onValueChange={(v) => setValue('event_id', v)} defaultValue={watch('event_id')}>
                                            <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-none h-12">
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
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">Nós gerenciamos o dinheiro, cobranças e prêmios automáticos.</p>
                                                <span className="inline-flex items-center text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-1 rounded uppercase">Taxa: 10% do pote</span>
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
                                            <Label className="font-bold">Valor da Entrada</Label>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500">R$</span>
                                                <Input
                                                    type="number"
                                                    className="pl-12 h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold"
                                                    {...register('entry_fee', { valueAsNumber: true })}
                                                />
                                            </div>
                                            <p className={`text-[10px] font-bold transition-colors ${entryFee < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                Mínimo sugerido: R$ 20,00
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="font-bold">Limite de Participantes (Vagas)</Label>
                                            <div className="relative group">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
                                                <Input
                                                    type="number"
                                                    className="pl-12 h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold"
                                                    {...register('max_members', { valueAsNumber: true })}
                                                    placeholder={paymentMethod === 'ONLINE' ? 'Ilimitado' : 'Mín. 5'}
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

                            {/* STEP 3: Scoring */}
                            {step === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <h2 className="text-xl font-semibold flex items-center gap-2"><Settings className="w-5 h-5" /> Regras de Pontuação</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">Personalize quanto vale cada tipo de acerto em seu bolão.</p>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">🎯 Placar Exato</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 10</span>
                                            </div>
                                            <Input type="number" {...register('score_exact', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">📊 Venceu + Altura</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 7</span>
                                            </div>
                                            <Input type="number" {...register('score_winner_goals', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">✓ Só Vencedor</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 5</span>
                                            </div>
                                            <Input type="number" {...register('score_winner', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-bold">~ Empate Genérico</Label>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">Sugestão: 2</span>
                                            </div>
                                            <Input type="number" {...register('score_draw', { valueAsNumber: true })} className="h-12 bg-slate-50 dark:bg-slate-900 border-none text-xl font-bold text-center" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: Confirmation */}
                            {step === 4 && (
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
                                            <p className="text-[10px] font-black text-slate-500 uppercase">Visibilidade</p>
                                            <p className="font-bold text-sm">{watch('is_public') ? 'Público' : 'Privado'}</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Pontuação</p>
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <span><strong>🎯 Exato:</strong> {watch('score_exact')} pts</span>
                                            <span><strong>📊 Vencedor+:</strong> {watch('score_winner_goals')} pts</span>
                                            <span><strong>✓ Vencedor:</strong> {watch('score_winner')} pts</span>
                                            <span><strong>~ Empate:</strong> {watch('score_draw')} pts</span>
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

                                {step < 4 ? (
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        className={`px-8 font-black transition-all duration-300 ${step === 2 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'}`}
                                    >
                                        Próximo
                                    </Button>
                                ) : (
                                    <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 font-black px-10 shadow-lg shadow-green-200 dark:shadow-none">
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        🚀 Criar Bolão
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
