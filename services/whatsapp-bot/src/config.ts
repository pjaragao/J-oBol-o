import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3500', 10),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  evolutionApiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
  evolutionApiKey: process.env.EVOLUTION_API_KEY || '',
  evolutionInstance: process.env.EVOLUTION_INSTANCE || 'jaobolao',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  hermesApiUrl: process.env.HERMES_API_URL || 'http://localhost:8644',
  hermesWebhookSecret: process.env.HERMES_WEBHOOK_SECRET || '',
  botWhatsappJid: process.env.BOT_WHATSAPP_JID || '', // Ex: 5511999999999@s.whatsapp.net
  rateLimitMaxPerHour: parseInt(process.env.RATE_LIMIT_MAX_PER_HOUR || '25', 10),
  silentHoursStart: parseInt(process.env.SILENT_HOURS_START || '23', 10),
  silentHoursEnd: parseInt(process.env.SILENT_HOURS_END || '7', 10),
  dataDir: path.resolve(__dirname, 'data'),
};

// Validate critical configurations
if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY is not configured.');
}
if (!config.evolutionApiKey) {
  console.warn('⚠️ Warning: EVOLUTION_API_KEY is not configured.');
}

