import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hbmtkaeymmvpjfarjpij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXRrYWV5bW12cGpmYXJqcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDc2NjcsImV4cCI6MjA4MTM4MzY2N30.pae3uwAOYfq8H5Tqcfc2FhNLLnuIHhsWhZ1N3qraP_A'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log('--- EVENT SUMMARY ---')
    const { data: allEvents } = await supabase.from('events').select('*')

    if (allEvents) {
        for (const event of allEvents) {
            const codeMatch = event.description?.match(/- ([A-Z0-9]+)$/)
            const code = codeMatch ? codeMatch[1] : 'NULL'
            console.log(`[${event.is_active ? 'ACTIVE' : 'INACTIVE'}] ${event.name} (Code: ${code})`)
        }
    } else {
        console.log('No events found.')
    }
}

debug()
