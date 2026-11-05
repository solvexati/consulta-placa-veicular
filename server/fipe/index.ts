import { getEnv } from '../env.js';
import { brasilApiFipe } from './brasilapi.js';
import { parallelumFipe } from './parallelum.js';
import type { FipePrice, FipePriceSource } from './types.js';

const SOURCES: Record<string, FipePriceSource> = {
  [brasilApiFipe.name]: brasilApiFipe,
  [parallelumFipe.name]: parallelumFipe,
};

/** Fontes ativas, na ordem de tentativa (FIPE_SOURCES, padrão "brasilapi,parallelum"). */
export function getFipeSources(): FipePriceSource[] {
  return getEnv()
    .fipeSources.map((name) => SOURCES[name])
    .filter((s): s is FipePriceSource => Boolean(s));
}

/**
 * Preço FIPE real. Tenta cada fonte em ordem; se uma estiver fora do ar,
 * passa para a próxima. Retorna `null` se nenhuma tiver o código/ano.
 * Nunca lança erro — sem FIPE real, a consulta segue com o valor do provedor.
 */
export async function getFipePrice(fipeCode: string, yearModel: number): Promise<FipePrice | null> {
  if (!/^\d{6}-\d$/.test(fipeCode)) return null;
  for (const source of getFipeSources()) {
    try {
      const price = await source.getPrice(fipeCode, yearModel);
      if (price && Number.isFinite(price.value) && price.value > 0) return price;
    } catch (err) {
      console.warn(`[fipe:${source.name}] indisponível: ${(err as Error).message}`);
    }
  }
  return null;
}
