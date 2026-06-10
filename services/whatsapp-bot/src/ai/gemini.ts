import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let genAI: GoogleGenerativeAI | null = null;

if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
}

export async function askGemini(prompt: string, systemInstruction?: string): Promise<string | null> {
  if (!genAI) {
    logger.warn('Gemini API key is not configured, skipping.');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
    });

    logger.debug('Sending prompt to Gemini API...', { promptLength: prompt.length });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    return text || null;
  } catch (error: any) {
    logger.error('Gemini API call failed', { error: error.message });
    return null;
  }
}
export type { GoogleGenerativeAI };
