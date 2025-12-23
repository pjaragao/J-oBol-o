// Edge Function: Calculate Points
// Triggered after a match is finalized to calculate bet points

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ScoringRules {
    exact: number;   // Exact score match
    winner: number;  // Correct winner/draw
    goals: number;   // Correct goal difference
}

interface Match {
    id: string;
    home_score: number;
    away_score: number;
    status: string;
}

interface Bet {
    id: string;
    user_id: string;
    home_score_bet: number;
    away_score_bet: number;
    groups: {
        scoring_rules: ScoringRules;
    };
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculatePoints(
    bet: Bet,
    match: Match,
    rules: ScoringRules
): number {
    const { home_score_bet, away_score_bet } = bet;
    const { home_score, away_score } = match;

    // Exact score match - highest points
    if (home_score_bet === home_score && away_score_bet === away_score) {
        return rules.exact;
    }

    // Determine actual and predicted outcomes
    const actualDiff = home_score - away_score;
    const predictedDiff = home_score_bet - away_score_bet;

    const actualWinner = actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : 'draw';
    const predictedWinner = predictedDiff > 0 ? 'home' : predictedDiff < 0 ? 'away' : 'draw';

    // Check if predicted correct winner/draw
    if (actualWinner === predictedWinner) {
        // Correct goal difference - medium-high points
        if (actualDiff === predictedDiff) {
            return rules.goals;
        }
        // Just correct winner - medium points
        return rules.winner;
    }

    // Wrong prediction - no points
    return 0;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { match_id } = await req.json();

        if (!match_id) {
            return new Response(
                JSON.stringify({ error: 'match_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Supabase client with service role
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Fetch the match
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, home_score, away_score, status')
            .eq('id', match_id)
            .single();

        if (matchError || !match) {
            return new Response(
                JSON.stringify({ error: 'Match not found', details: matchError }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (match.status !== 'finished') {
            return new Response(
                JSON.stringify({ error: 'Match is not finished yet' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (match.home_score === null || match.away_score === null) {
            return new Response(
                JSON.stringify({ error: 'Match score not set' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch all bets for this match with group scoring rules
        const { data: bets, error: betsError } = await supabase
            .from('bets')
            .select('id, user_id, home_score_bet, away_score_bet, groups!inner(scoring_rules)')
            .eq('match_id', match_id);

        if (betsError) {
            return new Response(
                JSON.stringify({ error: 'Failed to fetch bets', details: betsError }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!bets || bets.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No bets found for this match', updated: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Calculate and update points for each bet
        const updates: { id: string; points: number; user_id: string }[] = [];

        for (const bet of bets) {
            const rules = bet.groups.scoring_rules as ScoringRules;
            const points = calculatePoints(bet as Bet, match as Match, rules);
            updates.push({ id: bet.id, points, user_id: bet.user_id });
        }

        // Batch update all bets
        let successCount = 0;
        let errorCount = 0;

        for (const update of updates) {
            const { error: updateError } = await supabase
                .from('bets')
                .update({ points_earned: update.points })
                .eq('id', update.id);

            if (updateError) {
                console.error(`Failed to update bet ${update.id}:`, updateError);
                errorCount++;
            } else {
                successCount++;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                match_id,
                total_bets: bets.length,
                updated: successCount,
                errors: errorCount,
                points_summary: updates.map(u => ({ user_id: u.user_id, points: u.points }))
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
