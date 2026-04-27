# 🏆 JãoBolão

<p align="center">
  <img src="assets/logo.png" alt="JãoBolão Logo" width="200" />
</p>

O **JãoBolão** é uma plataforma moderna e multiplataforma (Web e Mobile) para criação e gestão de bolões de futebol. Com uma interface premium e experiência fluida, o projeto oferece um sistema completo de apostas, rankings em tempo real e monetização através de assinaturas.

---

## 🚀 Tecnologias

O projeto utiliza uma stack de ponta para garantir performance e escalabilidade:

- **Frontend Web:** [Next.js 15](https://nextjs.org/) (App Router), Tailwind CSS, ShadCN UI.
- **Mobile:** [React Native](https://reactnative.dev/) com [Expo](https://expo.dev/), NativeWind (Tailwind para Native).
- **Backend (BaaS):** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Realtime, Storage).
- **Pagamentos:** [Stripe](https://stripe.com/) (Web) e [RevenueCat](https://www.revenuecat.com/) (Mobile IAP).
- **Dados Esportivos:** [Football-Data.org API](https://www.football-data.org/).
- **Gerenciamento:** [Turborepo](https://turbo.build/repo) (Monorepo).

---

## ✨ Funcionalidades

- **🔐 Autenticação Completa:** Login via Email, Social (Google/Apple) e Magic Link.
- **⚽ Gestão de Bolões:** Crie grupos privados ou públicos, defina regras de pontuação e convide amigos.
- **📊 Apostas e Rankings:** Palpites intuitivos antes dos jogos, visualização de apostas após o início e ranking automatizado.
- **💳 Sistema de Assinaturas:** Planos Free, Premium e Pro com diferentes limites e recursos.
- **🔄 Sincronização Automática:** Resultados e partidas atualizados em tempo real via Edge Functions e APIs externas.
- **📱 Multiplataforma:** Experiência consistente entre Web, iOS e Android.

---

## 📁 Estrutura do Projeto (Monorepo)

```text
/jaobolao
├── /apps
│   ├── /web                    # Aplicação Next.js 15
│   └── /mobile                 # Aplicativo Expo (React Native)
├── /packages
│   ├── /shared                 # Tipos e utilitários compartilhados
│   └── /supabase               # Cliente e configurações do banco
├── /supabase
│   ├── /migrations             # Migrações do banco de dados
│   └── /functions              # Edge Functions (Deno)
└── turbo.json                  # Configuração do Monorepo
```

---

## 🛠️ Como Começar

### Pré-requisitos
- [Node.js LTS](https://nodejs.org/) instalado.
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para desenvolvimento backend).

### Configuração Inicial

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/pjaragao/J-oBol-o.git
   cd J-oBol-o
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie arquivos `.env` nas pastas correspondentes (`apps/web`, `apps/mobile`) seguindo os exemplos ou a documentação técnica.

4. **Inicie o ambiente de desenvolvimento:**
   ```bash
   # Para rodar tudo simultaneamente
   npm run dev

   # Para rodar apenas a Web
   cd apps/web && npm run dev
   ```

---

## 📄 Documentação

Para detalhes técnicos sobre o modelo de dados, políticas de segurança (RLS) e fluxos de pagamento, consulte a [Documentação Técnica (base.md)](./base.md).

---

## ⚖️ Licença

Este projeto está sob a licença [MIT](./LICENSE). (Ou conforme preferência do autor).

---
<p align="center">Desenvolvido com ❤️ por <a href="https://github.com/pjaragao">Paulo Aragão</a></p>
