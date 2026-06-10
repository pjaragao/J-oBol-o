import { Request, Response } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface ParsedWebhookMessage {
  event: string;
  instance: string;
  jid: string;         // Group JID or User JID
  senderJid: string;   // Individual JID of the person typing
  senderName: string;  // Name of the sender
  text: string;        // Text message content
  fromMe: boolean;     // Whether message was sent by the bot itself
  messageId: string;
  mentionedJids?: string[]; // JIDs of users mentioned in the message
}

// Validate webhook signature
export function validateWebhook(req: Request): boolean {
  if (!config.webhookSecret) {
    // If not configured, skip check (development mode)
    return true;
  }

  const signature = req.headers['x-evolution-signature'] || req.headers['apikey'] || req.query.apikey;
  
  if (signature !== config.webhookSecret) {
    logger.warn('Unauthorized webhook request received', {
      ip: req.ip,
      headers: req.headers,
    });
    return false;
  }

  return true;
}

// Parse incoming Evolution API webhook payload
export function parseWebhookPayload(body: any): ParsedWebhookMessage | null {
  try {
    const event = body.event;
    const instance = body.instance;
    
    if (event !== 'messages.upsert') {
      // We only care about new messages
      return null;
    }

    const data = body.data;
    if (!data || !data.key) return null;

    const fromMe = data.key.fromMe || false;
    const jid = data.key.remoteJid || '';
    const messageId = data.key.id || '';
    
    // In a group, sender is participant. In private chat, remoteJid is the sender.
    const senderJid = data.key.participant || jid;
    const senderName = data.pushName || 'Participante';

    // Extract text content from different message shapes
    let text = '';
    let mentionedJids: string[] = [];
    const message = data.message;
    
    if (message) {
      if (message.conversation) {
        text = message.conversation;
      } else if (message.extendedTextMessage) {
        text = message.extendedTextMessage.text || '';
        if (message.extendedTextMessage.contextInfo?.mentionedJid) {
          mentionedJids = message.extendedTextMessage.contextInfo.mentionedJid;
        }
      } else if (message.imageMessage && message.imageMessage.caption) {
        text = message.imageMessage.caption;
      } else if (message.videoMessage && message.videoMessage.caption) {
        text = message.videoMessage.caption;
      }
    }

    return {
      event,
      instance,
      jid,
      senderJid,
      senderName,
      text: text.trim(),
      fromMe,
      messageId,
      mentionedJids,
    };
  } catch (error: any) {
    logger.error('Error parsing webhook payload', { error: error.message, body });
    return null;
  }
}
export type { Request };
