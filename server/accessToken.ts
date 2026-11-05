import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAccessTokenSecret } from './env.js';

/**
 * Token de acesso ao laudo, assinado com HMAC-SHA256 (mesma ideia de um JWT).
 * A verificação não depende de banco nem de memória compartilhada — cada rota
 * da Vercel roda numa função separada, então isso é obrigatório sem Supabase.
 * Formato: base64url(payload JSON) + "." + base64url(assinatura)
 */
export interface AccessTokenPayload {
  v: 1;
  plate: string;
  tx: string;
  iat: number;
}

function sign(data: string): string {
  return createHmac('sha256', getAccessTokenSecret()).update(data).digest('base64url');
}

export function createAccessToken(plate: string, transactionId: string): string {
  const payload: AccessTokenPayload = { v: 1, plate, tx: transactionId, iat: Math.floor(Date.now() / 1000) };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Retorna o payload se a assinatura for válida; caso contrário, `null`. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const [body, signature, ...rest] = token.split('.');
  if (!body || !signature || rest.length) return null;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AccessTokenPayload;
    return payload.v === 1 && typeof payload.plate === 'string' ? payload : null;
  } catch {
    return null;
  }
}
