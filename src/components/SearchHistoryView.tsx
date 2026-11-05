import { useMemo, useState } from 'react';
import { ChevronRight, History, LockOpen, Lock, Search, Trash2 } from 'lucide-react';
import type { HistoryEntry } from '../../shared/vehicle';
import { cn, formatBRL, haptic, relativeTime } from '../utils/format';
import { formatPlate, normalizePlate } from '../../shared/plateFormatter';

type Filter = 'todos' | 'basico' | 'desbloqueado';

interface Props {
  history: HistoryEntry[];
  onOpen: (plate: string) => void;
  onRemove: (plate: string) => void;
  onClear: () => void;
  onNewSearch: () => void;
}

export default function SearchHistoryView({ history, onOpen, onRemove, onClear, onNewSearch }: Props) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const counts = useMemo(
    () => ({
      todos: history.length,
      basico: history.filter((h) => !h.unlocked).length,
      desbloqueado: history.filter((h) => h.unlocked).length,
    }),
    [history],
  );

  const items = useMemo(() => {
    const q = query.trim().toUpperCase();
    const qPlate = normalizePlate(query);
    return history.filter((h) => {
      if (filter === 'basico' && h.unlocked) return false;
      if (filter === 'desbloqueado' && !h.unlocked) return false;
      if (!q) return true;
      return (qPlate && h.plate.includes(qPlate)) || `${h.brand} ${h.model}`.toUpperCase().includes(q);
    });
  }, [history, filter, query]);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'basico', label: 'Básico' },
    { id: 'desbloqueado', label: 'Laudo completo' },
  ];

  if (history.length === 0) {
    return (
      <section className="animate-slide-up flex flex-col items-center rounded-3xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-200">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <History className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Nenhuma consulta ainda</h2>
        <p className="mt-1 max-w-xs text-sm text-slate-500">As placas que você pesquisar ficam salvas aqui, inclusive offline.</p>
        <button onClick={onNewSearch} className="tap mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800">
          <Search className="h-4 w-4" /> Fazer primeira consulta
        </button>
      </section>
    );
  }

  return (
    <section className="animate-slide-up space-y-4" aria-labelledby="history-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="history-title" className="text-2xl font-extrabold tracking-tight">Histórico</h2>
          <p className="text-sm text-slate-500">{history.length} placa(s) consultada(s) neste dispositivo</p>
        </div>
        {confirmClear ? (
          <div className="flex gap-1.5">
            <button onClick={() => setConfirmClear(false)} className="tap h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={() => {
                haptic(20);
                onClear();
                setConfirmClear(false);
              }}
              className="tap h-11 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Apagar tudo
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)} className="tap inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por placa, marca ou modelo"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white pr-3 pl-10 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Filtrar histórico"
        />
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Filtrar por status">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => {
              haptic();
              setFilter(f.id);
            }}
            className={cn(
              'tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-inset',
              filter === f.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100',
            )}
          >
            {f.label}
            <span className={cn('rounded-full px-1.5 text-xs', filter === f.id ? 'bg-white/20' : 'bg-slate-100')}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">Nenhum resultado para este filtro.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li key={h.plate} className="flex items-stretch overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <button
                onClick={() => {
                  haptic();
                  onOpen(h.plate);
                }}
                className="tap flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left hover:bg-slate-50"
              >
                <span className="shrink-0 overflow-hidden rounded-md border-2 border-slate-900 text-center">
                  <span className="block bg-plate-blue text-[7px] font-bold tracking-[0.25em] text-white">BRASIL</span>
                  <span className="block px-1.5 font-mono text-sm font-extrabold">{formatPlate(h.plate)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {h.brand} {h.model} <span className="font-medium text-slate-500">{h.yearModel}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {h.unlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                        <LockOpen className="h-3 w-3" /> Laudo completo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                        <Lock className="h-3 w-3" /> Básico
                      </span>
                    )}
                    <span>{formatBRL(h.fipeValue)}</span>
                    <span>· {relativeTime(h.searchedAt)}</span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
              <button
                onClick={() => {
                  haptic(15);
                  onRemove(h.plate);
                }}
                className="tap flex w-12 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remover ${formatPlate(h.plate)} do histórico`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
