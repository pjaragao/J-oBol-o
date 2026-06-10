import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class ContextLoader {
  private baseDir: string;

  constructor() {
    // __dirname points to services/whatsapp-bot/dist
    // The data directory will be under services/whatsapp-bot/src/data in dev (or copied to dist/data, or relative to src)
    // Let's resolve it to support both tsx (dev) and dist (production)
    const resolvedPath = path.resolve(config.dataDir);
    this.baseDir = resolvedPath;
    logger.debug('Resolved data directory path', { resolvedPath });
  }

  // Detect relevant files based on user query
  public getContext(query: string): string {
    try {
      const normalizedQuery = query.toLowerCase();
      const loadedFiles: string[] = [];
      const contextBlocks: string[] = [];

      // 1. Check for year-specific files (1930 - 2026)
      const yearRegex = /\b(19[3-9]\d|20[0-2]\d|2026)\b/g;
      let match;
      const years: string[] = [];
      while ((match = yearRegex.exec(normalizedQuery)) !== null) {
        years.push(match[1]);
      }

      // De-duplicate years
      const uniqueYears = Array.from(new Set(years));
      
      uniqueYears.forEach(year => {
        const filePath = path.join(this.baseDir, 'copas', `${year}.md`);
        if (fs.existsSync(filePath)) {
          contextBlocks.push(fs.readFileSync(filePath, 'utf-8'));
          loadedFiles.push(`copas/${year}.md`);
        }
      });

      // 2. Check for statistics/records files
      if (normalizedQuery.includes('artilheiro') || normalizedQuery.includes('gols') || normalizedQuery.includes('goleador')) {
        const filePath = path.join(this.baseDir, 'estatisticas', 'artilheiros.md');
        if (fs.existsSync(filePath)) {
          contextBlocks.push(fs.readFileSync(filePath, 'utf-8'));
          loadedFiles.push('estatisticas/artilheiros.md');
        }
      }

      if (normalizedQuery.includes('curiosidade') || normalizedQuery.includes('fatos') || normalizedQuery.includes('recorde') || normalizedQuery.includes('historia')) {
        const filePath = path.join(this.baseDir, 'estatisticas', 'fatos.md');
        if (fs.existsSync(filePath)) {
          contextBlocks.push(fs.readFileSync(filePath, 'utf-8'));
          loadedFiles.push('estatisticas/fatos.md');
        }
      }

      // 3. Fallback: If no files loaded, load a general info file or a couple of files
      if (contextBlocks.length === 0) {
        const generalPath = path.join(this.baseDir, 'estatisticas', 'geral.md');
        if (fs.existsSync(generalPath)) {
          contextBlocks.push(fs.readFileSync(generalPath, 'utf-8'));
          loadedFiles.push('estatisticas/geral.md');
        } else {
          // If general doesn't exist, check if we can read one or two cup files as general context
          const firstCupPath = path.join(this.baseDir, 'copas', '2022.md');
          if (fs.existsSync(firstCupPath)) {
            contextBlocks.push(fs.readFileSync(firstCupPath, 'utf-8'));
            loadedFiles.push('copas/2022.md');
          }
        }
      }

      logger.info('Loaded knowledge base files for query context', {
        query,
        files: loadedFiles,
      });

      return contextBlocks.join('\n\n---\n\n');
    } catch (error: any) {
      logger.error('Failed to load query context from files', { error: error.message });
      return '';
    }
  }
}

export const contextLoader = new ContextLoader();
