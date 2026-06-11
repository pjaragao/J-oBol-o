import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Trophy, Award, Zap, ShieldAlert, BadgeDollarSign, ShieldCheck } from 'lucide-react'

interface GroupRulesProps {
    group: {
        id?: string
        name: string
        is_paid: boolean
        payment_method: 'ONLINE' | 'OFFLINE'
        entry_fee: number | string
        scoring_rules?: any
        prize_distribution_strategy?: any
    }
}

export default function GroupRules({ group }: GroupRulesProps) {
    const rules = group.scoring_rules || {}
    
    // Normalize keys to support both db keys and form keys
    const exact = rules.exact ?? 10
    const winnerDiff = rules.winner_diff ?? rules.winner_goals ?? 7
    const winner = rules.winner ?? 5
    const oneScore = rules.one_score ?? rules.draw ?? 2

    const entryFee = Number(group.entry_fee) || 0
    const platformFee = entryFee * 0.05
    const totalCost = entryFee + platformFee

    const prizeStrategy = group.prize_distribution_strategy || { mode: 'WINNER_TAKES_ALL' }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Scoring Rules Card */}
            <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-md">
                <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 text-white rounded-xl">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Regras de Pontuação</CardTitle>
                            <CardDescription className="text-slate-500 dark:text-slate-400">Como os pontos são calculados para cada palpite</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cravada */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">🎯 Placar Exato (Cravada)</span>
                                <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-sm px-3 py-1 rounded-full">{exact} pts</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                                Você acerta exatamente o número de gols de ambas as equipes.
                            </p>
                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px]">
                                <span className="text-slate-400 font-bold">Exemplo: </span>
                                <span className="text-slate-600 dark:text-slate-350">Seu palpite: <strong className="text-indigo-600 dark:text-indigo-400">2x1</strong> | Placar do jogo: <strong>2x1</strong></span>
                            </div>
                        </div>

                        {/* Vencedor + Saldo */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">📊 Vencedor / Empate + Saldo</span>
                                <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-sm px-3 py-1 rounded-full">{winnerDiff} pts</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                                Você acerta o vencedor do jogo (ou que o jogo terminará empatado) e a diferença exata de gols (saldo).
                            </p>
                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                                <div>
                                    <span className="text-slate-400 font-bold">Exemplo Vitória: </span>
                                    <span className="text-slate-600 dark:text-slate-350">Seu palpite: <strong className="text-indigo-600 dark:text-indigo-400">3x1</strong> (saldo +2) | Placar: <strong>2x0</strong> (saldo +2)</span>
                                </div>
                                <div className="border-t border-slate-50 dark:border-slate-800/50 pt-1">
                                    <span className="text-slate-400 font-bold">Exemplo Empate: </span>
                                    <span className="text-slate-600 dark:text-slate-350">Seu palpite: <strong className="text-indigo-600 dark:text-indigo-400">1x1</strong> (saldo 0) | Placar: <strong>0x0</strong> (saldo 0)</span>
                                </div>
                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium pt-1">
                                    💡 Nota: Em empates, o saldo de gols é sempre 0. Portanto, acertar que o jogo terminará empatado (mas com placar diferente) garante sempre os {winnerDiff} pts.
                                </div>
                            </div>
                        </div>

                        {/* Apenas Vencedor */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">✓ Apenas Vencedor</span>
                                <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-sm px-3 py-1 rounded-full">{winner} pts</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                                Você acerta qual time vence o jogo, mas erra a diferença de gols (saldo) e o placar.
                            </p>
                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                                <div>
                                    <span className="text-slate-400 font-bold">Exemplo: </span>
                                    <span className="text-slate-600 dark:text-slate-350">Seu palpite: <strong className="text-indigo-600 dark:text-indigo-400">2x1</strong> | Placar do jogo: <strong>3x0</strong> (vitória do mesmo time)</span>
                                </div>
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                                    ⚠️ Nota: Esta pontuação não se aplica a empates. Acertar empate com placar diferente sempre garante {winnerDiff} pts (saldo de ambos é 0).
                                </div>
                            </div>
                        </div>

                        {/* Um Placar Correto */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">🎯 Um Placar Correto</span>
                                <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-sm px-3 py-1 rounded-full">{oneScore} pts</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                                Você não acerta o vencedor, mas acerta a quantidade de gols de pelo menos um time.
                            </p>
                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px]">
                                <span className="text-slate-400 font-bold">Exemplo: </span>
                                <span className="text-slate-600 dark:text-slate-350">Seu palpite: <strong className="text-indigo-600 dark:text-indigo-400">2x1</strong> | Placar do jogo: <strong>2x2</strong> (você acertou os 2 gols do Mandante)</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Prize and Fees Card */}
            {group.id === 'a2fba08f-a1d7-43e6-867a-653f7e537cf7' ? (
                <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500 text-white rounded-xl">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Premiação e Valores</CardTitle>
                                <CardDescription className="text-slate-500 dark:text-slate-400">Entenda os custos e a distribuição dos prêmios</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {/* Financial Summary Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Entry Fee Info */}
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <BadgeDollarSign className="w-4 h-4 text-emerald-500" />
                                    Taxa de Inscrição
                                </div>
                                <div className="space-y-2">
                                    <div className="text-3xl font-black text-slate-900 dark:text-white">
                                        R$ 85,00
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        O pagamento é feito via PIX direto para o organizador. Não há taxas adicionais na plataforma.
                                    </p>
                                    <div className="mt-3 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] space-y-1.5 text-slate-700 dark:text-slate-300">
                                        <p>🔑 <strong>Chave PIX:</strong> <span className="select-all font-mono">4b65a4b7-29f7-4f0c-a94a-e8300f019d09</span></p>
                                        <p>👤 <strong>Nome:</strong> Luiz Fernando Gouvea Teixeira</p>
                                        <p>💬 <strong>WhatsApp:</strong> <a href="https://wa.me/5548999730106" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">48 999730106 (Clique para enviar)</a></p>
                                    </div>
                                </div>
                            </div>

                            {/* Distribution Strategy Info */}
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <Award className="w-4 h-4 text-amber-500" />
                                    Regras de Premiação
                                </div>
                                <div className="space-y-3">
                                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                                        🏆 Regras do Bolão G4 Arena
                                    </div>
                                    <div className="space-y-1.5 mt-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] leading-relaxed text-slate-600 dark:text-slate-350">
                                        <p>🥇 <strong>CAMPEÃO:</strong> R$ 1.500,00 + Brindes</p>
                                        <p>🥈 <strong>VICE-CAMPEÃO:</strong> R$ 750,00 + Brindes</p>
                                        <p>🥉 <strong>TERCEIRO:</strong> R$ 250,00 + Brindes</p>
                                        <p>⚖️ <strong>EMPATE:</strong> A premiação será dividida</p>
                                        <p>👥 <strong>MÍNIMO:</strong> 45 participantes (caso contrário, prêmio proporcional)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500 text-white rounded-xl">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Premiação e Valores</CardTitle>
                                <CardDescription className="text-slate-500 dark:text-slate-400">Entenda os custos e a distribuição dos prêmios</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {/* Financial Summary Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Entry Fee Info */}
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <BadgeDollarSign className="w-4 h-4 text-emerald-500" />
                                    Taxa de Inscrição
                                </div>
                                {group.is_paid ? (
                                    <div className="space-y-2">
                                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entryFee)}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                            O valor da inscrição é revertido <strong className="text-emerald-600 dark:text-emerald-400">100% para o pote de prêmio</strong>.
                                        </p>
                                        {group.payment_method === 'ONLINE' && (
                                            <div className="mt-3 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] space-y-1.5">
                                                <div className="flex justify-between text-slate-500">
                                                    <span>Inscrição:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-350">R$ {entryFee.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-500">
                                                    <span>Taxa de pagamento (5%):</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-350">R$ {platformFee.toFixed(2)}</span>
                                                </div>
                                                <div className="border-t border-dashed my-1.5 pt-1.5 flex justify-between font-bold text-slate-900 dark:text-white">
                                                    <span>Total do participante:</span>
                                                    <span>R$ {totalCost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-2xl font-black text-slate-900 dark:text-white">Bolão Gratuito</div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                            Este bolão não possui taxa de inscrição nem premiação em dinheiro vinculada ao app.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Distribution Strategy Info */}
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <Award className="w-4 h-4 text-amber-500" />
                                    Regra de Divisão
                                </div>
                                <div className="space-y-3">
                                    {prizeStrategy.mode === 'WINNER_TAKES_ALL' ? (
                                        <>
                                            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                                                🏆 O Vencedor Leva Tudo
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                100% do pote líquido acumulado será pago integralmente ao 1º colocado no ranking final.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                                                📊 Divisão Percentual
                                            </div>
                                            <div className="space-y-1.5 mt-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                {prizeStrategy.tiers?.map((tier: any) => (
                                                    <div key={tier.rank} className="flex justify-between text-xs text-slate-600 dark:text-slate-350">
                                                        <span className="font-semibold">{tier.rank}º Lugar:</span>
                                                        <span className="font-extrabold text-amber-600 dark:text-amber-400">{tier.value}% do pote</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Offline Disclaimer */}
                        {group.is_paid && group.payment_method === 'OFFLINE' && (
                            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/40 flex gap-3 text-amber-800 dark:text-amber-300">
                                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div className="text-xs space-y-1 leading-relaxed">
                                    <strong className="block font-bold">Aviso de Pagamento Direto (Offline)</strong>
                                    <p>
                                        Este bolão é gerenciado de forma independente. O administrador é responsável por recolher as taxas e efetuar o pagamento das premiações fora da plataforma.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Funcionamento e Prazos Card */}
            <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-md">
                <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500 text-white rounded-xl">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Funcionamento e Prazos</CardTitle>
                            <CardDescription className="text-slate-500 dark:text-slate-400">Regras de transparência e prazos para envio dos palpites</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Prazo Limite */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">⏰</span>
                                    <span className="font-bold text-slate-900 dark:text-white">Prazo Limite</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Os palpites podem ser enviados ou alterados até **5 minutos antes** do início oficial de cada partida. Após esse prazo, o sistema bloqueia automaticamente qualquer alteração.
                                </p>
                            </div>
                        </div>

                        {/* Visibilidade Oculta */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">🔒</span>
                                    <span className="font-bold text-slate-900 dark:text-white">Palpites Ocultos</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Para garantir a integridade do bolão e evitar que participantes copiem palpites alheios (cola), as apostas dos seus adversários ficam ocultas e só serão reveladas a todos **após o início de cada jogo**.
                                </p>
                            </div>
                        </div>

                        {/* Mata-Mata */}
                        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:shadow-sm transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">⚡</span>
                                    <span className="font-bold text-slate-900 dark:text-white">Jogos de Mata-Mata</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Nas fases eliminatórias, os confrontos serão liberados para palpites assim que forem oficialmente definidos em campo. Fique atento para palpitar o quanto antes nessas fases!
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
