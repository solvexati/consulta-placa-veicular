import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isAuthConfigured } from '../config';

const CACHE_KEY = 'cpv:google-login-active';

/**
 * Pergunta ao Supabase se o login com Google está ATIVADO no painel.
 * Enquanto não estiver, o app funciona sem login; quando for ativado,
 * o login passa a ser exigido sozinho, sem novo deploy.
 * Sem internet, usa o último valor conhecido.
 */
export async function isGoogleLoginActive(): Promise<boolean> {
  if (!isAuthConfigured) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const settings = (await res.json()) as { external?: { google?: boolean } };
    const active = settings.external?.google === true;
    try {
      localStorage.setItem(CACHE_KEY, active ? '1' : '0');
    } catch {
      /* sem armazenamento */
    }
    return active;
  } catch {
    try {
      return localStorage.getItem(CACHE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
