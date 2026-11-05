import type {
  ApiErrorBody,
  ApiErrorCode,
  ReportResponse,
  UnlockRequest,
  UnlockResponse,
  VehicleResponse,
} from '../../shared/apiContract';
import type { AdvancedReport, PaymentMethod, VehicleBasic } from '../../shared/vehicle';

/** URL base do backend. Vazio = mesma origem (Vercel serve app e /api juntos). */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode | 'network_error' | 'timeout',
    message: string,
    public readonly status = 0,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new ApiError('timeout', 'O servidor demorou para responder. Tente novamente.');
    }
    throw new ApiError('network_error', navigator.onLine ? 'Não foi possível conectar ao servidor.' : 'Você está offline.');
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const e = (body as ApiErrorBody | null)?.error;
    throw new ApiError(e?.code ?? 'internal_error', e?.message ?? `Erro ${res.status} no servidor.`, res.status);
  }
  return body as T;
}

/** Requisições em andamento: cliques repetidos na mesma placa reaproveitam a mesma chamada. */
const inFlight = new Map<string, Promise<unknown>>();

function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = run().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export function fetchVehicleBasic(plate: string): Promise<VehicleBasic> {
  return once(`basic:${plate}`, async () => {
    const r = await request<VehicleResponse>(`/api/vehicle?plate=${encodeURIComponent(plate)}`);
    return r.vehicle;
  });
}

export async function unlockVehicleReport(plate: string, method: PaymentMethod): Promise<UnlockResponse> {
  const payload: UnlockRequest = { plate, method };
  return request<UnlockResponse>('/api/unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchVehicleReport(plate: string, accessToken: string): Promise<AdvancedReport> {
  return once(`report:${plate}`, async () => {
    const r = await request<ReportResponse>(`/api/report?plate=${encodeURIComponent(plate)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return r.report;
  });
}
