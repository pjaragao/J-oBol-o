import { askGemini } from './gemini.js';
import { askOpenRouter } from './openrouter.js';
import { contextLoader } from './context-loader.js';
import { logger } from '../utils/logger.js';

const SYSTEM_INSTRUCTION = `
Você é o "Jão", o assistente virtual inteligente do "JãoBolão" (um bolão de futebol).
Seu objetivo é responder dúvidas dos participantes sobre a história das Copas do Mundo de Futebol, estatísticas de copas anteriores, curiosidades e funcionamento geral do bolão.

Instruções importantes:
1. Responda em Português Brasileiro de forma amigável, animada e direta.
2. Use formatação do WhatsApp: use asteriscos para *negrito*, underline para _itálico_, emojis relevantes para deixar a leitura dinâmica, e listas organizadas. Evite blocos gigantes de texto.
3. Você receberá um CONTEXTO contendo dados históricos extraídos de arquivos markdown oficiais das Copas do Mundo. Utilize esse contexto como fonte primária da verdade.
4. Se o contexto não contiver a resposta exata, você pode usar seu conhecimento geral sobre Copas, mas deixe claro que é uma resposta geral e não oficial do banco de dados do JãoBolão.
5. Nunca invente placares ou estatísticas fictícias se não souber. Diga apenas que não tem essa informação registrada no momento.
6. Mantenha as respostas curtas (máximo de 3 parágrafos ou uma lista concisa) para não poluir o grupo de WhatsApp.
`;

export async function generateAiReply(userMessage: string): Promise<string> {
  // 1. Load context from markdown files
  const context = contextLoader.getContext(userMessage);

  // 2. Assemble prompt with context
  const prompt = `
[CONTEXTO HISTÓRICO DO JÃOBOÃO]
${context || 'Nenhum arquivo de contexto correspondente foi encontrado.'}
[FIM DO CONTEXTO]

[MENSAGEM DO PARTICIPANTE]
"${userMessage}"

Jão, responda à pergunta do participante acima com base no contexto fornecido.
`;

  logger.info('Generating AI reply...', { userMessageLength: userMessage.length });

  // Layer 1: Gemini
  try {
    const geminiReply = await askGemini(prompt, SYSTEM_INSTRUCTION);
    if (geminiReply) {
      logger.info('AI reply generated via Gemini (Layer 1)');
      return geminiReply;
    }
  } catch (err: any) {
    logger.error('Gemini failed, trying fallback Layer 2', { error: err.message });
  }

  // Layer 2: OpenRouter (Llama 3)
  try {
    const openRouterReply = await askOpenRouter(prompt, SYSTEM_INSTRUCTION);
    if (openRouterReply) {
      logger.info('AI reply generated via OpenRouter (Layer 2)');
      return openRouterReply;
    }
  } catch (err: any) {
    logger.error('OpenRouter fallback failed', { error: err.message });
  }

  // Layer 3: Offline static responder
  logger.warn('All AI generation layers failed. Returning offline response.');
  return `🤖 *Olá! Aqui é o Jão.* \n\nEstou com dificuldades para me conectar aos meus servidores de IA no momento. 🔌\n\nPor favor, tente novamente em alguns instantes ou pergunte sobre a classificação do bolão usando o comando *!ranking*.`;
}
