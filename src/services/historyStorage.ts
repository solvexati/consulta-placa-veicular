import type { HistoryEntry, UnlockReceipt, VehicleBasic } from '../types/vehicle';

const HISTORY_KEY = 'cpv:history:v1';
const UNLOCKS_KEY = 'cpv:unlocks:v1';
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

export function getUnlocks(): Record<string, UnlockReceipt> {
  return read<Record<string, UnlockReceipt>>(UNLOCKS_KEY, {});
}

export function isUnlocked(plate: string): boolean {
  return Boolean(getUnlocks()[plate]);
}

export function getReceipt(plate: string): UnlockReceipt | null {
  return getUnlocks()[plate] ?? null;
}

export function saveUnlock(receipt: UnlockReceipt): void {
  const unlocks = getUnlocks();
  unlocks[receipt.plate] = receipt;
  write(UNLOCKS_KEY, unlocks);
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
  return [];
}
