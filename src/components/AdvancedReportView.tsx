import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleCheck,
  CircleX,
  Gavel,
  Landmark,
  Printer,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type {
  AdvancedReport,
  AuctionRecord,
  DamageSeverity,
  FineSeverity,
  StructuralPoint,
  StructuralPointId,
  StructuralStatus,
  UnlockReceipt,
  VehicleBasic,
} from '../../shared/vehicle';
import { cn, formatBRL, formatDate, formatDateTime, haptic } from '../utils/format';
import { formatPlate } from '../../shared/plateFormatter';

interface Props {
  vehicle: VehicleBasic;
  report: AdvancedReport;
  receipt: UnlockReceipt | null;
  onBack: () => void;
}

type Tone = 'ok' | 'warn' | 'bad' | 'info';

const TONE: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  bad: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
};

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'sinistros', label: 'Sinistros', icon: ShieldAlert },
  { id: 'leilao', label: 'Leilão', icon: Gavel },
  { id: 'roubo', label: 'Roubo/Furto', icon: Siren },
  { id: 'gravames', label: 'Gravames', icon: Landmark },
  { id: 'proprietarios', label: 'Donos', icon: Users },
  { id: 'estrutura', label: 'Raio-X 360°', icon: Wrench },
  { id: 'debitos', label: 'Débitos', icon: Receipt },
  { id: 'seguro', label: 'Seguradoras', icon: BadgeCheck },
];

const SEVERITY_LABEL: Record<DamageSeverity, { label: string; tone: Tone }> = {
  pequena: { label: 'Pequena monta', tone: 'warn' },
  media: { label: 'Média monta', tone: 'bad' },
  grande: { label: 'Grande monta', tone: 'bad' },
};

const FINE_TONE: Record<FineSeverity, Tone> = { Leve: 'info', Média: 'warn', Grave: 'bad', Gravíssima: 'bad' };

/* ------------------------------------------------------------------ */

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset', TONE[tone])}>{children}</span>;
}

