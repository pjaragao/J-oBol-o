import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import BetsClient from './BetsClient'

export default async function MyBetsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.is_admin || false

    // Fetch user groups with event details
    const { data: memberships } = await supabase
        .from('group_members')
        .select(`
            group_id,
            groups (
                id,
                name,
                event_id,
                events (
                    id,
                    name,
                    logo_url
                )
            )
        `)
        .eq('user_id', user.id)

    const groups = memberships?.map((m: any) => ({
        id: m.groups.id,
        name: m.groups.name,
        event_id: m.groups.event_id,
        event: m.groups.events
    })) || []

    return (
        <AppLayout user={user} profile={profile} isAdmin={isAdmin}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minhas Apostas</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie todos os seus palpites em um só lugar.</p>
                </div>

                <BetsClient initialGroups={groups} userId={user.id} />
            </div>
        </AppLayout>
    )
}
