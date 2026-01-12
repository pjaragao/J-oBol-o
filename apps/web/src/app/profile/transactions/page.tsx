'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DollarSign, ArrowLeft, ArrowUpRight, ArrowDownLeft, Wallet, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Transaction {
    id: string
    type: string
    amount: number
    status: string
    created_at: string
    group_id: string
    groups: {
        name: string
    }
}

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchTransactions = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('transactions')
                .select('*, groups(name)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (data) setTransactions(data)
            setLoading(false)
        }

        fetchTransactions()
    }, [supabase])

    const getIcon = (type: string) => {
        switch (type) {
            case 'ENTRY_FEE': return <ArrowUpRight className="text-red-500" />
            case 'PRIZE_PAYOUT': return <ArrowDownLeft className="text-green-500" />
            case 'PLATFORM_FEE_ONLINE': return <ArrowUpRight className="text-slate-500" />
            default: return <Wallet className="text-blue-500" />
        }
    }

    const getLabel = (type: string) => {
        switch (type) {
            case 'ENTRY_FEE': return 'Pagamento de Entrada'
            case 'PRIZE_PAYOUT': return 'Prêmio Recebido'
            case 'PLATFORM_FEE_ONLINE': return 'Taxa da Plataforma'
            case 'CREATOR_ADMISSION_FEE': return 'Taxa de Criação de Grupo'
            case 'CREATOR_UPGRADE_FEE': return 'Taxa de Upgrade'
            default: return type
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <Link href="/dashboard" className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-800 transition-colors mb-2">
                        <ArrowLeft className="w-4 h-4" /> Voltar ao Início
                    </Link>
                    <h1 className="text-3xl font-bold">Minhas Transações</h1>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-green-500 text-white rounded-full shadow-lg">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs text-green-700 dark:text-green-400 block uppercase font-bold tracking-wider">Saldo em Prêmios</span>
                        <span className="text-2xl font-black text-green-900 dark:text-green-100">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                transactions.reduce((acc, t) => t.type === 'PRIZE_PAYOUT' ? acc + t.amount : acc, 0)
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico Recente</CardTitle>
                    <CardDescription>Acompanhe todos os seus movimentos financeiros na plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-10 text-center text-slate-400">Carregando transações...</div>
                    ) : transactions.length === 0 ? (
                        <div className="py-20 text-center text-slate-400">
                            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p>Nenhuma transação encontrada.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                                            {getIcon(t.type)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{getLabel(t.type)}</h4>
                                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(t.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                <span className="opacity-30">•</span>
                                                {t.groups?.name || 'Sistema'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-black ${t.type === 'PRIZE_PAYOUT' ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {t.type === 'PRIZE_PAYOUT' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                        </div>
                                        <div className={`text-[10px] font-bold uppercase tracking-widest ${t.status === 'COMPLETED' ? 'text-green-500' : 'text-yellow-500'}`}>
                                            {t.status === 'COMPLETED' ? 'Concluído' : 'Pendente'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
