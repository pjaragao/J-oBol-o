# 📋 Regras do Projeto — JãoBolão

> Este documento define as regras, padrões e convenções que devem ser seguidos em todo desenvolvimento feito neste projeto.

---

## 🏗️ Arquitetura Geral

- **Tipo**: Monorepo com 2 apps (`web`, `mobile`) + backend (`supabase`)
- **Raiz do projeto**: `c:\Users\paulojr\Documents\JaoBolao\J-oBol-o`
- **Gerenciamento**: Não usa Turborepo na prática (sem `turbo.json`). Cada app é independente.
- **Linguagem**: TypeScript em todo o projeto

### Estrutura Principal
```
J-oBol-o/
├── apps/
│   ├── web/          # Next.js 16 (App Router)
│   └── mobile/       # Expo (React Native) com Expo Router
├── supabase/
│   ├── migrations/   # 5 arquivos SQL consolidados
│   ├── functions/    # 6 Edge Functions (Deno)
│   ├── scripts/      # Scripts auxiliares SQL
│   └── seed.sql      # Dados iniciais
├── assets/           # Logo
└── .github/workflows/  # GitHub Actions (match-sync CRON)
```

---

## 🌐 Web App (`apps/web`)

### Stack
| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 16.x | Framework (App Router) |
| React | 19.x | UI Library |
| TypeScript | 5.x | Linguagem |
| Tailwind CSS | 3.x | Estilização |
| ShadCN UI | — | Design System (Radix UI) |
| Supabase JS | 2.x | BaaS Client |
| Zustand | 5.x | State Management |
| React Hook Form | 7.x | Forms |
| Zod | 3.x | Validação de Schemas |
| next-intl | 4.x | Internacionalização (pt, en, es) |
| next-themes | — | Dark/Light mode |
| date-fns | 4.x | Manipulação de datas |
| lucide-react | — | Ícones |
| TanStack Query | 5.x | Server state management |
| web-push | 3.x | Push notifications |

### Convenções de Código Web
1. **Componentes**: Use `'use client'` somente quando necessário (client components)
2. **Imports**: Sempre use alias `@/` para importar de `src/`
3. **Pages**: Server Components por padrão (App Router)
4. **Estilização**: Tailwind CSS + CSS Variables HSL para tema
5. **UI Primitivos**: ShadCN UI — componentes em `src/components/ui/`
6. **Formulários**: React Hook Form + Zod para validação
7. **Estado Global**: Zustand (stores em `src/lib/hooks/`)
8. **i18n**: Todas as strings visíveis devem usar `useTranslations()` do next-intl
9. **Idiomas suportados**: `pt` (padrão), `en`, `es`
10. **Tema**: Dark mode via `next-themes` com variáveis CSS HSL

### Rotas Web (App Router)
```
/                    → Landing / Home (redirect para dashboard se logado)
/login               → Tela de login
/register            → Tela de cadastro
/dashboard           → Dashboard principal
/groups              → Lista de grupos
/groups/create       → Criar grupo
/groups/join         → Entrar em grupo
/groups/[groupId]    → Detalhe do grupo (tabs: dashboard, partidas, ranking, membros, config)
/bets                → Minhas apostas
/profile             → Perfil do usuário
/subscription        → Planos de assinatura
/notifications       → Central de notificações
/admin               → Painel administrativo
/admin/events        → Gerenciar eventos/torneios
/admin/matches       → Gerenciar partidas
/admin/teams         → Gerenciar times
/admin/logs          → Logs de sincronização
/admin/marketing     → Campanhas de marketing
/admin/i18n          → Gerenciar traduções
/api/cron/*          → CRON endpoints (update-matches, send-reminders)
/api/admin/*         → API routes admin
/api/groups/*        → API routes de grupos
/api/push/*          → API routes push notifications
```

### Regras para Criar Componentes Web
- Coloque em `src/components/{domínio}/` (ex: `groups/`, `bets/`, `admin/`)
- Componentes UI genéricos vão em `src/components/ui/`
- Use `class-variance-authority` (CVA) para variantes de componentes
- Sempre exporte o componente como `default` ou named export
- Nomenclatura: PascalCase para componentes, camelCase para funções/hooks

---

## 📱 Mobile App (`apps/mobile`)

### Stack
| Tecnologia | Versão | Uso |
|---|---|---|
| Expo | 52.x | Framework |
| React Native | 0.76.x | UI |
| Expo Router | 4.x | Navigation (file-based) |
| NativeWind | 4.x | Estilização (Tailwind for RN) |
| Supabase JS | 2.x | BaaS Client |
| RevenueCat | 8.x | In-App Purchases |
| expo-notifications | — | Push Notifications |
| expo-secure-store | — | Secure Storage |

### Estrutura Mobile
```
apps/mobile/
├── app/
│   ├── _layout.tsx         # Root layout (auth check)
│   ├── (auth)/             # Login, Register
│   ├── (tabs)/             # Bottom Tabs (Home, Groups, Search, Profile)
│   └── groups/[id].tsx     # Detalhe do grupo
├── components/
│   ├── GroupCard.tsx        # Card de grupo
│   ├── MatchCard.tsx       # Card de partida
│   └── ui/                 # Badge, Button, Card, Input
├── hooks/                  # useDebounce
└── lib/
    ├── supabase.ts         # Client config
    ├── revenuecat.ts       # RevenueCat config
    └── notifications.ts    # Push notifications
```

