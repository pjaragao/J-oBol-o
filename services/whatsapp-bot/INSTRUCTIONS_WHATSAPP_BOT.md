# Instruções para Implementação do Ranking no Bot do WhatsApp (e Hermes)

A lógica de cálculo do ranking geral (com pontos definitivos) e parcial (com pontos ao vivo/live) foi migrada com sucesso para o banco de dados. Agora, em vez de buscar todos os membros e todos os palpites para calcular os pontos na aplicação, deve-se chamar a função RPC **`get_group_ranking`** diretamente.

---

## 1. A Função RPC do Supabase (`get_group_ranking`)

A função está instalada no schema público do Supabase e aceita o parâmetro `p_group_id` (UUID). Ela retorna uma tabela ordenada pelas regras de desempate oficiais do bolão.

### Estrutura de Retorno (Colunas):
*   `user_id` (UUID): ID do usuário do palpite.
*   `display_name` (TEXT): Nome de exibição do participante.
*   `avatar_url` (TEXT): URL do avatar do participante (se houver).
*   `total_points` (INTEGER): Soma de pontos consolidados (jogos finalizados) + pontos live (jogos em andamento).
*   `live_points` (INTEGER): Apenas os pontos parciais provenientes de jogos atualmente ao vivo.
*   `exact_scores` (INTEGER): Quantidade de placares exatos acertados (Cravadas - 10 pontos).
*   `winner_diff_scores` (INTEGER): Quantidade de acertos de vencedor + diferença de gols (7 pontos).
*   `winner_scores` (INTEGER): Quantidade de acertos apenas do vencedor (5 pontos).
*   `consolation_scores` (INTEGER): Quantidade de acertos de apenas um placar de time (Consolação - 2 pontos).

---

## 2. Como Utilizar no Bot do WhatsApp (`services/whatsapp-bot`)

No código TypeScript do bot, em `src/supabase/queries.ts`, atualize o método `getGroupRanking` para realizar uma chamada simples à RPC do Supabase:

```typescript
export async function getGroupRanking(groupId: string, eventId: string, userJid?: string): Promise<LeaderboardUser[]> {
  // 1. Chamar a RPC do Supabase
  const { data, error } = await supabase
    .rpc('get_group_ranking', { p_group_id: groupId });

  if (error || !data) {
    logger.error('Error fetching group ranking from RPC', { error: error?.message });
    return [];
  }

  // 2. Mapear os JIDs para identificar o remetente atual ("Você")
  const { data: linkedJids } = await supabase
    .from('whatsapp_links')
    .select('user_id, whatsapp_jid')
    .eq('group_id', groupId)
    .eq('verified', true);

  const jidToUserMap = new Map<string, string>();
  linkedJids?.forEach(lk => jidToUserMap.set(lk.whatsapp_jid, lk.user_id));
  const currentUserId = userJid ? jidToUserMap.get(userJid) : undefined;

  // 3. Retornar os itens formatados
  return data.map((item: any, index: number) => ({
    rank: index + 1,
    displayName: item.display_name || 'Participante',
    totalPoints: item.total_points,
    livePoints: item.live_points,
    exact: item.exact_scores,
    winnerDiff: item.winner_diff_scores,
    winner: item.winner_scores,
    consolation: item.consolation_scores,
    isMe: item.user_id === currentUserId,
  }));
}
```

Isso remove completamente a necessidade de buscar todas as partidas e todos os palpites do grupo no bot, tornando o comando `!ranking` instantâneo e super leve.

---

## 3. Como Utilizar no Agente Hermes (MCP)

No arquivo de regras do Hermes ([SKILL.md](file:///c:/Users/paulojr/Documents/JaoBolao/J-oBol-o/services/whatsapp-bot/hermes/skills/bolao-access/SKILL.md)), a instrução para buscar o ranking deve ser simplificada para uma consulta SQL direta na RPC:

```sql
SELECT * FROM public.get_group_ranking('ID_DO_GRUPO');
```

O Hermes não precisa mais realizar `JOIN` complexos ou agrupamentos manuais de palpites no banco para obter as estatísticas ou somas de pontos parciais/live.
