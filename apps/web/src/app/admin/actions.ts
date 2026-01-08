'use server'

import { updateMatches, sendReminders } from '@/lib/cron'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function manualUpdateMatches() {
    try {
        const result = await updateMatches(false) // Not live loop, just one run
        revalidatePath('/admin')
        return { success: true, message: 'Partidas atualizadas com sucesso!', details: result }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function manualUpdateLiveMatches() {
    try {
        const result = await updateMatches(true) // isLive = true
        revalidatePath('/admin')
        return { success: true, message: 'Partidas ao vivo atualizadas com sucesso!', details: result }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function manualSendReminders() {
    try {
        const result = await sendReminders()
        revalidatePath('/admin')
        return { success: true, message: 'Lembretes enviados com sucesso!', details: result }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function getPendingBetsCount() {
    try {
        const supabase = await createClient()
        const { count, error } = await supabase
            .from('bets')
            .select('id, matches!inner(status, home_score, away_score)', { count: 'exact', head: true })
            .eq('points', 0)
            .in('matches.status', ['finished', 'FT', 'AET', 'PEN'])
            .not('matches.home_score', 'is', null)
            .not('matches.away_score', 'is', null)

        if (error) throw error
        return { success: true, count: count || 0 }
    } catch (error: any) {
        return { success: false, count: 0, message: error.message }
    }
}

export async function recalculateAllPendingBets() {
    try {
        const supabase = await createClient()

        // Get all finished matches with unprocessed bets
        const { data: pendingBets, error: fetchError } = await supabase
            .from('bets')
            .select(`
                id,
                home_score_bet,
                away_score_bet,
                group_id,
                match_id,
                matches!inner(id, status, home_score, away_score),
                groups!inner(scoring_rules)
            `)
            .eq('points', 0)
            .in('matches.status', ['finished', 'FT', 'AET', 'PEN'])
            .not('matches.home_score', 'is', null)
            .not('matches.away_score', 'is', null)

        if (fetchError) throw fetchError

        if (!pendingBets || pendingBets.length === 0) {
            revalidatePath('/admin')
            return { success: true, message: 'Nenhuma aposta pendente encontrada.', count: 0 }
        }

        // Get unique match IDs
        const matchIds = [...new Set(pendingBets.map(b => (b.matches as any).id))]

        // Call recalculate_match_points for each unique match
        let totalRecalculated = 0
        for (const matchId of matchIds) {
            const { data: count } = await supabase.rpc('recalculate_match_points', { p_match_id: matchId })
            totalRecalculated += count || 0
        }

        revalidatePath('/admin')
        return {
            success: true,
            message: `${totalRecalculated} apostas recalculadas com sucesso!`,
            count: totalRecalculated
        }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

