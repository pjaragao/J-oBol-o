# 🗺️ Mapa Completo da Aplicação — JãoBolão

> Referência rápida de **todos os arquivos** do projeto, organizados por módulo, com descrição de cada um.

---

## 📁 Raiz do Projeto

| Arquivo | Descrição |
|---|---|
| `README.md` | Documentação pública (EN/PT) |
| `README_SETUP.md` | Guia de setup do ambiente |
| `base.md` | Documentação técnica completa (modelo de dados, segurança, fluxos) |
| `portfolio_case.md` | Case de estudo para portfólio |
| `package.json` | Root package (apenas next como dep) |
| `.gitignore` | node_modules, .next, .env, keys |

---

## 🌐 Web — `apps/web/`

### Configuração
| Arquivo | Descrição |
|---|---|
| `package.json` | Dependências do web app |
| `next.config.ts` | Config Next.js + next-intl + remote images |
| `tailwind.config.ts` | Tailwind com design tokens HSL (ShadCN) |
| `tsconfig.json` | TypeScript config |
| `postcss.config.mjs` | PostCSS config |
| `middleware.ts` | Supabase session refresh middleware |
| `vercel.json` | Config de deploy Vercel |
| `generate-vapid.js` | Script para gerar chaves VAPID |

### Fonte & Tema — `src/app/`
| Arquivo | Descrição |
|---|---|
| `layout.tsx` | Root Layout (Inter font, ThemeProvider, NextIntl) |
| `page.tsx` | Home page (delega para HomeClient) |
| `globals.css` | CSS global + variáveis HSL do tema |

### Páginas — `src/app/`

#### Autenticação
| Rota | Arquivo/Pasta | Descrição |
|---|---|---|
| `/login` | `login/` | Tela de login |
| `/register` | `register/` | Tela de cadastro |
| `/auth` | `auth/` | Callback de autenticação |

#### Dashboard & Principal
| Rota | Arquivo/Pasta | Descrição |
|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Dashboard principal |
| `/profile` | `profile/` | Perfil do usuário |
| `/subscription` | `subscription/` | Planos de assinatura |
| `/notifications` | `notifications/` | Central de notificações |
| `/bets` | `bets/page.tsx` + `BetsClient.tsx` | Minhas apostas |

#### Grupos
| Rota | Arquivo/Pasta | Descrição |
|---|---|---|
| `/groups` | `groups/page.tsx` | Lista de grupos |
| `/groups/create` | `groups/create/` | Criar grupo |
| `/groups/join` | `groups/join/` | Entrar via convite |
| `/groups/[groupId]` | `groups/[groupId]/` | Detalhe do grupo |

#### Admin
| Rota | Arquivo/Pasta | Descrição |
|---|---|---|
| `/admin` | `admin/page.tsx` | Dashboard admin |
| `/admin/events` | `admin/events/` | CRUD de eventos |
| `/admin/matches` | `admin/matches/` | Gerenciar partidas |
| `/admin/teams` | `admin/teams/` | Gerenciar times |
| `/admin/logs` | `admin/logs/` | Logs de sync |
| `/admin/marketing` | `admin/marketing/` | Campanhas |
| `/admin/i18n` | `admin/i18n/` | Traduções |

#### API Routes — `src/app/api/`
| Rota | Descrição |
|---|---|
| `api/cron/update-matches/` | CRON endpoint para sincronizar partidas |
| `api/cron/send-reminders/` | CRON endpoint para enviar lembretes |
| `api/admin/` | Endpoints administrativos |
| `api/groups/` | Endpoints de grupos |
| `api/push/` | Endpoints de push notification |

### Componentes — `src/components/`

#### `ui/` — Primitivos ShadCN
| Componente | Descrição |
|---|---|
| `button.tsx` | Botão com variantes (CVA) |
| `card.tsx` | Card container |
| `input.tsx` | Input de texto |
| `textarea.tsx` | Textarea |
| `label.tsx` | Label de formulário |
| `select.tsx` | Select dropdown |
| `checkbox.tsx` | Checkbox |
| `switch.tsx` | Toggle switch |
| `alert.tsx` | Alert/Banner |
| `LanguageSelector.tsx` | Seletor de idioma |
| `TeamName.tsx` | Exibe nome de time com logo |
| `index.ts` | Barrel export |

