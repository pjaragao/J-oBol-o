# Instruções de Implantação do Bot de WhatsApp no Homelab

Este guia destina-se ao agente de IA (ou administrador) encarregado de implantar e configurar o microsserviço de chatbot do **JãoBolão** e a **Evolution API** no homelab local.

---

## 1. Arquitetura de Implantação
A arquitetura baseia-se em:
1. **Evolution API**: Instância autohospedada que gerencia a conexão com o WhatsApp via Puppeteer/Baileys.
2. **Redis & PostgreSQL**: Banco de dados e cache para a Evolution API.
3. **Chatbot Service**: Este microsserviço Node.js que escuta webhooks da Evolution API, responde comandos via IA (Gemini/OpenRouter) e consome banco de dados do Supabase.
4. **Tailscale Funnel**: Expõe com segurança a porta do Chatbot para a internet receber os webhooks enviados pela Evolution API (se a Evolution API estiver rodando fora da mesma rede local, ou para simplificar a comunicação HTTPS obrigatória para webhooks da Evolution API).

---

## 2. Configuração de Variáveis de Ambiente (.env)

Crie o arquivo `.env` na raiz da pasta `services/whatsapp-bot` com as seguintes definições:

```ini
# Configurações do Servidor
PORT=3500
NODE_ENV=production

# Supabase
SUPABASE_URL=https://sua-url-supabase.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key-jwt

# Evolution API
EVOLUTION_API_URL=http://localhost:8080 # Ou JID interno do container
EVOLUTION_API_TOKEN=seu-global-api-token-da-evolution
EVOLUTION_INSTANCE_NAME=jaobolao-bot
EVOLUTION_WEBHOOK_SECRET=segredo-webhook-opcional

# APIs de Inteligência Artificial
GEMINI_API_KEY=sua-chave-do-google-ai-studio
OPENROUTER_API_KEY=sua-chave-do-openrouter
```

---

## 3. Subir os Containers do Homelab

Utilize o arquivo `docker-compose.yml` fornecido na pasta `services/whatsapp-bot` para orquestrar e subir todos os serviços necessários:

```bash
# Para subir todo o ecossistema (Evolution API + Postgres/Redis + Chatbot)
docker-compose up -d --build
```

---

## 4. Configuração do Túnel Externo (Tailscale Funnel)

Como a Evolution API exige uma URL segura (HTTPS) para entrega estável de webhooks, utilize o **Tailscale Funnel** configurado no homelab do usuário para expor o servidor do Chatbot (porta `3500`):

1. Habilite o funnel para a porta do Chatbot:
   ```bash
   tailscale funnel 3500
   ```
2. O Tailscale retornará uma URL pública HTTPS correspondente à sua máquina (ex: `https://node-name.tailnet-name.ts.net`).
3. Anote esta URL, pois ela será o seu endpoint de webhook: `https://node-name.tailnet-name.ts.net/webhook`.

---

## 5. Configurar a Instância e Webhook na Evolution API

Configure a instância conectada ao WhatsApp para disparar eventos para o webhook do chatbot:

1. **Criar Instância**: Chame a rota de criação da Evolution API ou utilize o painel admin para criar a instância `jaobolao-bot`.
2. **Configurar Webhook**: Aponte o webhook da instância para a URL exposta pelo Tailscale:
   - **URL do Webhook**: `https://node-name.tailnet-name.ts.net/webhook`
   - **Eventos a Escutar**: `SEND_MESSAGE`, `MESSAGES_UPSERT`
   - **Ativar Webhook**: Marque como `true`.

---

## 6. Pareamento do WhatsApp

1. Acesse o painel da Evolution API ou chame a API `/instance/connect/jaobolao-bot` para obter o QR Code.
2. Com o celular dedicado ao bolão, escaneie o QR Code no WhatsApp (Aparelhos Conectados).
3. Aguarde sincronizar.

---

## 7. Configuração do Grupo de Bolão no Supabase

Para que o bot comece a escutar e notificar um grupo de bolão específico:
1. Abra o painel do Supabase.
2. Na tabela `groups`, localize o grupo do bolão.
3. Defina as seguintes colunas:
   - `whatsapp_bot_enabled` = `true`
   - `whatsapp_group_jid` = JID do grupo do WhatsApp (ex: `120363024837298@g.us`).
   - `whatsapp_invite_link` = URL de convite para o grupo de WhatsApp (ex: `https://chat.whatsapp.com/...`).

*Dica para descobrir o JID do grupo:* Ao adicionar o bot ao grupo do WhatsApp e digitar qualquer mensagem, o console do microsserviço registrará o payload do webhook exibindo o `key.remoteJid`. Copie este valor e cole no banco.

---

## 8. Verificação de Funcionamento

Envie uma mensagem no grupo do WhatsApp:
- Digite `!ajuda` e veja se o bot responde com a lista de comandos.
- Digite `!copa Quem ganhou a copa de 1970?` para testar as respostas da IA Jão baseadas na base de conhecimento.
- Altere o status de algum jogo de teste no Supabase para `finished` e veja se o bot envia a notificação no grupo e atualiza o respectivo arquivo markdown em `src/data/copas/`.
