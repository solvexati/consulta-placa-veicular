import type { UnlockRequest, UnlockResponse } from '../shared/apiContract.js';
import { HttpError, enforceRateLimit, json, methodNotAllowed, readJson, route, validatePlate } from '../server/http.js';
import { unlockReport } from '../server/vehicleService.js';

/**
 * POST /api/unlock  { "plate": "ABC1D23", "method": "pix" | "cartao" }
 * Libera o laudo completo e devolve o token de acesso.
 * PAGAMENTO SIMULADO: controlado por SIMULATED_PAYMENTS (padrão: true).
 */
export const POST = route(async (req) => {
  enforceRateLimit(req, 'unlock');
  const body = await readJson<Partial<UnlockRequest>>(req);
  const plate = validatePlate(body.plate);
  if (body.method !== 'pix' && body.method !== 'cartao') {
    throw new HttpError(400, 'invalid_body', 'Forma de pagamento inválida. Use "pix" ou "cartao".');
  }
  const result: UnlockResponse = await unlockReport(plate, body.method);
  return json(result, 201);
});

export const GET = () => methodNotAllowed(['POST']);
