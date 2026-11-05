import type { DataSource } from '../shared/apiContract.js';
import type { AdvancedReport, VehicleBasic } from '../shared/vehicle.js';
import { getEnv } from './env.js';
import { HttpError } from './http.js';
import { getProvider } from './providers/index.js';
import { validateBasic, validateReport } from './providers/validate.js';
import type { VehicleProvider } from './providers/types.js';
import { getStore } from './store/index.js';
import type { CacheKind, CachedEntry, Store } from './store/types.js';

/**
 * ÚNICO ponto do backend que chama a API paga. Regras, em ordem:
 *  1. Cache do servidor (Supabase), compartilhado entre TODOS os usuários.
 *  2. Trava por placa: se outra requisição já está consultando a mesma placa,
 *     espera o resultado dela entrar no cache em vez de chamar a API de novo.
 *  3. Chama a API (via adaptador). Se a API devolve tudo numa chamada ('full'),
 *     grava básico + laudo juntos — o laudo depois sai do cache sem nova cobrança.
 *  4. Valida o formato antes de gravar: resposta fora do padrão não é guardada.
 */

type DataOf<K extends CacheKind> = K extends 'basic' ? VehicleBasic : AdvancedReport;

export interface Fetched<T> {
  data: T;
  source: DataSource;
  provider: string;
  fetchedAt: string;
}

const HOUR = 60 * 60 * 1000;
/** Tempo máximo que uma trava fica ativa (se a função cair, ela expira sozinha). */
const LOCK_TTL_SECONDS = 25;
/** Quanto tempo uma requisição espera outra terminar antes de tentar por conta própria. */
const LOCK_WAIT_MS = 15_000;
const LOCK_POLL_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ttlMs(kind: CacheKind): number {
  const env = getEnv();
  return (kind === 'basic' ? env.basicCacheHours : env.reportCacheHours) * HOUR;
}

export async function getVehicleData<K extends CacheKind>(plate: string, kind: K): Promise<Fetched<DataOf<K>>> {
  const store = getStore();

  const hit = await store.getCached<DataOf<K>>(plate, kind, ttlMs(kind));
  if (hit) return { ...hit, source: 'cache' };

  const locked = await store.acquireFetchLock(plate, kind, LOCK_TTL_SECONDS);
  if (!locked) {
    const waited = await waitForCache<DataOf<K>>(store, plate, kind);
    if (waited) return { ...waited, source: 'cache' };
    // A outra requisição demorou demais ou falhou: segue e consulta por conta própria
  }

  try {
    if (locked) {
      // Outra requisição pode ter concluído entre a 1ª leitura e a trava
      const late = await store.getCached<DataOf<K>>(plate, kind, ttlMs(kind));
      if (late) return { ...late, source: 'cache' };
    }
    const entry = await loadFromProvider(store, getProvider(), plate, kind);
    return { ...entry, source: 'provider' };
  } finally {
    if (locked) await store.releaseFetchLock(plate, kind);
  }
}

async function waitForCache<T>(store: Store, plate: string, kind: CacheKind): Promise<CachedEntry<T> | null> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(LOCK_POLL_MS);
    const entry = await store.getCached<T>(plate, kind, ttlMs(kind));
    if (entry) return entry;
  }
  return null;
}

async function loadFromProvider<K extends CacheKind>(
  store: Store,
  provider: VehicleProvider,
  plate: string,
  kind: K,
): Promise<CachedEntry<DataOf<K>>> {
  let basic: VehicleBasic | null = null;
  let report: AdvancedReport | null = null;

  try {
    if (provider.mode === 'full') {
      const full = await provider.getFull(plate);
      if (full) ({ basic, report } = full);
    } else if (kind === 'basic') {
      basic = await provider.getBasic(plate);
    } else {
      report = await provider.getReport(plate);
    }
  } catch (err) {
    console.error(`[provider:${provider.name}] falha ao consultar ${kind} ${plate}`, err);
    throw new HttpError(502, 'provider_error', 'A base de dados veicular está indisponível no momento. Tente novamente em instantes.');
  }

  const wanted = kind === 'basic' ? basic : report;
  if (!wanted) throw new HttpError(404, 'not_found', 'Veículo não encontrado para esta placa.');

  const fetchedAt = new Date().toISOString();
  const saved: Partial<Record<CacheKind, boolean>> = {};
  for (const [k, data, validate] of [
    ['basic', basic, validateBasic],
    ['report', report, validateReport],
  ] as const) {
    if (!data) continue;
    const problems = validate(data);
    if (problems.length) {
      console.error(`[provider:${provider.name}] resposta fora do formato (${k} ${plate}):`, problems.slice(0, 10));
      if (k === kind) {
        throw new HttpError(502, 'provider_error', 'A base de dados veicular devolveu dados incompletos. Tente novamente mais tarde.');
      }
      continue; // a parte extra (modo 'full') inválida só não é guardada
    }
    await store.setCached(plate, k, { data, provider: provider.name, fetchedAt });
    saved[k] = true;
  }
  if (!saved[kind]) throw new HttpError(502, 'provider_error', 'Não foi possível salvar a consulta.');

  return { data: wanted as DataOf<K>, provider: provider.name, fetchedAt };
}
