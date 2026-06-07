import dotenv from 'dotenv';
dotenv.config();

export const config = {
    PORT: process.env.PORT || 3000,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
    DEFAULT_SYSTEM_PROMPT: "Você é o Petrus, um assistente de IA extremamente capaz, direto e educado, rodando dentro do WhatsApp.",
};
