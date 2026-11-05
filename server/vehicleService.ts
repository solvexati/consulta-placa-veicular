import type { ReportResponse, VehicleResponse } from '../shared/apiContract.js';
import type { AdvancedReport, PaymentMethod, UnlockReceipt, VehicleBasic } from '../shared/vehicle.js';
import { createAccessToken, verifyAccessToken } from './accessToken.js';
import { sha256, transactionId } from './crypto.js';
import { getEnv } from './env.js';
import { HttpError } from './http.js';
import { getProvider } from './providers/index.js';
import { getStore } from './store/index.js';
import type { CacheKind } from './store/types.js';

export const ADVANCED_PRICE_CENTS = 3500;
const HOUR = 60 * 60 * 1000;

interface Fetched<T> {
  data: T;
  source: 'cache' | 'provider';
  provider: string;
  fetchedAt: string;
}

/**
 * Busca no cache; se não houver (ou estiver vencido), consulta o provedor
 * e grava no cache. Isso evita pagar a API externa duas vezes pela mesma placa.
 */
async function cachedFetch<T>(
  plate: string,
  kind: CacheKind,
  ttlHours: number,
  load: () => Promise<T | null>,
): Promise<Fetched<T>> {
  const store = getStore();
  const hit = await store.getCached<T>(plate, kind, ttlHours * HOUR);
  if (hit) return { ...hit, source: 'cache' };

  const provider = getProvider();
  let data: T | null;
  try {
    data = await load();
  } catch (err) {
    console.error(`[provider:${provider.name}] falha em ${kind} ${plate}`, err);
    throw new HttpError(502, 'provider_error', 'A base de dados veicular está indisponível no momento. Tente novamente em instantes.');
  }
  if (!data) throw new HttpError(404, 'not_found', 'Veículo não encontrado para esta placa.');

  const entry = { data, provider: provider.name, fetchedAt: new Date().toISOString() };
  await store.setCached(plate, kind, entry);
  return { ...entry, source: 'provider' };
}

export async function getVehicleBasic(plate: string, ipHash: string): Promise<VehicleResponse> {
  const { basicCacheHours } = getEnv();
  const r = await cachedFetch<VehicleBasic>(plate, 'basic', basicCacheHours, () => getProvider().getBasic(plate));
  await getStore().logLookup({ plate, kind: 'basic', source: r.source, ipHash });
  return { vehicle: r.data, source: r.source, provider: r.provider, fetchedAt: r.fetchedAt };
}

export async function getVehicleReport(plate: string, accessToken: string | null, ipHash: string): Promise<ReportResponse> {
  if (!accessToken) throw new HttpError(401, 'unauthorized', 'Laudo bloqueado. Desbloqueie para ter acesso.');
  const payload = verifyAccessToken(accessToken);
  if (!payload || payload.plate !== plate) {
    throw new HttpError(401, 'unauthorized', 'Acesso ao laudo inválido para esta placa.');
  }
  // Com banco de dados, confere também o registro (permite revogar em caso de estorno)
  const store = getStore();
  if (store.kind === 'supabase' && !(await store.findUnlock(plate, sha256(accessToken)))) {
    throw new HttpError(401, 'unauthorized', 'Acesso ao laudo revogado ou não encontrado.');
  }

  const { reportCacheHours } = getEnv();
  const r = await cachedFetch<AdvancedReport>(plate, 'report', reportCacheHours, () => getProvider().getReport(plate));
  await getStore().logLookup({ plate, kind: 'report', source: r.source, ipHash });
  return { plate, report: r.data, source: r.source, provider: r.provider, fetchedAt: r.fetchedAt };
}

/**
 * Libera o laudo de uma placa e devolve o token de acesso.
 * Por enquanto o pagamento é SIMULADO — quando o gateway for integrado, este
 * fluxo passa a ser disparado pelo webhook de confirmação do pagamento.
 */
export async function unlockReport(plate: string, method: PaymentMethod): Promise<{ receipt: UnlockReceipt; accessToken: string }> {
  if (!getEnv().simulatedPayments) {
    throw new HttpError(501, 'payments_not_configured', 'Pagamento ainda não disponível.');
  }
  const txId = transactionId(method === 'pix' ? 'PIX' : 'CARD');
  const accessToken = createAccessToken(plate, txId);
  const receipt = await getStore().createUnlock({
    plate,
    method,
    amountCents: ADVANCED_PRICE_CENTS,
    tokenHash: sha256(accessToken),
    transactionId: txId,
  });
  return { receipt, accessToken };
}