function Section({ id, index, title, icon: Icon, status, children }: { id: string; index: number; title: string; icon: LucideIcon; status: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="print-avoid-break scroll-mt-32 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="mr-1 text-slate-400">{index}.</span>
            {title}
          </span>
        </h3>
        {status}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
      <CircleCheck className="h-5 w-5 shrink-0" />
      {children}
    </p>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function AdvancedReportView({ vehicle: v, report: r, receipt, onBack }: Props) {
  const verdict =
    r.score >= 85
      ? { label: 'Recomendado', desc: 'Nenhum apontamento grave encontrado.', color: '#059669', tone: 'ok' as Tone }
      : r.score >= 50
        ? { label: 'Atenção', desc: 'Há apontamentos que exigem verificação antes da compra.', color: '#d97706', tone: 'warn' as Tone }
        : { label: 'Alto risco', desc: 'Apontamentos graves. Recomendamos vistoria cautelar.', color: '#dc2626', tone: 'bad' as Tone };

  const activeLien = r.liens.some((l) => l.status === 'Ativo');
  const structIssues = r.structure.filter((p) => p.status !== 'ok').length;

  const summary: { label: string; ok: boolean; text: string }[] = [
    { label: 'Sinistro', ok: r.claims.length === 0, text: r.claims.length ? `${r.claims.length} registro(s)` : 'Nada consta' },
    { label: 'Leilão', ok: !r.auction, text: r.auction ? 'Consta' : 'Nada consta' },
    { label: 'Roubo/Furto', ok: r.theft.status === 'nada_consta', text: r.theft.status === 'nada_consta' ? 'Nada consta' : r.theft.status === 'recuperado' ? 'Recuperado' : 'ATIVO' },
    { label: 'Gravame', ok: !activeLien, text: activeLien ? 'Ativo' : 'Nada consta' },
    { label: 'Estrutura', ok: structIssues === 0, text: structIssues ? `${structIssues} ponto(s)` : '10/10 OK' },
    { label: 'Débitos', ok: r.debts.total === 0, text: r.debts.total ? formatBRL(r.debts.total) : 'Sem débitos' },
  ];

  function scrollTo(id: string) {
    haptic();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function print() {
    haptic();
    window.print();
  }

  return (
    <article className="animate-slide-up space-y-4" aria-label="Laudo veicular completo">
      {/* Cabeçalho só na impressão */}
      <div className="print-only mb-4 border-b-2 border-slate-900 pb-3">
        <p className="text-xl font-extrabold">Consulta Placa Veicular — Laudo Completo</p>
        <p className="text-xs text-slate-600">Emitido em {formatDateTime(new Date().toISOString())}{receipt ? ` · Transação ${receipt.transactionId}` : ''}</p>
      </div>

      <div className="no-print flex items-center justify-between gap-2">
        <button onClick={onBack} className="tap -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> Dados básicos
        </button>
        <button onClick={print} className="tap inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
      </div>

      {/* Resumo + score */}
      <div className="print-avoid-break overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <ScoreGauge score={r.score} color={verdict.color} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="overflow-hidden rounded-md border-2 border-slate-900 font-mono text-sm font-extrabold">
                <span className="block bg-plate-blue px-2 text-[8px] tracking-[0.3em] text-white">BRASIL</span>
                <span className="block px-2">{formatPlate(v.plate)}</span>
              </span>
              <Badge tone={verdict.tone}>{verdict.label}</Badge>
            </div>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight">
              {v.brand} {v.model} <span className="font-semibold text-slate-500">{v.yearManufacture}/{v.yearModel}</span>
            </h2>
            <p className="text-sm text-slate-500">{v.version} · {v.color} · FIPE {formatBRL(v.fipeValue)}</p>
            <p className="mt-2 text-sm text-slate-700">{verdict.desc}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
          {summary.map((s) => (
            <div key={s.label} className="flex items-center gap-2 bg-white p-3">
              {s.ok ? <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{s.label}</p>
                <p className={cn('truncate text-sm font-bold', s.ok ? 'text-slate-900' : 'text-amber-700')}>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
        {receipt && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            Desbloqueado em {formatDateTime(receipt.paidAt)} via {receipt.method === 'pix' ? 'PIX' : 'cartão de crédito'} · {formatBRL(receipt.amount)}
          </p>
        )}
      </div>

      {/* Navegação entre seções */}
      <nav className="no-print scrollbar-none sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto bg-slate-50/95 px-4 py-2 backdrop-blur" aria-label="Seções do laudo">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => scrollTo(s.id)} className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100">
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </button>
        ))}
      </nav>

      {/* 1. Sinistros */}
      <Section id="sinistros" index={1} title="Histórico de Sinistros" icon={ShieldAlert} status={r.claims.length ? <Badge tone="bad">{r.claims.length} registro(s)</Badge> : <Badge tone="ok">Nada consta</Badge>}>
        {r.claims.length === 0 ? (
          <Empty>Nenhum sinistro registrado nas bases das seguradoras.</Empty>
        ) : (
          <ul className="space-y-3">
            {r.claims.map((c, i) => (
              <li key={i} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={SEVERITY_LABEL[c.severity].tone}>{SEVERITY_LABEL[c.severity].label}</Badge>
                  <span className="text-xs text-slate-500">{formatDate(c.date)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{c.description}</p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Seguradora" value={c.insurer} />
                  <Field label="Indenização integral" value={c.indemnified ? 'Sim (perda total)' : 'Não'} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 2. Leilão */}
      <Section id="leilao" index={2} title="Histórico de Leilão" icon={Gavel} status={r.auction ? <Badge tone="bad">Consta leilão</Badge> : <Badge tone="ok">Nada consta</Badge>}>
        {r.auction ? <AuctionCard a={r.auction} vehicle={v} /> : <Empty>Nenhuma passagem por leilão encontrada.</Empty>}
      </Section>

      {/* 3. Roubo e furto */}
      <Section
        id="roubo"
        index={3}
        title="Roubo e Furto"
        icon={Siren}
        status={r.theft.status === 'nada_consta' ? <Badge tone="ok">Nada consta</Badge> : r.theft.status === 'recuperado' ? <Badge tone="warn">Recuperado</Badge> : <Badge tone="bad">Alerta ativo</Badge>}
      >
        {r.theft.occurrences.length === 0 ? (
          <Empty>Sem registro de roubo ou furto. Fonte: {r.theft.source}.</Empty>
        ) : (
          <>
            {r.theft.occurrences.map((o, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Ocorrência" value={o.type} />
                  <Field label="Data" value={formatDate(o.date)} />
                  <Field label="Local" value={`${o.city}/${o.uf}`} />
                  <Field label="Recuperado em" value={o.recoveredAt ? formatDate(o.recoveredAt) : '—'} />
                </dl>
                <p className="mt-3 text-xs text-slate-500">{o.policeReport}</p>
              </div>
            ))}
            <p className="mt-3 text-xs text-slate-500">Fonte: {r.theft.source}. {r.theft.status === 'recuperado' && 'Situação atual: veículo recuperado e regularizado, sem restrição de circulação.'}</p>
          </>
        )}
      </Section>

      {/* 4. Gravames */}
      <Section
        id="gravames"
        index={4}
        title="Gravames e Restrições"
        icon={Landmark}
        status={activeLien || r.restrictions.renajud || r.restrictions.judicial || r.restrictions.tributary ? <Badge tone="warn">Possui restrição</Badge> : <Badge tone="ok">Livre</Badge>}
      >
        {r.liens.length > 0 ? (
          r.liens.map((l, i) => (
            <div key={i} className="mb-3 rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-bold">{l.type}</p>
                <Badge tone={l.status === 'Ativo' ? 'warn' : 'ok'}>{l.status}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Banco credor" value={l.creditor} />
                <Field label="Contrato" value={l.contract} />
                <Field label="Desde" value={formatDate(l.since)} />
              </dl>
            </div>
          ))
        ) : (
          <div className="mb-3">
            <Empty>Sem alienação fiduciária ou gravame registrado.</Empty>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['RENAJUD', r.restrictions.renajud],
              ['Judicial', r.restrictions.judicial],
              ['Administrativa', r.restrictions.administrative],
              ['Tributária', r.restrictions.tributary],
            ] as const
          ).map(([label, has]) => (
            <div key={label} className={cn('flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ring-1 ring-inset', has ? TONE.bad : TONE.ok)}>
              {has ? <CircleX className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
              {label}
            </div>
          ))}
        </div>
        {r.restrictions.notes.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {r.restrictions.notes.map((n) => (
              <li key={n} className="flex items-start gap-2 text-sm text-slate-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {n}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 5. Proprietários */}
      <Section id="proprietarios" index={5} title="Histórico de Proprietários" icon={Users} status={<Badge tone={r.ownership.totalOwners > 3 ? 'warn' : 'info'}>{r.ownership.totalOwners} dono(s)</Badge>}>
        <dl className="mb-4 grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4">
          <Field label="Total" value={r.ownership.totalOwners} />
          <Field label="Tempo médio" value={`${r.ownership.averageMonths} meses`} />
          <Field label="Uso principal" value={r.ownership.mainUsage} />
        </dl>
        <ol className="relative ml-3 space-y-4 border-l-2 border-slate-200 pl-6">
          {r.ownership.owners.map((o) => (
            <li key={o.order} className="relative">
              <span className="absolute top-0.5 -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">{o.order}</span>
              <p className="text-sm font-bold">
                {o.order}º proprietário · {o.uf}{' '}
                <span className={cn('ml-1 text-xs font-semibold', o.usage === 'Particular' ? 'text-emerald-700' : 'text-amber-700')}>{o.usage}</span>
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(o.from)} — {o.to ? formatDate(o.to) : 'atual'} · {o.months} meses
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 6. Raio-X estrutural */}
      <Section id="estrutura" index={6} title="Raio-X Estrutural 360°" icon={Wrench} status={structIssues ? <Badge tone="warn">{structIssues} apontamento(s)</Badge> : <Badge tone="ok">10/10 aprovados</Badge>}>
        <StructuralMap points={r.structure} />
      </Section>

      {/* 7. Débitos */}
      <Section id="debitos" index={7} title="Débitos e Multas" icon={Receipt} status={r.debts.total > 0 ? <Badge tone="bad">{formatBRL(r.debts.total)}</Badge> : <Badge tone="ok">Sem débitos</Badge>}>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {(
            [
              ['IPVA', r.debts.ipva],
              ['Licenciamento', r.debts.licensing],
            ] as const
          ).map(([label, t]) => (
            <div key={label} className={cn('rounded-2xl p-4 ring-1 ring-inset', t.status === 'Pago' ? TONE.ok : TONE.bad)}>
              <p className="text-xs font-semibold uppercase opacity-80">{label} {t.year}</p>
              <p className="mt-0.5 text-lg font-extrabold">{t.amount === 0 ? 'Isento' : formatBRL(t.amount)}</p>
              <p className="text-xs font-bold">{t.amount === 0 ? '—' : t.status}</p>
            </div>
          ))}
        </div>

        {r.debts.fines.length === 0 ? (
          <Empty>Nenhuma multa em aberto.</Empty>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="space-y-2 md:hidden">
              {r.debts.fines.map((f, i) => (
                <li key={i} className="rounded-2xl border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={FINE_TONE[f.severity]}>{f.severity} · {f.points} pts</Badge>
                    <span className="font-bold">{formatBRL(f.amount)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{f.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{f.agency} · {f.city} · {formatDate(f.date)}</p>
                </li>
              ))}
            </ul>
            {/* Desktop / impressão: tabela */}
            <div className="hidden overflow-hidden rounded-2xl ring-1 ring-slate-200 md:block print:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Órgão</th>
                    <th className="px-3 py-2.5">Infração</th>
                    <th className="px-3 py-2.5">Gravidade</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.debts.fines.map((f, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(f.date)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{f.agency}</td>
                      <td className="px-3 py-2.5">{f.description}</td>
                      <td className="px-3 py-2.5"><Badge tone={FINE_TONE[f.severity]}>{f.severity}</Badge></td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{formatBRL(f.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white">
          <span className="text-sm font-semibold">Total de débitos em aberto</span>
          <span className="text-xl font-extrabold">{formatBRL(r.debts.total)}</span>
        </div>
      </Section>

      {/* 8. Seguradoras */}
      <Section id="seguro" index={8} title="Aceitação em Seguradoras" icon={BadgeCheck} status={<Badge tone={r.insurance.riskProfile === 'Baixo' ? 'ok' : r.insurance.riskProfile === 'Médio' ? 'warn' : 'bad'}>Risco {r.insurance.riskProfile}</Badge>}>
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
            <span className="text-xl font-extrabold">{r.insurance.fipePercent}%</span>
            <span className="text-[10px] font-semibold text-slate-500">da FIPE</span>
          </div>
          <div>
            <p className="flex items-center gap-1.5 font-bold">
              {r.insurance.accepted ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-red-600" />}
              {r.insurance.accepted ? 'Segurável' : 'Não segurável'}
            </p>
            <p className="text-sm text-slate-600">{r.insurance.notes}</p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {r.insurance.insurers.map((s) => (
            <li key={s.name} className={cn('flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ring-1 ring-inset', s.accepts ? TONE.ok : TONE.bad)}>
              {s.accepts ? <CircleCheck className="h-4 w-4 shrink-0" /> : <CircleX className="h-4 w-4 shrink-0" />}
              <span className="leading-tight">{s.name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="px-2 pb-4 text-center text-xs text-slate-400">
        Informações compiladas de bases públicas e privadas (DETRAN, SINESP, RENAJUD, FIPE, seguradoras e leiloeiros). Recomenda-se vistoria cautelar presencial antes da compra.
      </p>

      <button onClick={print} className="tap no-print flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 font-bold text-white hover:bg-slate-800">
        <Printer className="h-5 w-5" /> Imprimir ou salvar laudo em PDF
      </button>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0" role="img" aria-label={`Nota do veículo: ${score} de 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold" style={{ color }}>{score}</span>
        <span className="text-[10px] font-semibold text-slate-500">de 100</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AuctionCard({ a, vehicle }: { a: AuctionRecord; vehicle: VehicleBasic }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
      <figure className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <AuctionYardPhoto lot={a.lot} color={vehicle.color} />
        <figcaption className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Camera className="h-3.5 w-3.5" /> {a.photoCaption}
        </figcaption>
      </figure>
      <dl className="grid grid-cols-2 content-start gap-3">
        <Field label="Data do leilão" value={formatDate(a.date)} />
        <Field label="Lote" value={a.lot} />
        <Field label="Leiloeiro" value={a.auctioneer} />
        <Field label="Comitente" value={a.consignor} />
        <div className="col-span-2"><Field label="Motivo da apreensão" value={a.reason} /></div>
        <div className="col-span-2"><Field label="Condição" value={a.condition} /></div>
        <div className="col-span-2"><Field label="Pátio" value={a.yard} /></div>
      </dl>
    </div>
  );
}

const COLOR_HEX: Record<string, string> = {
  Branco: '#f1f5f9', 'Branco Perolizado': '#f8fafc', Prata: '#cbd5e1', Preto: '#1e293b', Cinza: '#64748b',
  Grafite: '#475569', Vermelho: '#dc2626', Azul: '#1d4ed8',
};

/** Ilustração vetorial da foto pericial (funciona offline e na impressão). */
function AuctionYardPhoto({ lot, color }: { lot: string; color: string }) {
  const body = COLOR_HEX[color] ?? '#94a3b8';
  return (
    <svg viewBox="0 0 320 200" className="block h-auto w-full bg-slate-300" role="img" aria-label={`Foto do veículo no pátio, lote ${lot}`}>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect width="320" height="120" fill="url(#sky)" />
      <rect y="120" width="320" height="80" fill="#78716c" />
      {/* cerca do pátio */}
      {Array.from({ length: 17 }, (_, i) => (
        <rect key={i} x={i * 20} y="70" width="3" height="50" fill="#475569" />
      ))}
      <rect y="78" width="320" height="2" fill="#475569" />
      <rect y="100" width="320" height="2" fill="#475569" />
      {/* carros ao fundo */}
      <rect x="10" y="100" width="70" height="22" rx="6" fill="#64748b" opacity="0.7" />
      <rect x="240" y="100" width="70" height="22" rx="6" fill="#57534e" opacity="0.7" />
      {/* veículo principal */}
      <path d="M50 150 L70 118 Q78 106 95 106 L200 106 Q216 106 228 118 L255 140 Q275 143 280 152 L280 165 L40 165 L40 156 Q42 150 50 150 Z" fill={body} stroke="#0f172a" strokeWidth="2" />
      <path d="M82 120 L96 112 L140 112 L140 136 L74 136 Z" fill="#334155" opacity="0.85" />
      <path d="M148 112 L198 112 Q210 112 220 122 L232 136 L148 136 Z" fill="#334155" opacity="0.85" />
      {/* avaria */}
      <path d="M250 142 l8 6 l-5 4 l9 5" fill="none" stroke="#b91c1c" strokeWidth="2.5" />
      <circle cx="90" cy="166" r="18" fill="#0f172a" />
      <circle cx="90" cy="166" r="8" fill="#94a3b8" />
      <circle cx="230" cy="166" r="18" fill="#0f172a" />
      <circle cx="230" cy="166" r="8" fill="#94a3b8" />
      {/* placa do lote no para-brisa */}
      <rect x="150" y="116" width="44" height="18" rx="2" fill="#facc15" stroke="#0f172a" />
      <text x="172" y="129" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a" fontFamily="monospace">{lot}</text>
      {/* carimbo */}
      <rect x="8" y="8" width="104" height="20" rx="3" fill="#0f172a" opacity="0.75" />
      <text x="60" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="sans-serif">FOTO PERICIAL</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

const POINT_POS: Record<StructuralPointId, { x: number; y: number }> = {
  motor: { x: 100, y: 62 },
  longarinaDianteira: { x: 52, y: 92 },
  cortaFogo: { x: 100, y: 118 },
  colunaA: { x: 150, y: 140 },
  vidros: { x: 100, y: 160 },
  colunaB: { x: 50, y: 205 },
  assoalho: { x: 100, y: 228 },
  colunaC: { x: 150, y: 272 },
  longarinaTraseira: { x: 52, y: 318 },
  estepe: { x: 100, y: 340 },
};

const STATUS_STYLE: Record<StructuralStatus, { fill: string; label: string; tone: Tone }> = {
  ok: { fill: '#059669', label: 'Original', tone: 'ok' },
  reparo: { fill: '#d97706', label: 'Reparo', tone: 'warn' },
  dano: { fill: '#dc2626', label: 'Dano estrutural', tone: 'bad' },
};

function StructuralMap({ points }: { points: StructuralPoint[] }) {
  const firstIssue = points.find((p) => p.status !== 'ok') ?? points[0];
  const [selected, setSelected] = useState<StructuralPointId>(firstIssue.id);
  const sel = points.find((p) => p.id === selected)!;

  function choose(id: StructuralPointId) {
    haptic();
    setSelected(id);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="mx-auto w-full max-w-[220px]">
        <svg viewBox="0 0 200 400" className="h-auto w-full" role="group" aria-label="Mapa estrutural do veículo (vista superior)">
          {/* carroceria */}
          <path d="M60 20 Q100 5 140 20 Q170 30 172 70 L175 330 Q172 380 140 388 Q100 396 60 388 Q28 380 25 330 L28 70 Q30 30 60 20 Z" fill="#f1f5f9" stroke="#0f172a" strokeWidth="3" />
          {/* capô e porta-malas */}
          <path d="M40 110 Q100 96 160 110" fill="none" stroke="#94a3b8" strokeWidth="2" />
          <path d="M40 300 Q100 312 160 300" fill="none" stroke="#94a3b8" strokeWidth="2" />
          {/* vidros */}
          <path d="M48 128 Q100 112 152 128 L146 168 Q100 158 54 168 Z" fill="#bfdbfe" stroke="#64748b" strokeWidth="1.5" />
          <path d="M54 262 Q100 272 146 262 L150 292 Q100 302 50 292 Z" fill="#bfdbfe" stroke="#64748b" strokeWidth="1.5" />
          {/* portas */}
          <line x1="30" y1="215" x2="56" y2="215" stroke="#94a3b8" strokeWidth="2" />
          <line x1="144" y1="215" x2="170" y2="215" stroke="#94a3b8" strokeWidth="2" />
          {/* rodas */}
          {[[18, 80], [170, 80], [18, 290], [170, 290]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="12" height="40" rx="4" fill="#0f172a" />
          ))}
          {points.map((p) => {
            const pos = POINT_POS[p.id];
            const active = p.id === selected;
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.label}: ${STATUS_STYLE[p.status].label}`}
                aria-pressed={active}
                onClick={() => choose(p.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose(p.id))}
                className="cursor-pointer outline-none"
              >
                <circle cx={pos.x} cy={pos.y} r="22" fill="transparent" />
                {active && <circle cx={pos.x} cy={pos.y} r="16" fill={STATUS_STYLE[p.status].fill} opacity="0.25" />}
                <circle cx={pos.x} cy={pos.y} r="10" fill={STATUS_STYLE[p.status].fill} stroke="#fff" strokeWidth={active ? 3 : 2} />
                {p.status !== 'ok' && <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">!</text>}
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex justify-center gap-3 text-[11px] font-semibold text-slate-600">
          {(Object.keys(STATUS_STYLE) as StructuralStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_STYLE[s].fill }} /> {STATUS_STYLE[s].label}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className={cn('no-print mb-3 rounded-2xl p-4 ring-1 ring-inset', TONE[STATUS_STYLE[sel.status].tone])} aria-live="polite">
          <p className="text-xs font-bold uppercase opacity-80">Ponto selecionado</p>
          <p className="mt-0.5 text-base font-extrabold">{sel.label} — {STATUS_STYLE[sel.status].label}</p>
          <p className="mt-1 text-sm">{sel.note}</p>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => choose(p.id)}
                className={cn(
                  'tap flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm',
                  p.id === selected ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800 hover:bg-slate-100',
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_STYLE[p.status].fill }} />
                <span className="flex-1 font-semibold">{p.label}</span>
                <span className={cn('text-xs', p.id === selected ? 'text-slate-300' : 'text-slate-500')}>{STATUS_STYLE[p.status].label}</span>
              </button>
              <p className="print-only px-3 pb-1 text-xs text-slate-600">{p.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
