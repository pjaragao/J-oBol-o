'use server'

import { updateMatches, sendReminders } from '@/lib/cron'
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

export async function manualSendReminders() {
    try {
        const result = await sendReminders()
        revalidatePath('/admin')
        return { success: true, message: 'Lembretes enviados com sucesso!', details: result }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
