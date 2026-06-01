Você é um assistente de desenvolvimento para o projeto **JãoBolão** — uma plataforma multiplataforma (Web + Mobile) de bolões de futebol.

## Contexto do Projeto
- **Web**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 3 + ShadCN UI
- **Mobile**: Expo 52 + React Native 0.76 + NativeWind + Expo Router
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions em Deno, Realtime, Storage)
- **Pagamentos**: Stripe (web) + RevenueCat (mobile)
- **API Esportiva**: Football-Data.org
- **i18n**: next-intl (pt, en, es)
- **State**: Zustand + TanStack Query

## Arquivos de Referência
Antes de responder qualquer pergunta ou fazer qualquer alteração, consulte os seguintes arquivos:
- `.gemini/REGRAS.md` — Regras, padrões e convenções do projeto
- `.gemini/MAPA_APLICACAO.md` — Mapa completo de todos os arquivos
- `.gemini/WORKFLOWS.md` — Workflows de desenvolvimento passo-a-passo
- `.gemini/SCHEMA_DB.md` — Schema completo do banco de dados

## Regras de Comportamento
1. **Sempre** use TypeScript
2. **Sempre** use `@/` para imports dentro de `src/`
3. **Sempre** adicione textos traduzíveis nos 3 idiomas (pt.json, en.json, es.json)
4. **Nunca** modifique `.env*` ou arquivos sensíveis
5. **Sempre** use ShadCN UI components como base para UI web
6. **Sempre** use `IF NOT EXISTS` / `CREATE OR REPLACE` em SQL
7. **Sempre** considere RLS ao criar/modificar tabelas
8. O typo `reosurce_type` na tabela `sync_logs` é intencional — NÃO corrija
9. Componentes grandes devem ser refatorados incrementalmente
10. TypeScript errors são ignorados no build (ignoreBuildErrors: true)

## Estrutura de Pastas
```
J-oBol-o/
├── apps/web/src/        # Next.js app
│   ├── app/             # Pages (App Router)
│   ├── components/      # React components
│   ├── lib/             # Utils, clients, services
│   ├── hooks/           # Custom hooks
│   ├── actions/         # Server Actions
│   ├── types/           # TypeScript types
│   └── i18n/            # Internationalization
├── apps/mobile/         # Expo app
│   ├── app/             # Expo Router pages
│   ├── components/      # RN components
│   ├── lib/             # Supabase, RevenueCat, notifications
│   └── hooks/           # Custom hooks
└── supabase/
    ├── migrations/      # SQL migrations
    ├── functions/       # Edge Functions (Deno)
    └── config.toml      # Supabase config
```
