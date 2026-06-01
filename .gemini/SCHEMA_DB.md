# 🗃️ Schema do Banco de Dados — JãoBolão

> Referência rápida do modelo de dados PostgreSQL no Supabase.

---

## 📊 Diagrama ER

```
                                    ┌──────────────────┐
                                    │   auth.users     │
                                    │   (Supabase)     │
                                    └────────┬─────────┘
                                             │ 1:1
                                    ┌────────▼─────────┐
                         ┌──────────│    profiles       │──────────┐
                         │          │                   │          │
                         │          └─┬───────────┬───┘          │
                         │            │           │              │
                    1:N  │       1:N  │      1:N  │         1:N  │
              ┌──────────▼──┐  ┌─────▼────┐  ┌───▼──────┐  ┌───▼────────────┐
              │subscriptions│  │  bets    │  │ notifi-  │  │ group_members  │
              └─────────────┘  └────┬─────┘  │ cations  │  └───┬──────┬─────┘
                                    │        └──────────┘      │      │
                               N:1  │                     N:1  │      │ N:1
                              ┌─────▼────┐              ┌──────▼──┐   │
                              │ matches  │              │ groups  │◄──┘
                              └────┬─────┘              └────┬────┘
                              N:1  │                    N:1   │
                              ┌────▼─────┐              ┌────▼────┐
                              │  events  │              │ events  │
                              └──────────┘              └─────────┘
                              
                              ┌──────────┐
     matches.home_team_id ──► │  teams   │ ◄── matches.away_team_id
     profiles.favorite_team ► │          │
                              └──────────┘
```

---

## 📋 Tabelas Detalhadas

### `profiles` (extends auth.users)
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | FK auth.users | PK |
| `email` | TEXT | ❌ | — | Email do usuário |
| `display_name` | TEXT | ✅ | — | Nome de exibição |
| `nickname` | TEXT | ✅ | — | Apelido |
| `avatar_url` | TEXT | ✅ | — | URL do avatar |
| `favorite_team_id` | UUID | ✅ | FK teams | Time favorito |
| `is_admin` | BOOLEAN | ❌ | false | É admin? |
| `is_super_admin` | BOOLEAN | ❌ | false | Super admin? |
| `notification_settings` | JSONB | ❌ | `{...}` | Config notificações |
| `subscription_tier` | TEXT | ❌ | 'free' | free/premium/pro |
| `subscription_status` | TEXT | ❌ | 'inactive' | active/inactive/canceled/past_due |
| `full_name` | TEXT | ✅ | — | Nome completo |
| `cpf` | TEXT | ✅ | — | CPF |
| `cep` | TEXT | ✅ | — | CEP |
| `address_*` | TEXT | ✅ | — | Campos de endereço |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |
| `updated_at` | TIMESTAMPTZ | ❌ | NOW() | Auto-updated |

### `teams`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `name` | TEXT | ❌ | — | Nome do time |
| `short_name` | TEXT | ✅ | — | Abreviação |
| `tla` | TEXT | ✅ | — | Three-letter acronym |
| `logo_url` | TEXT | ✅ | — | URL do escudo |
| `api_id` | INTEGER | ✅ | UNIQUE | ID na API externa |
| `country` | TEXT | ✅ | — | País |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |

### `events` (Torneios/Competições)
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `name` | TEXT | ❌ | — | Nome técnico |
| `display_name` | TEXT | ✅ | — | Nome exibido |
| `description` | TEXT | ✅ | — | Descrição |
| `season` | INTEGER | ✅ | — | Temporada |
| `start_date` | DATE | ✅ | — | Início |
| `end_date` | DATE | ✅ | — | Fim |
| `api_id` | INTEGER | ✅ | UNIQUE | ID na API |
| `logo_url` | TEXT | ✅ | — | Logo |
| `is_active` | BOOLEAN | ❌ | true | Ativo? |
| `current_matchday` | INTEGER | ✅ | — | Rodada atual |
| `hosting_fee` | DECIMAL(10,2) | ❌ | 0.00 | Taxa hospedagem |
| `online_fee_percent` | DECIMAL(5,2) | ❌ | 10.0 | % taxa online |
| `offline_fee_per_slot` | DECIMAL(10,2) | ❌ | 0.00 | Taxa offline/vaga |
| `offline_base_fee` | DECIMAL(10,2) | ❌ | 0.00 | Taxa base offline |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |

