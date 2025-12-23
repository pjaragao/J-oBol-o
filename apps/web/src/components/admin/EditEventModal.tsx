'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Event {
    id: string
    name: string
    display_name: string | null
    is_active: boolean
}

interface EditEventModalProps {
    isOpen: boolean
    onClose: () => void
    event: Event
    onSave: () => void
}

export function EditEventModal({ isOpen, onClose, event, onSave }: EditEventModalProps) {
    const [displayName, setDisplayName] = useState(event.display_name || '')
    const [isActive, setIsActive] = useState(event.is_active)
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .from('events')
                .update({
                    display_name: displayName || null,
                    is_active: isActive
                })
                .eq('id', event.id)

            if (error) throw error

            onSave()
            onClose()
        } catch (error: any) {
            alert('Erro ao atualizar: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-bold mb-4">Editar Campeonato</h3>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome Original (API)</label>
                            <p className="mt-1 text-sm text-gray-500 bg-gray-50 p-2 rounded">{event.name}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome de Exibição</label>
                            <input
                                type="text"
                                placeholder={event.name}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                            />
                            <p className="mt-1 text-xs text-gray-500">Deixe em branco para usar o nome original.</p>
                        </div>
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                                Ativo para novos grupos
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
