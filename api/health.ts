import type { HealthResponse } from '../shared/apiContract.js';
import { getEnv } from '../server/env.js';
import { json, methodNotAllowed, route } from '../server/http.js';
import { getStore } from '../server/store/index.js';

/** GET /api/health — status do backend e configuração ativa. */
export const GET = route(async () => {
  const env = getEnv();
  const body: HealthResponse = {
    status: 'ok',
    provider: env.vehicleProvider,
    store: getStore().kind,
    simulatedPayments: env.simulatedPayments,
    time: new Date().toISOString(),
  };
  return json(body);
});

export const POST = () => methodNotAllowed(['GET']);
