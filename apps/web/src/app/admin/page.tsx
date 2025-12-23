import { createClient } from '@/lib/supabase/server'
import { CronControls } from '@/components/admin/CronControls'

export default async function AdminDashboard() {
    const supabase = createClient()

    // Parallel fetch for stats
    const [
        { count: usersCount },
        { count: groupsCount },
        { count: matchesCount }
    ] = await Promise.all([
        (await supabase).from('profiles').select('*', { count: 'exact', head: true }),
        (await supabase).from('groups').select('*', { count: 'exact', head: true }),
        (await supabase).from('matches').select('*', { count: 'exact', head: true })
    ])

    return (
        <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 mb-8">
                Dashboard Overview
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase">Total de Usuários</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{usersCount || 0}</p>
                        </div>
                        <div className="bg-indigo-100 p-3 rounded-full">
                            <span className="text-2xl">👥</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase">Total de Grupos</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{groupsCount || 0}</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full">
                            <span className="text-2xl">🏆</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase">Partidas Cadastradas</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{matchesCount || 0}</p>
                        </div>
                        <div className="bg-yellow-100 p-3 rounded-full">
                            <span className="text-2xl">⚽</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold mb-4">Ações Rápidas</h3>
                    <div className="flex gap-4">
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                            Criar Novo Campeonato
                        </button>
                        <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Ver Logs
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold mb-4">Manutenção & Atualizações</h3>
                    <CronControls />
                </div>
            </div>
        </div>
    )
}