### `matches` (Partidas)
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `event_id` | UUID | ❌ | FK events | Torneio |
| `home_team_id` | UUID | ❌ | FK teams | Time casa |
| `away_team_id` | UUID | ❌ | FK teams | Time visitante |
| `match_date` | TIMESTAMPTZ | ❌ | — | Data/hora |
| `home_score` | INTEGER | ✅ | — | Gols casa |
| `away_score` | INTEGER | ✅ | — | Gols visitante |
| `score_detailed` | JSONB | ✅ | — | Placar detalhado |
| `status` | TEXT | ❌ | 'scheduled' | Status* |
| `api_id` | INTEGER | ✅ | UNIQUE | ID na API |
| `round` | TEXT | ✅ | — | Rodada |
| `group_name` | TEXT | ✅ | — | Grupo (fase grupos) |
| `venue` | TEXT | ✅ | — | Estádio |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |
| `updated_at` | TIMESTAMPTZ | ❌ | NOW() | Auto-updated |

**Status possíveis***: `scheduled`, `live`, `finished`, `postponed`, `cancelled`, `FT`, `AET`, `PEN`, `TIMED`, `IN_PLAY`, `PAUSED`, `SUSPENDED`

### `groups` (Bolões)
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `name` | TEXT | ❌ | — | Nome |
| `description` | TEXT | ✅ | — | Descrição |
| `event_id` | UUID | ❌ | FK events | Torneio vinculado |
| `invite_code` | TEXT | ✅ | UNIQUE, auto 8 chars | Código de convite |
| `is_public` | BOOLEAN | ❌ | false | Público? |
| `max_members` | INTEGER | ❌ | 50 | Máx membros |
| `created_by` | UUID | ❌ | FK profiles | Criador |
| `scoring_rules` | JSONB | ❌ | `{exact:10,...}` | Regras de pontuação |
| `requires_premium` | BOOLEAN | ❌ | false | Requer assinatura? |
| `allow_member_invites` | BOOLEAN | ❌ | false | Membros convidam? |
| `join_requires_approval` | BOOLEAN | ❌ | false | Entrada aprovada? |
| `is_finished` | BOOLEAN | ❌ | false | Bolão encerrado? |
| `finished_at` | TIMESTAMPTZ | ✅ | — | Data encerramento |
| `payment_method` | ENUM | ❌ | 'ONLINE' | ONLINE/OFFLINE |
| `is_paid` | BOOLEAN | ❌ | false | É pago? |
| `entry_fee` | DECIMAL(10,2) | ❌ | 0 | Taxa de entrada |
| `min_members` | INTEGER | ❌ | 5 | Mínimo membros |
| `prize_distribution_strategy` | JSONB | ❌ | `{mode: "WINNER_TAKES_ALL"}` | Premiação |
| `bet_lock_minutes` | INTEGER | ❌ | 5 | Lock antes do jogo |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |

### `group_members`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `group_id` | UUID | ❌ | FK groups | Grupo |
| `user_id` | UUID | ❌ | FK profiles | Membro |
| `role` | TEXT | ❌ | 'member' | admin/moderator/member |
| `payment_status` | ENUM | ❌ | 'PENDING' | PENDING/PAID/EXEMPT |
| `paid_at` | TIMESTAMPTZ | ✅ | — | Data pagamento |
| `joined_at` | TIMESTAMPTZ | ❌ | NOW() | — |

UNIQUE: (group_id, user_id)

