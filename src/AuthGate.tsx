import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import App from './App';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { signOut } from './services/auth';
import { clearLocalData } from './services/historyStorage';
import { isGoogleLoginActive } from './services/loginStatus';

/**
 * Login com Google obrigatório para usar o app.
 * Liga sozinho: enquanto o provedor Google não estiver ATIVADO no painel do
 * Supabase, o app abre direto (sem login). Ao ativar, passa a exigir login.
 */
export default function AuthGate() {
  const { loading, user, error } = useAuth();
  const [loginActive, setLoginActive] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    isGoogleLoginActive().then((active) => alive && setLoginActive(active));
    return () => {
      alive = false;
    };
  }, []);

  if (loading || loginActive === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900" role="status" aria-label="Carregando">
        <LoaderCircle className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (user) {
    return (
      <App
        key={user.id}
        user={user}
        onSignOut={async () => {
          clearLocalData(); // próximo usuário do aparelho não vê dados do anterior
          await signOut();
        }}
      />
    );
  }

  if (!loginActive) return <App user={null} onSignOut={() => {}} />;

  return <LoginScreen error={error} />;
}
