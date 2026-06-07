import { connectToWhatsApp } from './whatsapp';
import { startPanel } from './panel';
import { config } from './config';

async function bootstrap() {
    console.log('🚀 Inicializando Sistema AI WhatsApp...');
    
    if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'sk-sua-chave-aqui') {
        console.warn('⚠️ AVISO: Sua OPENAI_API_KEY não foi configurada corretamente no .env.');
        console.warn('O bot funcionará e salvará mensagens no banco, mas a IA não responderá.');
    }

    // Inicia o Painel Web (Express)
    startPanel();

    // Inicia a Conexão com o WhatsApp (Baileys)
    await connectToWhatsApp();
}

bootstrap().catch((err) => {
    console.error('❌ Erro crítico ao iniciar o sistema:', err);
    process.exit(1);
});
