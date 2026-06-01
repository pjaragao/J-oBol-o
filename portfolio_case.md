# Case de Estudo Técnico: JãoBolão

## Visão Executiva (Executive Summary)

O **JãoBolão** é uma plataforma multiplataforma (Web, iOS e Android) projetada para modernizar, gamificar e monetizar a experiência de bolões esportivos e ligas de palpites. Mais do que um simples aplicativo de apostas entre amigos, o sistema atua como uma solução robusta (SaaS/B2C) que orquestra torneios, partidas e rankings em tempo real com um modelo de assinatura integrado. 

Do ponto de vista arquitetural, o projeto adota o padrão **Monorepo** para unificar as bases de código Web e Mobile, garantindo alta coesão e velocidade de iteração. O uso intenso de tecnologias _serverless_ e _Edge Computing_ permite que o sistema escale elasticamente para lidar com picos de tráfego que invariavelmente ocorrem durante eventos esportivos de grande porte, como a Copa do Mundo ou finais de campeonatos.

O grande diferencial do JãoBolão é a sua capacidade de eliminar o atrito operacional tanto para os organizadores de grupos quanto para os jogadores. Ao automatizar toda a esteira de atualização de resultados e cálculo de pontuações, a plataforma entrega uma experiência premium, engajadora e focada unicamente na diversão, suportada por um ecossistema técnico moderno e altamente performático.

---

## Público-Alvo e Modelo de Negócio

- **Público-Alvo**: Entusiastas de futebol, grupos de amigos, famílias e até mesmo empresas que buscam promover engajamento interno (Team Building) através de competições amigáveis durante grandes torneios esportivos.
- **Modelo de Negócio**: **Freemium com Assinaturas (SaaS / In-App Purchases)**. 
  - **Free**: Limite de 1 grupo, 1 torneio e até 10 membros.
  - **Premium / Pro**: Geração de receita recorrente oferecendo grupos ilimitados, maior volume de membros, grupos privados e análises estatísticas avançadas.
  - **Estratégia de Conversão**: Transição fluida (frictionless) do usuário gratuito para o pago através de _paywalls_ contextuais em ambas as plataformas (Web e Mobile).

---

## O Problema Resolvido (The Challenge)

Historicamente, a gestão de bolões esportivos é um processo altamente analógico, manual e propenso a falhas. Organizadores utilizam planilhas do Excel e grupos de WhatsApp para coletar palpites, monitorar resultados ao vivo e calcular os pontos (acerto na mosca, acerto de vencedor, saldo de gols) para dezenas ou centenas de participantes. 

**A Dor (Pain Point)**: 
1. **Ineficiência Operacional e Escalabilidade**: O tempo gasto para atualizar planilhas durante uma rodada com múltiplos jogos simultâneos inviabiliza bolões com muitos participantes.
2. **Falta de Transparência e Engajamento**: Os jogadores não sabem suas posições no ranking até que o organizador feche os cálculos manualmente no fim do dia.

**O Impacto da Solução**: 
O JãoBolão automatiza **100% da regra de negócio de pontuação e ranking**. O impacto é a redução a zero das horas de administração de grupos, eliminando o erro humano, reduzindo a carga cognitiva e elevando o engajamento através de notificações e atualizações de tabelas em tempo real.

---

## Arquitetura e Tech Stack

A arquitetura foi desenhada priorizando a **reutilização de código**, a **experiência do desenvolvedor (DX)** e a **segurança de dados**.

*   **Infraestrutura e Gestão**: **Turborepo** (Monorepo). Tipagens do TypeScript e schemas de validação (Zod) são compartilhados nativamente entre frontends.
*   **Frontend Web**: **Next.js 15 (App Router)** com **React 18**. Utiliza Server Components para renderização veloz (SSR/RSC), estilizado com **Tailwind CSS** e **ShadCN UI** para um design system premium e responsivo. Hospedagem via Vercel.
*   **Frontend Mobile**: **React Native via Expo**, garantindo um ciclo de release contínuo nas lojas (App Store e Google Play). O design é adaptado usando **NativeWind**, mantendo a paridade visual e de _tokens_ com a versão Web.
*   **Backend, Banco de Dados & Auth**: **Supabase (BaaS)**. O coração dos dados é um banco **PostgreSQL** relacional robusto. A autenticação engloba Magic Links e OAuth (Google/Apple). A segurança da camada de dados é garantida a nível de banco via **Row Level Security (RLS)**, garantindo que usuários manipulem estritamente os dados aos quais têm permissão.
*   **Computação Assíncrona**: **Supabase Edge Functions (Deno)**. Responsáveis por rodar as regras de negócios críticas, processamento de webhooks e rotinas em background (CRONs) fora do fio principal de interação do usuário.

