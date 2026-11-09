import { requireUser } from '../server/auth.js';
import { sha256 } from '../server/crypto.js';
import { getEnv } from '../server/env.js';
import { enforceRateLimit, getClientIp, getReportToken, json, methodNotAllowed, requirePlate, route } from '../server/http.js';
import { getVehicleReport } from '../server/vehicleService.js';

/**
 * GET /api/report?plate=ABC1D23
 * Headers: Authorization: Bearer <login Google>  +  X-Report-Token: <token de /api/unlock>
 * Retorna o laudo completo apenas para placas desbloqueadas.
 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  enforceRateLimit(req, 'report', user?.id);
  const plate = requirePlate(req);
  const ipHash = sha256(getClientIp(req) + getEnv().ipHashSalt);
  return json(await getVehicleReport(plate, getReportToken(req), { ipHash, userId: user?.id ?? null }));
});

export const POST = () => methodNotAllowed(['GET']);
