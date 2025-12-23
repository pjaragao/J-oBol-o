import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

export default async function GroupsLayout({
    children,
}: {
    children: React.ReactNode
}) {
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

    // Check admin status (or fetch if not in profile, assuming profile.is_admin exists)
    // If is_admin is not on profile type yet, we might need to check standard way
    const isAdmin = profile?.is_admin || false

    return (
        <AppLayout user={user} profile={profile} isAdmin={isAdmin}>
            {children}
        </AppLayout>
    )
}