---

## Integrações, APIs e IA

O sistema possui forte acoplamento com serviços externos vitais para o negócio, abstraídos sob uma camada de Edge Functions:

1. **Football-Data.org API (Sincronização Esportiva)**: 
   - A pipeline de dados consome endpoints externos via **CRON Jobs** em Edge Functions. 
   - A `sync-matches` roda diariamente para atualizar a grade de partidas, enquanto a `sync-results` roda com altíssima frequência (ex: a cada 30 min) durante os jogos para capturar placares ao vivo.
2. **Orquestração de Pagamentos Cross-Platform**:
   - **Stripe (Web)**: Gerencia o fluxo de Checkout Sessions e faturamento.
   - **RevenueCat (Mobile)**: Gerencia o ecossistema complexo do StoreKit 2 (Apple) e Google Play Billing.
   - **Data Pipeline**: Webhooks emitidos por ambos os provedores convergem para Edge Functions unificadas (`stripe-webhook`, `revenuecat-webhook`), que normalizam o status (`active`, `past_due`, `canceled`) dentro da tabela `profiles` no PostgreSQL, garantindo que uma assinatura feita no iOS desbloqueie recursos na Web instantaneamente.

---

## Soluções e Funcionalidades Core

*   **Motor de Pontuação Configurável (Custom Rules Engine)**: A regra de negócio não é estática. Administradores definem os pesos (`{ "exact": 10, "winner": 5, "goals": 3 }` persistidos via JSONB) criando bolões hiper-personalizados.
*   **Real-time Leaderboards (Supabase Realtime)**: Ao invés de *polling* agressivo, os clientes Web e Mobile se inscrevem (Subscribe) em canais do PostgreSQL via WebSockets. Quando a engine de backend atualiza os placares, o ranking front-end reage magicamente em tempo real, gerando forte efeito "wow" nos usuários.
*   **Autenticação Frictionless**: Fluxos de Onboarding otimizados via Magic Link (Email sem senha) e provedores nativos (Apple/Google OAuth) elevam a taxa de conversão em aquisição de usuários.

---

## Desafios Técnicos Superados

> [!IMPORTANT]
> **Desafio 1: Sincronização de Estado de Faturamento Cross-Platform**  
> **Problema**: Lidar com assinaturas em múltiplas plataformas cria o risco de duplicação de faturamento ou dessincronização de privilégios. Um usuário poderia assinar na App Store e ter sua assinatura não reconhecida na Web.  
> **Solução Arquitetural**: O banco de dados Postgres atua como a única fonte da verdade (*Single Source of Truth*). Implementamos o **RevenueCat** como abstração mobile para padronizar webhooks da App Store/Play Store, direcionando-os para nossas Edge Functions. Esses handlers aplicam operações transacionais seguras na tabela `subscriptions` unindo as IDs dos provedores ao `user_id`, garantindo consistência em milissegundos independente de onde a compra ocorreu.

> [!TIP]
> **Desafio 2: Escalabilidade no Cálculo de Pontos (High Concurrency)**  
> **Problema**: Quando o apito final de uma partida de Copa do Mundo soa, centenas de milhares de palpites na tabela `bets` precisam ser avaliados simultaneamente contra o resultado final, correndo risco de gerar bloqueios de tabela (*table locks*) ou estourar a memória.  
> **Solução Arquitetural**: Desacoplamento da engine de pontuação. A trigger de fechamento do jogo envia uma notificação assíncrona para a Edge Function `calculate-points`. A função processa os registros em blocos (*batch processing/pagination*), calculando os pontos com base no JSONB de regras de cada grupo isoladamente e efetuando `BULK UPDATES` massivos no Postgres de forma otimizada e não bloqueante.
