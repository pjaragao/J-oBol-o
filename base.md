# Documentação Técnica: JãoBolão

## 1. Visão Geral

O **JãoBolão** é uma aplicação multiplataforma (Web + Mobile) para criação e participação em bolões de futebol, com sistema de assinaturas para monetização.

### 1.1. Plataformas
| Plataforma | Tecnologia | Distribuição |
|------------|------------|--------------|
| **Web** | Next.js 15 (App Router) | Vercel / Cloudflare |
| **iOS** | React Native (Expo) | App Store |
| **Android** | React Native (Expo) | Google Play Store |

### 1.2. Stack Tecnológica

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
├─────────────────────────────────────────────────────────────┤
│  Web: Next.js 15, React 18, TypeScript, Tailwind, ShadCN    │
│  Mobile: Expo (React Native), NativeWind, React Navigation  │
├─────────────────────────────────────────────────────────────┤
│                        BACKEND                               │
├─────────────────────────────────────────────────────────────┤
│  Database: Supabase (PostgreSQL)                            │
│  Auth: Supabase Auth (Email, OAuth, Magic Link)             │
│  Realtime: Supabase Realtime Subscriptions                  │
│  Storage: Supabase Storage (logos, avatars)                 │
│  Serverless: Supabase Edge Functions (Deno)                 │
├─────────────────────────────────────────────────────────────┤
│                      PAGAMENTOS                              │
├─────────────────────────────────────────────────────────────┤
│  Web: Stripe Checkout + Billing Portal                      │
│  Mobile: RevenueCat (App Store + Play Store IAP)            │
│  Webhook: Edge Function para sincronizar status             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de Dados (PostgreSQL)

### 2.1. Diagrama ER

```
profiles ─────┬───── group_members ─────┬───── groups
     │        │                         │         │
     │        └───── bets ──────────────┘         │
     │                │                           │
     │                │                           │
subscriptions        matches ───────────────── events
                       │
                     teams
```

### 2.2. Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuário (estende auth.users) |
| `subscriptions` | Assinaturas dos usuários (Stripe/RevenueCat) |
| `teams` | Banco central de times |
| `events` | Torneios/Competições |
| `matches` | Partidas de cada evento |
| `groups` | Grupos de bolão |
| `group_members` | Membros de cada grupo (N:N) |
| `bets` | Apostas dos usuários |

### 2.3. Schema SQL

```sql
-- Perfis de usuário
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    nickname TEXT,
    avatar_url TEXT,
    favorite_team_id UUID REFERENCES public.teams(id),
    is_admin BOOLEAN DEFAULT FALSE,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'pro')),
    subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assinaturas
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'revenuecat')),
    provider_subscription_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('premium', 'pro')),
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_subscription_id)
);

-- Times
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    short_name TEXT,
    logo_url TEXT,
    api_id INTEGER UNIQUE,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos/Torneios
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    api_id INTEGER UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partidas
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    home_team_id UUID NOT NULL REFERENCES public.teams(id),
    away_team_id UUID NOT NULL REFERENCES public.teams(id),
    match_date TIMESTAMPTZ NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
    api_id INTEGER UNIQUE,
    round TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grupos de bolão
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    event_id UUID NOT NULL REFERENCES public.events(id),
    invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
    is_public BOOLEAN DEFAULT FALSE,
    max_members INTEGER DEFAULT 50,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    scoring_rules JSONB DEFAULT '{"exact": 10, "winner": 5, "goals": 3}'::jsonb,
    requires_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membros do grupo
CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Apostas
CREATE TABLE public.bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    home_score_bet INTEGER NOT NULL,
    away_score_bet INTEGER NOT NULL,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id, match_id)
);

-- Índices para performance
CREATE INDEX idx_profiles_subscription ON public.profiles(subscription_tier, subscription_status);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_matches_event ON public.matches(event_id);
CREATE INDEX idx_matches_date ON public.matches(match_date);
CREATE INDEX idx_bets_user ON public.bets(user_id);
CREATE INDEX idx_bets_group ON public.bets(group_id);
CREATE INDEX idx_bets_match ON public.bets(match_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
```

---

## 3. Sistema de Assinaturas

### 3.1. Planos

| Plano | Preço | Recursos |
|-------|-------|----------|
| **Free** | R$ 0 | 1 grupo, 1 torneio, máx 10 membros |
| **Premium** | R$ 9,90/mês | Grupos ilimitados, torneios ilimitados, máx 50 membros |
| **Pro** | R$ 19,90/mês | Tudo do Premium + Grupos privados, Estatísticas avançadas, Suporte prioritário |

### 3.2. Provedores de Pagamento

| Plataforma | Provedor | Integração |
|------------|----------|------------|
| **Web** | Stripe | Checkout Session + Customer Portal |
| **iOS** | RevenueCat | StoreKit 2 via SDK |
| **Android** | RevenueCat | Google Play Billing via SDK |

### 3.3. Fluxo de Assinatura (Web)

```
Usuário → Clica "Assinar" → Edge Function cria Checkout Session →
Stripe Checkout → Webhook recebe evento → Edge Function atualiza profiles.subscription_*
```

### 3.4. Fluxo de Assinatura (Mobile)

```
Usuário → Clica "Assinar" → RevenueCat SDK mostra paywall →
In-App Purchase → RevenueCat Webhook → Edge Function atualiza profiles.subscription_*
```

---

## 4. Funcionalidades por Módulo

