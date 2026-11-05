import { providerRequest } from '../providers/httpClient.js';
import { normalizeReference, parseBRL, type FipePriceSource } from './types.js';

interface BrasilApiFipeItem {
  valor: string;
  marca: string;
  modelo: string;
  anoModelo: number;
  codigoFipe: string;
  mesReferencia: string;
}

/** BrasilAPI — gratuita, sem chave. https://brasilapi.com.br/docs#tag/FIPE */
export const brasilApiFipe: FipePriceSource = {
  name: 'brasilapi',
  async getPrice(fipeCode, yearModel) {
    const res = await providerRequest<BrasilApiFipeItem[]>('fipe:brasilapi', {
      url: `https://brasilapi.com.br/api/fipe/preco/v1/${encodeURIComponent(fipeCode)}`,
      timeoutMs: 6000,
      retries: 0,
    });
    const item = res.data?.find((i) => i.anoModelo === yearModel);
    if (!item) return null;
    return { value: parseBRL(item.valor), reference: normalizeReference(item.mesReferencia), model: item.modelo, source: 'brasilapi' };
  },
};
