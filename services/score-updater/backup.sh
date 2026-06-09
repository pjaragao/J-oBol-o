#!/bin/bash
# Script de backup do banco de dados JaoBolao via Docker (pg_dump)

# Obtém o diretório onde o script está localizado
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Garante que as variáveis do .env do score-updater estão carregadas
if [ -f "$SCRIPT_DIR/.env" ]; then
    # Carrega as variáveis exportando-as, ignorando comentários
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Configurações do Banco
DB_PASSWORD="${SUPABASE_DB_PASSWORD}"
PROJECT_REF="hbmtkaeymmvpjfarjpij"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Verifica se a senha foi configurada
if [ -z "$DB_PASSWORD" ]; then
    echo "$(date): Erro - SUPABASE_DB_PASSWORD não está definida no arquivo .env." >> "$SCRIPT_DIR/backup.log"
    echo "Erro: SUPABASE_DB_PASSWORD não está definida no arquivo .env."
    exit 1
fi

# Cria a pasta de backups se ela não existir
mkdir -p "$BACKUP_DIR"

DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/backup_${DATE}.sql"

echo "Iniciando backup do Supabase [${PROJECT_REF}]..."

# Executa pg_dump usando o container postgres:15-alpine para garantir compatibilidade
docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  postgres:15-alpine \
  pg_dump -h "db.${PROJECT_REF}.supabase.co" -U "postgres" -p 5432 -d "postgres" -F p > "$FILENAME"

if [ $? -eq 0 ] && [ -s "$FILENAME" ]; then
    # Compacta o arquivo SQL usando gzip
    gzip -f "$FILENAME"
    echo "$(date): Backup concluído com sucesso: ${FILENAME}.gz" >> "$SCRIPT_DIR/backup.log"
    echo "Backup concluído com sucesso: ${FILENAME}.gz"
    
    # Mantém apenas os backups dos últimos 7 dias para não encher o disco
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +7 -delete
    echo "Limpeza de backups antigos concluída."
else
    echo "$(date): Erro ao realizar o backup do banco de dados." >> "$SCRIPT_DIR/backup.log"
    echo "Erro ao realizar o backup do banco de dados."
    rm -f "$FILENAME"
    exit 1
fi
