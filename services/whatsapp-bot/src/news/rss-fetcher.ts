import Parser from 'rss-parser';
import { saveNewsArticles } from '../supabase/queries.js';
import { logger } from '../utils/logger.js';

const parser = new Parser({
  customFields: {
    item: ['summary', 'description'],
  }
});

const RSS_FEEDS = [
  {
    name: 'GE - Copa do Mundo',
    url: 'https://ge.globo.com/rss/futebol/copa-do-mundo/',
  },
  {
    name: 'ESPN - Futebol',
    url: 'https://www.espn.com.br/rss/futebol',
  },
  {
    name: 'Google News - Copa',
    url: 'https://news.google.com/rss/search?q=copa+do+mundo+futebol&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  }
];

export async function fetchAndArchiveNews(): Promise<void> {
  logger.info('Starting RSS news feeds fetch...');
  const articlesToSave: any[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      logger.debug(`Fetching feed: ${feed.name}`, { url: feed.url });
      const parsedFeed = await parser.parseURL(feed.url);
      
      parsedFeed.items.forEach(item => {
        if (!item.title || !item.link) return;

        // Clean up title (remove publication suffix from Google News for example)
        let title = item.title;
        if (feed.name === 'Google News - Copa' && title.includes(' - ')) {
          title = title.split(' - ').slice(0, -1).join(' - ');
        }

        // Clean up summary (strip HTML tags)
        let summary = item.contentSnippet || item.summary || item.content || '';
        summary = summary.replace(/<[^>]*>/g, '').trim();
        if (summary.length > 150) {
          summary = summary.substring(0, 147) + '...';
        }

        articlesToSave.push({
          source: feed.name,
          title: title.substring(0, 200),
          summary: summary || null,
          url: item.link,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          tags: ['copa', 'futebol'],
        });
      });

      logger.debug(`Successfully parsed feed ${feed.name}`, { count: parsedFeed.items.length });
    } catch (error: any) {
      logger.error(`Failed to fetch/parse RSS feed: ${feed.name}`, { error: error.message });
    }
  }

  if (articlesToSave.length > 0) {
    logger.info(`Archiving collected news items...`, { count: articlesToSave.length });
    await saveNewsArticles(articlesToSave);
  } else {
    logger.warn('No news articles collected in this run.');
  }
}

// Schedule news fetch job every 5 minutes
export function startNewsScheduler() {
  // Run once immediately on startup
  fetchAndArchiveNews().catch(err => logger.error('Initial news fetch failed', { error: err.message }));

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  setInterval(() => {
    logger.info('Running scheduled news fetch job...');
    fetchAndArchiveNews().catch(err => logger.error('Scheduled news fetch failed', { error: err.message }));
  }, FIVE_MINUTES_MS);
}
export type { Parser };
