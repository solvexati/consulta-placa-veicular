import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PaymentMethod, UnlockReceipt } from '../../shared/vehicle.js';
import type { CachedEntry, Store } from './types.js';

interface UnlockRow {
  plate: string;
  method: PaymentMethod;
  amount_cents: number;
  transaction_id: string;
  created_at: string;
}

const toReceipt = (r: UnlockRow): UnlockReceipt => ({
  plate: r.plate,
  method: r.method,
  amount: r.amount_cents / 100,
  transactionId: r.transaction_id,
  paidAt: r.created_at,
});

/**
 * Armazenamento no Supabase (Postgres). Usa a chave `service_role`, que só
 * existe no servidor — as tabelas têm RLS ativo e nenhuma policy pública,
 * então o app (navegador) não consegue lê-las diretamente.
 * Esquema: supabase/migrations/0001_backend_schema.sql
 */
export function createSupabaseStore(url: string, serviceRoleKey: string): Store {
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    kind: 'supabase',

    async getCached<T>(plate: string, kind: 'basic' | 'report', maxAgeMs: number) {
      const minDate = new Date(Date.now() - maxAgeMs).toISOString();
      const { data, error } = await db
        .from('vehicle_cache')
        .select('data, provider, fetched_at')
        .eq('plate', plate)
        .eq('kind', kind)
        .gte('fetched_at', minDate)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ data: data.data as T, provider: data.provider, fetchedAt: data.fetched_at } satisfies CachedEntry<T>) : null;
    },

    async setCached(plate, kind, entry) {
      const { error } = await db.from('vehicle_cache').upsert(
        { plate, kind, data: entry.data, provider: entry.provider, fetched_at: entry.fetchedAt },
        { onConflict: 'plate,kind' },
      );
      if (error) throw error;
    },

    async createUnlock(u) {
      const { data, error } = await db
        .from('unlocks')
        .insert({
          plate: u.plate,
          method: u.method,
          amount_cents: u.amountCents,
          token_hash: u.tokenHash,
          transaction_id: u.transactionId,
          status: 'paid',
        })
        .select('plate, method, amount_cents, transaction_id, created_at')
        .single();
      if (error) throw error;
      return toReceipt(data as UnlockRow);
    },

    async findUnlock(plate, tokenHash) {
      const { data, error } = await db
        .from('unlocks')
        .select('plate, method, amount_cents, transaction_id, created_at')
        .eq('token_hash', tokenHash)
        .eq('plate', plate)
        .eq('status', 'paid')
        .maybeSingle();
      if (error) throw error;
      return data ? toReceipt(data as UnlockRow) : null;
    },

    async acquireFetchLock(plate, kind, ttlSeconds) {
      const { data, error } = await db.rpc('try_acquire_fetch_lock', { p_plate: plate, p_kind: kind, p_ttl_seconds: ttlSeconds });
      if (error) {
        // Sem trava, o pior caso é uma chamada duplicada à API — não bloqueia o usuário
        console.warn('[store] falha ao obter trava', error.message);
        return true;
      }
      return data === true;
    },

    async releaseFetchLock(plate, kind) {
      const { error } = await db.rpc('release_fetch_lock', { p_plate: plate, p_kind: kind });
      if (error) console.warn('[store] falha ao liberar trava', error.message);
    },

    async logLookup(log) {
      const { error } = await db
        .from('lookup_logs')
        .insert({ plate: log.plate, kind: log.kind, source: log.source, provider: log.provider, ip_hash: log.ipHash });
      if (error) console.warn('[store] falha ao gravar log de consulta', error.message);
    },
  };
}
