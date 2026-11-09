import type { ApiErrorBody, ApiErrorCode } from '../shared/apiContract.js';
import { isValidPlate, normalizePlate } from '../shared/plateFormatter.js';
import { checkRateLimit } from './rateLimit.js';
import { getEnv } from './env.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function json<T>(body: T, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } };
    return json(body, err.status, err.headers);
  }
  console.error('[api] erro inesperado', err);
  const body: ApiErrorBody = { error: { code: 'internal_error', message: 'Erro interno. Tente novamente.' } };
  return json(body, 500);
}

/** Envolve um handler: captura erros e devolve sempre JSON padronizado. */
export function route(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function methodNotAllowed(allowed: string[]): Response {
  return errorResponse(new HttpError(405, 'method_not_allowed', `Use ${allowed.join(', ')}.`, { allow: allowed.join(', ') }));
}

/** Lê e valida `?plate=` da URL. */
export function requirePlate(req: Request): string {
  const raw = new URL(req.url).searchParams.get('plate') ?? '';
  return validatePlate(raw);
}

export function validatePlate(raw: unknown): string {
  const plate = normalizePlate(String(raw ?? ''));
  if (!isValidPlate(plate)) {
    throw new HttpError(400, 'invalid_plate', 'Placa inválida. Use o formato ABC1234 ou ABC1D23.');
  }
  return plate;
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : null;
}

/** Token de acesso a um laudo desbloqueado (header X-Report-Token). */
export function getReportToken(req: Request): string | null {
  return req.headers.get('x-report-token')?.trim() || null;
}

/** Aplica o limite de requisições por usuário (ou por IP, sem login); lança 429 se excedido. */
export function enforceRateLimit(req: Request, bucket: string, userId?: string | null): void {
  const { rateLimitPerMinute } = getEnv();
  const who = userId ? `u:${userId}` : `ip:${getClientIp(req)}`;
  const result = checkRateLimit(`${bucket}:${who}`, rateLimitPerMinute, 60_000);
  if (!result.allowed) {
    throw new HttpError(429, 'rate_limited', 'Muitas consultas em pouco tempo. Aguarde um instante.', {
      'retry-after': String(Math.ceil(result.retryAfterMs / 1000)),
    });
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'invalid_body', 'Corpo da requisição deve ser JSON válido.');
  }
}
