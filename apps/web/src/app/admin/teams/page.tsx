import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeamList } from '@/components/admin/TeamList'

export default async function AdminTeamsPage() {
    const supabase = createClient()
    const { data: { user }, error } = await (await supabase).auth.getUser()

    if (error || !user) {
        redirect('/login')
    }

    const { data: profile } = await (await supabase)
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin) {
        redirect('/')
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Gerenciar Times</h1>
            </div>

            <TeamList />
        </div>
    )
}
