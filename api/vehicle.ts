import { sha256 } from '../server/crypto.js';
import { getEnv } from '../server/env.js';
import { enforceRateLimit, getClientIp, json, methodNotAllowed, requirePlate, route } from '../server/http.js';
import { getVehicleBasic } from '../server/vehicleService.js';

/** GET /api/vehicle?plate=ABC1D23 — dados cadastrais + FIPE (consulta grátis). */
export const GET = route(async (req) => {
  enforceRateLimit(req, 'vehicle');
  const plate = requirePlate(req);
  const ipHash = sha256(getClientIp(req) + getEnv().ipHashSalt);
  return json(await getVehicleBasic(plate, ipHash));
});

export const POST = () => methodNotAllowed(['GET']);
