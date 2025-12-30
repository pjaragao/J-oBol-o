/**
 * Calculates points for a bet based on the real match result.
 * 
 * 10 pts - Exact score
 * 7 pts  - Winner and goal difference
 * 5 pts  - Winner
 * 2 pts  - Consolation (one score correct)
 */
export const calculateLivePoints = (betHome: number, betAway: number, realHome: number, realAway: number): number => {
    // 10 pts - Exact score
    if (betHome === realHome && betAway === realAway) return 10

    const betWinner = betHome > betAway ? 1 : betHome < betAway ? -1 : 0
    const realWinner = realHome > realAway ? 1 : realHome < realAway ? -1 : 0

    // Winner detected
    if (betWinner === realWinner) {
        const betDiff = betHome - betAway
        const realDiff = realHome - realAway

        // 7 pts - Winner and goal difference
        if (betDiff === realDiff) return 7

        // 5 pts - Winner
        return 5
    }

    // 2 pts - Consolation (one of the scores is correct)
    if (betHome === realHome || betAway === realAway) return 2

    return 0
}
