export type PlateFormat = 'mercosul' | 'antiga';

export type FuelType = 'Flex' | 'Gasolina' | 'Diesel' | 'Elétrico' | 'Híbrido';

export interface VehicleBasic {
  plate: string;
  plateFormat: PlateFormat;
  brand: string;
  model: string;
  version: string;
  category: string;
  yearManufacture: number;
  yearModel: number;
  color: string;
  fuel: FuelType;
  engine: string;
  power: string;
  transmission: string;
  city: string;
  uf: string;
  chassisMasked: string;
  renavamMasked: string;
  fipeCode: string;
  fipeValue: number;
  fipeReference: string;
}

export type DamageSeverity = 'pequena' | 'media' | 'grande';

export interface InsuranceClaim {
  date: string;
  insurer: string;
  severity: DamageSeverity;
  description: string;
  indemnified: boolean;
}

export interface AuctionRecord {
  date: string;
  auctioneer: string;
  consignor: string;
  lot: string;
  reason: string;
  condition: string;
  yard: string;
  photoCaption: string;
}

export type TheftStatus = 'nada_consta' | 'recuperado' | 'ativo';

export interface TheftOccurrence {
  date: string;
  type: 'Roubo' | 'Furto';
  city: string;
  uf: string;
  policeReport: string;
  recoveredAt?: string;
}

export interface TheftHistory {
  status: TheftStatus;
  source: string;
  occurrences: TheftOccurrence[];
}

export interface Lien {
  type: string;
  creditor: string;
  contract: string;
  since: string;
  status: 'Ativo' | 'Baixado';
}

export interface Restrictions {
  renajud: boolean;
  judicial: boolean;
  administrative: boolean;
  tributary: boolean;
  notes: string[];
}

export type OwnerUsage = 'Particular' | 'Frota empresarial' | 'Locadora';

export interface OwnerRecord {
  order: number;
  uf: string;
  from: string;
  to: string | null;
  usage: OwnerUsage;
  months: number;
}

export interface OwnershipHistory {
  totalOwners: number;
  averageMonths: number;
  mainUsage: OwnerUsage;
  owners: OwnerRecord[];
}

export type StructuralStatus = 'ok' | 'reparo' | 'dano';

export type StructuralPointId =
  | 'colunaA'
  | 'colunaB'
  | 'colunaC'
  | 'longarinaDianteira'
  | 'longarinaTraseira'
  | 'cortaFogo'
  | 'estepe'
  | 'vidros'
  | 'motor'
  | 'assoalho';

export interface StructuralPoint {
  id: StructuralPointId;
  label: string;
  status: StructuralStatus;
  note: string;
}

export type FineSeverity = 'Leve' | 'Média' | 'Grave' | 'Gravíssima';

export interface Fine {
  date: string;
  agency: string;
  description: string;
  amount: number;
  severity: FineSeverity;
  points: number;
  city: string;
}

export interface TaxItem {
  year: number;
  amount: number;
  status: 'Pago' | 'Pendente';
}

export interface Debts {
  fines: Fine[];
  ipva: TaxItem;
  licensing: TaxItem;
  total: number;
}

export type RiskProfile = 'Baixo' | 'Médio' | 'Alto';

export interface InsuranceAcceptance {
  accepted: boolean;
  fipePercent: number;
  riskProfile: RiskProfile;
  notes: string;
  insurers: { name: string; accepts: boolean }[];
}

export interface AdvancedReport {
  score: number;
  claims: InsuranceClaim[];
  auction: AuctionRecord | null;
  theft: TheftHistory;
  liens: Lien[];
  restrictions: Restrictions;
  ownership: OwnershipHistory;
  structure: StructuralPoint[];
  debts: Debts;
  insurance: InsuranceAcceptance;
}

export interface VehicleRecord {
  basic: VehicleBasic;
  advanced: AdvancedReport;
}

export interface HistoryEntry {
  plate: string;
  brand: string;
  model: string;
  yearModel: number;
  fipeValue: number;
  searchedAt: string;
  unlocked: boolean;
}

export type PaymentMethod = 'pix' | 'cartao';

export interface UnlockReceipt {
  plate: string;
  method: PaymentMethod;
  amount: number;
  transactionId: string;
  paidAt: string;
}