### 4.1. Autenticação
- Login com Email/Senha
- Login com Google/Apple (OAuth)
- Magic Link (email sem senha)
- Recuperação de senha
- Verificação de email

### 4.2. Dashboard
- Listar grupos do usuário
- Estatísticas pessoais (total apostas, pontos, posição média)
- Próximas partidas
- Status da assinatura

### 4.3. Grupos
- Criar grupo (vinculado a um torneio)
- Entrar via código de convite
- Sair do grupo
- Gerenciar membros (admin)
- Definir regras de pontuação

### 4.4. Apostas
- Ver partidas do torneio
- Fazer/editar aposta (antes do início)
- Ver apostas da galera (após início)
- Ranking do grupo
- Histórico de apostas

### 4.5. Administração
- Gerenciar torneios (CRUD)
- Importar partidas via API
- Sincronizar resultados
- Finalizar partidas e calcular pontos
- Gerenciar times

---

## 5. Estrutura de Diretórios

### 5.1. Monorepo

```
/jaobolao
├── /apps
│   ├── /web                    # Next.js 15 (App Router)
│   │   ├── /app
│   │   ├── /components
│   │   ├── /lib
│   │   └── package.json
│   └── /mobile                 # Expo (React Native)
│       ├── /app                # Expo Router
│       ├── /components
│       ├── /lib
│       └── package.json
├── /packages
│   ├── /shared                 # Código compartilhado
│   │   ├── /types              # TypeScript types
│   │   ├── /schemas            # Zod schemas
│   │   └── /utils              # Utilitários
│   └── /supabase               # Cliente Supabase compartilhado
├── /supabase
│   ├── /migrations             # SQL migrations
│   ├── /functions              # Edge Functions
│   └── config.toml
├── turbo.json                  # Turborepo config
└── package.json
```

### 5.2. Web (Next.js)

```
/apps/web
├── /app
│   ├── /(auth)                 # Login, Signup
│   ├── /(dashboard)            # Rotas protegidas
│   │   ├── /dashboard
│   │   ├── /groups/[groupId]
│   │   ├── /profile
│   │   └── /subscription
│   ├── /(admin)                # Painel admin
│   └── /api                    # Route Handlers
├── /components
│   ├── /auth
│   ├── /groups
│   ├── /bets
│   ├── /subscription
│   └── /ui                     # ShadCN
└── /lib
    ├── /supabase
    ├── /hooks
    └── /stores                 # Zustand
```

### 5.3. Mobile (Expo)

```
/apps/mobile
├── /app                        # Expo Router (file-based)
│   ├── /(auth)
│   ├── /(tabs)                 # Bottom tabs
│   │   ├── index.tsx           # Dashboard
│   │   ├── groups.tsx
│   │   ├── ranking.tsx
│   │   └── profile.tsx
│   └── /group/[id].tsx
├── /components
│   ├── /auth
│   ├── /groups
│   ├── /bets
│   └── /ui                     # NativeWind components
└── /lib
    ├── /supabase
    ├── /revenuecat
    └── /hooks
```

---

## 6. Edge Functions

### 6.1. Lista de Functions

| Function | Trigger | Descrição |
|----------|---------|-----------|
| `calculate-points` | Webhook / Manual | Calcula pontos após partida finalizar |
| `sync-matches` | Cron (diário) | Sincroniza partidas da API |
| `sync-results` | Cron (30min) | Atualiza resultados de jogos ao vivo |
| `stripe-webhook` | Webhook | Processa eventos do Stripe |
| `revenuecat-webhook` | Webhook | Processa eventos do RevenueCat |
| `create-checkout` | API | Cria sessão de checkout Stripe |

---

## 7. Segurança (Row Level Security)

### 7.1. Funções Auxiliares

```sql
-- Verificar se é admin do sistema
CREATE FUNCTION is_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Verificar se é membro do grupo
CREATE FUNCTION is_group_member(group_uuid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members WHERE group_id = group_uuid AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Verificar se tem assinatura ativa
CREATE FUNCTION has_active_subscription() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND subscription_status = 'active'
    );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 7.2. Policies Principais

- **profiles**: Leitura pública, escrita apenas próprio
- **teams/events/matches**: Leitura pública, escrita admin
- **groups**: Leitura para membros ou públicos, escrita para admin do grupo
- **bets**: Leitura após início da partida, escrita antes do início

---

## 8. APIs Externas

### 8.1. Football-Data.org
- **Uso**: Importar torneios, times e partidas
- **Endpoints**: `/competitions`, `/matches`, `/teams`
- **Rate Limit**: 10 req/min (free tier)

### 8.2. Stripe
- **Uso**: Pagamentos web
- **Webhooks**: `checkout.session.completed`, `customer.subscription.*`

### 8.3. RevenueCat
- **Uso**: In-App Purchases (iOS/Android)
- **Webhooks**: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`

---

## 9. Deploy

### 9.1. Infraestrutura

| Componente | Serviço |
|------------|---------|
| Web | Vercel |
| Mobile iOS | App Store Connect |
| Mobile Android | Google Play Console |
| Backend | Supabase Cloud |
| Storage | Supabase Storage |
| Edge Functions | Supabase Edge (Deno Deploy) |
| Pagamentos Web | Stripe |
| Pagamentos Mobile | RevenueCat |

### 9.2. Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# RevenueCat
REVENUECAT_API_KEY=
REVENUECAT_WEBHOOK_SECRET=

# Football API
FOOTBALL_API_KEY=
```