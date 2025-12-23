'use client'

import { useState } from 'react'
import { createCheckoutSession } from '@/lib/stripe/checkout'

export default function SubscriptionPage() {
    const [loading, setLoading] = useState<string | null>(null)
    const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')

    const handleSubscribe = async (tier: 'premium' | 'pro') => {
        setLoading(tier)
        try {
            const { url } = await createCheckoutSession(tier, period)
            window.location.href = url
        } catch (error: any) {
            alert('Erro ao iniciar assinatura: ' + error.message)
            setLoading(null)
        }
    }

    return (
        <div className="bg-gray-50 py-12 sm:py-16">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-indigo-600">Assinaturas</h2>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                        Escolha o plano ideal para seus bolões
                    </p>
                </div>

                <div className="mt-6 flex justify-center">
                    <div className="bg-white p-1 rounded-lg border flex">
                        <button
                            onClick={() => setPeriod('monthly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${period === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setPeriod('yearly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${period === 'yearly' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                            Anual (-20%)
                        </button>
                    </div>
                </div>

                <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
                    {/* FREE */}
                    <div className="rounded-3xl p-8 ring-1 ring-gray-200 xl:p-10 bg-white">
                        <h3 className="text-lg font-semibold leading-8 text-gray-900">Free</h3>
                        <p className="mt-4 text-sm leading-6 text-gray-600">Para começar a brincar com os amigos.</p>
                        <p className="mt-6 flex items-baseline gap-x-1">
                            <span className="text-4xl font-bold tracking-tight text-gray-900">R$ 0</span>
                        </p>
                        <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                            <li className="flex gap-x-3">✅ 1 Grupo de Bolão</li>
                            <li className="flex gap-x-3">✅ Máx 10 participantes</li>
                            <li className="flex gap-x-3">✅ Anúncios na plataforma</li>
                        </ul>
                        <button disabled className="mt-8 block w-full rounded-md bg-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                            Plano Atual
                        </button>
                    </div>

                    {/* PREMIUM */}
                    <div className="rounded-3xl p-8 ring-1 ring-indigo-200 xl:p-10 bg-indigo-50 border-2 border-indigo-500 relative">
                        <div className="absolute top-0 right-0 -mt-2 -mr-2 px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full">
                            POPULAR
                        </div>
                        <h3 className="text-lg font-semibold leading-8 text-indigo-600">Premium</h3>
                        <p className="mt-4 text-sm leading-6 text-gray-600">Para quem leva bolão a sério.</p>
                        <p className="mt-6 flex items-baseline gap-x-1">
                            <span className="text-4xl font-bold tracking-tight text-gray-900">
                                {period === 'monthly' ? 'R$ 9,90' : 'R$ 99,90'}
                            </span>
                            <span className="text-sm font-semibold leading-6 text-gray-600">/{period === 'monthly' ? 'mês' : 'ano'}</span>
                        </p>
                        <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                            <li className="flex gap-x-3">✅ Grupos Ilimitados</li>
                            <li className="flex gap-x-3">✅ Máx 50 participantes/grupo</li>
                            <li className="flex gap-x-3">✅ Sem anúncios</li>
                            <li className="flex gap-x-3">✅ Estatísticas básicas</li>
                        </ul>
                        <button
                            onClick={() => handleSubscribe('premium')}
                            disabled={!!loading}
                            className="mt-8 block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            {loading === 'premium' ? 'Processando...' : 'Assinar Premium'}
                        </button>
                    </div>

                    {/* PRO */}
                    <div className="rounded-3xl p-8 ring-1 ring-gray-200 xl:p-10 bg-white">
                        <h3 className="text-lg font-semibold leading-8 text-gray-900">Pro</h3>
                        <p className="mt-4 text-sm leading-6 text-gray-600">Para organizadores profissionais.</p>
                        <p className="mt-6 flex items-baseline gap-x-1">
                            <span className="text-4xl font-bold tracking-tight text-gray-900">
                                {period === 'monthly' ? 'R$ 19,90' : 'R$ 199,90'}
                            </span>
                            <span className="text-sm font-semibold leading-6 text-gray-600">/{period === 'monthly' ? 'mês' : 'ano'}</span>
                        </p>
                        <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                            <li className="flex gap-x-3">✅ Tudo do Premium</li>
                            <li className="flex gap-x-3">✅ Participantes Ilimitados</li>
                            <li className="flex gap-x-3">✅ Grupos Privados (Invisible)</li>
                            <li className="flex gap-x-3">✅ Análise avançada de dados</li>
                        </ul>
                        <button
                            onClick={() => handleSubscribe('pro')}
                            disabled={!!loading}
                            className="mt-8 block w-full rounded-md bg-gray-900 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            {loading === 'pro' ? 'Processando...' : 'Assinar Pro'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
