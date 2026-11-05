/**
 * Validador do formato devolvido pelos provedores. Roda:
 *  - automaticamente antes de gravar no cache (resposta fora do formato NÃO é
 *    guardada nem enviada ao app — protege contra a API mudar sem aviso);
 *  - manualmente com `npm run provider:check` ao plugar/trocar de API.
 * Retorna a lista de problemas (vazia = válido).
 */

type Check = (value: unknown) => boolean;

const isStr: Check = (v) => typeof v === 'string';
const isNum: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const isBool: Check = (v) => typeof v === 'boolean';
const isArr: Check = (v) => Array.isArray(v);
const isObj: Check = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = (...values: string[]): Check => (v) => typeof v === 'string' && values.includes(v);
const nullable = (c: Check): Check => (v) => v === null || c(v);

function check(obj: unknown, path: string, schema: Record<string, Check>, problems: string[]): void {
  if (!isObj(obj)) {
    problems.push(`${path}: esperado objeto`);
    return;
  }
  const rec = obj as Record<string, unknown>;
  for (const [key, test] of Object.entries(schema)) {
    if (!test(rec[key])) problems.push(`${path}.${key}: valor inválido (${JSON.stringify(rec[key])?.slice(0, 60)})`);
  }
}

function checkList(list: unknown, path: string, schema: Record<string, Check>, problems: string[]): void {
  if (!isArr(list)) {
    problems.push(`${path}: esperado lista`);
    return;
  }
  (list as unknown[]).forEach((item, i) => check(item, `${path}[${i}]`, schema, problems));
}

export function validateBasic(v: unknown): string[] {
  const p: string[] = [];
  check(v, 'basic', {
    plate: (x) => isStr(x) && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(x as string),
    plateFormat: oneOf('mercosul', 'antiga'),
    brand: isStr, model: isStr, version: isStr, category: isStr,
    yearManufacture: isNum, yearModel: isNum,
    color: isStr,
    fuel: oneOf('Flex', 'Gasolina', 'Diesel', 'Elétrico', 'Híbrido'),
    engine: isStr, power: isStr, transmission: isStr,
    city: isStr, uf: (x) => isStr(x) && (x as string).length === 2,
    chassisMasked: isStr, renavamMasked: isStr,
    fipeCode: isStr, fipeValue: isNum, fipeReference: isStr,
  }, p);
  return p;
}

export function validateReport(v: unknown): string[] {
  const p: string[] = [];
  if (!isObj(v)) return ['report: esperado objeto'];
  const r = v as Record<string, unknown>;

  check(r, 'report', { score: isNum, claims: isArr, auction: nullable(isObj), structure: isArr, liens: isArr }, p);
  checkList(r.claims, 'report.claims', {
    date: isStr, insurer: isStr, severity: oneOf('pequena', 'media', 'grande'), description: isStr, indemnified: isBool,
  }, p);
  if (r.auction) {
    check(r.auction, 'report.auction', {
      date: isStr, auctioneer: isStr, consignor: isStr, lot: isStr, reason: isStr, condition: isStr, yard: isStr, photoCaption: isStr,
    }, p);
  }
  check(r.theft, 'report.theft', { status: oneOf('nada_consta', 'recuperado', 'ativo'), source: isStr, occurrences: isArr }, p);
  checkList(r.liens, 'report.liens', { type: isStr, creditor: isStr, contract: isStr, since: isStr, status: oneOf('Ativo', 'Baixado') }, p);
  check(r.restrictions, 'report.restrictions', { renajud: isBool, judicial: isBool, administrative: isBool, tributary: isBool, notes: isArr }, p);
  check(r.ownership, 'report.ownership', {
    totalOwners: isNum, averageMonths: isNum, mainUsage: oneOf('Particular', 'Frota empresarial', 'Locadora'), owners: isArr,
  }, p);
  checkList(r.structure, 'report.structure', { id: isStr, label: isStr, status: oneOf('ok', 'reparo', 'dano'), note: isStr }, p);
  check(r.debts, 'report.debts', { fines: isArr, ipva: isObj, licensing: isObj, total: isNum }, p);
  if (isObj(r.debts)) {
    const d = r.debts as Record<string, unknown>;
    checkList(d.fines, 'report.debts.fines', {
      date: isStr, agency: isStr, description: isStr, amount: isNum, severity: oneOf('Leve', 'Média', 'Grave', 'Gravíssima'), points: isNum, city: isStr,
    }, p);
    for (const tax of ['ipva', 'licensing'] as const) {
      check(d[tax], `report.debts.${tax}`, { year: isNum, amount: isNum, status: oneOf('Pago', 'Pendente') }, p);
    }
  }
  check(r.insurance, 'report.insurance', {
    accepted: isBool, fipePercent: isNum, riskProfile: oneOf('Baixo', 'Médio', 'Alto'), notes: isStr, insurers: isArr,
  }, p);
  return p;
}
