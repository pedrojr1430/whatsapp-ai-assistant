import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

export const db = {
    // ---- CONFIGURAÇÕES DO SISTEMA (PROMPT) ----
    async getSystemPrompt(): Promise<string> {
        let conf = await prisma.systemConfig.findUnique({ where: { key: 'SYSTEM_PROMPT' } });
        if (!conf) {
            conf = await prisma.systemConfig.create({
                data: { key: 'SYSTEM_PROMPT', value: config.DEFAULT_SYSTEM_PROMPT }
            });
        }
        return conf.value;
    },

    async updateSystemPrompt(newPrompt: string): Promise<void> {
        await prisma.systemConfig.upsert({
            where: { key: 'SYSTEM_PROMPT' },
            update: { value: newPrompt },
            create: { key: 'SYSTEM_PROMPT', value: newPrompt }
        });
    },

    // ---- USUÁRIOS E GRUPOS ----
    async ensureUser(userId: string, name?: string) {
        return prisma.user.upsert({
            where: { id: userId },
            update: { name: name || undefined },
            create: { id: userId, name: name }
        });
    },

    async ensureGroup(groupId: string, name?: string) {
        return prisma.group.upsert({
            where: { id: groupId },
            update: { name: name || undefined },
            create: { id: groupId, name: name }
        });
    },

    // ---- MENSAGENS (MEMÓRIA) ----
    async saveMessage(userId: string, groupId: string | null, role: 'user' | 'assistant', text: string) {
        await prisma.message.create({
            data: {
                userId,
                groupId,
                role,
                text
            }
        });
    },

    async getHistory(userId: string, groupId: string | null, limit: number = 10) {
        return prisma.message.findMany({
            where: {
                userId: groupId ? undefined : userId, // Se for no grupo, traz de todos no grupo, senão traz só do usuário
                groupId: groupId
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        }).then(msgs => msgs.reverse()); // Retorna na ordem cronológica (mais antigas primeiro)
    },

    // ---- KANBAN / CRM ----
    async getChatsList() {
        const users = await prisma.user.findMany({
            include: {
                messages: {
                    where: { groupId: null },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const groups = await prisma.group.findMany({
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const chats = [];
        for (const u of users) {
            if (u.messages.length > 0) {
                chats.push({
                    id: u.id,
                    name: u.name || u.id.split('@')[0],
                    isGroup: false,
                    lastMessage: u.messages[0],
                    updatedAt: u.messages[0].createdAt
                });
            }
        }
        for (const g of groups) {
            if (g.messages.length > 0) {
                chats.push({
                    id: g.id,
                    name: g.name || 'Grupo Desconhecido',
                    isGroup: true,
                    lastMessage: g.messages[0],
                    updatedAt: g.messages[0].createdAt
                });
            }
        }

        // Ordena pelos mais recentes
        chats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return chats;
    },

    async getChatMessagesAll(chatId: string, isGroup: boolean) {
        return prisma.message.findMany({
            where: isGroup ? { groupId: chatId } : { userId: chatId, groupId: null },
            orderBy: { createdAt: 'asc' }
        });
    },

    // ---- ESTATÍSTICAS PARA O PAINEL ----
    async getStats() {
        const totalMessages = await prisma.message.count();
        const totalUsers = await prisma.user.count();
        const totalGroups = await prisma.group.count();
        return { totalMessages, totalUsers, totalGroups };
    }
};
