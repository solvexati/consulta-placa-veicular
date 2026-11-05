import { getEnv } from '../env.js';
import { ProviderError } from './types.js';

export interface ProviderRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Objeto será enviado como JSON. */
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
}

export interface ProviderResponse<T> {
  status: number;
  /** `null` quando a API responde 404 (placa não encontrada). */
  data: T | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cliente HTTP padrão para TODAS as APIs de dados veiculares:
 *  - timeout (PROVIDER_TIMEOUT_MS, padrão 15s)
 *  - novas tentativas com espera crescente em falha de rede, 429 e 5xx (PROVIDER_RETRIES, padrão 2)
 *  - 404 vira `data: null` (placa inexistente); outros 4xx (ex.: chave inválida) falham na hora
 *  - nunca registra a chave da API nos logs
 */
export async function providerRequest<T>(providerName: string, req: ProviderRequest): Promise<ProviderResponse<T>> {
  const env = getEnv();
  const timeoutMs = req.timeoutMs ?? env.providerTimeoutMs;
  const retries = req.retries ?? env.providerRetries;
  const safeUrl = req.url.replace(/([?&](?:key|token|api[_-]?key)=)[^&]+/gi, '$1***');

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(300 * 2 ** (attempt - 1));
    const started = Date.now();
    try {
      const res = await fetch(req.url, {
        method: req.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...(req.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...req.headers,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      console.info(`[provider:${providerName}] ${req.method ?? 'GET'} ${safeUrl} → ${res.status} (${Date.now() - started}ms)`);

      if (res.status === 404) return { status: 404, data: null };
      if (res.status === 429 || res.status >= 500) {
        lastError = new ProviderError(`API respondeu ${res.status}`);
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new ProviderError(`API recusou a requisição (${res.status})`, detail.slice(0, 300));
      }
      try {
        return { status: res.status, data: (await res.json()) as T };
      } catch (err) {
        throw new ProviderError('API devolveu uma resposta que não é JSON válido', err);
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      lastError = err; // rede ou timeout: tenta de novo
      console.warn(`[provider:${providerName}] tentativa ${attempt + 1} falhou: ${(err as Error).message}`);
    }
  }
  throw new ProviderError(`API indisponível após ${retries + 1} tentativa(s)`, lastError);
}
