import { ParsedWebhookMessage } from '../evolution/webhook.js';
import { evolutionClient } from '../evolution/client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import {
  getGroupDetailsByJid,
  getGroupRanking,
  getMatchesToday,
  getUserBetsToday,
  getNewsArticles,
  linkUserWhatsapp,
  logChatbotAction,
  getLinkedUser,
} from '../supabase/queries.js';
import { generateAiReply } from '../ai/responder.js';

export async function handleIncomingMessage(msg: ParsedWebhookMessage): Promise<void> {
  const text = msg.text.trim();
  const jid = msg.jid;
  const isGroup = jid.endsWith('@g.us');

  // 1. If it's a group, check if the bot is enabled for this JID in Supabase
  let groupDetails = null;
  if (isGroup) {
    groupDetails = await getGroupDetailsByJid(jid);
    if (!groupDetails || !groupDetails.whatsapp_bot_enabled) {
      logger.debug('Bot ignored message: Group not configured or bot disabled', { jid });
      return;
    }
  }

  // 2. Identify prefix
  const prefix = config.botPrefix;
  const isCommand = text.startsWith(prefix);

  if (isCommand) {
    const parts = text.substring(prefix.length).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.info('Processing bot command', { command, jid, sender: msg.senderName });

    switch (command) {
      case 'ajuda':
      case 'help':
        await handleHelp(jid, msg.senderName);
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'text');
        break;

      case 'ranking':
      case 'classificacao':
        if (isGroup && groupDetails) {
          await handleRanking(jid, groupDetails.id, groupDetails.event_id);
        } else {
          await evolutionClient.sendText(jid, '❌ O comando *!ranking* só funciona dentro dos grupos do bolão.');
        }
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'text');
        break;

      case 'jogos':
      case 'placar':
      case 'hoje':
        if (isGroup && groupDetails) {
          await handleMatchesToday(jid, groupDetails.event_id);
        } else {
          // If in DM, we don't have event_id unless linked. Let's tell them.
          await evolutionClient.sendText(jid, '❌ O comando *!jogos* funciona nos grupos ativos do bolão.');
        }
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'text');
        break;

      case 'meus':
      case 'meusstats':
        if (isGroup && groupDetails) {
          await handleMyStats(jid, msg.senderJid, groupDetails.id, groupDetails.event_id, msg.senderName);
        } else {
          await evolutionClient.sendText(jid, '❌ O comando *!meus* só funciona dentro do grupo do bolão.');
        }
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'text');
        break;

      case 'vincular':
        if (args.length === 0) {
          await evolutionClient.sendText(jid, '❌ Uso incorreto. Digite: *!vincular CHAVE_DE_CONVITE* (pegue sua chave no dashboard do site).');
        } else {
          await handleVincular(jid, msg.senderJid, args[0], msg.senderName);
        }
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'text');
        break;

      case 'noticias':
        await handleNews(jid);
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'text');
        break;

      case 'copa':
      case 'jao':
      case 'pergunta':
        if (args.length === 0) {
          await evolutionClient.sendText(jid, '👋 Digite sua pergunta após o comando! Exemplo: *!copa quem foi campeão em 2002?*');
        } else {
          const query = args.join(' ');
          await handleAiQuery(jid, query);
        }
        await logChatbotAction(jid, msg.senderJid, `!${command}`, 'ai');
        break;

      default:
        // Unknown command
        if (!isGroup) {
          await evolutionClient.sendText(jid, `❓ Comando desconhecido. Digite *!ajuda* para ver a lista de comandos disponíveis.`);
        }
        break;
    }
  } else {
    // 3. Handle non-command messages
    // In groups: we ignore to prevent spam and save tokens.
    // In private chats (DM): we treat it as a conversation with AI Jão.
    if (!isGroup) {
      logger.info('Processing direct message conversation with AI', { jid, text });
      await handleAiQuery(jid, text);
      await logChatbotAction(jid, msg.senderJid, null, 'ai');
    }
  }
}