### `bets` (Apostas)
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `user_id` | UUID | ❌ | FK profiles | Apostador |
| `group_id` | UUID | ❌ | FK groups | Grupo |
| `match_id` | UUID | ❌ | FK matches | Partida |
| `home_score_bet` | INTEGER | ❌ | — | Palpite casa (≥0) |
| `away_score_bet` | INTEGER | ❌ | — | Palpite visitante (≥0) |
| `points` | INTEGER | ❌ | 0 | Pontos ganhos |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |
| `updated_at` | TIMESTAMPTZ | ❌ | NOW() | Auto-updated |

UNIQUE: (user_id, group_id, match_id)

### `pending_members`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `group_id` | UUID | ❌ | FK groups | Grupo |
| `user_id` | UUID | ❌ | FK profiles | Solicitante |
| `status` | TEXT | ❌ | 'pending' | pending/approved/rejected |
| `requested_at` | TIMESTAMPTZ | ❌ | NOW() | — |
| `reviewed_at` | TIMESTAMPTZ | ✅ | — | — |
| `reviewed_by` | UUID | ✅ | FK profiles | Admin revisor |

### `group_invitations`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `group_id` | UUID | ❌ | FK groups | Grupo |
| `invited_email` | TEXT | ❌ | — | Email convidado |
| `invited_user_id` | UUID | ✅ | FK profiles | ID se já cadastrado |
| `invited_by` | UUID | ❌ | FK profiles | Quem convidou |
| `status` | TEXT | ❌ | 'pending' | pending/accepted/expired/cancelled |
| `invite_token` | TEXT | ✅ | UNIQUE, auto hex | Token único |
| `expires_at` | TIMESTAMPTZ | ❌ | NOW() + 7 days | Expiração |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |
| `accepted_at` | TIMESTAMPTZ | ✅ | — | — |

### `transactions`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `user_id` | UUID | ✅ | FK profiles | Usuário |
| `group_id` | UUID | ✅ | FK groups | Grupo |
| `type` | ENUM | ❌ | — | Tipo transação |
| `amount` | DECIMAL(10,2) | ❌ | — | Valor |
| `status` | ENUM | ❌ | 'PENDING' | Status |
| `metadata` | JSONB | ✅ | — | Dados extras |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |
| `updated_at` | TIMESTAMPTZ | ❌ | NOW() | Auto-updated |

### `notifications`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `user_id` | UUID | ❌ | FK profiles | Destinatário |
| `title` | TEXT | ❌ | — | Título |
| `message` | TEXT | ✅ | — | Mensagem |
| `type` | TEXT | ✅ | — | Tipo (info, success, etc) |
| `data` | JSONB | ❌ | `{}` | Dados extras |
| `is_read` | BOOLEAN | ❌ | false | Lida? |
| `created_at` | TIMESTAMPTZ | ❌ | NOW() | — |

### `sync_logs`
| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | gen_random_uuid() | PK |
| `started_at` | TIMESTAMPTZ | ❌ | NOW() | Início |
| `reosurce_type` | TEXT | ❌ | — | Tipo recurso (TYPO intencional) |
| `details` | JSONB | ✅ | — | Detalhes |
| `status` | TEXT | ❌ | — | Status |
| `error_message` | TEXT | ✅ | — | Erro |
| `created_by` | UUID | ✅ | FK auth.users | Quem executou |

---

## 📐 Views

### `rankings`
Ranking global de apostadores com total de bets, pontos e acertos exatos.

### `group_rankings`
Ranking por grupo — mesma lógica mas filtrado pelo evento do grupo.

---

## 🔗 Indexes
```sql
idx_profiles_subscription    → profiles(subscription_tier, subscription_status)
idx_matches_event           → matches(event_id)
idx_matches_date            → matches(match_date)
idx_bets_composite          → bets(group_id, match_id)
idx_group_members_group     → group_members(group_id)
idx_transactions_group      → transactions(group_id)
idx_notifications_user      → notifications(user_id)
```
