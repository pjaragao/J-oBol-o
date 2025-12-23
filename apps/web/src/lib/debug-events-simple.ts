import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hbmtkaeymmvpjfarjpij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXRrYWV5bW12cGpmYXJqcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDc2NjcsImV4cCI6MjA4MTM4MzY2N30.pae3uwAOYfq8H5Tqcfc2FhNLLnuIHhsWhZ1N3qraP_A'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log('--- Active Events ---')
    const { data: events } = await supabase.from('events').select('*').eq('is_active', true)
    console.log(JSON.stringify(events?.map(e => ({ id: e.id, name: e.name, description: e.description, is_active: e.is_active })), null, 2))

    console.log('\n--- All Events ---')
    const { data: allEvents } = await supabase.from('events').select('*')
    console.log(JSON.stringify(allEvents?.map(e => ({ id: e.id, name: e.name, description: e.description, is_active: e.is_active })), null, 2))

    console.log('\n--- Pending Matches Debug ---')

    // First, let's find the events
    if (allEvents) {
        for (const event of allEvents) {
            const codeMatch = event.description?.match(/- ([A-Z0-9]+)$/)
            const code = codeMatch ? codeMatch[1] : null
            console.log(`Event: ${event.name} -> Code: ${code}`)
        }
    }

    const { data: pendingMatches } = await supabase
        .from('matches')
        .select('id, match_date, status, home_team_id, away_team_id, event_id')
        .lt('match_date', new Date().toISOString())
        .in('status', ['scheduled', 'TIMED'])
        .limit(10)

    console.log(`\nGlobal Pending Matches (scheduled + past): ${pendingMatches?.length}`)
    if (pendingMatches && pendingMatches.length > 0) {
        console.log(JSON.stringify(pendingMatches, null, 2))
    }
}

debug()
