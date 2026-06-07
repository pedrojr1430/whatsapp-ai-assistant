import OpenAI from 'openai';
import { config } from '../config';
import { db } from '../db';

const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

export const ai = {
    async generateResponse(userId: string, groupId: string | null, text: string): Promise<string> {
        try {
            // 1. Busca o prompt de sistema do DB
            const systemPrompt = await db.getSystemPrompt();

            // 2. Busca histórico recente da conversa (últimas 10 mensagens)
            const history = await db.getHistory(userId, groupId, 10);

            // 3. Monta o array de mensagens para a OpenAI
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                { role: 'system', content: systemPrompt }
            ];

            // Adiciona o histórico
            for (const msg of history) {
                // A role no banco está como 'user' ou 'assistant'
                messages.push({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.text
                });
            }

            // Adiciona a mensagem atual do usuário
            messages.push({ role: 'user', content: text });

            // 4. Chama a API da OpenAI
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo', // Pode ser substituído por gpt-4 ou gpt-4o
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
            });

            const reply = completion.choices[0]?.message?.content || "Desculpe, não consegui processar a resposta agora.";

            return reply.trim();
        } catch (error) {
            console.error("Erro na OpenAI:", error);
            return "Desculpe, encontrei um erro de conexão com meu cérebro (OpenAI API).";
        }
    }
};
