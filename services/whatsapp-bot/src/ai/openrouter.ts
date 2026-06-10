import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function askOpenRouter(prompt: string, systemInstruction?: string): Promise<string | null> {
  if (!config.openrouterApiKey) {
    logger.warn('OpenRouter API key is not configured, skipping.');
    return null;
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3-8b-instruct:free',
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: prompt }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://jaobolao.com.br', // Optional, required by OpenRouter
          'X-Title': 'JãoBolão Bot'
        },
        timeout: 15000,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    return reply || null;
  } catch (error: any) {
    logger.error('OpenRouter API call failed', { error: error.response?.data || error.message });
    return null;
  }
}
