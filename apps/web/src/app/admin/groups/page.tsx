import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GroupAdminClient } from '@/components/admin/GroupAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminGroupsPage() {
    const supabase = await createClient()

    // 1. Get current user profile and session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // 2. Strict authorization: only user 4ccadc6a-7c98-422e-b930-8f11313db2f1 (pjaragaojr@gmail.com)
    if (user.id !== '4ccadc6a-7c98-422e-b930-8f11313db2f1' && user.email !== 'pjaragaojr@gmail.com') {
        redirect('/admin')
    }

    // 3. Fetch groups, creator details, and members with profile information
    const { data: groupsData, error } = await supabase
        .from('groups')
        .select(`
            id,
            name,
            description,
            created_at,
            entry_fee,
            is_public,
            max_members,
            payment_method,
            created_by,
            creator:profiles!created_by(
                id,
                display_name,
                email,
                avatar_url
            ),
            group_members(
                role,
                payment_status,
                joined_at,
                profile:profiles(
                    id,
                    display_name,
                    email,
                    avatar_url
                )
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching group administration data:', error)
    }

    const formattedGroups = (groupsData || []).map(group => {
        // Safe mapping to make sure any type-casting or structure aligns with client needs
        return {
            ...group,
            creator: Array.isArray(group.creator) ? group.creator[0] : group.creator,
            group_members: (group.group_members || []).map((member: any) => ({
                ...member,
                profile: Array.isArray(member.profile) ? member.profile[0] : member.profile
            }))
        }
    })

    return (
        <div className="container mx-auto px-4 py-8">
            <GroupAdminClient initialGroups={formattedGroups as any} />
        </div>
    )
}
