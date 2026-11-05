import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Car,
  Cog,
  FileText,
  Fuel,
  Gauge,
  Gavel,
  Hash,
  Landmark,
  Lock,
  MapPin,
  Palette,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Siren,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { VehicleBasic } from '../../shared/vehicle';
import { cn, formatBRL, formatDateTime, haptic } from '../utils/format';
import { formatPlate } from '../../shared/plateFormatter';

interface Props {
  vehicle: VehicleBasic;
  unlocked: boolean;
  onUnlock: () => void;
  onOpenReport: () => void;
  onNewSearch: () => void;
  /** Quando a consulta foi salva no aparelho. */
  savedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
}

const LOCKED_ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldAlert, label: 'Sinistros e monta' },
  { icon: Gavel, label: 'Histórico de leilão' },
  { icon: Siren, label: 'Roubo e furto' },
  { icon: Landmark, label: 'Gravames e Renajud' },
  { icon: Users, label: 'Proprietários' },
  { icon: Wrench, label: 'Raio-X estrutural 360°' },
  { icon: Receipt, label: 'Multas, IPVA e licenciamento' },
  { icon: BadgeCheck, label: 'Aceitação em seguradoras' },
];

export default function VehicleBasicResult({ vehicle: v, unlocked, onUnlock, onOpenReport, onNewSearch, savedAt, refreshing, onRefresh }: Props) {
  const specs: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Calendar, label: 'Ano fab./modelo', value: `${v.yearManufacture}/${v.yearModel}` },
    { icon: Palette, label: 'Cor', value: v.color },
    { icon: Fuel, label: 'Combustível', value: v.fuel },
    { icon: Gauge, label: 'Motor', value: v.engine },
    { icon: Zap, label: 'Potência', value: v.power },
    { icon: Cog, label: 'Câmbio', value: v.transmission },
    { icon: MapPin, label: 'Emplacamento', value: `${v.city}/${v.uf}` },
    { icon: Car, label: 'Categoria', value: v.category },
    { icon: Hash, label: 'Chassi', value: v.chassisMasked },
    { icon: Hash, label: 'Renavam', value: v.renavamMasked },
  ];

  return (
    <section className="animate-slide-up space-y-4" aria-label="Resultado da consulta">
      <div className="no-print flex flex-wrap items-center justify-between gap-x-2">
        <button onClick={onNewSearch} className="tap -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> Nova consulta
        </button>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>Salva em {formatDateTime(savedAt)}</span>
          <button
            onClick={() => {
              haptic();
              onRefresh();
            }}
            disabled={refreshing}
            className="tap inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            aria-label="Atualizar dados desta placa"
          >
            <RotateCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} /> {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Identificação */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-300 uppercase">{v.brand}</p>
            <h2 className="text-2xl font-extrabold tracking-tight">{v.model}</h2>
            <p className="text-sm text-slate-300">{v.version}</p>
          </div>
          <div className="self-start overflow-hidden rounded-lg border-2 border-slate-900 bg-white text-center sm:self-auto">
            <div className="bg-plate-blue px-3 text-[9px] font-bold tracking-[0.3em] text-white">BRASIL</div>
            <div className="px-3 py-0.5 font-mono text-xl font-extrabold tracking-widest text-slate-900">{formatPlate(v.plate)}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-5">
          {specs.map((s) => (
            <div key={s.label} className="bg-white p-3.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold break-words text-slate-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* FIPE */}
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Tabela FIPE oficial</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-600">{formatBRL(v.fipeValue)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Código {v.fipeCode} · Referência {v.fipeReference}
          </p>
        </div>
        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 sm:flex">
          <BadgeCheck className="h-7 w-7" />
        </div>
      </div>

      {/* Banner de upsell / acesso ao laudo */}
      {unlocked ? (
        <div className="rounded-3xl bg-emerald-600 p-5 text-white shadow-md">
          <p className="flex items-center gap-2 font-bold">
            <BadgeCheck className="h-5 w-5" /> Laudo completo desbloqueado
          </p>
          <p className="mt-1 text-sm text-emerald-50">Você já tem acesso a todos os dados deste veículo.</p>
          <button
            onClick={() => {
              haptic();
              onOpenReport();
            }}
            className="tap mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <FileText className="h-5 w-5" /> Abrir laudo completo
          </button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-800 p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
          <p className="text-xs font-bold tracking-wider text-blue-200 uppercase">Busca avançada</p>
          <h3 className="mt-1 text-xl font-extrabold">Não compre no escuro: veja o laudo completo</h3>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
            {LOCKED_ITEMS.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-sm text-blue-50">
                <i.icon className="h-4 w-4 shrink-0 text-blue-200" />
                <span className="leading-tight">{i.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="text-3xl font-extrabold">R$ 35,00</span>
              <span className="ml-1 text-sm text-blue-200">pagamento único</span>
            </p>
            <button
              onClick={() => {
                haptic();
                onUnlock();
              }}
              className="tap flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-bold text-blue-800 shadow-md hover:bg-blue-50"
            >
              <Lock className="h-5 w-5" /> Desbloquear laudo
            </button>
          </div>
          <p className="mt-3 text-xs text-blue-200">PIX instantâneo ou cartão de crédito.</p>
        </div>
      )}
    </section>
  );
}
