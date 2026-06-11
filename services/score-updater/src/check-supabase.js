const SUPABASE_URL = 'https://hbmtkaeymmvpjfarjpij.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXRrYWV5bW12cGpmYXJqcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDc2NjcsImV4cCI6MjA4MTM4MzY2N30.pae3uwAOYfq8H5Tqcfc2FhNLLnuIHhsWhZ1N3qraP_A';

async function querySupabase() {
  console.log("Querying Supabase...");
  try {
    // 1. Get active events
    console.log("\n--- Active Events ---");
    let res = await fetch(`${SUPABASE_URL}/rest/v1/events?is_active=eq.true&select=*`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    let events = await res.json();
    console.log(events);

    // 2. Get sync logs
    console.log("\n--- Sync Logs (last 5) ---");
    res = await fetch(`${SUPABASE_URL}/rest/v1/sync_logs?select=*&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    let logs = await res.json();
    console.log(logs);

    // 3. Get matches for today or currently live
    console.log("\n--- Matches today/live ---");
    res = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*,home_team:teams!home_team_id(*),away_team:teams!away_team_id(*)&order=match_date.desc&limit=5`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    let matches = await res.json();
    console.log(matches.map(m => ({
      id: m.id,
      date: m.match_date,
      teams: `${m.home_team?.name} vs ${m.away_team?.name}`,
      score: `${m.home_score}x${m.away_score}`,
      status: m.status,
      api_id: m.api_id
    })));

  } catch (error) {
    console.error("Error querying Supabase:", error);
  }
}

querySupabase();
