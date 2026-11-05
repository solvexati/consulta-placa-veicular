/**
 * MODELO para plugar uma API paga. Não está registrado — copie este arquivo
 * (ex.: `infosimples.ts`), ajuste as URLs e os mapeamentos, e registre em `index.ts`.
 *
 * Regras:
 *  1. Use sempre `providerRequest` (timeout, novas tentativas, logs sem a chave).
 *  2. Converta a resposta da API para os tipos do sistema (`VehicleBasic`, `AdvancedReport`).
 *     Campo que a API não tiver: preencha com um valor neutro (ex.: lista vazia),
 *     nunca deixe `undefined` — o validador acusa.
 *  3. Placa inexistente na API → retorne `null` (vira 404 para o app).
 *  4. Rode `npm run provider:check -- ABC1D23` antes de subir.
 */
import type { AdvancedReport, VehicleBasic } from '../../shared/vehicle.js';
import { getPlateFormat } from '../../shared/plateFormatter.js';
import { getEnv } from '../env.js';
import { providerRequest } from './httpClient.js';
import type { FullProvider } from './types.js';

/** Formato (hipotético) da resposta da API — troque pelo formato real da documentação. */
interface ExampleApiResponse {
  placa: string;
  marca: string;
  modelo: string;
  versao?: string;
  ano_fabricacao: number;
  ano_modelo: number;
  cor: string;
  combustivel: string;
  municipio: string;
  uf: string;
  chassi: string;
  renavam: string;
  fipe?: { codigo: string; valor: number; referencia: string };
  // ...demais campos do laudo (sinistros, leilão, gravames, débitos...)
}

const mask = (value: string, keepStart: number, keepEnd: number) =>
  value.slice(0, keepStart) + '*'.repeat(Math.max(0, value.length - keepStart - keepEnd)) + value.slice(-keepEnd);

function toVehicleBasic(api: ExampleApiResponse): VehicleBasic {
  return {
    plate: api.placa,
    plateFormat: getPlateFormat(api.placa),
    brand: api.marca,
    model: api.modelo,
    version: api.versao ?? '',
    category: '',
    yearManufacture: api.ano_fabricacao,
    yearModel: api.ano_modelo,
    color: api.cor,
    fuel: 'Flex', // mapear api.combustivel → FuelType
    engine: '',
    power: '',
    transmission: '',
    city: api.municipio,
    uf: api.uf,
    chassisMasked: mask(api.chassi, 3, 6),
    renavamMasked: mask(api.renavam, 2, 4),
    fipeCode: api.fipe?.codigo ?? '',
    fipeValue: api.fipe?.valor ?? 0,
    fipeReference: api.fipe?.referencia ?? '',
  };
}

function toAdvancedReport(_api: ExampleApiResponse): AdvancedReport {
  // Mapear cada seção do laudo a partir da resposta real da API.
  throw new Error('template: implemente o mapeamento do laudo para a API escolhida');
}

export const templateProvider: FullProvider = {
  name: 'template',
  mode: 'full',
  async getFull(plate) {
    const { providerApiUrl, providerApiKey } = getEnv();
    const res = await providerRequest<ExampleApiResponse>('template', {
      url: `${providerApiUrl}/veiculos/${plate}`,
      headers: { authorization: `Bearer ${providerApiKey}` },
    });
    if (!res.data) return null;
    return { basic: toVehicleBasic(res.data), report: toAdvancedReport(res.data) };
  },
};
