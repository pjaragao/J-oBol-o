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
  // 1. Fetch group members
  const { data: members, error: membersErr } = await supabase
    .from('group_members')
    .select(`
      user_id,
      profiles(display_name, nickname)
    `)
    .eq('group_id', groupId);

  if (membersErr || !members) {
    logger.error('Error fetching group members for ranking', { error: membersErr?.message });
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

  // 3. Fetch live matches to add temporary live points
  const now = new Date().toISOString();
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: liveMatches } = await supabase
    .from('matches')
    .select('id, home_score, away_score')
    .eq('event_id', eventId)
    .not('status', 'in', '("finished", "FT", "AET", "PEN")')
    .lt('match_date', now)
    .gt('match_date', threeHoursAgo);

  const liveMatchesMap = new Map(liveMatches?.map(m => [m.id, m]) || []);

  // 4. Fetch all bets of the group
  const { data: bets } = await supabase
    .from('bets')
    .select('user_id, match_id, points, home_score_bet, away_score_bet')
    .eq('group_id', groupId);

  const statsMap = new Map<string, { exact: number; winnerDiff: number; winner: number; consolation: number }>();
  const pointsMapLiveTotal = new Map<string, number>();
  const livePointsOnlyMap = new Map<string, number>();

  bets?.forEach(bet => {
    const userId = bet.user_id;
    const basePoints = bet.points || 0;

    pointsMapLiveTotal.set(userId, (pointsMapLiveTotal.get(userId) || 0) + basePoints);

    // If match is live (points column not calculated yet)
    if (bet.points === null && liveMatchesMap.has(bet.match_id)) {
      const match = liveMatchesMap.get(bet.match_id)!;
      const lp = calculateLivePoints(
        bet.home_score_bet,
        bet.away_score_bet,
        match.home_score ?? 0,
        match.away_score ?? 0
      );
      if (lp > 0) {
        pointsMapLiveTotal.set(userId, (pointsMapLiveTotal.get(userId) || 0) + lp);
        livePointsOnlyMap.set(userId, (livePointsOnlyMap.get(userId) || 0) + lp);
      }
    }

    // Finished stats
    if (bet.points !== null) {
      if (!statsMap.has(userId)) {
        statsMap.set(userId, { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 });
      }
      const stats = statsMap.get(userId)!;
      if (basePoints === 10) stats.exact++;
      else if (basePoints === 7) stats.winnerDiff++;
      else if (basePoints === 5) stats.winner++;
      else if (basePoints === 2) stats.consolation++;
    }
  });

  // Assemble ranking
  const leaderboard: LeaderboardUser[] = members.map(m => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const userId = m.user_id;
    const total = pointsMapLiveTotal.get(userId) || 0;
    const live = livePointsOnlyMap.get(userId) || 0;
    const stats = statsMap.get(userId) || { exact: 0, winnerDiff: 0, winner: 0, consolation: 0 };

    return {
      rank: 0,
      displayName: profile?.display_name || profile?.nickname || 'Participante',
      totalPoints: total,
      livePoints: live,
      exact: stats.exact,
      winnerDiff: stats.winnerDiff,
      winner: stats.winner,
      consolation: stats.consolation,
      isMe: userId === currentUserId,
    };
  });

  // Sort descending
  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  // Add rank numbers
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });

  return leaderboard;
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