#### `layout/` — Layout & Navegação
| Componente | Tamanho | Descrição |
|---|---|---|
| `AppLayout.tsx` | 1.3KB | Layout wrapper principal |
| `AppHeader.tsx` | 5.9KB | Header da aplicação |
| `AppSidebar.tsx` | 15.9KB | Sidebar de navegação |
| `HomeClient.tsx` | 11.1KB | Landing page client component |
| `HeaderSetter.tsx` | 764B | Setter dinâmico do header |
| `LayoutContext.tsx` | 1.1KB | Context de layout |
| `NotificationBell.tsx` | 20.7KB | Sino de notificações com dropdown |

#### `groups/` — Módulo de Grupos
| Componente | Tamanho | Descrição |
|---|---|---|
| `GroupDashboard.tsx` | **77.3KB** | Dashboard completo do grupo |
| `GroupSettings.tsx` | **48.0KB** | Configurações do grupo |
| `MemberList.tsx` | **44.9KB** | Lista de membros + gestão |
| `RankingList.tsx` | **29.4KB** | Ranking/Classificação |
| `MatchList.tsx` | **29.9KB** | Lista de partidas |
| `GroupTabs.tsx` | 6.0KB | Tabs de navegação do grupo |
| `GroupBottomNav.tsx` | 4.5KB | Navegação inferior (mobile-like) |
| `PublicGroupsSearch.tsx` | 8.6KB | Busca de grupos públicos |

#### `bets/` — Módulo de Apostas
| Componente | Descrição |
|---|---|
| `BetModal.tsx` | Modal para fazer/editar aposta |

#### `admin/` — Painel Admin
| Componente | Descrição |
|---|---|
| `CronControls.tsx` | Controles de sincronização manual |
| `EditEventModal.tsx` | Modal de edição de evento |
| `EditTeamModal.tsx` | Modal de edição de time |
| `TeamList.tsx` | Lista de times com CRUD |

#### `profile/`
| Componente | Descrição |
|---|---|
| `AvatarUpload.tsx` | Upload de avatar para Supabase Storage |

#### `providers/`
| Componente | Descrição |
|---|---|
| `theme-provider.tsx` | ThemeProvider do next-themes |

### Lib — `src/lib/`

#### `supabase/` — Cliente Supabase
| Arquivo | Descrição |
|---|---|
| `client.ts` | Cliente browser (createBrowserClient) |
| `server.ts` | Cliente server (createServerClient) |
| `middleware.ts` | Refresh de sessão para middleware |
| `storage-utils.ts` | Helpers para Supabase Storage |

#### `api-football/`
| Arquivo | Descrição |
|---|---|
| `client.ts` | Cliente da API Football-Data.org |

#### `stripe/`
| Arquivo | Descrição |
|---|---|
| `checkout.ts` | Helpers para Stripe Checkout |

#### `hooks/`
| Arquivo | Descrição |
|---|---|
| `useUser.ts` | Hook para obter usuário autenticado |

#### `utils/`
| Arquivo | Descrição |
|---|---|
| `points.ts` | Lógica de cálculo de pontos (client-side) |

#### Outros `lib/`
| Arquivo | Descrição |
|---|---|
| `cron.ts` | **16.5KB** — Lógica de sincronização de partidas |
| `bet-security.ts` | Validações de segurança para bets |
| `financial-service.ts` | Serviço financeiro (transações) |
| `sync-logger.ts` | Logger para sincronizações |
| `verify-matches.ts` | Verificação de integridade de partidas |
| `utils.ts` | cn() helper (clsx + tailwind-merge) |
| `debug-events*.ts` | Scripts de debug (3 versões) |

### Hooks — `src/hooks/`
| Arquivo | Descrição |
|---|---|
| `usePushNotifications.ts` | **10.9KB** — Hook completo de push notifications |
| `useUserGroups.ts` | Hook para listar grupos do usuário |

### Actions — `src/actions/`
| Arquivo | Descrição |
|---|---|
| `groups.ts` | Server Actions para grupos (criar, entrar, sair, etc.) |

### Types — `src/types/`
| Arquivo | Descrição |
|---|---|
| `supabase-financial.ts` | Types das tabelas financeiras |

### i18n — `src/i18n/`
| Arquivo | Descrição |
|---|---|
| `config.ts` | Configuração de locales (pt, en, es) |
| `request.ts` | Resolução de locale por request |

