import { Database, PaymentMethod } from '@/types/supabase-financial';

type EventFeeConfig = {
    online_fee_percent: number;
    offline_fee_per_slot: number;
    offline_base_fee: number;
};

type GroupFinancialConfig = {
    payment_method: PaymentMethod;
    entry_fee: number;
    max_members: number | null;
};

export class FinancialService {
    /**
     * Calculates the Prize Pot for a group.
     *
     * @param config Group's financial configuration
     * @param paidMembersCount Number of members who have paid (status='PAID')
     * @param eventFees Event fee configuration
     * @returns object containing gross pot, fee deducted, and net pot available for distribution
     */
    static calculatePrizePot(
        config: GroupFinancialConfig,
        paidMembersCount: number,
        eventFees: EventFeeConfig
    ) {
        const grossPot = paidMembersCount * config.entry_fee;

        if (config.payment_method === 'ONLINE') {
            // Fee is percentage of the gross pot
            const feeAmount = (grossPot * eventFees.online_fee_percent) / 100;
            const netPot = grossPot - feeAmount;

            return {
                grossPot,
                platformFee: feeAmount,
                netPot: Math.max(0, netPot), // Safety check
            };
        } else {
            // OFFLINE: Platform fee is paid separately by creator. Pot is fully distributed.
            return {
                grossPot,
                platformFee: 0,
                netPot: grossPot,
            };
        }
    }

    /**
     * Calculates the fee charged to the Creator for creating/hosting an OFFLINE group.
     *
     * @param maxMembers The specific maximum capacity requested
     * @param eventFees Event fee configuration
     * @returns Total fee amount to be charged to creator
     */
    static calculateOfflineCreatorFee(
        maxMembers: number,
        eventFees: EventFeeConfig
    ): number {
        if (!maxMembers) return 0;
        return eventFees.offline_base_fee + (maxMembers * eventFees.offline_fee_per_slot);
    }

    /**
     * Calculates the cost to UPGRADE an offline group's member limit.
     *
     * @param oldMax Current max members
     * @param newMax Desired max members
     * @param eventFees Event fee configuration
     * @returns Fee difference to be charged
     */
    static calculateUpgradeFee(
        oldMax: number,
        newMax: number,
        eventFees: EventFeeConfig
    ): number {
        if (newMax <= oldMax) return 0;

        // We only charge for the additional slots
        const additionalSlots = newMax - oldMax;
        return additionalSlots * eventFees.offline_fee_per_slot;
    }

    /**
     * Generates a Prize Distribution Table based on available Net Pot and Strategy.
     * 
     * @param netPot The total amount available to distribute
     * @param strategy The distribution strategy JSON
     * @returns Map of Rank -> Prize Amount
     */
    static calculateDistribution(
        netPot: number,
        strategy: any // Typed as any for now, but should ideally be stricter
    ): Record<number, number> {
        const distribution: Record<number, number> = {};

        if (!strategy || strategy.mode === 'WINNER_TAKES_ALL') {
            distribution[1] = netPot;
            return distribution;
        }

        if (strategy.mode === 'PERCENTAGE' && Array.isArray(strategy.tiers)) {
            let remaining = netPot;
            strategy.tiers.forEach((tier: { rank: number; value: number }) => {
                const prize = (netPot * tier.value) / 100;
                distribution[tier.rank] = prize;
                remaining -= prize;
            });
            // Handle rounding dust? Usually negligible, or give to winner.
        }

        return distribution;
    }
}
