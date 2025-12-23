# Guia de Configuração do Ambiente - JãoBolão

O comando `npm` falhou porque o **Node.js** não está instalado no seu computador ou não está configurado corretamente. Siga os passos abaixo para resolver:

## 1. Instalar Node.js

Para rodar a aplicação Web (Next.js) e futuramente a Mobile (Expo), você precisa do Node.js.

1. Acesse o site oficial: [https://nodejs.org/](https://nodejs.org/)
2. Baixe a versão **LTS** (Recommended for Most Users).
3. Instale o arquivo baixado.
   - **Importante**: Durante a instalação, certifique-se de manter marcada a opção **"Add to PATH"**.

## 2. Verificar Instalação

Após instalar, abra um **novo terminal** (feche o atual e abra outro) e rode:

```powershell
node -v
npm -v
```

Se aparecerem números de versão (ex: `v20.10.0`), está tudo certo.

## 3. Instalar Dependências do Projeto

Agora você pode instalar as dependências do painel web que eu criei:

1. Navegue até a pasta do projeto web:
   ```powershell
   cd apps/web
   ```

2. Instale as dependências:
   ```powershell
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```powershell
   npm run dev
   ```

Acesse `http://localhost:3000` no seu navegador.
