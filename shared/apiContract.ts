/**
 * Contrato HTTP entre o app (src/) e o backend (api/ + server/).
 * Qualquer mudança aqui deve ser refletida nos dois lados.
 */
import type { AdvancedReport, PaymentMethod, UnlockReceipt, VehicleBasic } from './vehicle.js';

export type DataSource = 'cache' | 'provider';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiErrorCode =
  | 'invalid_plate'
  | 'invalid_body'
  | 'method_not_allowed'
  | 'not_found'
  | 'unauthorized'
  | 'rate_limited'
  | 'payments_not_configured'
  | 'provider_error'
  | 'internal_error';

/** GET /api/vehicle?plate=ABC1D23 — dados básicos (grátis). */
export interface VehicleResponse {
  vehicle: VehicleBasic;
  source: DataSource;
  provider: string;
  fetchedAt: string;
}

/** POST /api/unlock — libera o laudo completo (pagamento simulado por enquanto). */
export interface UnlockRequest {
  plate: string;
  method: PaymentMethod;
}

export interface UnlockResponse {
  receipt: UnlockReceipt;
  /** Token de acesso ao laudo. Enviar como `Authorization: Bearer <token>`. */
  accessToken: string;
}

/** GET /api/report?plate=ABC1D23 + Authorization: Bearer <token> — laudo completo. */
export interface ReportResponse {
  plate: string;
  report: AdvancedReport;
  source: DataSource;
  provider: string;
  fetchedAt: string;
}

/** GET /api/health */
export interface HealthResponse {
  status: 'ok';
  provider: string;
  store: 'supabase' | 'memory';
  simulatedPayments: boolean;
  time: string;
}
