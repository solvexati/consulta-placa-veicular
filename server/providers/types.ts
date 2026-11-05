import type { AdvancedReport, VehicleBasic } from '../../shared/vehicle.js';

/**
 * Contrato que todo provedor de dados veiculares deve cumprir.
 *
 * Para plugar a API paga: crie `server/providers/<nome>.ts` implementando esta
 * interface (convertendo o JSON da API para `VehicleBasic` / `AdvancedReport`),
 * registre em `server/providers/index.ts` e defina `VEHICLE_PROVIDER=<nome>`.
 */
export interface VehicleProvider {
  readonly name: string;
  /** Dados cadastrais + FIPE. Retorna `null` se a placa não existir na base. */
  getBasic(plate: string): Promise<VehicleBasic | null>;
  /** Laudo completo (consulta paga). Retorna `null` se a placa não existir na base. */
  getReport(plate: string): Promise<AdvancedReport | null>;
}

/** Erro de comunicação com o provedor externo (timeout, 5xx, resposta inválida). */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}
