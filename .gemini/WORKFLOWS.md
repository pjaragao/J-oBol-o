# 🔄 Workflows de Desenvolvimento — JãoBolão

> Guias passo-a-passo para tarefas comuns de desenvolvimento.

---

## 📝 Índice

1. [Criar Nova Página Web](#1-criar-nova-página-web)
2. [Criar Novo Componente Web](#2-criar-novo-componente-web)
3. [Adicionar Nova Tabela no Supabase](#3-adicionar-nova-tabela-no-supabase)
4. [Adicionar Nova Coluna a Tabela Existente](#4-adicionar-nova-coluna-a-tabela-existente)
5. [Criar Nova Edge Function](#5-criar-nova-edge-function)
6. [Adicionar Texto Traduzível (i18n)](#6-adicionar-texto-traduzível-i18n)
7. [Adicionar Novo API Route](#7-adicionar-novo-api-route)
8. [Criar Nova Tela Mobile](#8-criar-nova-tela-mobile)
9. [Modificar Sistema de Pontuação](#9-modificar-sistema-de-pontuação)
10. [Adicionar Novo Provider de Auth](#10-adicionar-novo-provider-de-auth)
11. [Deploy Web (Vercel)](#11-deploy-web-vercel)
12. [Rodar Localmente](#12-rodar-localmente)
13. [Debugging](#13-debugging)

---

## 1. Criar Nova Página Web

### Passos:
1. **Criar pasta da rota** em `apps/web/src/app/{rota}/`
2. **Criar `page.tsx`** (Server Component por padrão)
3. **Se precisar de client-side**, crie um componente `*Client.tsx` e importe na page
4. **Adicionar layout** se necessário em `layout.tsx`
5. **Adicionar à sidebar** em `src/components/layout/AppSidebar.tsx`
6. **Proteger rota** via middleware se autenticada

### Template de Página (Server Component):
```tsx
// apps/web/src/app/{rota}/page.tsx
import { getTranslations } from 'next-intl/server'

export default async function MinhaPage() {
    const t = await getTranslations('MinhaPagina')
    
    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
    )
}
```

### Template de Página (Client Component):
```tsx
// apps/web/src/app/{rota}/page.tsx
import MinhaPageClient from './MinhaPageClient'

export default function MinhaPage() {
    return <MinhaPageClient />
}

// apps/web/src/app/{rota}/MinhaPageClient.tsx
'use client'
import { useTranslations } from 'next-intl'

export default function MinhaPageClient() {
    const t = useTranslations('MinhaPagina')
    return <div>{t('title')}</div>
}
```

---

## 2. Criar Novo Componente Web

### Checklist:
- [ ] Criar em `src/components/{domínio}/NomeComponente.tsx`
- [ ] Marcar `'use client'` se usar hooks/estado
- [ ] Usar Tailwind CSS para estilos
- [ ] Usar componentes `ui/` do ShadCN como base
- [ ] Usar `useTranslations()` para textos
- [ ] Exportar com nome (PascalCase)

### Template:
```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface MeuComponenteProps {
    titulo: string
    onClick?: () => void
}

export default function MeuComponente({ titulo, onClick }: MeuComponenteProps) {
    const t = useTranslations('MeuComponente')
    
    return (
        <Card className="p-4">
            <h3 className="text-lg font-semibold">{titulo}</h3>
            <Button onClick={onClick}>{t('action')}</Button>
        </Card>
    )
}
```

---

## 3. Adicionar Nova Tabela no Supabase

### Checklist:
- [ ] Criar migration SQL em `supabase/migrations/006_*.sql`
- [ ] Usar `CREATE TABLE IF NOT EXISTS`
- [ ] Adicionar `COMMENT ON TABLE`
- [ ] Adicionar indexes relevantes
- [ ] Habilitar RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Criar policies de SELECT, INSERT, UPDATE, DELETE
- [ ] Adicionar trigger `update_updated_at` se tiver coluna `updated_at`
- [ ] Atualizar types em `src/types/`
- [ ] Documentar no MAPA_APLICACAO.md

### Template SQL:
```sql
-- Migration: 006_nome_da_feature.sql
-- Description: ...

CREATE TABLE IF NOT EXISTS public.nova_tabela (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- campos...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.nova_tabela IS 'Descrição da tabela';

-- Index
CREATE INDEX IF NOT EXISTS idx_nova_tabela_user ON public.nova_tabela(user_id);

-- RLS
ALTER TABLE public.nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nova_tabela_select_own" ON public.nova_tabela
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nova_tabela_insert_own" ON public.nova_tabela
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER update_nova_tabela_updated_at
    BEFORE UPDATE ON public.nova_tabela
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## 4. Adicionar Nova Coluna a Tabela Existente

### Checklist:
- [ ] Criar nova migration: `supabase/migrations/006_add_coluna.sql`
- [ ] Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- [ ] Definir DEFAULT para dados existentes
- [ ] Atualizar policies se necessário
- [ ] Atualizar types TypeScript

### Template:
```sql
-- Migration: 006_add_coluna_na_tabela.sql
ALTER TABLE public.tabela
    ADD COLUMN IF NOT EXISTS nova_coluna TEXT DEFAULT '';
```

---

## 5. Criar Nova Edge Function

### Passos:
1. Criar pasta `supabase/functions/nome-funcao/`
2. Criar `index.ts` com handler Deno
3. Registrar em `supabase/config.toml`
4. Definir `verify_jwt` (true/false)

### Template:
```typescript
// supabase/functions/nome-funcao/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Lógica aqui...

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
```

### Registrar em `config.toml`:
```toml
[functions.nome-funcao]
verify_jwt = true
```

---

## 6. Adicionar Texto Traduzível (i18n)

### Checklist:
- [ ] Adicionar key nos 3 arquivos JSON de mensagens
- [ ] Usar `useTranslations()` (client) ou `getTranslations()` (server)

### Passo 1 — Adicionar nos JSONs:
```json
// messages/pt.json
{
  "MinhaPagina": {
    "title": "Meu Título",
    "description": "Minha descrição"
  }
}

// messages/en.json
{
  "MinhaPagina": {
    "title": "My Title",
    "description": "My description"
  }
}

// messages/es.json
{
  "MinhaPagina": {
    "title": "Mi Título",
    "description": "Mi descripción"
  }
}
```

### Passo 2 — Usar no componente:
```tsx
// Client Component
'use client'
import { useTranslations } from 'next-intl'

export default function Comp() {
    const t = useTranslations('MinhaPagina')
    return <h1>{t('title')}</h1>
}

// Server Component
import { getTranslations } from 'next-intl/server'

export default async function Page() {
    const t = await getTranslations('MinhaPagina')
    return <h1>{t('title')}</h1>
}
```

---

## 7. Adicionar Novo API Route

### Localização: `apps/web/src/app/api/{rota}/route.ts`

### Template:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    
    // Verificar auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Lógica...
    
    return NextResponse.json({ data: [] })
}

export async function POST(request: NextRequest) {
    const body = await request.json()
    // ...
    return NextResponse.json({ success: true })
}
```

---

## 8. Criar Nova Tela Mobile

### Passos:
1. Criar arquivo em `apps/mobile/app/{rota}.tsx`
2. Expo Router usa file-based routing

### Template:
```tsx
// apps/mobile/app/nova-tela.tsx
import { View, Text, StyleSheet } from 'react-native'
import { Button } from '../components/ui/Button'

export default function NovaTela() {
    return (
        <View className="flex-1 bg-gray-900 p-4">
            <Text className="text-white text-2xl font-bold">
                Nova Tela
            </Text>
            <Button title="Ação" onPress={() => {}} />
        </View>
    )
}
```

---

## 9. Modificar Sistema de Pontuação

### Arquivos envolvidos:
1. **Banco**: `supabase/migrations/002_consolidated_logic.sql` — função `calculate_points_with_rules()`
2. **Client**: `apps/web/src/lib/utils/points.ts` — cálculo client-side
3. **Edge Function**: `supabase/functions/calculate-points/index.ts`
4. **UI**: `apps/web/src/components/groups/GroupSettings.tsx` — config de regras
5. **Default rules**: Coluna `groups.scoring_rules` (JSONB)

### Regras atuais:
```json
{
  "exact": 10,        // Placar exato
  "winner_diff": 7,   // Vencedor + saldo correto
  "winner": 5,        // Apenas vencedor correto
  "one_score": 2      // Acertou placar de 1 time
}
```

> **IMPORTANTE**: Ao modificar a lógica, altere tanto o SQL quanto o TypeScript para manter paridade.

---

## 10. Adicionar Novo Provider de Auth

### Passos:
1. Configurar provider no **Supabase Dashboard**
2. Adicionar variáveis no `supabase/config.toml`:
```toml
[auth.external.novo_provider]
enabled = true
client_id = "env(NOVO_PROVIDER_CLIENT_ID)"
secret = "env(NOVO_PROVIDER_CLIENT_SECRET)"
redirect_uri = ""
```
3. Adicionar botão na tela de login
4. Implementar callback em `apps/web/src/app/auth/`

---

## 11. Deploy Web (Vercel)

### Passos:
1. Push para branch `main`
2. Vercel detecta automaticamente
3. Build: `next build` (dentro de `apps/web/`)
4. Verificar variáveis de ambiente no Vercel Dashboard

### vercel.json atual:
```json
{
  "buildCommand": "cd apps/web && npm run build",
  "installCommand": "cd apps/web && npm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

---

## 12. Rodar Localmente

### Web:
```powershell
cd c:\Users\paulojr\Documents\JaoBolao\J-oBol-o\apps\web
npm install
npm run dev
# Acesse http://localhost:3000
```

### Mobile:
```powershell
cd c:\Users\paulojr\Documents\JaoBolao\J-oBol-o\apps\mobile
npm install
npx expo start
# Escaneie QR code com Expo Go
```

### Supabase Local:
```powershell
cd c:\Users\paulojr\Documents\JaoBolao\J-oBol-o
npx supabase start  # Requer Docker
# Dashboard: http://localhost:54323
# API: http://localhost:54321
```

---

## 13. Debugging

### Logs de Sincronização
- **UI**: `/admin/logs` no painel admin
- **Tabela**: `sync_logs` no Supabase
- **CRON**: GitHub Actions → Workflow `Match Sync Cron`

### Debug de Autenticação
- Verificar cookies no browser DevTools
- Middleware: `apps/web/middleware.ts` faz refresh de sessão
- Supabase Auth: Dashboard → Authentication

### Debug de RLS
```sql
-- Testar como um usuário específico
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "user-uuid-here"}';
SELECT * FROM public.groups;
```

### Arquivos de Debug disponíveis:
- `src/lib/debug-events.ts`
- `src/lib/debug-events-simple.ts`
- `src/lib/debug-events-simple-v2.ts`
- `src/app/debug/` (página de debug)
