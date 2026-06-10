# Instruções de Implantação do NeyBot com Hermes Agent no Homelab

Este guia destina-se a orientar a implantação e configuração da nova arquitetura de IA conversacional do **JãoBolão**, utilizando o **NeyBot** integrado ao **Hermes Agent** e à **Evolution API** no seu homelab com segurança total de banco de dados (somente leitura e proteção contra cópia de palpites).

---

## 1. Arquitetura de Implantação

A nova arquitetura distribui as responsabilidades em três camadas:
1. **Evolution API (Docker):** Gateway que mantém a conexão com o WhatsApp e repassa as mensagens via Webhook.
2. **NeyBot Bridge (Este microsserviço Node.js):**
   - Recebe webhooks da Evolution API.
   - Detecta quando o bot é mencionado (`@NeyBot` em grupos) ou mensagens privadas (DMs).
   - Intercepta comandos de infraestrutura importantes, como `vincular <token>` diretamente na bridge.
   - Encaminha o fluxo de conversação para o Hermes Agent via HTTP.
   - Escuta o Supabase Realtime para enviar notificações automáticas de gols/jogos.
3. **Hermes Agent (WSL/Docker - v0.13.0):**
   - O "cérebro" de IA do NeyBot.
   - Possui memória persistente de conversas.
   - Utiliza as **Skills** internas (`copas-history` e `bolao-rules`).
   - Utiliza **MCP Tools** (`@modelcontextprotocol/server-postgres`) para ler dados dinâmicos diretamente do banco de dados em um schema de **somente leitura** e com proteção contra espionagem de apostas.

---

## 2. Configurando o Banco de Dados Seguro (Supabase)

Para evitar que o bot altere dados do banco de dados ou exponha palpites de partidas não iniciadas (evitando cópias entre participantes), criamos um schema dedicado somente leitura.

### Passo 1: Executar o script SQL no Supabase
1. Vá para o painel do seu **Supabase Cloud**.
2. Abra o **SQL Editor** e crie uma nova query.
3. Copie e cole todo o conteúdo do arquivo: [setup_secure_db.sql](file:///c:/Users/paulojr/Documents/JaoBolao/J-oBol-o/services/whatsapp-bot/hermes/setup_secure_db.sql)
4. Execute o script. Ele irá:
   - Criar o schema seguro `neybot`.
   - Criar views que expõem apenas os dados necessários do bolão.
   - Ocultar automaticamente as apostas de jogos futuros (retornando `NULL` nos placares).
   - Criar o usuário restrito `neybot_reader` com permissão de leitura exclusiva ao schema `neybot`.

---

## 3. Configurando o Hermes no WSL

Criamos um script automático para configurar o profile `neybot` no Hermes local.

### Passos de Instalação do Profile:
1. No seu WSL, navegue até a pasta do projeto `services/whatsapp-bot`.
2. Garanta permissão de execução e rode o script de setup:
   ```bash
   chmod +x hermes-setup.sh
   ./hermes-setup.sh
   ```
3. O script criará o profile `neybot` e copiará as configurações e as skills markdown.
4. Acesse a pasta do profile criada no seu usuário:
   ```bash
   cd ~/.hermes/profiles/neybot
   ```
5. Edite o arquivo `.env` configurando suas chaves do Gemini e a string de conexão do Postgres segura:
   ```ini
   GEMINI_API_KEY=sua-chave-gemini-aqui
   NEYBOT_DB_CONNECTION_STRING=postgresql://neybot_reader:SenhaCriadaNoPasso2@db.seu-projeto.supabase.co:5432/postgres
   HERMES_WEBHOOK_SECRET=segredo-compartilhado-com-a-bridge
   ```
6. Inicie o gateway do Hermes:
   ```bash
   hermes --profile neybot gateway start
   ```
   *(O Hermes iniciará um servidor MCP do PostgreSQL usando o usuário `neybot_reader`, garantindo que ele só consiga ler o schema restrito).*

---

## 4. Configurando a NeyBot Bridge (Node.js)

Configure o arquivo `.env` na raiz desta pasta (`services/whatsapp-bot/.env`) com as seguintes definições:

```ini
PORT=3500
NODE_ENV=production

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-chave-service-role

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-chave-api-da-evolution
EVOLUTION_INSTANCE=jaobolao-bot

# Segurança do Webhook da Bridge (Recebido da Evolution)
WEBHOOK_SECRET=segredo-webhook-da-bridge

# Configuração do Hermes Agent
HERMES_API_URL=http://localhost:8644
HERMES_WEBHOOK_SECRET=segredo-compartilhado-com-a-bridge
BOT_WHATSAPP_JID=5511999999999@s.whatsapp.net # O JID do seu bot (ajuda a detectar menções exatas)

# Silêncio e Limite
RATE_LIMIT_MAX_PER_HOUR=25
SILENT_HOURS_START=23
SILENT_HOURS_END=7
```

---

## 5. Inicializando a Bridge

Você pode buildar e iniciar a bridge via Docker Compose:

```bash
docker-compose up -d --build
```

A bridge irá subir na porta `3500` e ficará escutando os webhooks da Evolution API. Certifique-se de configurar o webhook da sua instância da Evolution API para apontar para o endereço exposto pela bridge (ex: via Tailscale Funnel: `https://seu-subdominio.ts.net/webhook`).

---

## 6. Testando a Integração

### Teste no WhatsApp:
1. **Em um grupo:** Envie `@NeyBot quem ganhou a copa de 1970?`
   - O bot deve responder usando a skill de histórico de copas.
2. **Em um grupo:** Envie `@NeyBot como está o ranking do bolão?`
   - O Hermes deve acionar o Postgres MCP, rodar a consulta SQL de ranking e apresentar a tabela formatada no WhatsApp.
3. **No privado (DM):** Digite `vincular TOKEN` (onde TOKEN é a chave gerada no site do bolão).
   - A bridge irá interceptar diretamente o vínculo e confirmar a associação.
4. **Proteção contra espionagem:** Tente perguntar pelo WhatsApp as apostas de outro usuário para uma partida que ainda não começou.
   - O NeyBot lerá valores nulos (`NULL`) das views seguras do banco e não conseguirá revelar os palpites futuros, impedindo cópias!

