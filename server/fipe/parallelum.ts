import { providerRequest } from '../providers/httpClient.js';
import { normalizeReference, parseBRL, type FipePriceSource } from './types.js';

const BASE = 'https://fipe.parallelum.com.br/api/v2/cars';

interface YearItem {
  code: string; // ex.: "2024-1" (ano-combustível) ou "32000-1" (0 km)
  name: string;
}

interface PriceItem {
  price: string;
  model: string;
  modelYear: number;
  codeFipe: string;
  referenceMonth: string;
}

/** FIPE API (Parallelum) — gratuita, sem chave (limite diário por IP). https://deividfortuna.github.io/fipe/ */
export const parallelumFipe: FipePriceSource = {
  name: 'parallelum',
  async getPrice(fipeCode, yearModel) {
    const code = encodeURIComponent(fipeCode);
    const years = await providerRequest<YearItem[]>('fipe:parallelum', { url: `${BASE}/${code}/years`, timeoutMs: 6000, retries: 0 });
    const year = years.data?.find((y) => y.code.startsWith(`${yearModel}-`));
    if (!year) return null;
    const price = await providerRequest<PriceItem>('fipe:parallelum', {
      url: `${BASE}/${code}/years/${encodeURIComponent(year.code)}`,
      timeoutMs: 6000,
      retries: 0,
    });
    if (!price.data) return null;
    return { value: parseBRL(price.data.price), reference: normalizeReference(price.data.referenceMonth), model: price.data.model, source: 'parallelum' };
  },
};
