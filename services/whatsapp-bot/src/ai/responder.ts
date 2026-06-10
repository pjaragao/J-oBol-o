import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface AiRequestContext {
  senderName?: string;
  senderJid?: string;
  groupName?: string;
  groupJid?: string;
}

export async function generateAiReply(userMessage: string, context?: AiRequestContext): Promise<string> {
  if (!config.hermesApiUrl) {
    logger.warn('Hermes API URL is not configured.');
    return '🤖 JãoBolão: O chatbot do Hermes não está configurado.';
  }

  logger.info('Forwarding WhatsApp message to Hermes Agent...', { 
    userMessageLength: userMessage.length,
    sender: context?.senderName,
    group: context?.groupName 
  });

  try {
    const payload = {
      message: userMessage,
      metadata: {
        senderName: context?.senderName || 'Participante',
        senderJid: context?.senderJid || '',
        groupName: context?.groupName || '',
        groupJid: context?.groupJid || '',
        timestamp: new Date().toISOString()
      }
    };

    const response = await axios.post(
      `${config.hermesApiUrl}/routes/whatsapp-inbound`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.hermesWebhookSecret}`
        },
        timeout: 45000 // Hermes running locally might take some time to process
      }
    );

    const reply = response.data?.reply || response.data?.response;
    if (reply) {
      logger.info('Reply received from Hermes Agent');
      return reply;
    }

    logger.warn('Hermes Agent returned an empty response', { responseData: response.data });
    return '🤖 Opa! O NeyBot tentou responder, mas a resposta veio vazia. Tente novamente!';
  } catch (error: any) {
    logger.error('Failed to communicate with Hermes Agent gateway', { 
      error: error.response?.data || error.message 
    });
    return '🤖 *NeyBot*: Estou enfrentando dificuldades para me comunicar com o meu cérebro Hermes no homelab. 🔌\n\nPor favor, tente novamente em alguns instantes.';
  }
}

