import { getEnv } from '../env.js';
import { mockProvider } from './mock.js';
import type { VehicleProvider } from './types.js';
import { withRealFipe } from './withRealFipe.js';

/**
 * Registro de provedores disponíveis. Para plugar a API paga:
 *   import { minhaApiProvider } from './minhaApi.js';
 *   e registre com `registerProvider(minhaApiProvider)` abaixo.
 * O provedor ativo é escolhido pela variável VEHICLE_PROVIDER.
 */
const PROVIDERS = new Map<string, VehicleProvider>([[mockProvider.name, mockProvider]]);

/** Registra um provedor em tempo de execução (usado em testes e integrações). */
export function registerProvider(provider: VehicleProvider): void {
  PROVIDERS.set(provider.name.toLowerCase(), provider);
}

/** Provedor ativo, já com o preço FIPE oficial aplicado (se FIPE_ENRICH=true). */
export function getProvider(): VehicleProvider {
  const env = getEnv();
  const provider = PROVIDERS.get(env.vehicleProvider);
  if (!provider) {
    throw new Error(`VEHICLE_PROVIDER="${env.vehicleProvider}" não está registrado em server/providers/index.ts`);
  }
  return env.fipeEnrich ? withRealFipe(provider) : provider;
}