### Regras Mobile
1. **Estilos**: NativeWind (classes Tailwind em React Native)
2. **Storage**: `expo-secure-store` para tokens
3. **Auth**: Supabase Auth com AsyncStorage adapter
4. **Pagamentos**: RevenueCat para IAP (iOS/Android)
5. **Navigation**: File-based routing via Expo Router

---

## 🗄️ Backend (Supabase)

### Banco de Dados PostgreSQL

#### Tabelas Principais (10 tabelas)
| Tabela | Propósito |
|---|---|
| `profiles` | Perfis de usuário (extends auth.users) |
| `subscriptions` | Assinaturas Stripe/RevenueCat |
| `teams` | Times de futebol |
| `events` | Torneios/Competições |
| `matches` | Partidas |
| `groups` | Grupos de bolão |
| `group_members` | Membros dos grupos (N:N) |
| `pending_members` | Solicitações de entrada pendentes |
| `group_invitations` | Convites para grupos |
| `bets` | Apostas dos usuários |
| `transactions` | Transações financeiras |
| `notifications` | Notificações in-app |
| `sync_logs` | Logs de sincronização |

#### Enums Customizados
- `payment_method_type`: `ONLINE`, `OFFLINE`
- `payment_status_type`: `PENDING`, `PAID`, `EXEMPT`
- `transaction_type`: `ENTRY_FEE`, `PRIZE_PAYOUT`, `PLATFORM_FEE_ONLINE`, `CREATOR_ADMISSION_FEE`, `CREATOR_UPGRADE_FEE`
- `transaction_status`: `PENDING`, `COMPLETED`, `FAILED`, `WAIVED`

#### Regras de Segurança (RLS)
- **profiles**: Leitura pública, escrita só próprio
- **teams/events/matches**: Leitura pública, escrita admin
- **groups**: Visível se público OU membro OU admin OU convite pendente
- **bets**: Visível após início da partida, escrita antes do início
- **notifications**: Apenas do próprio usuário

#### Funções Auxiliares RLS
- `is_admin()` — verifica is_admin ou is_super_admin
- `is_group_member(UUID)` — verifica membership
- `is_group_admin(UUID)` — verifica role 'admin' no grupo

#### Triggers Automáticos
1. `on_auth_user_created` → Cria profile automaticamente
2. `on_group_created` → Adiciona criador como admin
3. `on_match_score_update` → Recalcula pontos dos bets
4. `on_bet_save_calc_points` → Calcula pontos ao salvar bet
5. `on_group_member_joined` → Notifica admin + aceita convite
6. `on_pending_member_created` → Notifica admins
7. `cleanup_expired_invitations` → Expira convites antigos
8. `update_*_updated_at` → Atualiza timestamps

#### Sistema de Pontuação
```json
{
  "exact": 10,        // Placar exato
  "winner_diff": 7,   // Vencedor + saldo correto
  "winner": 5,        // Apenas vencedor correto
  "one_score": 2      // Acertou placar de 1 time
}
```

### Edge Functions (Deno)
| Função | JWT | Descrição |
|---|---|---|
| `calculate-points` | ✅ | Calcula pontos pós-partida |
| `sync-matches` | ✅ | Sincroniza partidas do Football-Data.org |
| `stripe-webhook` | ❌ | Recebe webhooks Stripe |
| `revenuecat-webhook` | ❌ | Recebe webhooks RevenueCat |
| `create-checkout` | ✅ | Cria sessão Stripe Checkout |
| `send-push` | ✅ | Envia push notifications |

### Migrations (ordem de execução)
1. `001_consolidated_schema.sql` — Tabelas, indexes, enums
2. `002_consolidated_logic.sql` — Functions, triggers, views
3. `003_consolidated_rls.sql` — Row Level Security policies
4. `004_push_subscriptions.sql` — Push subscription table
5. `005_push_tokens.sql` — Push tokens table

---

## 🔑 Variáveis de Ambiente

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FOOTBALL_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### Supabase Secrets
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
REVENUECAT_WEBHOOK_SECRET
FOOTBALL_API_KEY
```

---

## 🚀 Comandos de Desenvolvimento

### Web
```powershell
cd apps/web
npm install    # Instalar dependências
npm run dev    # Servidor dev (localhost:3000)
npm run build  # Build para produção
npm run lint   # Linting
```

### Mobile
```powershell
cd apps/mobile
npm install        # Instalar dependências
npx expo start     # Iniciar Expo
npx expo start --web  # Modo web
```

---

## ⚠️ Regras Importantes

1. **NUNCA** comite arquivos `.env*`, `keys_temp.json` ou `vapid-keys.txt`
2. **SEMPRE** use `IF NOT EXISTS` / `IF EXISTS` em migrations SQL
3. **SEMPRE** use `CREATE OR REPLACE` para functions e triggers
4. **SEMPRE** teste RLS policies ao modificar tabelas
5. **O typo `reosurce_type`** na tabela `sync_logs` é intencional (legado) — NÃO corrija
6. **TypeScript errors são ignorados** no build (`ignoreBuildErrors: true`)
7. **Imagens remotas** devem ter hostname configurado em `next.config.ts`
8. **next-intl**: Novas strings devem ser adicionadas nos 3 arquivos: `pt.json`, `en.json`, `es.json`
9. **Componentes grandes**: Alguns componentes são muito grandes (GroupDashboard: 77KB, GroupSettings: 48KB, MemberList: 44KB) — considere refatorar ao modificar
10. **Deploy**: Web em Vercel, Supabase Cloud para backend
