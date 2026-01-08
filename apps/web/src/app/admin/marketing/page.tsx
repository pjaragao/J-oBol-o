import React from 'react'
import { CampaignForm } from './components/CampaignForm'
import { Megaphone, History } from 'lucide-react'

export default function MarketingPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <Megaphone className="h-8 w-8 text-green-600" />
                        Campanhas de Marketing
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Envie notificações em massa e lembretes inteligentes para engajar seus usuários.
                    </p>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 transition-all">
                    <History className="h-4 w-4" />
                    Histórico de Envios
                </button>
            </div>

            <CampaignForm />
        </div>
    )
}
