import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured.');
}

// We use the service_role key to bypass RLS for administrative tasks.
// However, the chatbot service should only perform SELECT/INSERT queries.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
