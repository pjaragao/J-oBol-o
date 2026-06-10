import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rate-limiter.js';

export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;
  private instance: string;

  constructor() {
    this.baseUrl = config.evolutionApiUrl;
    this.apiKey = config.evolutionApiKey;
    this.instance = config.evolutionInstance;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
    };
  }

  // Set typing presence
  public async sendPresence(jid: string, presence: 'composing' | 'paused' | 'recording' = 'composing'): Promise<void> {
    try {
      const url = `${this.baseUrl}/message/sendPresence/${this.instance}`;
      await axios.post(url, {
        number: jid,
        presence,
      }, {
        headers: this.getHeaders(),
        timeout: 5000,
      });
      logger.debug('Presence set', { jid, presence });
    } catch (error: any) {
      logger.error('Error sending presence to Evolution API', { error: error.message });
    }
  }

  // Send a text message
  public async sendText(jid: string, text: string): Promise<boolean> {
    // Check rate limiter
    if (!rateLimiter.checkLimit(jid)) {
      logger.warn('Rate limit hit, message skipped', { jid });
      return false;
    }

    try {
      // Simulate human typing
      await this.sendPresence(jid, 'composing');
      await rateLimiter.getRandomDelay(2000, 5000);
      
      const url = `${this.baseUrl}/message/sendText/${this.instance}`;
      const payload = {
        number: jid,
        text: text,
        options: {
          delay: 0,
          presence: 'composing',
          linkPreview: true,
        }
      };

      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      // Stop composing
      await this.sendPresence(jid, 'paused');

      logger.info('Message sent successfully', { jid, status: response.status });
      return true;
    } catch (error: any) {
      logger.error('Failed to send text message via Evolution API', {
        error: error.response?.data || error.message,
        jid
      });
      return false;
    }
  }

  // Fetch connection state
  public async getConnectionState(): Promise<string> {
    try {
      const url = `${this.baseUrl}/instance/connectionState/${this.instance}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 5000,
      });
      return response.data?.instance?.state || 'DISCONNECTED';
    } catch (error: any) {
      logger.error('Failed to fetch connection state', { error: error.message });
      return 'UNKNOWN';
    }
  }
}

export const evolutionClient = new EvolutionClient();
