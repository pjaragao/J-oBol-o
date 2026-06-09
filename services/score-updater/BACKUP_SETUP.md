# Configuração da Rotina de Backup no WSL/Homelab

Este guia orienta como configurar e automatizar a execução do script `backup.sh` diariamente no seu ambiente WSL (Windows Subsystem for Linux) ou no seu servidor homelab.

## Passo 1: Configurar as Credenciais

Se você ainda não possui um arquivo `.env` configurado na pasta do `score-updater`, faça uma cópia do arquivo `.env.example`:

```bash
cp .env.example .env
```

Abra o arquivo `.env` e preencha as variáveis de ambiente, garantindo que a senha mestra esteja configurada no novo campo:

```env
SUPABASE_DB_PASSWORD=sua_senha_mestra_aqui
```

## Passo 2: Dar permissão de execução ao script

No seu terminal Linux/WSL, navegue até a pasta do script e dê a permissão de execução:

```bash
chmod +x backup.sh
```

Você pode testar a execução manual rodando:

```bash
./backup.sh
```

Os backups gerados serão salvos em formato compactado (`.sql.gz`) dentro da pasta `./backups/` e os logs de execução em `./backup.log`. O script mantém apenas os últimos 7 dias de backups para evitar o consumo desnecessário de disco.

## Passo 3: Configurar no Cron do WSL/Linux

Para automatizar a execução diária do backup, utilize o utilitário `cron` do Linux:

1. Abra o editor de tarefas do cron rodando o comando:
   ```bash
   crontab -e
   ```

2. Escolha o seu editor de texto de preferência (ex: nano) e adicione a seguinte linha ao final do arquivo para rodar o backup todos os dias às **02:00 da manhã** (ajuste o caminho absoluto de acordo com seu ambiente):
   ```cron
   0 2 * * * /caminho/completo/para/J-oBol-o/services/score-updater/backup.sh >/dev/null 2>&1
   ```
   *Exemplo prático no WSL:*
   Se a pasta do seu projeto estiver em `/home/usuario/JaoBolao/J-oBol-o/services/score-updater`, a linha será:
   ```cron
   0 2 * * * /home/usuario/JaoBolao/J-oBol-o/services/score-updater/backup.sh >/dev/null 2>&1
   ```

3. Salve e saia do editor. O cron confirmará que a nova tarefa foi instalada.

*Dica para WSL:* Caso o serviço cron não inicie automaticamente no WSL após reiniciar a máquina, você pode iniciá-lo rodando `sudo service cron start`.
