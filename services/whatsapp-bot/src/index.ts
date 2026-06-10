import express from 'express';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { validateWebhook, parseWebhookPayload } from './evolution/webhook.js';
import { handleIncomingMessage } from './bot/router.js';
import { startRealtimeListener } from './supabase/realtime.js';
import { startNewsScheduler } from './news/rss-fetcher.js';

const app = express();

app.use(express.json());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instance: config.evolutionInstance,
  });
});

// Evolution API webhook endpoint
app.post('/webhook', async (req, res) => {
  // 1. Validate request authority
  if (!validateWebhook(req)) {
    return res.status(401).send('Unauthorized');
  }

  // 2. Parse payload
  const parsed = parseWebhookPayload(req.body);
  if (!parsed) {
    // Event is ignored (e.g. not messages.upsert)
    return res.status(200).send('Ignored');
  }

  // 3. Ignore self-messages (sent by the bot itself) to avoid infinite loops
  if (parsed.fromMe) {
    return res.status(200).send('From Me');
  }

  logger.debug('Webhook message parsed', {
    jid: parsed.jid,
    sender: parsed.senderName,
    text: parsed.text,
  });

  // 4. Process in background asynchronously
  // This prevents the webhook connection from timing out or hanging
  handleIncomingMessage(parsed).catch(err => {
    logger.error('Error handling message in background', {
      error: err.message,
      parsed,
    });
  });

  // 5. Acknowledge receipt to Evolution API immediately
  return res.status(200).send('OK');
});

// Start listening
app.listen(config.port, '0.0.0.0', () => {
  logger.info(`=== JãoBolão WhatsApp Chatbot Server ===`);
  logger.info(`Server listening on port ${config.port}`);
  logger.info(`Target Evolution instance: ${config.evolutionInstance}`);
  
  // Start the Supabase Realtime scoring listener
  try {
    startRealtimeListener();
  } catch (err: any) {
    logger.error('Failed to initialize Supabase Realtime subscription', { error: err.message });
  }

  // Start the RSS News fetcher cron scheduler
  try {
    startNewsScheduler();
  } catch (err: any) {
    logger.error('Failed to initialize RSS News scheduler', { error: err.message });
  }
});


