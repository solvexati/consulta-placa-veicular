import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';
import { HttpError, getBearerToken } from './http.js';

export interface RequestUser {
  id: string;
  email: string;
}

let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = getEnv();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new HttpError(500, 'internal_error', 'Login não configurado no servidor (SUPABASE_PUBLISHABLE_KEY).');
  }
  authClient ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authClient;
}

const LOGIN_STATUS_TTL_MS = 5 * 60 * 1000;
let loginStatus: { active: boolean; checkedAt: number } | null = null;

/**
 * O provedor Google está ATIVADO no painel do Supabase? (consulta em cache por 5 min)
 * Enquanto não estiver, a API funciona sem login. Se o Supabase não responder,
 * usa o último valor conhecido; sem nenhum, assume ativo (mais seguro).
 */
export async function isLoginActive(): Promise<boolean> {
  if (loginStatus && Date.now() - loginStatus.checkedAt < LOGIN_STATUS_TTL_MS) return loginStatus.active;
  const { supabaseUrl, supabasePublishableKey } = getEnv();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const settings = (await res.json()) as { external?: { google?: boolean } };
    loginStatus = { active: settings.external?.google === true, checkedAt: Date.now() };
  } catch (err) {
    console.warn('[auth] não foi possível consultar o status do login:', (err as Error).message);
    loginStatus = { active: loginStatus?.active ?? true, checkedAt: Date.now() };
  }
  return loginStatus.active;
}

/**
 * Valida o login Google (token do Supabase em `Authorization: Bearer`).
 * A assinatura é conferida com as chaves públicas do Supabase (JWKS, em cache),
 * então não dá para forjar um usuário. Lança 401 se o login for exigido e não
 * houver sessão válida. Token enviado é sempre validado, mesmo com login opcional.
 */
export async function requireUser(req: Request): Promise<RequestUser | null> {
  if (!getEnv().authRequired) return null;
  const token = getBearerToken(req);
  if (!token) {
    if (!(await isLoginActive())) return null;
    throw new HttpError(401, 'unauthenticated', 'Faça login com o Google para continuar.');
  }

  const { data, error } = await getAuthClient().auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== 'authenticated') {
    throw new HttpError(401, 'unauthenticated', 'Sua sessão expirou. Entre novamente com o Google.');
  }
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
}
