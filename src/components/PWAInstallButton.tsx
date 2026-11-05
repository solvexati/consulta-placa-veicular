import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { cn, haptic } from '../utils/format';

interface Props {
  variant?: 'compact' | 'full';
  onInstalled?: () => void;
}

export default function PWAInstallButton({ variant = 'compact', onInstalled }: Props) {
  const { showInstall, canPrompt, isIOS, promptInstall } = usePWAInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (!showInstall) return null;

  async function handleClick() {
    haptic();
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') onInstalled?.();
    } else if (isIOS) {
      setIosOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'tap inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
          variant === 'compact'
            ? 'h-11 bg-white/10 px-3 text-sm text-white hover:bg-white/20'
            : 'h-12 w-full bg-slate-900 px-4 text-white hover:bg-slate-800',
        )}
      >
        <Download className="h-4 w-4" />
        <span>{variant === 'compact' ? <><span className="sm:hidden">Instalar</span><span className="hidden sm:inline">Instalar App</span></> : 'Instalar App'}</span>
      </button>
      {iosOpen && <IOSInstallModal onClose={() => setIosOpen(false)} />}
    </>
  );
}

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ios-title" onClick={onClose}>
      <div className="animate-slide-up pb-safe w-full max-w-sm rounded-t-3xl bg-white p-6 text-slate-900 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/apple-touch-icon.png" alt="" className="h-12 w-12 rounded-xl" />
            <div>
              <h2 id="ios-title" className="text-lg font-bold">Instalar no iPhone</h2>
              <p className="text-sm text-slate-500">Acesso rápido, tela cheia e uso offline</p>
            </div>
          </div>
          <button onClick={onClose} className="tap -mt-1 -mr-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="space-y-3">
          <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span>
            <span className="text-sm">
              Toque no botão <strong>Compartilhar</strong>{' '}
              <Share className="inline h-4 w-4 align-text-bottom text-blue-600" /> na barra do Safari.
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span>
            <span className="text-sm">
              Role e escolha <strong>Adicionar à Tela de Início</strong>{' '}
              <SquarePlus className="inline h-4 w-4 align-text-bottom text-blue-600" />.
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">3</span>
            <span className="text-sm">
              Toque em <strong>Adicionar</strong>. O ícone aparecerá na sua tela inicial.
            </span>
          </li>
        </ol>

        <button onClick={onClose} className="tap mt-5 h-12 w-full rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800">
          Entendi
        </button>
      </div>
    </div>
  );
}