### Traduções — `messages/`
| Arquivo | Tamanho | Descrição |
|---|---|---|
| `pt.json` | 21.6KB | Português (padrão) |
| `en.json` | 20.5KB | Inglês |
| `es.json` | 21.9KB | Espanhol |

---

## 📱 Mobile — `apps/mobile/`

### Configuração
| Arquivo | Descrição |
|---|---|
| `package.json` | Dependências mobile |
| `app.json` | Config Expo (nome, bundle ID) |
| `tsconfig.json` | TypeScript config |

### App Routes — `app/`
| Arquivo | Descrição |
|---|---|
| `_layout.tsx` | Root Layout (auth guard, fonts) |
| `(auth)/_layout.tsx` | Auth layout |
| `(auth)/login.tsx` | Tela de login |
| `(auth)/register.tsx` | Tela de cadastro |
| `(tabs)/_layout.tsx` | Tab bar layout |
| `(tabs)/index.tsx` | Dashboard/Home |
| `(tabs)/groups.tsx` | Meus Grupos |
| `(tabs)/search.tsx` | Buscar Grupos |
| `(tabs)/profile.tsx` | Perfil |
| `groups/[id].tsx` | Detalhe do grupo |
| `groups/[id]/` | Sub-rotas do grupo |

### Components — `components/`
| Arquivo | Descrição |
|---|---|
| `GroupCard.tsx` | Card de grupo |
| `MatchCard.tsx` | Card de partida |
| `ui/Badge.tsx` | Badge component |
| `ui/Button.tsx` | Botão com variantes |
| `ui/Card.tsx` | Card container |
| `ui/Input.tsx` | Input de texto |

### Lib — `lib/`
| Arquivo | Descrição |
|---|---|
| `supabase.ts` | Supabase client com SecureStore |
| `revenuecat.ts` | RevenueCat configuração |
| `notifications.ts` | Expo notifications setup |

### Hooks — `hooks/`
| Arquivo | Descrição |
|---|---|
| `useDebounce.ts` | Hook de debounce |

---

## 🗄️ Supabase — `supabase/`

### Migrations — `migrations/`
| Arquivo | Tamanho | Descrição |
|---|---|---|
| `001_consolidated_schema.sql` | 11.7KB | Tabelas, indexes, enums |
| `002_consolidated_logic.sql` | 15.0KB | Functions, triggers, views |
| `003_consolidated_rls.sql` | 6.7KB | Row Level Security policies |
| `004_push_subscriptions.sql` | 1.3KB | Web push subscriptions |
| `005_push_tokens.sql` | 2.4KB | Mobile push tokens |

### Edge Functions — `functions/`
| Função | Arquivo | Tamanho | Descrição |
|---|---|---|---|
| `calculate-points` | `index.ts` | 6.3KB | Engine de cálculo de pontos |
| `sync-matches` | `index.ts` | 7.9KB | Sync Football-Data.org |
| `stripe-webhook` | `index.ts` | 9.4KB | Handler Stripe webhooks |
| `revenuecat-webhook` | `index.ts` | 7.8KB | Handler RevenueCat webhooks |
| `create-checkout` | `index.ts` | 4.8KB | Criar sessão Stripe Checkout |
| `send-push` | `index.ts` | 7.2KB | Enviar push notifications |

### Outros
| Arquivo | Descrição |
|---|---|
| `config.toml` | Configuração Supabase CLI |
| `seed.sql` | Dados iniciais (12 times brasileiros + Brasileirão 2025) |
| `scripts/clean_football_data.sql` | Limpar dados importados |

---

## ⚙️ CI/CD — `.github/`

| Arquivo | Descrição |
|---|---|
| `workflows/match-sync.yml` | CRON a cada 20min para sync de partidas |

---

## 📊 Diagrama de Dependências

```
                    ┌──────────────┐
                    │  Supabase    │
                    │  (Postgres)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐  ┌──┴───┐  ┌─────┴──────┐
        │  Web App   │  │ Edge │  │ Mobile App │
        │ (Next.js)  │  │ Func │  │  (Expo)    │
        └─────┬──────┘  └──┬───┘  └─────┬──────┘
              │            │            │
    ┌─────────┼────┐   ┌───┼────┐   ┌───┼────┐
    │         │    │   │   │    │   │   │    │
  Stripe   Football  Vercel  RevenueCat  App
  (web     -Data.org        (mobile     Stores
  payments)  (API)           payments)
```
