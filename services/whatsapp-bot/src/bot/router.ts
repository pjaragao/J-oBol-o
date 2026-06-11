import { ParsedWebhookMessage } from '../evolution/webhook.js';
import { evolutionClient } from '../evolution/client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import {
  getGroupDetailsByJid,
  logChatbotAction,
} from '../supabase/queries.js';
import { generateAiReply } from '../ai/responder.js';

// Helper to check if NeyBot is mentioned in the message
function isBotMentioned(msg: ParsedWebhookMessage): boolean {
  // 1. Check if bot's JID is in mentionedJids
  if (config.botWhatsappJid && msg.mentionedJids?.includes(config.botWhatsappJid)) {
    return true;
  }
  
  const cleanText = msg.text.toLowerCase();
  
  // 2. Check if text contains "neybot" or "@neybot"
  if (cleanText.includes('neybot') || cleanText.includes('@neybot')) {
    return true;
  }
  
  // 3. Check if text contains the number part of the bot JID (if configured)
  if (config.botWhatsappJid) {
    const botNumber = config.botWhatsappJid.split('@')[0];
    if (cleanText.includes(botNumber)) {
      return true;
    }
  }
  
  return false;
}

// Helper to remove NeyBot mention from the message text
function removeBotMention(text: string): string {
  let clean = text;
  
  // Remove @neybot or neybot case-insensitively
  clean = clean.replace(/@?neybot/gi, '');
  
  // Remove JID number part of the bot if configured
  if (config.botWhatsappJid) {
    const botNumber = config.botWhatsappJid.split('@')[0];
    const regexNumber = new RegExp(`@?${botNumber}`, 'gi');
    clean = clean.replace(regexNumber, '');
  }
  
  return clean.trim();
}

// Main message handler
export async function handleIncomingMessage(msg: ParsedWebhookMessage): Promise<void> {
  const text = msg.text.trim();
  const jid = msg.jid;
  const isGroup = jid.endsWith('@g.us');

  // 1. Detect if it's a group or private DM
  let groupDetails = null;
  if (isGroup) {
    // Check if the bot is enabled for this group
    groupDetails = await getGroupDetailsByJid(jid);
    if (!groupDetails || !groupDetails.whatsapp_bot_enabled) {
      logger.debug('Bot ignored message: Group not configured or bot disabled', { jid });
      return;
    }

    // In groups, the bot MUST be mentioned to respond
    if (!isBotMentioned(msg)) {
      return;
    }
  }

  // 2. Extract clean message text (removing bot mentions)
  const cleanText = isGroup ? removeBotMention(text) : text;

  if (!cleanText) {
    // Message only contained the mention, greet the user
    const greeting = `⚽ Fala parceiro! Sou o *NeyBot*! Como posso te ajudar hoje? \n\nPergunte sobre as Copas do Mundo ou sobre a classificação do nosso Bolão! 🏆`;
    await evolutionClient.sendText(jid, greeting);
    return;
  }



  // 4. Delegate conversational requests to Hermes AI Agent
  logger.info('Processing conversational message via Hermes Agent', { 
    jid, 
    sender: msg.senderName, 
    originalText: text 
  });
  
  try {
    // Send presence typing to Evolution API
    await evolutionClient.sendPresence(jid, 'composing');

    const reply = await generateAiReply(cleanText, {
      senderName: msg.senderName,
      senderJid: msg.senderJid,
      groupName: groupDetails?.name || undefined,
      groupJid: isGroup ? jid : undefined,
    });

    await evolutionClient.sendText(jid, reply);
    await logChatbotAction(jid, msg.senderJid, null, 'ai');
  } catch (err: any) {
    logger.error('Error handling AI response in router', { error: err.message });
    await evolutionClient.sendText(
      jid,
      '🤖 *NeyBot*: Deu ruim aqui ao processar sua mensagem. Tenta de novo em um minutinho! ⚽'
    );
  }
}



