import 'server-only'
import { createClient } from '@/lib/supabase/client' // Note: For server side we might need createClient from /server or use admin client
import { createClient as createServerClient } from '@supabase/supabase-js'

// Simple logger using Service Role key if available, or just standard client
// Since this runs in API routes, we can use the environment variables directly for a server-side client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export class SyncLogger {
    private supabase;

    constructor() {
        if (supabaseServiceKey) {
            this.supabase = createServerClient(supabaseUrl, supabaseServiceKey)
        } else {
            console.warn('SyncLogger: No Service Role Key found, logging might fail if RLS prevents it.')
            // Fallback to anonymous client (might fail)
            this.supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        }
    }

    async log(params: {
        resourceType: 'league' | 'fixtures' | 'teams' | 'system' | 'cron_matches',
        status: 'running' | 'success' | 'error',
        details?: any,
        errorMessage?: string,
        userId?: string
    }) {
        try {
            const { error } = await this.supabase
                .from('sync_logs')
                .insert({
                    reosurce_type: params.resourceType, // typo in migration: reosurce_type
                    status: params.status,
                    details: params.details,
                    error_message: params.errorMessage,
                    created_by: params.userId
                })

            if (error) {
                console.error('SyncLogger Error:', error)
            }
        } catch (err) {
            console.error('SyncLogger exception:', err)
        }
    }
}

export const syncLogger = new SyncLogger()
