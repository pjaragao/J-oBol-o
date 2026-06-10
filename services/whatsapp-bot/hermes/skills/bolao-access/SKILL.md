---
name: bolao-access
description: "Instruções de como consultar dados live do bolão (como rankings, jogos e palpites dos usuários) usando as ferramentas do Supabase MCP."
---

# Acesso ao Banco de Dados do JãoBolão (via MCP)

Use esta skill para traduzir perguntas sobre dados live (como ranking, palpites e jogos) em chamadas de banco de dados apropriadas usando as ferramentas MCP disponíveis do Supabase.

## Tabelas Importantes:
1. `groups`: Contém os grupos do bolão. As colunas principais são `id`, `name`, `event_id`, `whatsapp_group_jid`.
2. `group_members`: Membros de cada grupo. Colunas `group_id`, `user_id`.
3. `profiles`: Perfis com `id`, `display_name` e `nickname`.
4. `bets`: Palpites dos usuários. Colunas `user_id`, `group_id`, `match_id`, `home_score_bet`, `away_score_bet`, `points_earned`.
5. `matches`: Jogos do campeonato. Colunas `id`, `event_id`, `home_team_id`, `away_team_id`, `match_date`, `home_score`, `away_score`, `status` ('scheduled', 'live', 'finished').
6. `teams`: Dados dos times. Colunas `id`, `name`.
7. `whatsapp_links`: Mapeia JIDs do WhatsApp para `user_id` do Supabase. Colunas `user_id`, `group_id`, `whatsapp_jid`, `whatsapp_name`, `verified` (boolean).

## Como consultar:
Você pode executar consultas SQL diretamente usando as ferramentas do servidor MCP (por exemplo, `query` ou `read_rows` / `execute_sql`).

### Exemplo 1: Descobrir o ID do grupo pelo WhatsApp JID
Se você recebeu uma mensagem em um grupo com JID `120363024837298@g.us`, você pode buscar o grupo:
```sql
SELECT id, name, event_id FROM public.groups WHERE whatsapp_group_jid = '120363024837298@g.us' LIMIT 1;
```

### Exemplo 2: Classificação/Ranking do Grupo
Para montar a classificação geral de um grupo (ex: ID `group_id`):
```sql
SELECT 
  p.display_name,
  COALESCE(SUM(b.points_earned), 0) as total_points,
  COUNT(CASE WHEN b.points_earned = 10 THEN 1 END) as exact_matches,
  COUNT(CASE WHEN b.points_earned = 7 THEN 1 END) as winner_diff,
  COUNT(CASE WHEN b.points_earned = 5 THEN 1 END) as winner_only
FROM public.group_members gm
JOIN public.profiles p ON p.id = gm.user_id
LEFT JOIN public.bets b ON b.user_id = gm.user_id AND b.group_id = gm.group_id
WHERE gm.group_id = 'ID_DO_GRUPO'
GROUP BY p.id, p.display_name
ORDER BY total_points DESC, exact_matches DESC, winner_diff DESC;
```

### Exemplo 3: Jogos de Hoje
```sql
SELECT 
  t_home.name as home_team,
  t_away.name as away_team,
  m.home_score,
  m.away_score,
  m.status,
  m.match_date
FROM public.matches m
JOIN public.teams t_home ON t_home.id = m.home_team_id
JOIN public.teams t_away ON t_away.id = m.away_team_id
WHERE m.match_date::date = CURRENT_DATE
ORDER BY m.match_date ASC;
```

### Exemplo 4: Palpites de um Usuário pelo WhatsApp JID
Para descobrir o `user_id` de quem enviou a mensagem (ex: JID `5511999999999@s.whatsapp.net`):
```sql
SELECT user_id FROM public.whatsapp_links WHERE whatsapp_jid = 'JID_DO_USER' AND group_id = 'ID_DO_GRUPO' AND verified = true LIMIT 1;
```
Depois, consulte os palpites de hoje:
```sql
SELECT 
  t_home.name as home_team,
  t_away.name as away_team,
  b.home_score_bet,
  b.away_score_bet,
  b.points_earned
FROM public.matches m
JOIN public.teams t_home ON t_home.id = m.home_team_id
JOIN public.teams t_away ON t_away.id = m.away_team_id
LEFT JOIN public.bets b ON b.match_id = m.id AND b.user_id = 'USER_ID' AND b.group_id = 'ID_DO_GRUPO'
WHERE m.match_date::date = CURRENT_DATE;
```
