import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { onSessionChange, supabase, translateAuthError } from '../services/auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  /** Erro devolvido pelo Google/Supabase ao voltar do login. */
  error: string | null;
}

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = u.user_metadata as Record<string, string | undefined>;
  return {
    id: u.id,
    email: u.email ?? '',
    name: meta.full_name || meta.name || u.email || 'Usuário',
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}

/** Lê o erro que o Supabase devolve na URL após um login cancelado/recusado. */
function readRedirectError(): string | null {
  const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '&'));
  const desc = params.get('error_description') || params.get('error');
  if (!desc) return null;
  window.history.replaceState(window.history.state, '', window.location.pathname);
  return translateAuthError(desc.replace(/\+/g, ' '));
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({ loading: Boolean(supabase), user: null, error: null }));

  useEffect(() => {
    if (!supabase) return;
    const redirectError = readRedirectError();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ loading: false, user: toUser(data.session), error: redirectError });
    });
    const unsubscribe = onSessionChange((session) => {
      if (active) setState((s) => ({ loading: false, user: toUser(session), error: session ? null : s.error }));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
