import { LoaderCircle } from 'lucide-react';
import App from './App';
import { isAuthConfigured } from './config';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { signOut } from './services/auth';
import { clearLocalData } from './services/historyStorage';

/**
 * O app só abre com login Google. Sem sessão, mostra a tela de entrada.
 * Enquanto a chave pública do Supabase não estiver configurada (VITE_SUPABASE_PUBLISHABLE_KEY),
 * o login fica desligado e o app abre direto — ele liga sozinho quando a chave for cadastrada.
 */
export default function AuthGate() {
  const { loading, user, error } = useAuth();

  if (!isAuthConfigured) return <App user={null} onSignOut={() => {}} />;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900" role="status" aria-label="Carregando">
        <LoaderCircle className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return <LoginScreen error={error} />;

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
