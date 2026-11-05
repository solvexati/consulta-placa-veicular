import { getEnv } from '../env.js';
import { mockProvider } from './mock.js';
import type { VehicleProvider } from './types.js';

/** Registro de provedores disponíveis. Adicione aqui o adaptador da API paga. */
const PROVIDERS: Record<string, VehicleProvider> = {
  mock: mockProvider,
};

export function getProvider(): VehicleProvider {
  const name = getEnv().vehicleProvider;
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`VEHICLE_PROVIDER="${name}" não está registrado em server/providers/index.ts`);
  }
  return provider;
}
