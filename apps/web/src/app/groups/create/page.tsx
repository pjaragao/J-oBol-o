'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateGroupPage() {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const [events, setEvents] = useState<any[]>([])
    const [selectedEventId, setSelectedEventId] = useState('')

    // Fetch events on component mount
    useEffect(() => {
        const fetchEvents = async () => {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('is_active', true)

            if (data && data.length > 0) {
                console.log('Eventos carregados:', data)
                setEvents(data)
                setSelectedEventId(data[0].id)
            } else {
                console.log('Nenhum evento ativo encontrado')
            }
        }
        fetchEvents()
    }, [])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        console.log('Usuário logado:', user)

        if (!user) {
            setLoading(false)
            return
        }

        console.log('Evento selecionado:', selectedEventId)

        if (!selectedEventId) {
            alert('Nenhum evento ativo encontrado para criar o grupo.')
            setLoading(false)
            return
        }

        try {
            console.log('Tentando criar grupo...')
            const { data, error } = await supabase
                .from('groups')
                .insert({
                    name,
                    description,
                    event_id: selectedEventId,
                    created_by: user.id
                })
                .select()
                .single()

            if (error) {
                console.error('Erro Supabase:', error)
                throw error
            }

            console.log('Grupo criado com sucesso:', data)
            router.push(`/groups/${data.id}`)
        } catch (error: any) {
            console.error('Erro capturado:', error)
            alert('Erro ao criar grupo: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-8">Criar Novo Bolão</h1>

            <form onSubmit={handleCreate} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Nome do Grupo
                    </label>
                    <input
                        type="text"
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    />
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Descrição (opcional)
                    </label>
                    <textarea
                        id="description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    />
                </div>

                <div>
                    <label htmlFor="event" className="block text-sm font-medium text-gray-700">
                        Campeonato
                    </label>
                    {events.length > 0 ? (
                        <select
                            id="event"
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        >
                            {events.map((event) => (
                                <option key={event.id} value={event.id}>
                                    {event.display_name || event.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <p className="text-sm text-red-600 mt-1">
                            Nenhum campeonato ativo encontrado. Peça ao admin para importar um campeonato.
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {loading ? 'Criando...' : 'Criar Grupo'}
                </button>
            </form>
        </div>
    )
}
