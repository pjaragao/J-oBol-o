import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { GroupTabs } from '@/components/groups/GroupTabs'

export default async function GroupDetailsPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = await params
    const supabase = createClient()
    const { data: { user } } = await (await supabase).auth.getUser()

    const { data: group } = await (await supabase)
        .from('groups')
        .select('*, events(name), group_members(count)')
        .eq('id', groupId)
        .single()

    if (!group) {
        notFound()
    }

    // Check if current user is admin
    const { data: membership } = await (await supabase)
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user?.id)
        .single()

    const isAdmin = membership?.role === 'admin'

    // Fetch matches for the event linked to this group
    const { data: matches } = await (await supabase)
        .from('matches')
        .select('*, home_team:teams!home_team_id(name, short_name, logo_url), away_team:teams!away_team_id(name, short_name, logo_url)')
        .eq('event_id', group.event_id)
        .order('match_date', { ascending: true })

    return (
        <div className="pb-12 bg-gray-50 dark:bg-slate-900">
            <header className="bg-green-700 dark:bg-slate-900 pb-24 border-b border-green-600 dark:border-slate-800">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white">{group.name}</h1>
                            <p className="text-green-100 mt-2">{group.description}</p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-4 text-sm text-green-100 bg-green-800/50 p-4 rounded-lg border border-green-600/30">
                        <div className="flex items-center gap-2">
                            <span role="img" aria-label="trophy">🏆</span>
                            <span className="font-semibold">{group.events.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span role="img" aria-label="users">👥</span>
                            <span>{group.group_members[0].count} participantes</span>
                        </div>
                        <div className="flex items-center gap-2 bg-green-900/50 px-3 py-1 rounded border border-green-600/30">
                            <span role="img" aria-label="key">🔑</span>
                            <button className="hover:text-white font-mono" title="Copiar código">
                                {group.invite_code}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="-mt-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <GroupTabs
                    groupId={groupId}
                    matches={matches || []}
                    group={group}
                    isAdmin={isAdmin}
                    userId={user?.id || ''}
                />
            </main>
        </div>
    )
}
