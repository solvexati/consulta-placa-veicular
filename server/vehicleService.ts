import type { ReportResponse, VehicleResponse } from '../shared/apiContract.js';
import type { PaymentMethod, UnlockReceipt } from '../shared/vehicle.js';
import { createAccessToken, verifyAccessToken } from './accessToken.js';
import { sha256, transactionId } from './crypto.js';
import { getEnv } from './env.js';
import { HttpError } from './http.js';
import { getStore } from './store/index.js';
import { getVehicleData } from './vehicleData.js';

export const ADVANCED_PRICE_CENTS = 3500;

export async function getVehicleBasic(plate: string, ipHash: string): Promise<VehicleResponse> {
  const r = await getVehicleData(plate, 'basic');
  await getStore().logLookup({ plate, kind: 'basic', source: r.source, provider: r.provider, ipHash });
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

  const r = await getVehicleData(plate, 'report');
  await store.logLookup({ plate, kind: 'report', source: r.source, provider: r.provider, ipHash });
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
