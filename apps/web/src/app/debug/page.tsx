import { createClient } from '@/lib/supabase/server'

export default async function AdminDebugPage() {
    const supabase = createClient()

    const { data: { user } } = await (await supabase).auth.getUser()

    if (!user) {
        return <div className="p-8">Usuário não logado</div>
    }

    const { data: profile, error } = await (await supabase)
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return (
        <div className="p-8 font-mono text-sm">
            <h1 className="text-xl font-bold mb-4">Debug: Status do Usuário</h1>

            <div className="bg-gray-100 p-4 rounded mb-4">
                <h2 className="font-bold">Auth User:</h2>
                <pre>{JSON.stringify({ id: user.id, email: user.email }, null, 2)}</pre>
            </div>

            <div className="bg-gray-100 p-4 rounded mb-4">
                <h2 className="font-bold">Profile (do banco):</h2>
                {error ? (
                    <pre className="text-red-600">Erro: {JSON.stringify(error, null, 2)}</pre>
                ) : (
                    <pre>{JSON.stringify(profile, null, 2)}</pre>
                )}
            </div>

            <div className={`p-4 rounded ${profile?.is_admin ? 'bg-green-100' : 'bg-red-100'}`}>
                <strong>is_admin:</strong> {String(profile?.is_admin)}
                {!profile?.is_admin && (
                    <p className="mt-2 text-sm">
                        Execute no Supabase SQL Editor:<br />
                        <code className="bg-gray-800 text-white px-2 py-1 rounded">
                            UPDATE public.profiles SET is_admin = true WHERE id = '{user.id}';
                        </code>
                    </p>
                )}
            </div>
        </div>
    )
}
