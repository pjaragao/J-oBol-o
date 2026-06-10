import { logger } from './logger.js';
import { config } from '../config.js';

class RateLimiter {
  // Store timestamps of sent messages per JID
  private messageHistory = new Map<string, number[]>();

  // Check if we are in silent hours (default 23:00 to 07:00)
  public isSilentHour(): boolean {
    const currentHour = new Date().getHours();
    const start = config.silentHoursStart;
    const end = config.silentHoursEnd;

    if (start < end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Over midnight (e.g., 23 to 7)
      return currentHour >= start || currentHour < end;
    }
  }

  // Check and increment rate limit for a specific target JID
  // Returns true if message is allowed, false if limit exceeded
  public checkLimit(jid: string): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    let history = this.messageHistory.get(jid) || [];
    // Filter older than 1 hour
    history = history.filter(ts => ts > oneHourAgo);
    
    if (history.length >= config.rateLimitMaxPerHour) {
      logger.warn('Rate limit exceeded for JID', { jid, count: history.length });
      return false;
    }

    history.push(now);
    this.messageHistory.set(jid, history);
    return true;
  }

  // Generate a random delay between min and max milliseconds
  public getRandomDelay(min = 3000, max = 8000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

export const rateLimiter = new RateLimiter();
