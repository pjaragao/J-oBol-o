// Edge Function: Sync Matches from Football-Data.org API
// Fetches matches for a competition and updates the database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FootballDataMatch {
    id: number;
    utcDate: string;
    status: string;
    matchday: number;
    stage: string;
    homeTeam: {
        id: number;
        name: string;
        shortName: string;
        crest: string;
    };
    awayTeam: {
        id: number;
        name: string;
        shortName: string;
        crest: string;
    };
    score: {
        fullTime: {
            home: number | null;
            away: number | null;
        };
    };
}

interface FootballDataResponse {
    matches: FootballDataMatch[];
}

// Map Football-Data.org status to our status
function mapStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
        'SCHEDULED': 'scheduled',
        'TIMED': 'scheduled',
        'IN_PLAY': 'live',
        'PAUSED': 'live',
        'FINISHED': 'finished',
        'POSTPONED': 'postponed',
        'CANCELLED': 'cancelled',
        'SUSPENDED': 'postponed',
    };
    return statusMap[apiStatus] || 'scheduled';
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { event_id, competition_code, sync_results_only } = await req.json();

        if (!event_id || !competition_code) {
            return new Response(
                JSON.stringify({ error: 'event_id and competition_code are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const apiKey = Deno.env.get('FOOTBALL_API_KEY');
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'FOOTBALL_API_KEY not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch matches from Football-Data.org
        const apiUrl = `https://api.football-data.org/v4/competitions/${competition_code}/matches`;
        const apiResponse = await fetch(apiUrl, {
            headers: {
                'X-Auth-Token': apiKey,
            },
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return new Response(
                JSON.stringify({ error: 'Failed to fetch from Football API', details: errorText }),
                { status: apiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const apiData: FootballDataResponse = await apiResponse.json();
        const matches = apiData.matches;

        if (!matches || matches.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No matches found for this competition' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        let teamsCreated = 0;
        let matchesCreated = 0;
        let matchesUpdated = 0;
        const errors: string[] = [];

        for (const match of matches) {
            try {
                // Ensure home team exists
                const { data: homeTeam } = await supabase
                    .from('teams')
                    .upsert({
                        api_id: match.homeTeam.id,
                        name: match.homeTeam.name,
                        short_name: match.homeTeam.shortName,
                        logo_url: match.homeTeam.crest,
                    }, {
                        onConflict: 'api_id',
                    })
                    .select('id')
                    .single();

                // Ensure away team exists
                const { data: awayTeam } = await supabase
                    .from('teams')
                    .upsert({
                        api_id: match.awayTeam.id,
                        name: match.awayTeam.name,
                        short_name: match.awayTeam.shortName,
                        logo_url: match.awayTeam.crest,
                    }, {
                        onConflict: 'api_id',
                    })
                    .select('id')
                    .single();

                if (!homeTeam || !awayTeam) {
                    errors.push(`Failed to create teams for match ${match.id}`);
                    continue;
                }

                // Check if match already exists
                const { data: existingMatch } = await supabase
                    .from('matches')
                    .select('id')
                    .eq('api_id', match.id)
                    .single();

                const matchData = {
                    event_id: event_id,
                    home_team_id: homeTeam.id,
                    away_team_id: awayTeam.id,
                    match_date: match.utcDate,
                    home_score: match.score.fullTime.home,
                    away_score: match.score.fullTime.away,
                    status: mapStatus(match.status),
                    api_id: match.id,
                    round: match.stage === 'REGULAR_SEASON' ? `Rodada ${match.matchday}` : match.stage,
                };

                if (existingMatch) {
                    // Update existing match
                    if (sync_results_only) {
                        // Only update score and status
                        await supabase
                            .from('matches')
                            .update({
                                home_score: matchData.home_score,
                                away_score: matchData.away_score,
                                status: matchData.status,
                            })
                            .eq('id', existingMatch.id);
                    } else {
                        await supabase
                            .from('matches')
                            .update(matchData)
                            .eq('id', existingMatch.id);
                    }
                    matchesUpdated++;
                } else if (!sync_results_only) {
                    // Create new match
                    await supabase
                        .from('matches')
                        .insert(matchData);
                    matchesCreated++;
                }
            } catch (error) {
                errors.push(`Error processing match ${match.id}: ${error.message}`);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                event_id,
                total_api_matches: matches.length,
                matches_created: matchesCreated,
                matches_updated: matchesUpdated,
                errors: errors.length > 0 ? errors : undefined,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Sync matches error:', error);
        return new Response(
            JSON.stringify({ error: 'Sync failed', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
