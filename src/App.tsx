import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, FileText, History, Info, LoaderCircle, Search, WifiOff } from 'lucide-react';
import Header, { type View } from './components/Header';
import type { AuthUser } from './hooks/useAuth';
import PlateSearchBox from './components/PlateSearchBox';
import VehicleBasicResult from './components/VehicleBasicResult';
import AdvancedReportView from './components/AdvancedReportView';
import AdvancedCheckoutModal from './components/AdvancedCheckoutModal';
import SearchHistoryView from './components/SearchHistoryView';
import PWAInstallButton from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  addToHistory,
  cacheRecord,
  clearHistory,
  getCachedRecord,
  getHistory,
  getReceipt,
  isRecordFresh,
  getUnlocks,
  removeFromHistory,
  removeUnlock,
  saveUnlock,
  type CachedRecord,
  type StoredUnlock,
} from './services/historyStorage';
import { ApiError, fetchVehicleBasic, fetchVehicleReport, unlockVehicleReport } from './services/vehicleApi';
import type { HistoryEntry, PaymentMethod, UnlockReceipt } from '../shared/vehicle';
import { cn, haptic } from './utils/format';
import { formatPlate, normalizePlate } from '../shared/plateFormatter';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.');

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

interface AppProps {
  user: AuthUser;
  onSignOut: () => void;
}

export default function App({ user, onSignOut }: AppProps) {
  const [view, setView] = useState<View>('search');
  const [record, setRecord] = useState<CachedRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(getHistory);
  const [unlocks, setUnlocks] = useState<Record<string, StoredUnlock>>(getUnlocks);
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
  /**
   * Busca por placa — CACHE PRIMEIRO:
   * 1. Se a placa já foi consultada neste aparelho há menos de CLIENT_CACHE_DAYS,
   *    mostra o que está salvo e NÃO faz nenhuma requisição.
   * 2. Senão, consulta o servidor (que também tem cache próprio) e salva aqui.
   * 3. Sem conexão, usa a cópia salva mesmo vencida.
   * `refresh: true` força ir ao servidor (botão "Atualizar").
   */
  async function search(input: string, opts: { openReport?: boolean; refresh?: boolean } = {}) {
    const p = normalizePlate(input);
    const cached = getCachedRecord(p);

    if (cached && !opts.refresh && isRecordFresh(cached)) {
      showRecord(cached, opts.openReport);
      return;
    }

    if (opts.refresh) setRefreshing(true);
    else setLoading(true);
    try {
      let next: CachedRecord;
      try {
        const basic = await fetchVehicleBasic(p);
        // O laudo pago já baixado é mantido: atualizar não gera nova cobrança
        next = { basic, advanced: cached?.advanced ?? null, savedAt: new Date().toISOString() };
      } catch (err) {
        if (!cached || (err instanceof ApiError && err.status >= 400 && err.status < 500)) {
          showToast(errorMessage(err));
          return;
        }
        next = cached;
        showToast('Sem conexão com o servidor. Exibindo a consulta salva neste aparelho.');
      }
      if (opts.refresh && next !== cached) showToast('Dados atualizados.', 'success');
      showRecord(next, opts.openReport);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /** Exibe a consulta, salva no aparelho e move a placa para o topo do histórico (sem duplicar). */
  function showRecord(rec: CachedRecord, openReportView?: boolean) {
    setRecord(rec);
    cacheRecord(rec.basic.plate, rec);
    setHistory(addToHistory(rec.basic));
    if (openReportView && getReceipt(rec.basic.plate)) void openReport(rec);
    else navigate('search');
  }

  /** Abre o laudo; busca no backend com o token se ainda não estiver salvo no aparelho. */
  async function openReport(rec: CachedRecord | null = record) {
    if (!rec) return;
    const p = rec.basic.plate;
    const unlock = getReceipt(p);
    if (!unlock) {
      setCheckoutOpen(true);
      return;
    }
    navigate('report');
    if (rec.advanced) return;

    setReportError(null);
    setReportLoading(true);
    try {
      const advanced = await fetchVehicleReport(p, unlock.accessToken);
      const next = { ...rec, advanced };
      setRecord(next);
      cacheRecord(p, next);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') {
        removeUnlock(p);
        setUnlocks(getUnlocks());
        setHistory(getHistory());
        showToast('O acesso a este laudo expirou. Desbloqueie novamente.');
        navigate('search');
      } else {
        setReportError(errorMessage(err));
      }
    } finally {
      setReportLoading(false);
    }
  }

  function openReportOrCheckout() {
    haptic();
    if (!record) {
      navigate('search');
      showToast('Consulte uma placa primeiro para gerar o laudo.');
      return;
    }
    void openReport();
  }

  /** Chamado pelo checkout: libera o laudo no backend (pagamento simulado). */
  async function confirmUnlock(method: PaymentMethod): Promise<UnlockReceipt> {
    if (!record) throw new Error('Nenhum veículo selecionado.');
    const { receipt, accessToken } = await unlockVehicleReport(record.basic.plate, method);
    saveUnlock({ ...receipt, accessToken });
    setUnlocks(getUnlocks());
    setHistory(getHistory());
    return receipt;
  }

  function handleUnlockDone() {
    setCheckoutOpen(false);
    if (!record) return;
    showToast(`Laudo da placa ${formatPlate(record.basic.plate)} desbloqueado!`, 'success');
    void openReport();
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
        user={user}
        onSignOut={onSignOut}
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
              onOpenReport={() => void openReport()}
              onNewSearch={newSearch}
              savedAt={record.savedAt}
              refreshing={refreshing}
              onRefresh={() => search(record.basic.plate, { refresh: true })}
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
            onOpen={(p) => search(p, { openReport: true })}
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
            record.advanced ? (
              <AdvancedReportView vehicle={record.basic} report={record.advanced} receipt={getReceipt(record.basic.plate)} onBack={() => navigate('search')} />
            ) : (
              <section className="animate-fade-in flex flex-col items-center rounded-3xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-200" role="status">
                {reportLoading || !reportError ? (
                  <>
                    <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" />
                    <p className="mt-3 font-semibold">Gerando laudo completo…</p>
                    <p className="text-sm text-slate-500">Consultando sinistros, leilão, gravames e débitos.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-red-700">{reportError}</p>
                    <button onClick={() => void openReport()} className="tap mt-5 h-12 rounded-xl bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800">
                      Tentar novamente
                    </button>
                  </>
                )}
              </section>
            )
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

      {checkoutOpen && record && <AdvancedCheckoutModal vehicle={record.basic} onClose={() => setCheckoutOpen(false)} onConfirm={confirmUnlock} onDone={handleUnlockDone} />}

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
