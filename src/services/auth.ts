import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isAuthConfigured } from '../config';

/**
 * Login com Google via Supabase Auth (fluxo PKCE).
 * A sessão fica salva no aparelho, então o app abre logado — inclusive offline.
 */
export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'cpv:auth',
      },
    })
  : null;

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Login ainda não configurado.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Token do usuário logado (renovado automaticamente) para enviar ao backend. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function onSessionChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export function translateAuthError(message: string): string {
  if (/provider is not enabled|Unsupported provider/i.test(message)) return 'Login com Google ainda não foi ativado no servidor.';
  if (/redirect/i.test(message)) return 'Endereço de retorno do login não autorizado.';
  if (/network|fetch/i.test(message)) return 'Sem conexão. Verifique a internet e tente novamente.';
  return message;
}
