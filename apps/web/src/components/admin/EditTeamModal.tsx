'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team {
    id: string
    name: string
    short_name: string
    code: string
    logo_url: string
}

interface EditTeamModalProps {
    isOpen: boolean
    onClose: () => void
    team: Team
    onSave: () => void
}

export function EditTeamModal({ isOpen, onClose, team, onSave }: EditTeamModalProps) {
    const [name, setName] = useState(team.name)
    const [shortName, setShortName] = useState(team.short_name || '')
    const [logoUrl, setLogoUrl] = useState(team.logo_url || '')
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .from('teams')
                .update({
                    name,
                    short_name: shortName,
                    logo_url: logoUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', team.id)

            if (error) throw error

            onSave()
            onClose()
            alert('Time atualizado com sucesso!')
        } catch (error: any) {
            alert('Erro ao atualizar time: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
                <h3 className="text-lg font-bold mb-4">Editar Time</h3>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome Curto</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={shortName}
                                onChange={e => setShortName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">URL do Logo</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={logoUrl}
                                onChange={e => setLogoUrl(e.target.value)}
                            />
                            {logoUrl && (
                                <div className="mt-2 text-center">
                                    <img src={logoUrl} alt="Preview" className="h-12 w-12 object-contain mx-auto" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                </div>
                            )}
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
