# WhatsApp AI Assistant 🤖

Um assistente pessoal de IA integrado ao WhatsApp, construído com Node.js, Baileys, OpenAI e Prisma/SQLite.

## Funcionalidades
- Responde a comandos específicos (`/Petrus` e `/shadow`).
- Responde a menções diretas (reply) no WhatsApp.
- Mantém o contexto das conversas salvo no banco de dados SQLite.
- Permite alteração da personalidade da IA dinamicamente através de um Painel Web.
- Mostra o QRCode de conexão no Painel Web ou no Terminal.

## 🛠 Instalação Local

1. Clone ou baixe este repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Renomeie o `.env.example` para `.env` e configure sua chave da OpenAI.
   ```bash
   cp .env.example .env
   ```
4. Gere o banco de dados e o cliente Prisma:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. Inicie o sistema:
   ```bash
   npm start
   ```

## 📱 Como Conectar
Ao iniciar `npm start`, acesse `http://localhost:3000` ou olhe no seu terminal.
1. Abra o WhatsApp no celular.
2. Vá em **Aparelhos Conectados** > **Conectar um aparelho**.
3. Escaneie o QR Code que aparecerá no site ou no terminal.

## 🚀 Deploy em VPS (Ubuntu / Linux)

Para manter o bot online 24h em uma VPS, recomendamos o uso do `PM2`.

1. Acesse sua VPS via SSH.
2. Certifique-se de que o **Node.js** (v18+) esteja instalado.
3. Clone este projeto.
4. Execute `npm install`.
5. Instale o PM2 globalmente:
   ```bash
   npm install -g pm2
   ```
6. Crie o arquivo `.env` e rode a migração do banco (`npx prisma db push && npx prisma generate`).
7. Inicie o bot usando o PM2:
   ```bash
   pm2 start npm --name "whatsapp-ai" -- start
   ```
8. Para que o PM2 reinicie automaticamente caso a VPS reinicie, execute:
   ```bash
   pm2 startup
   pm2 save
   ```
9. Agora basta acessar `http://SUA_VPS_IP:3000` para escanear o QRCode!
