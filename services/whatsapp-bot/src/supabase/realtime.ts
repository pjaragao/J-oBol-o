import { supabase } from './client.js';
import { logger } from '../utils/logger.js';
import { evolutionClient } from '../evolution/client.js';
import { rateLimiter } from '../utils/rate-limiter.js';

// Cache for team names to prevent DB spam
const teamCache = new Map<string, { name: string; flag: string }>();

// Cache flags/emojis mapping
const countryFlags: Record<string, string> = {
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Italy': '🇮🇹',
  'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Uruguay': '🇺🇾', 'Croatia': '🇭🇷', 'Senegal': '🇸🇳', 'Japan': '🇯🇵', 'Morocco': '🇲🇦',
  'United States': '🇺🇸', 'Canada': '🇨🇦', 'Mexico': '🇲🇽', 'Qatar': '🇶🇦', 'Ecuador': '🇪🇨',
  'Switzerland': '🇨🇭', 'Cameroon': '🇨🇲', 'Serbia': '🇷🇸', 'Ghana': '🇬🇭', 'South Korea': '🇰🇷',
};

async function getTeamDetails(teamId: string): Promise<{ name: string; flag: string }> {
  if (teamCache.has(teamId)) {
    return teamCache.get(teamId)!;
  }

  const { data, error } = await supabase
    .from('teams')
    .select('name, country')
    .eq('id', teamId)
    .single();

  if (error || !data) {
    return { name: 'Time', flag: '⚽' };
  }

  const name = data.name;
  const flag = countryFlags[name] || countryFlags[data.country || ''] || '⚽';
  const details = { name, flag };
  teamCache.set(teamId, details);
  return details;
}

export function startRealtimeListener() {
  logger.info('Initializing Supabase Realtime Listener for Match events...');

  supabase
    .channel('matches-realtime-scores')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
      },
      async (payload) => {
        try {
          const oldMatch = payload.old as any;
          const newMatch = payload.new as any;

          if (!oldMatch || !newMatch) return;

          // 1. Fetch team names
          const home = await getTeamDetails(newMatch.home_team_id);
          const away = await getTeamDetails(newMatch.away_team_id);

          // 2. Detect match updates
          let message = '';
          
          const statusChanged = oldMatch.status !== newMatch.status;
          const scoreChanged = (oldMatch.home_score !== newMatch.home_score) || (oldMatch.away_score !== newMatch.away_score);

          // Início de partida
          if (statusChanged && newMatch.status === 'live' && oldMatch.status === 'scheduled') {
            message = `🏟️ *COMEÇOU O JOGO!* 🟢\n\n` +
                      `${home.flag} *${home.name}*  vs  *${away.name}* ${away.flag}\n` +
                      `🏆 ${newMatch.round || 'Copa do Mundo'}\n` +
                      `━━━━━━━━━━━━━━━\n` +
                      `Que vença o melhor! Dê seu palpite no JãoBolão.`;
          }
          // Intervalo
          else if (statusChanged && newMatch.status === 'live' && newMatch.score_detailed?.stage === 'HALF_TIME') {
            message = `⏸️ *INTERVALO* ☕\n\n` +
                      `${home.flag} *${home.name}* ${newMatch.home_score} x ${newMatch.away_score} *${away.name}* ${away.flag}\n` +
                      `━━━━━━━━━━━━━━━\n` +
                      `Como está o seu palpite? Digite !meus para conferir!`;
          }
          // Fim de partida
          else if (statusChanged && newMatch.status === 'finished') {
            message = `🏁 *FIM DE JOGO!* 🔴\n\n` +
                      `${home.flag} *${home.name}* ${newMatch.home_score} x ${newMatch.away_score} *${away.name}* ${away.flag}\n` +
                      `━━━━━━━━━━━━━━━\n` +
                      `🏆 Jogo finalizado! Os pontos foram calculados.\n` +
                      `Digite *!ranking* para ver a classificação atualizada! 🥇`;
          }
          // GOL
          else if (scoreChanged && newMatch.status === 'live') {
            const isHomeGoal = (newMatch.home_score || 0) > (oldMatch.home_score || 0);
            const scoringTeam = isHomeGoal ? home : away;
            
            message = `⚽ *GOOOOL!* ${scoringTeam.flag}\n\n` +
                      `Gooool do *${scoringTeam.name}*!\n` +
                      `Placar atual: ${home.flag} *${home.name}* ${newMatch.home_score} x ${newMatch.away_score} *${away.name}* ${away.flag}\n` +
                      `━━━━━━━━━━━━━━━`;
          }

          if (!message) return;

          // Check if we are in silent hours (anti-spam during night games)
          if (rateLimiter.isSilentHour()) {
            logger.info('Match notification silenced due to night hours', { matchId: newMatch.id });
            return;
          }

          // 3. Find target active WhatsApp groups for this event
          const { data: groups, error: groupsErr } = await supabase
            .from('groups')
            .select('whatsapp_group_jid')
            .eq('event_id', newMatch.event_id)
            .eq('whatsapp_bot_enabled', true)
            .not('whatsapp_group_jid', 'is', null);

          if (groupsErr || !groups || groups.length === 0) {
            logger.debug('No active groups registered for this event match update', { eventId: newMatch.event_id });
            return;
          }

          // 4. Send notifications
          for (const group of groups) {
            if (group.whatsapp_group_jid) {
              logger.info('Sending real-time match update to group', { jid: group.whatsapp_group_jid, matchId: newMatch.id });
              await evolutionClient.sendText(group.whatsapp_group_jid, message);
            }
          }

        } catch (error: any) {
          logger.error('Error in realtime postgres_changes handler', { error: error.message });
        }
      }
    )
    .subscribe((status) => {
      logger.info('Supabase Realtime matches subscription status', { status });
    });
}
