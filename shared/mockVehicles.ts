import type {
  AdvancedReport,
  AuctionRecord,
  Debts,
  Fine,
  FineSeverity,
  FuelType,
  InsuranceAcceptance,
  InsuranceClaim,
  Lien,
  OwnerRecord,
  OwnerUsage,
  OwnershipHistory,
  Restrictions,
  StructuralPoint,
  StructuralPointId,
  StructuralStatus,
  TheftHistory,
  VehicleBasic,
  VehicleRecord,
} from './vehicle.js';
import { getPlateFormat, normalizePlate } from './plateFormatter.js';

/* ============================================================
 * Utilitários determinísticos (mesma placa => mesmos dados)
 * ============================================================ */

function hashString(str: string): number {
  // FNV-1a 32 bits
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const chance = (rng: Rng, p: number) => rng() < p;
const digits = (rng: Rng, n: number) => Array.from({ length: n }, () => int(rng, 0, 9)).join('');
const round = (v: number, step = 10) => Math.round(v / step) * step;

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const FIPE_REFERENCE = `${MONTHS[new Date().getMonth()]}/${CURRENT_YEAR}`;

function isoDate(year: number, month: number, day: number): string {
  const m = String(Math.min(Math.max(month, 1), 12)).padStart(2, '0');
  const d = String(Math.min(Math.max(day, 1), 28)).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function randomDate(rng: Rng, fromYear: number, toYear = CURRENT_YEAR): string {
  const y = int(rng, fromYear, Math.max(fromYear, toYear));
  const maxMonth = y === CURRENT_YEAR ? new Date().getMonth() + 1 : 12;
  return isoDate(y, int(rng, 1, maxMonth), int(rng, 1, 28));
}

function monthsBetween(fromIso: string, toIso: string | null): number {
  const a = new Date(fromIso);
  const b = toIso ? new Date(toIso) : new Date();
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

/* ============================================================
 * Catálogo de veículos brasileiros
 * ============================================================ */

interface CatalogModel {
  brand: string;
  model: string;
  versions: string[];
  category: string;
  engine: string;
  power: string;
  transmission: string;
  fuel: FuelType;
  /** Valor FIPE aproximado do modelo 0 km no ano corrente. */
  base: number;
  wmi: string;
  minYear: number;
  /** Código FIPE real da versão (preço oficial consultado pela API FIPE). */
  fipeCode: string;
}

const CATALOG: CatalogModel[] = [
  { brand: 'Fiat', model: 'Strada', versions: ['Freedom 1.3 CS Plus'], category: 'Picape', engine: '1.3', power: '107 cv', transmission: 'Manual 5 marchas', fuel: 'Flex', base: 118000, wmi: '9BD', minYear: 2021, fipeCode: '001527-0' },
  { brand: 'Fiat', model: 'Argo', versions: ['Drive 1.0'], category: 'Hatch', engine: '1.0', power: '75 cv', transmission: 'Manual 5 marchas', fuel: 'Flex', base: 89000, wmi: '9BD', minYear: 2018, fipeCode: '001494-0' },
  { brand: 'Fiat', model: 'Toro', versions: ['Freedom 1.3 T270 Aut.'], category: 'Picape', engine: '1.3 Turbo', power: '185 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 172000, wmi: '988', minYear: 2022, fipeCode: '001538-5' },
  { brand: 'Jeep', model: 'Compass', versions: ['Longitude T270 1.3 Turbo'], category: 'SUV', engine: '1.3 Turbo', power: '185 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 199000, wmi: '988', minYear: 2022, fipeCode: '017071-2' },
  { brand: 'Jeep', model: 'Renegade', versions: ['Longitude T270 1.3 Turbo'], category: 'SUV', engine: '1.3 Turbo', power: '185 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 149000, wmi: '988', minYear: 2022, fipeCode: '017108-5' },
  { brand: 'Volkswagen', model: 'Polo', versions: ['Highline 200 TSI'], category: 'Hatch', engine: '1.0 TSI', power: '116 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 104000, wmi: '9BW', minYear: 2018, fipeCode: '005476-3' },
  { brand: 'Volkswagen', model: 'T-Cross', versions: ['Highline 250 TSI'], category: 'SUV', engine: '1.0 TSI', power: '116 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 149000, wmi: '9BW', minYear: 2020, fipeCode: '005508-5' },
  { brand: 'Volkswagen', model: 'Nivus', versions: ['Highline 200 TSI'], category: 'SUV', engine: '1.0 TSI', power: '128 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 139000, wmi: '9BW', minYear: 2021, fipeCode: '005526-3' },
  { brand: 'Chevrolet', model: 'Tracker', versions: ['Premier 1.2 Turbo'], category: 'SUV', engine: '1.2 Turbo', power: '133 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 152000, wmi: '9BG', minYear: 2021, fipeCode: '004525-0' },
  { brand: 'Chevrolet', model: 'Onix', versions: ['LTZ 1.0 Turbo'], category: 'Hatch', engine: '1.0 Turbo', power: '116 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 99000, wmi: '9BG', minYear: 2020, fipeCode: '004515-2' },
  { brand: 'Hyundai', model: 'Creta', versions: ['Limited 1.0 TGDI'], category: 'SUV', engine: '1.0 Turbo', power: '120 cv', transmission: 'Automático 6 marchas', fuel: 'Flex', base: 156000, wmi: '9BH', minYear: 2022, fipeCode: '015203-0' },
  { brand: 'Renault', model: 'Kwid', versions: ['Zen 1.0'], category: 'Hatch', engine: '1.0', power: '71 cv', transmission: 'Manual 5 marchas', fuel: 'Flex', base: 72000, wmi: '93Y', minYear: 2018, fipeCode: '025266-2' },
  { brand: 'Nissan', model: 'Kicks', versions: ['Advance 1.6 CVT'], category: 'SUV', engine: '1.6', power: '114 cv', transmission: 'CVT', fuel: 'Flex', base: 132000, wmi: '94D', minYear: 2021, fipeCode: '023180-0' },
  { brand: 'Toyota', model: 'Hilux', versions: ['SRV 2.8 Diesel 4x4'], category: 'Picape', engine: '2.8 Turbo Diesel', power: '204 cv', transmission: 'Automático 6 marchas', fuel: 'Diesel', base: 298000, wmi: '8AJ', minYear: 2016, fipeCode: '002143-1' },
  { brand: 'Toyota', model: 'Yaris', versions: ['XLS 1.5 CVT'], category: 'Sedã', engine: '1.5', power: '110 cv', transmission: 'CVT', fuel: 'Flex', base: 112000, wmi: '9BR', minYear: 2019, fipeCode: '002174-1' },
  { brand: 'Ford', model: 'Ranger', versions: ['XLS 2.0 Diesel'], category: 'Picape', engine: '2.0 Turbo Diesel', power: '170 cv', transmission: 'Automático 10 marchas', fuel: 'Diesel', base: 285000, wmi: '8AF', minYear: 2024, fipeCode: '003499-1' },
  { brand: 'BYD', model: 'Song Plus', versions: ['DM-i 1.5 Híbrido Plug-in'], category: 'SUV', engine: '1.5 + motor elétrico', power: '235 cv', transmission: 'Automático e-CVT', fuel: 'Híbrido', base: 239000, wmi: 'LGX', minYear: 2023, fipeCode: '095005-0' },
  { brand: 'BYD', model: 'Dolphin', versions: ['EV GS'], category: 'Hatch', engine: 'Elétrico', power: '95 cv', transmission: 'Automático (redução única)', fuel: 'Elétrico', base: 149000, wmi: 'LGX', minYear: 2023, fipeCode: '095007-6' },
  { brand: 'Honda', model: 'HR-V', versions: ['EXL 1.5'], category: 'SUV', engine: '1.5', power: '126 cv', transmission: 'CVT', fuel: 'Flex', base: 159000, wmi: '93H', minYear: 2023, fipeCode: '014110-0' },
];

const COLORS = ['Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho', 'Azul', 'Branco Perolizado', 'Grafite'];

const LOCATIONS: { city: string; uf: string }[] = [
  { city: 'São Paulo', uf: 'SP' }, { city: 'Campinas', uf: 'SP' }, { city: 'Ribeirão Preto', uf: 'SP' },
  { city: 'Rio de Janeiro', uf: 'RJ' }, { city: 'Niterói', uf: 'RJ' }, { city: 'Belo Horizonte', uf: 'MG' },
  { city: 'Uberlândia', uf: 'MG' }, { city: 'Curitiba', uf: 'PR' }, { city: 'Londrina', uf: 'PR' },
  { city: 'Porto Alegre', uf: 'RS' }, { city: 'Florianópolis', uf: 'SC' }, { city: 'Joinville', uf: 'SC' },
  { city: 'Salvador', uf: 'BA' }, { city: 'Recife', uf: 'PE' }, { city: 'Fortaleza', uf: 'CE' },
  { city: 'Goiânia', uf: 'GO' }, { city: 'Brasília', uf: 'DF' }, { city: 'Manaus', uf: 'AM' },
];

const INSURERS = ['Porto Seguro', 'Bradesco Seguros', 'Allianz', 'Tokio Marine', 'HDI Seguros', 'Azul Seguros', 'Mapfre', 'Suhai Seguradora'];
const AUCTIONEERS = ['Sodré Santoro', 'Copart Brasil', 'Freitas Leiloeiro', 'VIP Leilões', 'Mega Leilões'];
const BANKS = ['Banco Itaú Unibanco S.A.', 'Banco Bradesco Financiamentos S.A.', 'Banco Santander (Brasil) S.A.', 'BV Financeira S.A.', 'Banco Pan S.A.', 'Banco do Brasil S.A.'];

const FINE_TYPES: { description: string; severity: FineSeverity; amount: number; points: number }[] = [
  { description: 'Transitar em velocidade superior à máxima permitida em até 20%', severity: 'Média', amount: 130.16, points: 4 },
  { description: 'Transitar em velocidade superior à máxima permitida entre 20% e 50%', severity: 'Grave', amount: 195.23, points: 5 },
  { description: 'Estacionar em local proibido pela sinalização', severity: 'Média', amount: 130.16, points: 4 },
  { description: 'Avançar o sinal vermelho do semáforo', severity: 'Gravíssima', amount: 293.47, points: 7 },
  { description: 'Dirigir veículo utilizando-se de telefone celular', severity: 'Gravíssima', amount: 293.47, points: 7 },
  { description: 'Deixar de dar preferência a pedestre na faixa', severity: 'Gravíssima', amount: 293.47, points: 7 },
  { description: 'Transitar em faixa ou via exclusiva de ônibus', severity: 'Gravíssima', amount: 293.47, points: 7 },
  { description: 'Estacionar afastado da guia entre 50 cm e 1 m', severity: 'Leve', amount: 88.38, points: 3 },
  { description: 'Rodízio municipal – circular em horário restrito', severity: 'Média', amount: 130.16, points: 4 },
];

const AGENCIES_BY_UF: Record<string, string[]> = {
  SP: ['DETRAN-SP', 'CET-SP', 'DER-SP', 'PRF'],
  RJ: ['DETRAN-RJ', 'CET-Rio', 'PRF'],
  MG: ['DETRAN-MG', 'BHTrans', 'DER-MG', 'PRF'],
};

/* ============================================================
 * Construtores de seções do laudo
 * ============================================================ */

const STRUCTURE_LABELS: Record<StructuralPointId, string> = {
  colunaA: 'Coluna A',
  colunaB: 'Coluna B',
  colunaC: 'Coluna C',
  longarinaDianteira: 'Longarina dianteira',
  longarinaTraseira: 'Longarina traseira',
  cortaFogo: 'Corta-fogo',
  estepe: 'Caixa do estepe',
  vidros: 'Vidros (gravação)',
  motor: 'Motor (numeração original)',
  assoalho: 'Assoalho',
};

const STRUCTURE_OK_NOTES: Record<StructuralPointId, string> = {
  colunaA: 'Sem sinais de corte, solda ou massa.',
  colunaB: 'Pontos de solda de fábrica preservados.',
  colunaC: 'Sem deformações ou reparos aparentes.',
  longarinaDianteira: 'Alinhada, sem marcas de tração ou reparo.',
  longarinaTraseira: 'Original, sem sinais de colisão traseira.',
  cortaFogo: 'Selante e numeração do chassi intactos.',
  estepe: 'Caixa original, sem ondulações.',
  vidros: 'Gravação de chassi coincidente em todos os vidros.',
  motor: 'Numeração do motor confere com a BIN.',
  assoalho: 'Sem corrosão estrutural ou reparos.',
};

function buildStructure(overrides: Partial<Record<StructuralPointId, { status: StructuralStatus; note: string }>> = {}): StructuralPoint[] {
  return (Object.keys(STRUCTURE_LABELS) as StructuralPointId[]).map((id) => ({
    id,
    label: STRUCTURE_LABELS[id],
    status: overrides[id]?.status ?? 'ok',
    note: overrides[id]?.note ?? STRUCTURE_OK_NOTES[id],
  }));
}

function buildOwnership(owners: Omit<OwnerRecord, 'months' | 'order'>[]): OwnershipHistory {
  const list: OwnerRecord[] = owners.map((o, i) => ({ ...o, order: i + 1, months: monthsBetween(o.from, o.to) }));
  const usageCount = list.reduce<Record<string, number>>((acc, o) => {
    acc[o.usage] = (acc[o.usage] ?? 0) + o.months;
    return acc;
  }, {});
  const mainUsage = (Object.entries(usageCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Particular') as OwnerUsage;
  return {
    totalOwners: list.length,
    averageMonths: Math.round(list.reduce((s, o) => s + o.months, 0) / Math.max(list.length, 1)),
    mainUsage,
    owners: list,
  };
}

function buildDebts(fines: Fine[], ipva: Debts['ipva'], licensing: Debts['licensing']): Debts {
  const total =
    fines.reduce((s, f) => s + f.amount, 0) +
    (ipva.status === 'Pendente' ? ipva.amount : 0) +
    (licensing.status === 'Pendente' ? licensing.amount : 0);
  return { fines, ipva, licensing, total: Math.round(total * 100) / 100 };
}

const NO_RESTRICTIONS: Restrictions = { renajud: false, judicial: false, administrative: false, tributary: false, notes: [] };

function computeScore(r: Omit<AdvancedReport, 'score'>): number {
  let s = 100;
  for (const c of r.claims) s -= c.severity === 'grande' ? 45 : c.severity === 'media' ? 20 : 8;
  if (r.auction) s -= 22;
  if (r.theft.status === 'recuperado') s -= 15;
  if (r.theft.status === 'ativo') s -= 80;
  if (r.liens.some((l) => l.status === 'Ativo')) s -= 6;
  if (r.restrictions.renajud || r.restrictions.judicial) s -= 20;
  for (const p of r.structure) s -= p.status === 'dano' ? 10 : p.status === 'reparo' ? 4 : 0;
  if (r.debts.total > 0) s -= Math.min(10, Math.ceil(r.debts.total / 400));
  if (r.ownership.mainUsage !== 'Particular') s -= 5;
  return Math.max(0, Math.min(100, s));
}

function finalize(base: Omit<AdvancedReport, 'score'>): AdvancedReport {
  return { ...base, score: computeScore(base) };
}

/* ============================================================
 * Placas de teste pré-configuradas
 * ============================================================ */

const PRESETS: Record<string, VehicleRecord> = {
  BRA2E19: {
    basic: {
      plate: 'BRA2E19', plateFormat: 'mercosul', brand: 'Toyota', model: 'Corolla Cross',
      version: 'XRX 1.8 Hybrid', category: 'SUV', yearManufacture: 2024, yearModel: 2024,
      color: 'Branco Perolizado', fuel: 'Híbrido', engine: '1.8 + motor elétrico', power: '122 cv (combinada)',
      transmission: 'Automático e-CVT', city: 'São Paulo', uf: 'SP',
      chassisMasked: '9BR********318842', renavamMasked: '01*****6721', fipeCode: '002204-7',
      fipeValue: 189450, fipeReference: FIPE_REFERENCE,
    },
    advanced: finalize({
      claims: [],
      auction: null,
      theft: { status: 'nada_consta', source: 'SINESP Cidadão / Polícia Civil-SP', occurrences: [] },
      liens: [],
      restrictions: NO_RESTRICTIONS,
      ownership: buildOwnership([{ uf: 'SP', from: '2024-02-10', to: null, usage: 'Particular' }]),
      structure: buildStructure(),
      debts: buildDebts([], { year: CURRENT_YEAR, amount: 7578, status: 'Pago' }, { year: CURRENT_YEAR, amount: 160.22, status: 'Pago' }),
      insurance: {
        accepted: true, fipePercent: 100, riskProfile: 'Baixo',
        notes: 'Veículo sem restrições. Aceito por todas as seguradoras consultadas a 100% da FIPE.',
        insurers: INSURERS.slice(0, 6).map((name) => ({ name, accepts: true })),
      },
    }),
  },

  KRP8214: {
    basic: {
      plate: 'KRP8214', plateFormat: 'antiga', brand: 'Honda', model: 'Civic',
      version: 'Touring 1.5 Turbo', category: 'Sedã', yearManufacture: 2019, yearModel: 2020,
      color: 'Cinza', fuel: 'Gasolina', engine: '1.5 Turbo', power: '173 cv',
      transmission: 'CVT', city: 'Campinas', uf: 'SP',
      chassisMasked: '93H********702215', renavamMasked: '11*****0384', fipeCode: '014089-9',
      fipeValue: 128900, fipeReference: FIPE_REFERENCE,
    },
    advanced: finalize({
      claims: [
        { date: '2023-05-18', insurer: 'Porto Seguro', severity: 'pequena', description: 'Colisão dianteira leve — para-choque, farol direito e capô. Reparo em oficina referenciada.', indemnified: false },
      ],
      auction: {
        date: '2023-08-22', auctioneer: 'Sodré Santoro', consignor: 'Porto Seguro Cia. de Seguros Gerais',
        lot: '0457', reason: 'Recuperação de sinistro — veículo indenizado e revendido pela seguradora',
        condition: 'Conservado, motor funcionando, danos de pequena monta já reparados',
        yard: 'Pátio Guarulhos/SP — Rod. Presidente Dutra, km 225',
        photoCaption: 'Foto pericial do pátio — lote 0457, vista lateral dianteira esquerda',
      },
      theft: { status: 'nada_consta', source: 'SINESP Cidadão / Polícia Civil-SP', occurrences: [] },
      liens: [],
      restrictions: NO_RESTRICTIONS,
      ownership: buildOwnership([
        { uf: 'SP', from: '2019-11-05', to: '2023-06-30', usage: 'Particular' },
        { uf: 'SP', from: '2023-06-30', to: '2023-08-22', usage: 'Frota empresarial' },
        { uf: 'SP', from: '2023-09-14', to: null, usage: 'Particular' },
      ]),
      structure: buildStructure({
        longarinaDianteira: { status: 'reparo', note: 'Sinais de desempeno leve na ponta da longarina direita. Sem comprometimento estrutural.' },
        cortaFogo: { status: 'ok', note: 'Original. Selante de fábrica preservado.' },
        vidros: { status: 'reparo', note: 'Para-brisa substituído (sem gravação de chassi). Demais vidros originais.' },
      }),
      debts: buildDebts(
        [{ date: '2025-03-11', agency: 'EMDEC Campinas', description: 'Estacionar em local proibido pela sinalização', amount: 130.16, severity: 'Média', points: 4, city: 'Campinas/SP' }],
        { year: CURRENT_YEAR, amount: 5156, status: 'Pago' },
        { year: CURRENT_YEAR, amount: 160.22, status: 'Pago' },
      ),
      insurance: {
        accepted: true, fipePercent: 80, riskProfile: 'Alto',
        notes: 'Passagem por leilão reduz a indenização para 70%–80% da FIPE. Algumas seguradoras recusam a contratação.',
        insurers: [
          { name: 'Porto Seguro', accepts: false }, { name: 'Bradesco Seguros', accepts: false },
          { name: 'Allianz', accepts: true }, { name: 'HDI Seguros', accepts: true },
          { name: 'Azul Seguros', accepts: true }, { name: 'Suhai Seguradora', accepts: true },
        ],
      },
    }),
  },

  ONX3A88: {
    basic: {
      plate: 'ONX3A88', plateFormat: 'mercosul', brand: 'Chevrolet', model: 'Onix Plus',
      version: 'Premier 1.0 Turbo', category: 'Sedã', yearManufacture: 2023, yearModel: 2024,
      color: 'Vermelho', fuel: 'Flex', engine: '1.0 Turbo', power: '116 cv',
      transmission: 'Automático 6 marchas', city: 'Belo Horizonte', uf: 'MG',
      chassisMasked: '9BG********104477', renavamMasked: '13*****9902', fipeCode: '004504-7',
      fipeValue: 104300, fipeReference: FIPE_REFERENCE,
    },
    advanced: finalize({
      claims: [],
      auction: null,
      theft: { status: 'nada_consta', source: 'SINESP Cidadão / Polícia Civil-MG', occurrences: [] },
      liens: [
        { type: 'Alienação fiduciária', creditor: 'Banco Itaú Unibanco S.A.', contract: '0087-552914-3', since: '2023-12-04', status: 'Ativo' },
      ],
      restrictions: {
        renajud: false, judicial: false, administrative: false, tributary: true,
        notes: ['IPVA do exercício corrente em aberto — impede o licenciamento.', 'Transferência depende da quitação do financiamento ou anuência do credor.'],
      },
      ownership: buildOwnership([{ uf: 'MG', from: '2023-12-04', to: null, usage: 'Particular' }]),
      structure: buildStructure(),
      debts: buildDebts(
        [
          { date: '2025-09-02', agency: 'BHTrans', description: 'Transitar em velocidade superior à máxima permitida em até 20%', amount: 130.16, severity: 'Média', points: 4, city: 'Belo Horizonte/MG' },
          { date: '2026-02-17', agency: 'DER-MG', description: 'Transitar em velocidade superior à máxima permitida entre 20% e 50%', amount: 195.23, severity: 'Grave', points: 5, city: 'Contagem/MG' },
        ],
        { year: CURRENT_YEAR, amount: 4172, status: 'Pendente' },
        { year: CURRENT_YEAR, amount: 151.86, status: 'Pendente' },
      ),
      insurance: {
        accepted: true, fipePercent: 100, riskProfile: 'Baixo',
        notes: 'Aceito a 100% da FIPE. Em caso de perda total, a indenização é paga primeiro ao banco credor.',
        insurers: INSURERS.slice(0, 6).map((name) => ({ name, accepts: true })),
      },
    }),
  },

  HYU7F90: {
    basic: {
      plate: 'HYU7F90', plateFormat: 'mercosul', brand: 'Hyundai', model: 'HB20',
      version: 'Platinum 1.0 TGDI', category: 'Hatch', yearManufacture: 2022, yearModel: 2023,
      color: 'Prata', fuel: 'Flex', engine: '1.0 Turbo', power: '120 cv',
      transmission: 'Automático 6 marchas', city: 'Rio de Janeiro', uf: 'RJ',
      chassisMasked: '9BH********551096', renavamMasked: '12*****4418', fipeCode: '015209-9',
      fipeValue: 86750, fipeReference: FIPE_REFERENCE,
    },
    advanced: finalize({
      claims: [
        { date: '2024-07-03', insurer: 'Tokio Marine', severity: 'media', description: 'Danos decorrentes de roubo: ignição violada, painel e porta dianteira esquerda. Reparado e vistoriado.', indemnified: false },
      ],
      auction: null,
      theft: {
        status: 'recuperado', source: 'SINESP Cidadão / Polícia Civil-RJ',
        occurrences: [
          { date: '2024-06-21', type: 'Roubo', city: 'Rio de Janeiro', uf: 'RJ', policeReport: 'BO 021-04877/2024 — 21ª DP Bonsucesso', recoveredAt: '2024-06-29' },
        ],
      },
      liens: [],
      restrictions: { ...NO_RESTRICTIONS, notes: ['Alerta de roubo baixado em 02/07/2024 após recuperação e perícia.'] },
      ownership: buildOwnership([
        { uf: 'RJ', from: '2022-12-15', to: '2024-10-01', usage: 'Particular' },
        { uf: 'RJ', from: '2024-10-01', to: null, usage: 'Particular' },
      ]),
      structure: buildStructure({
        colunaA: { status: 'reparo', note: 'Retoque de pintura na coluna A esquerda, sem solda.' },
        vidros: { status: 'reparo', note: 'Vidro da porta dianteira esquerda substituído após o roubo.' },
        motor: { status: 'ok', note: 'Numeração do motor original confirmada em perícia pós-recuperação.' },
      }),
      debts: buildDebts([], { year: CURRENT_YEAR, amount: 3470, status: 'Pago' }, { year: CURRENT_YEAR, amount: 233.08, status: 'Pago' }),
      insurance: {
        accepted: true, fipePercent: 90, riskProfile: 'Médio',
        notes: 'Histórico de roubo recuperado e regularizado. Aceito com vistoria prévia; prêmio pode ser mais alto.',
        insurers: [
          { name: 'Porto Seguro', accepts: true }, { name: 'Bradesco Seguros', accepts: true },
          { name: 'Allianz', accepts: false }, { name: 'Tokio Marine', accepts: true },
          { name: 'HDI Seguros', accepts: true }, { name: 'Azul Seguros', accepts: true },
        ],
      },
    }),
  },
};

/* ============================================================
 * Gerador dinâmico por hash
 * ============================================================ */

function generateVehicle(plate: string): VehicleRecord {
  const rng = mulberry32(hashString(plate));
  const m = pick(rng, CATALOG);
  const yearModel = int(rng, m.minYear, CURRENT_YEAR);
  const yearManufacture = yearModel > m.minYear && chance(rng, 0.45) ? yearModel - 1 : yearModel;
  const loc = pick(rng, LOCATIONS);
  const age = CURRENT_YEAR - yearModel;
  const fipeValue = round(m.base * Math.pow(0.9, age) * (0.95 + rng() * 0.1), 50);

  const basic: VehicleBasic = {
    plate,
    plateFormat: getPlateFormat(plate),
    brand: m.brand,
    model: m.model,
    version: pick(rng, m.versions),
    category: m.category,
    yearManufacture,
    yearModel,
    color: pick(rng, COLORS),
    fuel: m.fuel,
    engine: m.engine,
    power: m.power,
    transmission: m.transmission,
    city: loc.city,
    uf: loc.uf,
    chassisMasked: `${m.wmi}********${digits(rng, 6)}`,
    renavamMasked: `${digits(rng, 2)}*****${digits(rng, 4)}`,
    fipeCode: m.fipeCode,
    fipeValue,
    fipeReference: FIPE_REFERENCE,
  };

  // ---- Perfil de risco do veículo
  const hasClaim = chance(rng, 0.28);
  const hasAuction = chance(rng, 0.12);
  const theftRoll = rng();
  const theftStatus = theftRoll < 0.05 ? 'recuperado' : 'nada_consta';
  const hasLien = age <= 4 && chance(rng, 0.45);

  const claims: InsuranceClaim[] = [];
  if (hasClaim) {
    const severity = pick(rng, ['pequena', 'pequena', 'media', 'media', 'grande'] as const);
    const desc = {
      pequena: 'Colisão leve — para-choque e lanterna. Reparo estético.',
      media: 'Colisão lateral — portas, para-lama e suspensão. Reparo estrutural parcial.',
      grande: 'Colisão de grande monta — danos estruturais com perda total declarada.',
    }[severity];
    claims.push({ date: randomDate(rng, yearManufacture), insurer: pick(rng, INSURERS), severity, description: desc, indemnified: severity === 'grande' });
  }
  const bigDamage = claims.some((c) => c.severity === 'grande');

  let auction: AuctionRecord | null = null;
  if (hasAuction || bigDamage) {
    const reasons = [
      'Recuperação de financiamento — veículo apreendido por inadimplência',
      'Recuperação de sinistro — veículo indenizado pela seguradora',
      'Renovação de frota de locadora',
      'Veículo removido ao pátio do DETRAN e não reclamado',
    ];
    const lot = String(int(rng, 1, 999)).padStart(4, '0');
    auction = {
      date: randomDate(rng, yearManufacture),
      auctioneer: pick(rng, AUCTIONEERS),
      consignor: bigDamage ? claims[0].insurer : pick(rng, [...BANKS.slice(0, 3), 'Localiza Rent a Car S.A.', `DETRAN-${loc.uf}`]),
      lot,
      reason: bigDamage ? reasons[1] : pick(rng, reasons),
      condition: bigDamage ? 'Sinistrado — danos estruturais de grande monta' : pick(rng, ['Conservado, motor funcionando', 'Com avarias leves de lataria', 'Sem chave reserva, motor funcionando']),
      yard: `Pátio ${loc.city}/${loc.uf}`,
      photoCaption: `Foto pericial do pátio — lote ${lot}`,
    };
  }

  const theft: TheftHistory = {
    status: theftStatus,
    source: `SINESP Cidadão / Polícia Civil-${loc.uf}`,
    occurrences:
      theftStatus === 'recuperado'
        ? (() => {
            const date = randomDate(rng, yearManufacture);
            const d = new Date(date);
            d.setDate(d.getDate() + int(rng, 2, 25));
            return [{
              date,
              type: pick(rng, ['Roubo', 'Furto'] as const),
              city: loc.city,
              uf: loc.uf,
              policeReport: `BO ${digits(rng, 3)}-${digits(rng, 5)}/${date.slice(0, 4)}`,
              recoveredAt: d.toISOString().slice(0, 10),
            }];
          })()
        : [],
  };

  const liens: Lien[] = hasLien
    ? [{ type: 'Alienação fiduciária', creditor: pick(rng, BANKS), contract: `${digits(rng, 4)}-${digits(rng, 6)}-${int(rng, 0, 9)}`, since: isoDate(yearManufacture, int(rng, 1, 12), int(rng, 1, 28)), status: 'Ativo' }]
    : [];

  const renajud = chance(rng, 0.04);
  const ipvaPending = chance(rng, 0.2);
  const restrictions: Restrictions = {
    renajud,
    judicial: renajud,
    administrative: false,
    tributary: ipvaPending,
    notes: [
      ...(renajud ? ['Bloqueio RENAJUD de transferência determinado por vara cível.'] : []),
      ...(ipvaPending ? ['IPVA do exercício corrente em aberto.'] : []),
      ...(hasLien ? ['Transferência depende da baixa do gravame pelo credor.'] : []),
    ],
  };

  // ---- Proprietários
  const ownersCount = Math.min(1 + Math.floor(age / 3) + (chance(rng, 0.3) ? 1 : 0), 6);
  const firstDate = new Date(isoDate(yearManufacture, int(rng, 1, 12), int(rng, 1, 28)));
  const span = Date.now() - firstDate.getTime();
  const owners: Omit<OwnerRecord, 'months' | 'order'>[] = [];
  for (let i = 0; i < ownersCount; i++) {
    const from = new Date(firstDate.getTime() + (span * i) / ownersCount).toISOString().slice(0, 10);
    const to = i === ownersCount - 1 ? null : new Date(firstDate.getTime() + (span * (i + 1)) / ownersCount).toISOString().slice(0, 10);
    const usage: OwnerUsage = i === 0 && chance(rng, 0.25) ? pick(rng, ['Locadora', 'Frota empresarial'] as const) : 'Particular';
    owners.push({ uf: i === ownersCount - 1 ? loc.uf : pick(rng, LOCATIONS).uf, from, to, usage });
  }

  // ---- Estrutura
  const structOverrides: Partial<Record<StructuralPointId, { status: StructuralStatus; note: string }>> = {};
  if (claims.length) {
    const sev = claims[0].severity;
    if (sev === 'pequena') structOverrides.vidros = { status: 'reparo', note: 'Um vidro substituído sem gravação de chassi.' };
    if (sev === 'media') {
      structOverrides.colunaB = { status: 'reparo', note: 'Sinais de reparo com massa na coluna B.' };
      structOverrides.longarinaDianteira = { status: 'reparo', note: 'Desempeno na ponta da longarina.' };
    }
    if (sev === 'grande') {
      structOverrides.longarinaDianteira = { status: 'dano', note: 'Longarina com corte e emenda soldada.' };
      structOverrides.cortaFogo = { status: 'dano', note: 'Corta-fogo deformado e reparado.' };
      structOverrides.colunaA = { status: 'reparo', note: 'Solda fora do padrão de fábrica.' };
    }
  }

  // ---- Débitos
  const agencies = AGENCIES_BY_UF[loc.uf] ?? [`DETRAN-${loc.uf}`, 'PRF'];
  const fines: Fine[] = Array.from({ length: chance(rng, 0.45) ? int(rng, 1, 4) : 0 }, () => {
    const f = pick(rng, FINE_TYPES);
    return { date: randomDate(rng, Math.max(yearManufacture, CURRENT_YEAR - 2)), agency: pick(rng, agencies), description: f.description, amount: f.amount, severity: f.severity, points: f.points, city: `${loc.city}/${loc.uf}` };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const ipvaRate = ['SP', 'RJ', 'MG'].includes(loc.uf) ? 0.04 : 0.03;
  const debts = buildDebts(
    fines,
    { year: CURRENT_YEAR, amount: m.fuel === 'Elétrico' || age >= 20 ? 0 : Math.round(fipeValue * ipvaRate), status: ipvaPending ? 'Pendente' : 'Pago' },
    { year: CURRENT_YEAR, amount: Math.round((140 + rng() * 100) * 100) / 100, status: ipvaPending && chance(rng, 0.6) ? 'Pendente' : 'Pago' },
  );

  // ---- Seguradoras
  const riskProfile = bigDamage || renajud ? 'Alto' : auction ? 'Alto' : theft.status === 'recuperado' || claims.length ? 'Médio' : 'Baixo';
  const fipePercent = bigDamage ? 0 : auction ? 75 : theft.status === 'recuperado' ? 90 : 100;
  const insurance: InsuranceAcceptance = {
    accepted: !bigDamage,
    fipePercent,
    riskProfile,
    notes: bigDamage
      ? 'Veículo com perda total registrada. Não aceito pelas principais seguradoras.'
      : auction
        ? 'Passagem por leilão reduz a indenização para 70%–80% da FIPE.'
        : riskProfile === 'Médio'
          ? 'Aceito com vistoria prévia; prêmio pode ser mais alto.'
          : 'Aceito por todas as seguradoras consultadas a 100% da FIPE.',
    insurers: INSURERS.slice(0, 6).map((name) => ({
      name,
      accepts: bigDamage ? false : riskProfile === 'Baixo' ? true : chance(rng, riskProfile === 'Alto' ? 0.5 : 0.8),
    })),
  };

  return {
    basic,
    advanced: finalize({
      claims,
      auction,
      theft,
      liens,
      restrictions,
      ownership: buildOwnership(owners),
      structure: buildStructure(structOverrides),
      debts,
      insurance,
    }),
  };
}

/** Retorna os dados do veículo (pré-configurado ou gerado por hash). */
export function getVehicleByPlate(input: string): VehicleRecord {
  const plate = normalizePlate(input);
  return PRESETS[plate] ?? generateVehicle(plate);
}

/** Simula a latência de uma API real de consulta. */
export function fetchVehicle(input: string, delayMs = 900): Promise<VehicleRecord> {
  return new Promise((resolve) => setTimeout(() => resolve(getVehicleByPlate(input)), delayMs));
}
