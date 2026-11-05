import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, FileText, History, Info, Search, WifiOff } from 'lucide-react';
import Header, { type View } from './components/Header';
import PlateSearchBox from './components/PlateSearchBox';
import VehicleBasicResult from './components/VehicleBasicResult';
import AdvancedReportView from './components/AdvancedReportView';
import AdvancedCheckoutModal from './components/AdvancedCheckoutModal';
import SearchHistoryView from './components/SearchHistoryView';
import PWAInstallButton from './components/PWAInstallButton';
import { fetchVehicle } from './data/mockVehicles';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  addToHistory,
  clearHistory,
  getHistory,
  getReceipt,
  getUnlocks,
  removeFromHistory,
  saveUnlock,
} from './services/historyStorage';
import type { HistoryEntry, UnlockReceipt, VehicleRecord } from './types/vehicle';
import { cn, haptic } from './utils/format';
import { formatPlate, normalizePlate } from './utils/plateFormatter';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

export default function App() {
  const [view, setView] = useState<View>('search');
  const [record, setRecord] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(getHistory);
  const [unlocks, setUnlocks] = useState<Record<string, UnlockReceipt>>(getUnlocks);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const online = useOnlineStatus();
  const toastTimer = useRef<number | undefined>(undefined);

  const plate = record?.basic.plate ?? null;
  const unlocked = plate ? Boolean(unlocks[plate]) : false;

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  /* ---------- Navegação com suporte ao botão "voltar" do Android ---------- */
  const navigate = useCallback((next: View) => {
    setView((current) => {
      if (current !== next) window.history.pushState({ view: next }, '');
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    window.history.replaceState({ view: 'search' }, '');
    const onPop = (e: PopStateEvent) => {
      setCheckoutOpen(false);
      setView((e.state?.view as View) ?? 'search');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* ---------- Avisos de conectividade ---------- */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (online) showToast('Conexão restabelecida.', 'success');
  }, [online, showToast]);

  /* ---------- Ações ---------- */
  async function search(input: string, opts: { openReport?: boolean; fast?: boolean } = {}) {
    const p = normalizePlate(input);
    setLoading(true);
    try {
      const data = await fetchVehicle(p, opts.fast ? 250 : 900);
      setRecord(data);
      setHistory(addToHistory(data.basic));
      navigate(opts.openReport && unlocks[p] ? 'report' : 'search');
    } finally {
      setLoading(false);
    }
  }

  function openReportOrCheckout() {
    haptic();
    if (!record) {
      navigate('search');
      showToast('Consulte uma placa primeiro para gerar o laudo.');
      return;
    }
    if (unlocked) navigate('report');
    else setCheckoutOpen(true);
  }

  function handlePaid(receipt: UnlockReceipt) {
    saveUnlock(receipt);
    setUnlocks(getUnlocks());
    setHistory(getHistory());
    setCheckoutOpen(false);
    navigate('report');
    showToast(`Laudo da placa ${formatPlate(receipt.plate)} desbloqueado!`, 'success');
  }

  function goSearch() {
    haptic();
    if (view === 'search' && record) setRecord(null);
    navigate('search');
  }

  function newSearch() {
    setRecord(null);
    navigate('search');
  }

  /* ---------- Render ---------- */
  return (
    <div className="min-h-dvh pb-28 md:pb-10">
      <Header
        view={view}
        historyCount={history.length}
        onNavigate={(v) => (v === 'search' ? goSearch() : navigate(v))}
        onReport={openReportOrCheckout}
        onInstalled={() => showToast('App instalado com sucesso!', 'success')}
      />

      {!online && (
        <div className="no-print animate-fade-in flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900" role="status">
          <WifiOff className="h-4 w-4 shrink-0" />
          Você está offline. Os dados em cache e o seu histórico continuam acessíveis.
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pt-6">
        {view === 'search' &&
          (record ? (
            <VehicleBasicResult
              key={record.basic.plate}
              vehicle={record.basic}
              unlocked={unlocked}
              onUnlock={() => setCheckoutOpen(true)}
              onOpenReport={() => navigate('report')}
              onNewSearch={newSearch}
            />
          ) : (
            <>
              <PlateSearchBox loading={loading} onSearch={(p) => search(p)} />
              <div className="mx-auto mt-8 max-w-md md:hidden">
                <PWAInstallButton variant="full" onInstalled={() => showToast('App instalado com sucesso!', 'success')} />
              </div>
            </>
          ))}

        {view === 'history' && (
          <SearchHistoryView
            history={history}
            onOpen={(p) => search(p, { openReport: true, fast: true })}
            onRemove={(p) => {
              setHistory(removeFromHistory(p));
              showToast(`Placa ${formatPlate(p)} removida do histórico.`);
            }}
            onClear={() => {
              setHistory(clearHistory());
              showToast('Histórico apagado.');
            }}
            onNewSearch={newSearch}
          />
        )}

        {view === 'report' &&
          (record && unlocked ? (
            <AdvancedReportView vehicle={record.basic} report={record.advanced} receipt={getReceipt(record.basic.plate)} onBack={() => navigate('search')} />
          ) : (
            <section className="animate-slide-up flex flex-col items-center rounded-3xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-200">
              <FileText className="h-10 w-10 text-slate-300" />
              <h2 className="mt-3 text-lg font-bold">Nenhum laudo aberto</h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                {record ? 'Desbloqueie o laudo completo desta placa por R$ 35,00.' : 'Consulte uma placa e desbloqueie o laudo completo por R$ 35,00.'}
              </p>
              <button
                onClick={() => (record ? setCheckoutOpen(true) : newSearch())}
                className="tap mt-6 h-12 rounded-xl bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
              >
                {record ? 'Desbloquear agora' : 'Consultar placa'}
              </button>
            </section>
          ))}
      </main>

      {/* Barra de navegação inferior flutuante (mobile) */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-50 px-3 md:hidden" aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 rounded-2xl bg-slate-900/95 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <BottomButton active={view === 'search'} onClick={goSearch} icon={<Search className="h-5 w-5" />} label="Buscar" />
          <BottomButton
            active={view === 'history'}
            onClick={() => {
              haptic();
              navigate('history');
            }}
            icon={<History className="h-5 w-5" />}
            label="Histórico"
            badge={history.length || undefined}
          />
          <BottomButton active={view === 'report'} onClick={openReportOrCheckout} icon={<FileText className="h-5 w-5" />} label={unlocked ? 'Laudo' : 'Laudo R$ 35'} highlight={!unlocked} />
        </div>
      </nav>

      {checkoutOpen && record && <AdvancedCheckoutModal vehicle={record.basic} onClose={() => setCheckoutOpen(false)} onPaid={handlePaid} />}

      {/* Toast */}
      {toast && (
        <div key={toast.id} className="no-print animate-slide-up fixed inset-x-0 bottom-24 z-[80] flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
          <div className={cn('flex max-w-sm items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl', toast.tone === 'success' ? 'bg-emerald-600' : 'bg-slate-800')}>
            {toast.tone === 'success' ? <CircleCheck className="h-5 w-5 shrink-0" /> : <Info className="h-5 w-5 shrink-0" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

function BottomButton({
  active,
  onClick,
  icon,
  label,
  badge,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'tap relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold',
        active ? 'bg-white text-slate-900' : highlight ? 'text-blue-300 hover:bg-white/10' : 'text-slate-300 hover:bg-white/10',
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="absolute top-1 right-[calc(50%-22px)] flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">{badge}</span>
      )}
    </button>
  );
}
