// ============================================
// Supabase Client — Service Role (bypasses RLS)
// ============================================

import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
