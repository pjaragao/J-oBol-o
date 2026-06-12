import { supabase } from './client.js';
import { logger } from '../utils/logger.js';

export interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  event_id: string;
  whatsapp_group_jid: string | null;
  whatsapp_bot_enabled: boolean;
  whatsapp_invite_link: string | null;
}

export interface MatchDetails {
  id: string;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  round: string | null;
  home_team: { name: string; logo_url: string | null };
  away_team: { name: string; logo_url: string | null };
}

// Fetch group details by WhatsApp group JID
export async function getGroupDetailsByJid(jid: string): Promise<GroupDetails | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, description, event_id, whatsapp_group_jid, whatsapp_bot_enabled, whatsapp_invite_link')
    .eq('whatsapp_group_jid', jid)
    .single();

  if (error) {
    logger.debug('No active group configuration found for JID', { jid, error: error.message });
    return null;
  }

  return data;
}

// Retrieve linked user profiles for a WhatsApp JID in a specific group
export async function getLinkedUser(whatsappJid: string, groupId: string) {
  const { data, error } = await supabase
    .from('whatsapp_links')
    .select('user_id, verified, profiles(display_name, nickname)')
    .eq('whatsapp_jid', whatsappJid)
    .eq('group_id', groupId)
    .eq('verified', true)
    .maybeSingle();

  if (error) {
    logger.error('Error fetching linked user', { error: error.message, whatsappJid, groupId });
    return null;
  }

  return data;
}

// Link a user using their unique token
export async function linkUserWhatsapp(token: string, whatsappJid: string, whatsappName: string): Promise<string | null> {
  // 1. Find token
  const { data: linkRecord, error: findError } = await supabase
    .from('whatsapp_links')
    .select('id, user_id, group_id, verified')
    .eq('link_token', token.trim())
    .maybeSingle();

  if (findError || !linkRecord) {
    logger.warn('Invalid link token presented', { token, whatsappJid });
    return null;
  }

  if (linkRecord.verified) {
    return 'ALREADY_VERIFIED';
  }

  // 2. Update and verify link
  const { error: updateError } = await supabase
    .from('whatsapp_links')
    .update({
      whatsapp_jid: whatsappJid,
      whatsapp_name: whatsappName,
      verified: true,
    })
    .eq('id', linkRecord.id);

  if (updateError) {
    logger.error('Failed to verify whatsapp link', { error: updateError.message, tokenId: linkRecord.id });
    return null;
  }

  // Fetch group name
  const { data: groupData } = await supabase
    .from('groups')
    .select('name')
    .eq('id', linkRecord.group_id)
    .single();

  return groupData?.name || 'Bolão';
}

