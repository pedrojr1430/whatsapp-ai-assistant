import makeWASocket, { useMultiFileAuthState, DisconnectReason, WAMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import { ai } from '../ai';
import { db } from '../db';
import pino from 'pino';

// Variável global para armazenar a URI do QRCode gerado para o painel
export let currentQR: string | null = null;
export let isConnected: boolean = false;

export async function connectToWhatsApp() {
    // Permite que o diretório de auth seja configurado via variável de ambiente (útil para volumes no Railway)
    const authFolder = process.env.AUTH_FOLDER_PATH || path.join(__dirname, '..', '..', 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Mostra QR no terminal
        logger: pino({ level: 'silent' }) as any // Oculta logs poluentes do Baileys
    });

    // Evento de Conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQR = qr; // Atualiza a variável global do QR para o painel web
            isConnected = false;
        }

        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Motivo:', (lastDisconnect?.error as Boom)?.message);
            
            // Tenta reconectar se não foi deslogado propositalmente
            if (shouldReconnect) {
                console.log('Tentando reconectar em 5 segundos...');
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log('Deslogado do WhatsApp. Delete a pasta auth_info_baileys e reinicie para escanear novo QR Code.');
                // Se deslogou, apaga a pasta para permitir novo scan
                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
            }
        } else if (connection === 'open') {
            console.log('🚀 WhatsApp conectado com sucesso!');
            isConnected = true;
            currentQR = null;
        }
    });

    // Salva as credenciais sempre que houver alteração
    sock.ev.on('creds.update', saveCreds);

    // Evento de Recebimento de Mensagens
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return; // Ignora mensagens próprias ou sem texto

        // Desempacota a mensagem se for temporária ou view once
        let actualMessage = msg.message;
        if (actualMessage?.ephemeralMessage) {
            actualMessage = actualMessage.ephemeralMessage.message as typeof actualMessage;
        } else if (actualMessage?.viewOnceMessage) {
            actualMessage = actualMessage.viewOnceMessage.message as typeof actualMessage;
        } else if (actualMessage?.viewOnceMessageV2) {
            actualMessage = actualMessage.viewOnceMessageV2.message as typeof actualMessage;
        } else if (actualMessage?.documentWithCaptionMessage) {
            actualMessage = actualMessage.documentWithCaptionMessage.message as typeof actualMessage;
        }

        // Extrai o texto da mensagem considerando os vários tipos do WhatsApp
        const textMessage = actualMessage?.conversation || 
                            actualMessage?.extendedTextMessage?.text || 
                            actualMessage?.imageMessage?.caption || 
                            actualMessage?.videoMessage?.caption || '';

        if (!textMessage) return;

        const remoteJid = msg.key.remoteJid; // ID do chat (pode ser grupo ou usuário)
        if (!remoteJid) return;

        const isGroup = remoteJid.endsWith('@g.us');
        // Quem enviou de fato a mensagem (se for grupo, o participant tem o ID da pessoa)
        const senderId = isGroup ? msg.key.participant : remoteJid; 
        
        if (!senderId) return;

        // Registra o usuário e grupo no banco de dados para estatísticas
        await db.ensureUser(senderId, msg.pushName || 'Desconhecido');
        if (isGroup) {
            await db.ensureGroup(remoteJid, 'Grupo Desconhecido'); // Baileys precisa puxar metadados para saber o nome real
        }

        // --- VERIFICAÇÃO DE ATIVAÇÃO ---
        const isCommand = textMessage.toLowerCase().startsWith('/petrus') || textMessage.toLowerCase().startsWith('/shadow');
        
        // Verifica se a mensagem atual está respondendo a alguém (extrai de qualquer tipo de mensagem)
        const contextInfo = actualMessage?.extendedTextMessage?.contextInfo || 
                            actualMessage?.imageMessage?.contextInfo || 
                            actualMessage?.videoMessage?.contextInfo;
                            
        const botId = sock.user?.id;
        let isReplyingToMe = false;
        let isMentioningMe = false;
        
        if (botId) {
            const pureBotNumber = botId.split(':')[0].split('@')[0];
            
            // Verifica se está respondendo a uma mensagem enviada pelo bot
            if (contextInfo?.participant) {
                isReplyingToMe = contextInfo.participant.includes(pureBotNumber);
            }
            
            // Verifica se o bot foi marcado com @ (menção)
            if (contextInfo?.mentionedJid) {
                isMentioningMe = contextInfo.mentionedJid.some((jid: string) => jid.includes(pureBotNumber));
            }
        }

        // Se não atendeu nenhum critério de ativação, ignora
        if (!isCommand && !isReplyingToMe && !isMentioningMe) return;

        // Limpa o comando da mensagem para enviar para a IA
        let cleanText = textMessage;
        if (isCommand) {
            cleanText = textMessage.replace(/^\/(petrus|shadow)/i, '').trim();
        }

        if (cleanText.length === 0) {
            await sock.sendMessage(remoteJid, { text: "Olá! Como posso ajudar?" }, { quoted: msg });
            return;
        }

        // Salva a mensagem do usuário no histórico
        await db.saveMessage(senderId, isGroup ? remoteJid : null, 'user', cleanText);

        console.log(`[Nova Mensagem] Processando IA para: ${cleanText}`);

        // Mostra o status de 'digitando...'
        await sock.sendPresenceUpdate('composing', remoteJid);

        try {
            // Gera a resposta via OpenAI
            const reply = await ai.generateResponse(senderId, isGroup ? remoteJid : null, cleanText);

            // Salva a resposta da IA no histórico
            await db.saveMessage(senderId, isGroup ? remoteJid : null, 'assistant', reply);

            // Envia a resposta de volta no WhatsApp
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
        } catch (err) {
            console.error('Erro ao responder mensagem:', err);
        } finally {
            // Para o status de 'digitando...'
            await sock.sendPresenceUpdate('paused', remoteJid);
        }
    });

    return sock;
}