// Handler: Help command
async function handleHelp(jid: string, senderName: string): Promise<void> {
  const helpText = `👋 *Olá, ${senderName}! Eu sou o Jão, bot do JãoBolão.* ⚽🏆\n\n` +
    `Aqui estão os comandos que você pode usar no grupo:\n\n` +
    `📌 *Comandos de Status e Jogos:*\n` +
    `• *!ranking* — Veja a classificação geral do bolão com pontuações.\n` +
    `• *!jogos* — Lista os jogos de hoje com placares e andamento.\n` +
    `• *!meus* — Veja seus palpites de hoje e estatísticas pessoais (necessário vincular).\n\n` +
    `📌 *IA e Histórias das Copas:*\n` +
    `• *!copa <pergunta>* — Pergunte-me qualquer curiosidade histórica ou estatística das Copas!\n` +
    `  _Exemplo: !copa quem fez o gol mais rápido das copas?_\n` +
    `• *!noticias* — Confira as últimas notícias do mundo do futebol.\n\n` +
    `📌 *Integração:*\n` +
    `• *!vincular <token>* — Vincula seu número de WhatsApp à sua conta no site.\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Boa sorte nos palpites! 🍀`;
  await evolutionClient.sendText(jid, helpText);
}

// Handler: Ranking leaderboard
async function handleRanking(jid: string, groupId: string, eventId: string): Promise<void> {
  await evolutionClient.sendPresence(jid, 'composing');
  const leaderboard = await getGroupRanking(groupId, eventId);
  
  if (leaderboard.length === 0) {
    await evolutionClient.sendText(jid, '📭 Nenhuma pontuação registrada para este grupo ainda.');
    return;
  }

  // Pick top 10 to keep the message clean and readable on WhatsApp
  const top10 = leaderboard.slice(0, 10);

  let response = `🥇 *CLASSIFICAÇÃO GERAL DO BOLÃO* 🏆\n\n`;
  top10.forEach((user, index) => {
    let medal = '•';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';

    response += `${medal} *${user.rank}º* - ${user.displayName}: *${user.totalPoints} pts*\n` +
                `   _(Cravadas: ${user.exact} | Venc+Diff: ${user.winnerDiff} | Venc: ${user.winner})_\n`;
  });

  if (leaderboard.length > 10) {
    response += `\n...e outros ${leaderboard.length - 10} participantes.\n`;
  }

  response += `\n━━━━━━━━━━━━━━━\n` +
              `Confira a tabela completa em tempo real no site do JãoBolão! 📲`;

  await evolutionClient.sendText(jid, response);
}

