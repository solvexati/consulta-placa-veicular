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

/**
 * Valida o login Google (token do Supabase em `Authorization: Bearer`).
 * A assinatura é conferida com as chaves públicas do Supabase (JWKS, em cache),
 * então não dá para forjar um usuário. Lança 401 se não houver sessão válida.
 */
export async function requireUser(req: Request): Promise<RequestUser | null> {
  if (!getEnv().authRequired) return null;
  const token = getBearerToken(req);
  if (!token) throw new HttpError(401, 'unauthenticated', 'Faça login com o Google para continuar.');

  const { data, error } = await getAuthClient().auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== 'authenticated') {
    throw new HttpError(401, 'unauthenticated', 'Sua sessão expirou. Entre novamente com o Google.');
  }
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
}
