import { FileText, History, Search } from 'lucide-react';
import PWAInstallButton from './PWAInstallButton';
import { cn } from '../utils/format';

export type View = 'search' | 'history' | 'report';

interface Props {
  view: View;
  historyCount: number;
  onNavigate: (view: View) => void;
  onReport: () => void;
  onInstalled: () => void;
}

export default function Header({ view, historyCount, onNavigate, onReport, onInstalled }: Props) {
  const navItem = (active: boolean) =>
    cn(
      'tap hidden h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold md:inline-flex',
      active ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10',
    );

  return (
    <header className="no-print pt-safe sticky top-0 z-40 bg-slate-900 text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <button onClick={() => onNavigate('search')} className="tap flex min-h-11 items-center gap-2.5 rounded-xl" aria-label="Ir para a busca">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-lg" />
          <span className="text-left leading-tight">
            <span className="block text-base font-extrabold tracking-tight">Consulta Placa</span>
            <span className="block text-[11px] font-medium text-slate-400">Laudo veicular completo</span>
          </span>
        </button>

        <nav className="flex items-center gap-1.5" aria-label="Principal">
          <button onClick={() => onNavigate('search')} className={navItem(view === 'search')}>
            <Search className="h-4 w-4" /> Buscar
          </button>
          <button onClick={onReport} className={navItem(view === 'report')}>
            <FileText className="h-4 w-4" /> Laudo R$ 35
          </button>
          <button
            onClick={() => onNavigate('history')}
            className={cn(
              'tap relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold',
              view === 'history' ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10',
            )}
            aria-label={`Histórico (${historyCount})`}
          >
            <History className="h-5 w-5 md:h-4 md:w-4" />
            <span className="hidden md:inline">Histórico</span>
            {historyCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white md:static">
                {historyCount}
              </span>
            )}
          </button>
          <PWAInstallButton onInstalled={onInstalled} />
        </nav>
      </div>
    </header>
  );
}
