import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { localizeExternalImage } from '@/lib/supabase/storage-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // 1. Auth check (Admin only)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const results = {
            teams: 0,
            events: 0,
            errors: [] as string[]
        }

        // 2. Localize Team Logos
        const { data: teams } = await supabase
            .from('teams')
            .select('id, name, logo_url')
            .not('logo_url', 'is', null)
            // Filter out already localized (contains supabase URL pattern)
            .not('logo_url', 'ilike', '%supabase%')

        if (teams) {
            for (const team of teams) {
                const extension = team.logo_url?.split('.').pop() || 'png'
                const fileName = `${team.id}.${extension}`
                const localizedUrl = await localizeExternalImage(team.logo_url!, 'team-logos', fileName)

                if (localizedUrl && localizedUrl !== team.logo_url) {
                    await supabase.from('teams').update({ logo_url: localizedUrl }).eq('id', team.id)
                    results.teams++
                }
            }
        }

        // 3. Localize Event Logos
        const { data: events } = await supabase
            .from('events')
            .select('id, name, logo_url')
            .not('logo_url', 'is', null)
            .not('logo_url', 'ilike', '%supabase%')

        if (events) {
            for (const event of events) {
                const extension = event.logo_url?.split('.').pop() || 'png'
                const fileName = `${event.id}.${extension}`
                const localizedUrl = await localizeExternalImage(event.logo_url!, 'competition-logos', fileName)

                if (localizedUrl && localizedUrl !== event.logo_url) {
                    await supabase.from('events').update({ logo_url: localizedUrl }).eq('id', event.id)
                    results.events++
                }
            }
        }

        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
