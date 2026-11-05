/** Preço oficial da Tabela FIPE para um código + ano-modelo. */
export interface FipePrice {
  value: number;
  /** Mês de referência da tabela, ex.: "novembro/2026". */
  reference: string;
  /** Descrição do modelo segundo a FIPE. */
  model: string;
  source: string;
}

/**
 * Fonte de preços FIPE. Para adicionar outra: implemente esta interface em
 * `server/fipe/<nome>.ts` e registre em `server/fipe/index.ts`.
 */
export interface FipePriceSource {
  readonly name: string;
  /** `null` se o código/ano não existir na tabela. Lança erro se a fonte estiver fora do ar. */
  getPrice(fipeCode: string, yearModel: number): Promise<FipePrice | null>;
}

/** "R$ 156.804,00" → 156804 */
export function parseBRL(text: string): number {
  const n = Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** "novembro de 2026 " → "novembro/2026" */
export function normalizeReference(text: string): string {
  return text.trim().replace(/\s+de\s+/i, '/').toLowerCase();
}