// Fetch matches for today (active or scheduled)
export async function getMatchesToday(eventId: string): Promise<MatchDetails[]> {
  const today = new Date().toISOString().split('T')[0];
  const startOfDay = `${today}T00:00:00Z`;
  const endOfDay = `${today}T23:59:59Z`;

  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      match_date,
      status,
      home_score,
      away_score,
      round,
      home_team:teams!matches_home_team_id_fkey(name, logo_url),
      away_team:teams!matches_away_team_id_fkey(name, logo_url)
    `)
    .eq('event_id', eventId)
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay)
    .order('match_date', { ascending: true });

  if (error) {
    logger.error('Failed to fetch today\'s matches', { error: error.message });
    return [];
  }

  return (data || []) as unknown as MatchDetails[];
}

// Helper to calculate live points (fallback in JS)
function calculateLivePoints(betHome: number, betAway: number, matchHome: number, matchAway: number): number {
  const betWinner = betHome > betAway ? 1 : betHome < betAway ? -1 : 0;
  const matchWinner = matchHome > matchAway ? 1 : matchHome < matchAway ? -1 : 0;

  if (betHome === matchHome && betAway === matchAway) {
    return 10; // Exact match
  }

  if (betWinner === matchWinner) {
    const betDiff = betHome - betAway;
    const matchDiff = matchHome - matchAway;
    if (betDiff === matchDiff) {
      return 7; // Winner + diff
    }
    return 5; // Winner only
  }

  if (betHome === matchHome || betAway === matchAway) {
    return 2; // Consolation (correct score for one side)
  }

  return 0;
}

export interface LeaderboardUser {
  rank: number;
  displayName: string;
  totalPoints: number;
  livePoints: number;
  exact: number;
  winnerDiff: number;
  winner: number;
  consolation: number;
  isMe?: boolean;
}

// Fetch and calculate full leaderboard for a group
export async function getGroupRanking(groupId: string, eventId: string, userJid?: string): Promise<LeaderboardUser[]> {
  // 1. Call the Supabase RPC
  const { data: rankingData, error: rankingErr } = await supabase
    .rpc('get_group_ranking', { p_group_id: groupId });

  if (rankingErr || !rankingData) {
    logger.error('Error fetching group ranking from RPC', { error: rankingErr?.message });
    return [];
  }

  // 2. Fetch linked whatsapp accounts to tag current user
  const { data: linkedJids } = await supabase
    .from('whatsapp_links')
    .select('user_id, whatsapp_jid')
    .eq('group_id', groupId)
    .eq('verified', true);

  const jidToUserMap = new Map<string, string>();
  linkedJids?.forEach(lk => jidToUserMap.set(lk.whatsapp_jid, lk.user_id));
  const currentUserId = userJid ? jidToUserMap.get(userJid) : undefined;

  // 3. Map results to LeaderboardUser format
  let prevPoints = -1;
  let currentRank = 1;
  return (rankingData as any[]).map((item, index) => {
    const totalPoints = item.total_points || 0;
    if (totalPoints !== prevPoints) {
      currentRank = index + 1;
      prevPoints = totalPoints;
    }
    return {
      rank: currentRank,
      displayName: item.display_name || 'Participante',
      totalPoints: totalPoints,
      livePoints: item.live_points || 0,
      exact: item.exact_scores || 0,
      winnerDiff: item.winner_diff_scores || 0,
      winner: item.winner_scores || 0,
      consolation: item.consolation_scores || 0,
      isMe: item.user_id === currentUserId,
    };
  });
}

// Fetch user bets for today's matches
export async function getUserBetsToday(whatsappJid: string, groupId: string, eventId: string) {
  // Get linked user
  const link = await getLinkedUser(whatsappJid, groupId);
  if (!link) return null;

  const today = new Date().toISOString().split('T')[0];
  const startOfDay = `${today}T00:00:00Z`;
  const endOfDay = `${today}T23:59:59Z`;

  // Fetch matches
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      match_date,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name)
    `)
    .eq('event_id', eventId)
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay);

  if (!matches || matches.length === 0) return [];

  const matchIds = matches.map(m => m.id);

  // Fetch bets
  const { data: bets } = await supabase
    .from('bets')
    .select('match_id, home_score_bet, away_score_bet, points')
    .eq('user_id', link.user_id)
    .eq('group_id', groupId)
    .in('match_id', matchIds);

  const betsMap = new Map(bets?.map(b => [b.match_id, b]) || []);

  return matches.map(m => {
    const bet = betsMap.get(m.id);
    return {
      homeTeam: (m.home_team as any)?.name || 'Home',
      awayTeam: (m.away_team as any)?.name || 'Away',
      matchDate: m.match_date,
      hasBet: !!bet,
      homeBet: bet?.home_score_bet ?? null,
      awayBet: bet?.away_score_bet ?? null,
      points: bet?.points ?? null,
    };
  });
}

// Fetch news articles from the archive
export async function getNewsArticles(limit = 5) {
  const { data, error } = await supabase
    .from('news_articles')
    .select('source, title, summary, url, published_at')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to query news articles', { error: error.message });
    return [];
  }

  return data || [];
}

// Save articles collected by the parser
export async function saveNewsArticles(articles: any[]) {
  if (articles.length === 0) return;

  const { error } = await supabase
    .from('news_articles')
    .upsert(articles, { onConflict: 'url' });

  if (error) {
    logger.error('Error saving news articles to database', { error: error.message });
  }
}

// Log chatbot activities
export async function logChatbotAction(groupJid: string, senderJid: string, command: string | null, responseType: string) {
  const { error } = await supabase
    .from('chatbot_logs')
    .insert({
      group_jid: groupJid,
      sender_jid: senderJid,
      command: command || 'chat_conversational',
      response_type: responseType,
    });

  if (error) {
    logger.error('Failed to log chatbot action', { error: error.message });
  }
}
