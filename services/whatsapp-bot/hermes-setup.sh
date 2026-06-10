#!/bin/bash
# Script de configuração do Hermes Agent para o NeyBot
# Execute este script dentro do ambiente WSL (onde o Hermes Agent está instalado)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0;0m' # Sem cor

echo -e "${GREEN}=== Configuração do NeyBot no Hermes Agent ===${NC}"

# 1. Verificar se o Hermes CLI está disponível
if ! command -v hermes &> /dev/null; then
    echo -e "${RED}Erro: O executável 'hermes' não foi encontrado no PATH.${NC}"
    echo "Certifique-se de que o Hermes Agent está instalado e configurado corretamente."
    exit 1
fi

HERMES_VERSION=$(hermes --version 2>/dev/null || echo "v0.13.0")
echo -e "Hermes detectado: ${GREEN}${HERMES_VERSION}${NC}"

# 2. Criar o profile se não existir
echo -e "\n${YELLOW}[1/4] Gerenciando profile 'neybot'...${NC}"
if hermes profile list 2>/dev/null | grep -q "neybot"; then
    echo "Profile 'neybot' já existe."
else
    echo "Criando novo profile 'neybot'..."
    hermes profile create neybot
fi

# 3. Definir caminhos do profile
# Por padrão, no Hermes v0.13.0, os perfis ficam em ~/.hermes/profiles/<nome>
PROFILE_DIR="$HOME/.hermes/profiles/neybot"
mkdir -p "$PROFILE_DIR/skills/copas-history/references"
mkdir -p "$PROFILE_DIR/skills/bolao-rules"
mkdir -p "$PROFILE_DIR/skills/bolao-access"

# 4. Copiar arquivos de configuração
echo -e "\n${YELLOW}[2/4] Copiando arquivos de configuração...${NC}"
if [ -f "hermes/config.yaml" ]; then
    cp hermes/config.yaml "$PROFILE_DIR/config.yaml"
    echo "config.yaml copiado para $PROFILE_DIR/config.yaml"
else
    echo -e "${RED}Erro: Arquivo hermes/config.yaml não encontrado no diretório atual.${NC}"
    exit 1
fi

# 5. Copiar Skills e bases markdown
echo -e "\n${YELLOW}[3/4] Instalando Skills e referências históricas...${NC}"

# Copiar copas-history
cp hermes/skills/copas-history/SKILL.md "$PROFILE_DIR/skills/copas-history/SKILL.md"
cp -r hermes/skills/copas-history/references/*.md "$PROFILE_DIR/skills/copas-history/references/"

# Copiar bolao-rules e bolao-access
cp hermes/skills/bolao-rules/SKILL.md "$PROFILE_DIR/skills/bolao-rules/SKILL.md"
cp hermes/skills/bolao-access/SKILL.md "$PROFILE_DIR/skills/bolao-access/SKILL.md"

echo -e "${GREEN}Skills copiadas com sucesso!${NC}"

# 6. Preparar o .env do profile
echo -e "\n${YELLOW}[4/4] Preparando variáveis de ambiente do profile...${NC}"
PROFILE_ENV="$PROFILE_DIR/.env"
if [ -f "$PROFILE_ENV" ]; then
    echo "Arquivo .env já existe no profile. Não sobrescrevendo para proteger suas chaves."
else
    echo "Criando arquivo .env padrão em $PROFILE_ENV..."
    cat <<EOT > "$PROFILE_ENV"
# Configuração de chaves do profile NeyBot
GEMINI_API_KEY=sua-chave-gemini-aqui
NEYBOT_DB_CONNECTION_STRING=postgresql://neybot_reader:SenhaAqui@db.xxx.supabase.co:5432/postgres
HERMES_WEBHOOK_SECRET=segredo-webhook-da-bridge-aqui
EOT
    echo -e "${YELLOW}Aviso: Edite o arquivo $PROFILE_ENV com as suas credenciais!${NC}"
fi

echo -e "\n${GREEN}=== CONFIGURAÇÃO CONCLUÍDA COM SUCESSO! ===${NC}"
echo -e "Passos seguintes:"
echo -e "1. Acesse o profile: ${YELLOW}cd $PROFILE_DIR${NC}"
echo -e "2. Edite o arquivo ${YELLOW}.env${NC} com suas chaves de API."
echo -e "3. Inicie o gateway do NeyBot: ${YELLOW}neybot gateway start${NC}"
echo -e "   (Ou use o comando padrão do Hermes: ${YELLOW}hermes --profile neybot gateway start${NC})"