// Handler: Matches Today
async function handleMatchesToday(jid: string, eventId: string): Promise<void> {
  const matches = await getMatchesToday(eventId);

  if (matches.length === 0) {
    await evolutionClient.sendText(jid, '📅 Nenhum jogo agendado para o dia de hoje.');
    return;
  }

  let response = `⚽ *JOGOS DE HOJE* 🏟️\n\n`;
  
  matches.forEach(m => {
    const matchTime = new Date(m.match_date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    let scoreStr = 'vs';
    let statusBadge = '🕒';

    if (m.status === 'live') {
      scoreStr = `${m.home_score} x ${m.away_score}`;
      statusBadge = '🟢 *AO VIVO*';
    } else if (m.status === 'finished') {
      scoreStr = `${m.home_score} x ${m.away_score}`;
      statusBadge = '🔴 *FINALIZADO*';
    } else {
      statusBadge = `🕒 às ${matchTime}`;
    }

    response += `${m.home_team.name} ${scoreStr} ${m.away_team.name}\n` +
                `👉 Status: ${statusBadge} | ${m.round || 'Rodada'}\n\n`;
  });

  response += `━━━━━━━━━━━━━━━\n` +
              `Não se esqueça de preencher seus palpites no site antes do início de cada jogo!`;

  await evolutionClient.sendText(jid, response);
}

// Handler: User personal statistics and bets
async function handleMyStats(
  jid: string,
  senderJid: string,
  groupId: string,
  eventId: string,
  senderName: string
): Promise<void> {
  const link = await getLinkedUser(senderJid, groupId);
  if (!link) {
    await evolutionClient.sendText(
      jid,
      `⚠️ *${senderName}*, seu número de WhatsApp ainda não está vinculado à sua conta do Bolão.\n\n` +
      `Para ver suas estatísticas:\n` +
      `1. Acesse o site do JãoBolão.\n` +
      `2. No menu do Grupo, clique em "Vincular WhatsApp".\n` +
      `3. Copie o token de 6 dígitos.\n` +
      `4. Digite aqui no grupo: *!vincular SEU_TOKEN*`
    );
    return;
  }

  const betsToday = await getUserBetsToday(senderJid, groupId, eventId);
  const ranking = await getGroupRanking(groupId, eventId, senderJid);
  const myRank = ranking.find(u => u.isMe);

  let response = `👤 *ESTATÍSTICAS DE ${link.profiles ? (link.profiles as any).display_name : senderName}* 📊\n\n`;

  if (myRank) {
    response += `🏆 *Posição:* ${myRank.rank}º lugar\n` +
                `⭐ *Total de Pontos:* ${myRank.totalPoints} pts\n` +
                `🎯 *Cravadas (10pts):* ${myRank.exact}\n` +
                `📊 *Venc + Diferença (7pts):* ${myRank.winnerDiff}\n` +
                `✓ *Apenas Vencedor (5pts):* ${myRank.winner}\n\n`;
  }

  response += `📅 *Seus palpites para os jogos de hoje:*\n`;
  if (!betsToday || betsToday.length === 0) {
    response += `_Nenhum jogo hoje._\n`;
  } else {
    betsToday.forEach(b => {
      const betStatus = b.hasBet ? `*${b.homeBet} x ${b.awayBet}*` : `_Sem palpite_ ⚠️`;
      const pointsEarned = b.points !== null ? `(Ganhou ${b.points} pts)` : '';
      response += `• ${b.homeTeam} vs ${b.awayTeam}: ${betStatus} ${pointsEarned}\n`;
    });
  }

  response += `\n━━━━━━━━━━━━━━━\n` +
              `Acesse o painel completo no site!`;

  await evolutionClient.sendText(jid, response);
}

// Handler: Account Linking
async function handleVincular(jid: string, senderJid: string, token: string, senderName: string): Promise<void> {
  await evolutionClient.sendPresence(jid, 'composing');
  const groupName = await linkUserWhatsapp(token, senderJid, senderName);

  if (groupName === 'ALREADY_VERIFIED') {
    await evolutionClient.sendText(jid, `✅ Seu número já está vinculado a uma conta para este grupo!`);
  } else if (groupName) {
    await evolutionClient.sendText(
      jid,
      `🎉 *Sucesso, ${senderName}!*\n\nSeu WhatsApp foi vinculado com sucesso ao grupo *${groupName}*.\n` +
      `Agora você já pode usar o comando *!meus* para ver seus palpites diários!`
    );
  } else {
    await evolutionClient.sendText(
      jid,
      `❌ *Token Inválido ou Expirado.*\n` +
      `Verifique a chave copiada no painel do grupo no site e tente novamente.`
    );
  }
}

// Handler: Latest News
async function handleNews(jid: string): Promise<void> {
  const articles = await getNewsArticles(5);

  if (articles.length === 0) {
    await evolutionClient.sendText(jid, '📰 Nenhuma notícia recente arquivada no momento. Acesse o site para mais atualizações!');
    return;
  }

  let response = `📰 *ÚLTIMAS NOTÍCIAS DA COPA* ⚽\n\n`;
  
  articles.forEach((art, index) => {
    response += `*${index + 1}. ${art.title}*\n` +
                `_${art.summary || 'Resumo não disponível'}_ \n` +
                `🔗 Leia em: ${art.url}\n\n`;
  });

  response += `━━━━━━━━━━━━━━━\n` +
              `Atualizado automaticamente via RSS.`;

  await evolutionClient.sendText(jid, response);
}

// Handler: AI Conversational Queries
async function handleAiQuery(jid: string, query: string): Promise<void> {
  // Simulate typing presence
  await evolutionClient.sendPresence(jid, 'composing');
  
  // Call AI responder
  const reply = await generateAiReply(query);
  
  // Send the reply
  await evolutionClient.sendText(jid, reply);
}
