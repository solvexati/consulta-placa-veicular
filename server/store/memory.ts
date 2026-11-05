import type { UnlockReceipt } from '../../shared/vehicle.js';
import type { CacheKind, CachedEntry, Store } from './types.js';

/**
 * Armazenamento em memória. Na Vercel cada rota é uma função separada, então
 * este cache/registro NÃO é compartilhado entre rotas — o acesso ao laudo é
 * garantido pelo token assinado (server/accessToken.ts). Usado quando o Supabase não está configurado.
 * ATENÇÃO: os dados somem quando a instância reinicia — serve só para
 * desenvolvimento e demonstração.
 */
export function createMemoryStore(): Store {
  const cache = new Map<string, CachedEntry<unknown>>();
  const unlocks = new Map<string, UnlockReceipt & { plate: string }>();
  const locks = new Map<string, number>(); // chave → expira em (ms)

  return {
    kind: 'memory',

    async acquireFetchLock(plate, kind, ttlSeconds) {
      const key = `${kind}:${plate}`;
      const until = locks.get(key);
      if (until && until > Date.now()) return false;
      locks.set(key, Date.now() + ttlSeconds * 1000);
      return true;
    },

    async releaseFetchLock(plate, kind) {
      locks.delete(`${kind}:${plate}`);
    },

    async getCached<T>(plate: string, kind: CacheKind, maxAgeMs: number) {
      const entry = cache.get(`${kind}:${plate}`);
      if (!entry || Date.now() - new Date(entry.fetchedAt).getTime() > maxAgeMs) return null;
      return entry as CachedEntry<T>;
    },

    async setCached(plate, kind, entry) {
      cache.set(`${kind}:${plate}`, entry);
    },

    async createUnlock(u) {
      const receipt: UnlockReceipt = {
        plate: u.plate,
        method: u.method,
        amount: u.amountCents / 100,
        transactionId: u.transactionId,
        paidAt: new Date().toISOString(),
      };
      unlocks.set(u.tokenHash, receipt);
      return receipt;
    },

    async findUnlock(plate, tokenHash) {
      const found = unlocks.get(tokenHash);
      return found && found.plate === plate ? found : null;
    },

    async logLookup() {
      /* sem persistência de logs em memória */
    },
  };
}
