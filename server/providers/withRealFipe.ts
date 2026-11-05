import type { VehicleBasic } from '../../shared/vehicle.js';
import { getFipePrice } from '../fipe/index.js';
import type { VehicleProvider } from './types.js';

/**
 * Envolve QUALQUER provedor e substitui o valor FIPE pelo preço oficial atual
 * (BrasilAPI / Parallelum), usando o código FIPE + ano-modelo que o provedor devolveu.
 * Se as fontes FIPE estiverem fora do ar, mantém o valor original do provedor.
 * Ligado por FIPE_ENRICH (padrão: true). Desligue se a API paga já trouxer FIPE atualizado.
 */
export function withRealFipe(provider: VehicleProvider): VehicleProvider {
  async function enrich(basic: VehicleBasic | null): Promise<VehicleBasic | null> {
    if (!basic) return basic;
    const price = await getFipePrice(basic.fipeCode, basic.yearModel);
    return price ? { ...basic, fipeValue: price.value, fipeReference: price.reference } : basic;
  }

  if (provider.mode === 'full') {
    return {
      ...provider,
      async getFull(plate) {
        const full = await provider.getFull(plate);
        if (!full) return null;
        return { ...full, basic: (await enrich(full.basic))! };
      },
    };
  }
  return {
    ...provider,
    getBasic: async (plate) => enrich(await provider.getBasic(plate)),
    getReport: (plate) => provider.getReport(plate),
  };
}
