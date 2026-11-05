import { getVehicleByPlate } from '../../shared/mockVehicles.js';
import type { SplitProvider } from './types.js';

/**
 * Provedor de demonstração: dados determinísticos gerados a partir da placa
 * (placas de teste BRA2E19, KRP8214, ONX3A88 e HYU7F90 têm cenários fixos).
 * Não tem custo e funciona sem nenhuma chave de API.
 */
export const mockProvider: SplitProvider = {
  name: 'mock',
  mode: 'split',
  async getBasic(plate) {
    return getVehicleByPlate(plate).basic;
  },
  async getReport(plate) {
    return getVehicleByPlate(plate).advanced;
  },
};
