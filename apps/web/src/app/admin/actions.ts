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

export async function updateSingleEvent(eventId: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/admin/update-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId })
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao atualizar evento')

        revalidatePath('/admin/events')
        return { success: true, message: data.message }
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

        // Get bets where match is finished but bet.updated_at < match.updated_at
        // This means the bet wasn't recalculated after the match was updated
        const { data, error } = await supabase
            .from('bets')
            .select(`
                id,
                updated_at,
                matches!inner(status, home_score, away_score, updated_at)
            `)
            .in('matches.status', ['finished', 'FT', 'AET', 'PEN'])
            .not('matches.home_score', 'is', null)
            .not('matches.away_score', 'is', null)

        if (error) throw error

        // Filter bets where bet.updated_at < match.updated_at
        const pendingBets = data?.filter(bet => {
            const betUpdated = new Date(bet.updated_at).getTime()
            const matchUpdated = new Date((bet.matches as any).updated_at).getTime()
            return betUpdated < matchUpdated
        }) || []

        return { success: true, count: pendingBets.length }
    } catch (error: any) {
        return { success: false, count: 0, message: error.message }
    }
}

export async function recalculateAllPendingBets() {
    try {
        const supabase = await createClient()

        // Get all finished matches with bets that need recalculation
        const { data: allBets, error: fetchError } = await supabase
            .from('bets')
            .select(`
                id,
                updated_at,
                match_id,
                matches!inner(id, status, home_score, away_score, updated_at)
            `)
            .in('matches.status', ['finished', 'FT', 'AET', 'PEN'])
            .not('matches.home_score', 'is', null)
            .not('matches.away_score', 'is', null)

        if (fetchError) throw fetchError

        // Filter bets where bet.updated_at < match.updated_at
        const pendingBets = allBets?.filter(bet => {
            const betUpdated = new Date(bet.updated_at).getTime()
            const matchUpdated = new Date((bet.matches as any).updated_at).getTime()
            return betUpdated < matchUpdated
        }) || []

        if (pendingBets.length === 0) {
            revalidatePath('/admin')
            return { success: true, message: 'Nenhuma aposta pendente encontrada.', count: 0 }
        }

        // Get unique match IDs from pending bets
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
            message: `${pendingBets.length} apostas pendentes processadas em ${matchIds.length} partidas!`,
            count: pendingBets.length
        }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
