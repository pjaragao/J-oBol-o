import { differenceInMinutes, isBefore, addMinutes } from 'date-fns';

export class BetSecurityService {
    private static LOCK_MINUTES = 5;

    /**
     * Checks if betting is currently LOCKED for a specific match.
     * Lock logic: 5 minutes BEFORE match start time.
     * 
     * @param matchDate The official start time of the match
     * @returns true if LOCKED (cannot bet/edit), false otherwise
     */
    static isBettingLocked(matchDate: Date | string): boolean {
        const start = new Date(matchDate);
        const now = new Date();

        // Check if we are within the lock window (e.g., < 5 mins to start or already started)
        // Actually, simply: Is NOW >= (Start - 5 min)?
        const lockTime = addMinutes(start, -this.LOCK_MINUTES);

        return !isBefore(now, lockTime);
    }

    /**
     * Determines if a specific bet should be VISIBLE to the current user.
     * 
     * @param matchDate Match start time
     * @param isOwnBet Is this the current user's own bet?
     * @returns true if visible, false if hidden (masked)
     */
    static isBetVisible(matchDate: Date | string, isOwnBet: boolean): boolean {
        // 1. Own bets are ALWAYS visible
        if (isOwnBet) return true;

        // 2. Opponent bets are ONLY visible AFTER match start
        const start = new Date(matchDate);
        const now = new Date();

        // If Now >= Start, match has started -> Visible
        if (!isBefore(now, start)) {
            return true;
        }

        // Otherwise (Match hasn't started) -> Hidden
        return false;
    }
}
