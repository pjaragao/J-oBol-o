export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type PaymentMethod = 'ONLINE' | 'OFFLINE';
export type PaymentStatus = 'PENDING' | 'PAID' | 'EXEMPT';
export type TransactionType = 'ENTRY_FEE' | 'PRIZE_PAYOUT' | 'PLATFORM_FEE_ONLINE' | 'CREATOR_ADMISSION_FEE' | 'CREATOR_UPGRADE_FEE';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'WAIVED';

export interface Database {
    public: {
        Tables: {
            groups: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    event_id: string
                    invite_code: string | null
                    is_public: boolean | null
                    max_members: number | null
                    created_by: string
                    scoring_rules: Json | null
                    requires_premium: boolean | null
                    created_at: string
                    // Financial fields
                    payment_method: PaymentMethod
                    is_paid: boolean
                    entry_fee: number
                    min_members: number
                    prize_distribution_strategy: Json | null
                    bet_lock_minutes: number
                    join_requires_approval: boolean | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    event_id: string
                    invite_code?: string | null
                    is_public?: boolean | null
                    max_members?: number | null
                    created_by: string
                    scoring_rules?: Json | null
                    requires_premium?: boolean | null
                    created_at?: string
                    payment_method?: PaymentMethod
                    is_paid?: boolean
                    entry_fee?: number
                    min_members?: number
                    prize_distribution_strategy?: Json | null
                    bet_lock_minutes?: number
                    join_requires_approval?: boolean | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    event_id?: string
                    invite_code?: string | null
                    is_public?: boolean | null
                    max_members?: number | null
                    created_by?: string
                    scoring_rules?: Json | null
                    requires_premium?: boolean | null
                    created_at?: string
                    payment_method?: PaymentMethod
                    is_paid?: boolean
                    entry_fee?: number
                    min_members?: number
                    prize_distribution_strategy?: Json | null
                    bet_lock_minutes?: number
                    join_requires_approval?: boolean | null
                }
            }
            group_members: {
                Row: {
                    id: string
                    group_id: string
                    user_id: string
                    role: 'member' | 'admin' | 'moderator'
                    joined_at: string
                    // Financial fields
                    payment_status: PaymentStatus
                    paid_at: string | null
                }
                Insert: {
                    id?: string
                    group_id: string
                    user_id: string
                    role?: 'member' | 'admin' | 'moderator'
                    joined_at?: string
                    payment_status?: PaymentStatus
                    paid_at?: string | null
                }
                Update: {
                    id?: string
                    group_id?: string
                    user_id?: string
                    role?: 'member' | 'admin' | 'moderator'
                    joined_at?: string
                    payment_status?: PaymentStatus
                    paid_at?: string | null
                }
            }
            events: {
                Row: {
                    id: string
                    name: string
                    display_name: string | null
                    is_active: boolean
                    // Financial fields
                    hosting_fee: number
                    online_fee_percent: number
                    offline_fee_per_slot: number
                    offline_base_fee: number
                }
            }
            transactions: {
                Row: {
                    id: string
                    user_id: string | null
                    group_id: string | null
                    type: TransactionType
                    amount: number
                    status: TransactionStatus
                    created_at: string
                    updated_at: string
                    metadata: Json | null
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    group_id?: string | null
                    type: TransactionType
                    amount: number
                    status?: TransactionStatus
                    created_at?: string
                    updated_at?: string
                    metadata?: Json | null
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    group_id?: string | null
                    type?: TransactionType
                    amount?: number
                    status?: TransactionStatus
                    created_at?: string
                    updated_at?: string
                    metadata?: Json | null
                }
            }
            pending_members: {
                Row: {
                    id: string
                    group_id: string
                    user_id: string
                    status: 'pending' | 'approved' | 'rejected'
                    requested_at: string
                    reviewed_at: string | null
                    reviewed_by: string | null
                }
                Insert: {
                    id?: string
                    group_id: string
                    user_id: string
                    status?: 'pending' | 'approved' | 'rejected'
                    requested_at?: string
                    reviewed_at?: string | null
                    reviewed_by?: string | null
                }
                Update: {
                    id?: string
                    group_id?: string
                    user_id?: string
                    status?: 'pending' | 'approved' | 'rejected'
                    requested_at?: string
                    reviewed_at?: string | null
                    reviewed_by?: string | null
                }
            }
        }
    }
}
