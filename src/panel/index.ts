import express from 'express';
import * as path from 'path';
import QRCode from 'qrcode';
import { currentQR, isConnected } from '../whatsapp';
import { db } from '../db';
import { config } from '../config';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rota Principal: Dashboard
app.get('/', async (req, res) => {
    try {
        const systemPrompt = await db.getSystemPrompt();
        const stats = await db.getStats();
        
        let qrImage = null;
        if (currentQR && !isConnected) {
            qrImage = await QRCode.toDataURL(currentQR);
        }

        res.render('index', {
            isConnected,
            qrImage,
            systemPrompt,
            stats
        });
    } catch (error) {
        console.error("Erro no painel:", error);
        res.status(500).send("Erro interno do servidor.");
    }
});

// Rota para Atualizar Prompt
app.post('/update-prompt', async (req, res) => {
    try {
        const { newPrompt } = req.body;
        if (newPrompt && typeof newPrompt === 'string') {
            await db.updateSystemPrompt(newPrompt.trim());
        }
        res.redirect('/');
    } catch (error) {
        console.error("Erro ao atualizar prompt:", error);
        res.redirect('/?error=1');
    }
});

export function startPanel() {
    app.listen(config.PORT, () => {
        console.log(`🌐 Painel Administrativo rodando em http://localhost:${config.PORT}`);
    });
}
