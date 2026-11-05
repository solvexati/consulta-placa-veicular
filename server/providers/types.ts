import type { AdvancedReport, VehicleBasic } from '../../shared/vehicle.js';

/**
 * Contrato que todo provedor de dados veiculares (API) deve cumprir.
 * O resto do sistema — cache, travas, laudo, app — não sabe qual API está por trás.
 *
 * Escolha o modo conforme a API contratada:
 *  - 'split': a API tem consultas separadas (básica barata/grátis + completa paga).
 *  - 'full' : uma única chamada devolve tudo. O backend guarda as duas partes no
 *             cache de uma vez, então o laudo depois sai do cache sem nova cobrança.
 *
 * Para plugar uma API: copie `template.ts`, implemente, registre em `index.ts`
 * e defina VEHICLE_PROVIDER=<nome>. Valide com `npm run provider:check`.
 */
export type VehicleProvider = SplitProvider | FullProvider;

interface BaseProvider {
  /** Identificador gravado no cache e nos logs (ex.: "mock", "infosimples"). */
  readonly name: string;
}

export interface SplitProvider extends BaseProvider {
  readonly mode: 'split';
  /** Dados cadastrais + FIPE. `null` se a placa não existir na base. */
  getBasic(plate: string): Promise<VehicleBasic | null>;
  /** Laudo completo. `null` se a placa não existir na base. */
  getReport(plate: string): Promise<AdvancedReport | null>;
}

export interface FullProvider extends BaseProvider {
  readonly mode: 'full';
  /** Tudo numa chamada. `null` se a placa não existir na base. */
  getFull(plate: string): Promise<{ basic: VehicleBasic; report: AdvancedReport } | null>;
}

/** Falha ao falar com a API externa (timeout, 5xx, chave inválida, resposta fora do formato). */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
