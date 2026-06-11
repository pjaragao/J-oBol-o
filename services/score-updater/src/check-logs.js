const SUPABASE_URL = 'https://hbmtkaeymmvpjfarjpij.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXRrYWV5bW12cGpmYXJqcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDc2NjcsImV4cCI6MjA4MTM4MzY2N30.pae3uwAOYfq8H5Tqcfc2FhNLLnuIHhsWhZ1N3qraP_A';

async function getSyncLogsSchema() {
  console.log("Fetching a row from sync_logs...");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_logs?limit=1`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    const data = await res.json();
    console.log("Row contents:", data);
  } catch (error) {
    console.error("Error:", error);
  }
}

getSyncLogsSchema();
