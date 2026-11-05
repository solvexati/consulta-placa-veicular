import type { PaymentMethod, UnlockReceipt } from '../../shared/vehicle.js';
import type { DataSource } from '../../shared/apiContract.js';

export type CacheKind = 'basic' | 'report';

export interface CachedEntry<T> {
  data: T;
  provider: string;
  fetchedAt: string;
}

export interface NewUnlock {
  plate: string;
  method: PaymentMethod;
  amountCents: number;
  tokenHash: string;
  transactionId: string;
}

export interface LookupLog {
  plate: string;
  kind: CacheKind;
  source: DataSource;
  ipHash: string;
}

/** Persistência do backend. Implementações: Supabase (produção) e memória (dev/fallback). */
export interface Store {
  readonly kind: 'supabase' | 'memory';
  getCached<T>(plate: string, kind: CacheKind, maxAgeMs: number): Promise<CachedEntry<T> | null>;
  setCached<T>(plate: string, kind: CacheKind, entry: CachedEntry<T>): Promise<void>;
  createUnlock(unlock: NewUnlock): Promise<UnlockReceipt>;
  /** Retorna o desbloqueio se o token pertencer àquela placa. */
  findUnlock(plate: string, tokenHash: string): Promise<UnlockReceipt | null>;
  logLookup(log: LookupLog): Promise<void>;
}
