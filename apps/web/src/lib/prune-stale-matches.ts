/**
 * After importing a season, drop matches of the same event that belong to an
 * older season (their api_id is not in the freshly imported set).
 * Matches that already have bets are kept, since bets cascade on delete.
 */
export async function pruneStaleMatches(
    supabase: any,
    eventId: string,
    currentApiIds: number[]
): Promise<number> {
    if (!currentApiIds.length) return 0
    const keep = new Set(currentApiIds)

    const { data: existing, error } = await supabase
        .from('matches')
        .select('id, api_id')
        .eq('event_id', eventId)
    if (error || !existing) return 0

    const stale = existing.filter((m: any) => !keep.has(m.api_id)).map((m: any) => m.id as string)
    if (!stale.length) return 0

    const { data: withBets } = await supabase.from('bets').select('match_id').in('match_id', stale)
    const protectedIds = new Set((withBets || []).map((b: any) => b.match_id))
    const toDelete = stale.filter((id: string) => !protectedIds.has(id))
    if (!toDelete.length) return 0

    const { error: delError } = await supabase.from('matches').delete().in('id', toDelete)
    if (delError) {
        console.error('[pruneStaleMatches] delete error:', delError)
        return 0
    }
    return toDelete.length
}
