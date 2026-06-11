import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogListClient from './LogListClient'

export default async function AdminLogsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Check admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin) redirect('/')

    // Fetch logs (fetch up to 200 to give a good history for client filtering)
    const { data: logs } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(200)

    return <LogListClient initialLogs={logs || []} />
}
