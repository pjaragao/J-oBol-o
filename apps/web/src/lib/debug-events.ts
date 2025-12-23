import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log('--- Active Events ---')
    const { data: events } = await supabase.from('events').select('*').eq('is_active', true)
    console.table(events?.map(e => ({ id: e.id, name: e.name, description: e.description, is_active: e.is_active })))

    console.log('\n--- All Events ---')
    const { data: allEvents } = await supabase.from('events').select('*')
    console.table(allEvents?.map(e => ({ id: e.id, name: e.name, description: e.description, is_active: e.is_active })))

    console.log('\n--- Pending Matches Debug ---')
    if (events) {
        for (const event of events) {
            console.log(`Checking event: ${event.name} (${event.id})`)
            const codeMatch = event.description?.match(/- ([A-Z0-9]+)$/)
            const code = codeMatch ? codeMatch[1] : null
            console.log(`Code extracted: ${code}`)

            const { data: pendingMatches } = await supabase
                .from('matches')
                .select('id, match_date, status, home_team_id, away_team_id')
                .eq('event_id', event.id)
                .neq('status', 'finished')
                .neq('status', 'cancelled')
                .lt('match_date', new Date().toISOString())
                .order('match_date', { ascending: true })
                .limit(5)

            console.log(`Pending matches found: ${pendingMatches?.length}`)
            if (pendingMatches && pendingMatches.length > 0) {
                console.table(pendingMatches)
            }
        }
    }
}

debug()
