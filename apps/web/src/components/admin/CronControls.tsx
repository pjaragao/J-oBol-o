'use client'

import { useState } from 'react'
import { manualUpdateMatches, manualSendReminders } from '@/app/admin/actions'

export function CronControls() {
    const [loading, setLoading] = useState<string | null>(null)

    const handleUpdateMatches = async () => {
        if (!confirm('Tem certeza que deseja forçar a atualização das partidas?')) return
        setLoading('matches')
        try {
            const res = await manualUpdateMatches()
            if (res.success) {
                alert(res.message)
            } else {
                alert('Erro: ' + res.message)
            }
        } catch (e) {
            alert('Erro inesperado ao atualizar partidas')
        } finally {
            setLoading(null)
        }
    }

    const handleSendReminders = async () => {
        if (!confirm('Tem certeza que deseja enviar lembretes agora?')) return
        setLoading('reminders')
        try {
            const res = await manualSendReminders()
            if (res.success) {
                alert(res.message)
            } else {
                alert('Erro: ' + res.message)
            }
        } catch (e) {
            alert('Erro inesperado ao enviar lembretes')
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="flex gap-4">
            <button
                onClick={handleUpdateMatches}
                disabled={!!loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
                {loading === 'matches' ? (
                    <>
                        <span className="animate-spin">↻</span> Atualizando...
                    </>
                ) : (
                    <>🔄 Atualizar Partidas</>
                )}
            </button>
            <button
                onClick={handleSendReminders}
                disabled={!!loading}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
                {loading === 'reminders' ? (
                    <>
                        <span className="animate-spin">↻</span> Enviando...
                    </>
                ) : (
                    <>🔔 Enviar Lembretes</>
                )}
            </button>
        </div>
    )
}
