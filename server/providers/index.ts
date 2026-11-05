import { getEnv } from '../env.js';
import { mockProvider } from './mock.js';
import type { VehicleProvider } from './types.js';

/**
 * Registro de provedores disponíveis. Para plugar a API paga:
 *   import { minhaApiProvider } from './minhaApi.js';
 *   e adicione `[minhaApiProvider.name]: minhaApiProvider` abaixo.
 * O provedor ativo é escolhido pela variável VEHICLE_PROVIDER.
 */
const PROVIDERS = new Map<string, VehicleProvider>([[mockProvider.name, mockProvider]]);

/** Registra um provedor em tempo de execução (usado em testes e integrações). */
export function registerProvider(provider: VehicleProvider): void {
  PROVIDERS.set(provider.name.toLowerCase(), provider);
}

export function getProvider(): VehicleProvider {
  const name = getEnv().vehicleProvider;
  const provider = PROVIDERS.get(name);
  if (!provider) {
    throw new Error(`VEHICLE_PROVIDER="${name}" não está registrado em server/providers/index.ts`);
  }
  return provider;
}
