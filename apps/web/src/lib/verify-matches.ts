import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hbmtkaeymmvpjfarjpij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXRrYWV5bW12cGpmYXJqcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDc2NjcsImV4cCI6MjA4MTM4MzY2N30.pae3uwAOYfq8H5Tqcfc2FhNLLnuIHhsWhZ1N3qraP_A'
const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    console.log('--- Checking Premier League Matches (Since 2025-12-15) ---')

    // Get Event ID for PL
    const { data: events } = await supabase.from('events').select('id').ilike('description', '%- PL%').single()

    if (!events) {
        console.log('PL Event not found')
        return
    }

    const { data: matches } = await supabase
        .from('matches')
        .select('id, match_date, status, home_score, away_score, updated_at')
        .eq('event_id', events.id)
        .gte('match_date', '2025-12-15T00:00:00Z')
        .order('match_date', { ascending: true })

    console.log(`Found ${matches?.length} matches since 15/12`)
    if (matches && matches.length > 0) {
        // Show first 5
        console.log(JSON.stringify(matches.slice(0, 10).map(m => ({
            date: m.match_date,
            status: m.status,
            score: `${m.home_score}-${m.away_score}`,
            updated: m.updated_at
        })), null, 2))
    }
}

verify()
