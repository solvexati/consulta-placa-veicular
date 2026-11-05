import type { AdvancedReport, HistoryEntry, UnlockReceipt, VehicleBasic } from '../../shared/vehicle';

/** Desbloqueio guardado no aparelho: recibo + token de acesso ao laudo no backend. */
export type StoredUnlock = UnlockReceipt & { accessToken: string };

/**
 * Consulta salva no aparelho. Enquanto estiver dentro da validade, uma nova
 * busca pela mesma placa é respondida daqui, sem nenhuma requisição ao servidor.
 */
export interface CachedRecord {
  basic: VehicleBasic;
  /** Laudo pago: depois de baixado, nunca é consultado de novo automaticamente. */
  advanced: AdvancedReport | null;
  /** Quando os dados básicos vieram do servidor (ISO). */
  savedAt: string;
}

/** Validade dos dados básicos no aparelho. Depois disso, a próxima busca vai ao servidor. */
export const CLIENT_CACHE_DAYS = 7;

export function isRecordFresh(record: CachedRecord): boolean {
  const age = Date.now() - new Date(record.savedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < CLIENT_CACHE_DAYS * 24 * 60 * 60 * 1000;
}

const HISTORY_KEY = 'cpv:history:v1';
// v2: desbloqueios passaram a ter token emitido pelo backend (v1 era só local)
const UNLOCKS_KEY = 'cpv:unlocks:v2';
const RECORDS_KEY = 'cpv:records:v1';
const MAX_RECORDS = 30;
const MAX_HISTORY = 50;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível (modo privado / cota cheia) */
  }
}

// ---------- Desbloqueios (laudos pagos) ----------

export function getUnlocks(): Record<string, StoredUnlock> {
  return read<Record<string, StoredUnlock>>(UNLOCKS_KEY, {});
}

export function isUnlocked(plate: string): boolean {
  return Boolean(getUnlocks()[plate]);
}

export function getReceipt(plate: string): StoredUnlock | null {
  return getUnlocks()[plate] ?? null;
}

export function saveUnlock(receipt: StoredUnlock): void {
  const unlocks = getUnlocks();
  unlocks[receipt.plate] = receipt;
  write(UNLOCKS_KEY, unlocks);
}

// ---------- Cache local das consultas (evita repetir requisições) ----------

export function getCachedRecord(plate: string): CachedRecord | null {
  return read<Record<string, CachedRecord>>(RECORDS_KEY, {})[plate] ?? null;
}

export function cacheRecord(plate: string, record: CachedRecord): void {
  const all = read<Record<string, CachedRecord>>(RECORDS_KEY, {});
  delete all[plate];
  const entries = [[plate, record] as const, ...Object.entries(all)].slice(0, MAX_RECORDS);
  write(RECORDS_KEY, Object.fromEntries(entries));
}

// ---------- Histórico de pesquisas ----------

export function getHistory(): HistoryEntry[] {
  const unlocks = getUnlocks();
  return read<HistoryEntry[]>(HISTORY_KEY, []).map((h) => ({ ...h, unlocked: Boolean(unlocks[h.plate]) }));
}

export function addToHistory(basic: VehicleBasic): HistoryEntry[] {
  const entry: HistoryEntry = {
    plate: basic.plate,
    brand: basic.brand,
    model: basic.model,
    yearModel: basic.yearModel,
    fipeValue: basic.fipeValue,
    searchedAt: new Date().toISOString(),
    unlocked: isUnlocked(basic.plate),
  };
  const next = [entry, ...getHistory().filter((h) => h.plate !== basic.plate)].slice(0, MAX_HISTORY);
  write(HISTORY_KEY, next);
  return next;
}

export function removeFromHistory(plate: string): HistoryEntry[] {
  const next = getHistory().filter((h) => h.plate !== plate);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  write(HISTORY_KEY, []);
  write(RECORDS_KEY, {});
  return [];
}

/** Remove um desbloqueio local (ex.: token recusado pelo backend). */
export function removeUnlock(plate: string): void {
  const unlocks = getUnlocks();
  delete unlocks[plate];
  write(UNLOCKS_KEY, unlocks);
}
