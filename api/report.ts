import { sha256 } from '../server/crypto.js';
import { getEnv } from '../server/env.js';
import { enforceRateLimit, getBearerToken, getClientIp, json, methodNotAllowed, requirePlate, route } from '../server/http.js';
import { getVehicleReport } from '../server/vehicleService.js';

/**
 * GET /api/report?plate=ABC1D23
 * Header: Authorization: Bearer <accessToken recebido em /api/unlock>
 * Retorna o laudo completo apenas para placas desbloqueadas.
 */
export const GET = route(async (req) => {
  enforceRateLimit(req, 'report');
  const plate = requirePlate(req);
  const ipHash = sha256(getClientIp(req) + getEnv().ipHashSalt);
  return json(await getVehicleReport(plate, getBearerToken(req), ipHash));
});

export const POST = () => methodNotAllowed(['GET']);
