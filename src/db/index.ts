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

    // ---- ESTATÍSTICAS PARA O PAINEL ----
    async getStats() {
        const totalMessages = await prisma.message.count();
        const totalUsers = await prisma.user.count();
        const totalGroups = await prisma.group.count();
        return { totalMessages, totalUsers, totalGroups };
    }
};
