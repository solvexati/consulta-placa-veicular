import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Check, CircleCheck, Clock, Copy, CreditCard, Info, LoaderCircle, Lock, QrCode, X } from 'lucide-react';
import type { PaymentMethod, UnlockReceipt, VehicleBasic } from '../../shared/vehicle';
import { cn, formatBRL, haptic } from '../utils/format';
import { formatPlate } from '../../shared/plateFormatter';

export const ADVANCED_PRICE = 35;
const PIX_EXPIRATION_S = 10 * 60;

interface Props {
  vehicle: VehicleBasic;
  onClose: () => void;
  /** Confirma o pagamento no backend e devolve o recibo (lança erro se falhar). */
  onConfirm: (method: PaymentMethod) => Promise<UnlockReceipt>;
  /** Usuário clicou em "Ver laudo completo" após a aprovação. */
  onDone: () => void;
}

/* ------------------------------------------------------------------
 * PIX "Copia e Cola" (BR Code / padrão EMV do Banco Central)
 * ------------------------------------------------------------------ */
function emv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload(txid: string, amount: number): string {
  const merchantAccount = emv('00', 'br.gov.bcb.pix') + emv('01', 'pagamentos@consultaplaca.app');
  const payload =
    emv('00', '01') +
    emv('26', merchantAccount) +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', amount.toFixed(2)) +
    emv('58', 'BR') +
    emv('59', 'CONSULTA PLACA VEICULAR') +
    emv('60', 'SAO PAULO') +
    emv('62', emv('05', txid)) +
    '6304';
  return payload + crc16(payload);
}

function newTxId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/* ------------------------------------------------------------------
 * Cartão de crédito
 * ------------------------------------------------------------------ */
function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function cardBrand(num: string): string {
  const n = num.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(n)) return 'Elo';
  if (/^(606282|3841)/.test(n)) return 'Hipercard';
  return '';
}

const maskCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const maskExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function validExpiry(v: string): boolean {
  const [mm, yy] = v.split('/').map(Number);
  if (!mm || yy === undefined || Number.isNaN(yy) || mm < 1 || mm > 12) return false;
  const now = new Date();
  const year = 2000 + yy;
  return year > now.getFullYear() || (year === now.getFullYear() && mm >= now.getMonth() + 1);
}

/* ================================================================== */

type Step = 'form' | 'processing' | 'success';

export default function AdvancedCheckoutModal({ vehicle, onClose, onConfirm, onDone }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [step, setStep] = useState<Step>('form');
  const receiptRef = useRef<UnlockReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fecha com ESC e trava o scroll do fundo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && step !== 'processing' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, step]);

  async function confirmPayment(m: PaymentMethod) {
    setError(null);
    setStep('processing');
    try {
      receiptRef.current = await onConfirm(m);
      haptic(40);
      setStep('success');
    } catch (err) {
      haptic(30);
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.');
      setStep('form');
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
      onClick={() => step === 'form' && onClose()}
    >
      <div
        className="animate-slide-up pb-safe flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="checkout-title" className="text-lg font-bold">Desbloquear laudo completo</h2>
            <p className="text-sm text-slate-500">
              {vehicle.brand} {vehicle.model} · <span className="font-mono font-semibold">{formatPlate(vehicle.plate)}</span>
            </p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="tap flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {step === 'form' && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm text-slate-600">Total (pagamento único)</span>
                <span className="text-2xl font-extrabold">{formatBRL(ADVANCED_PRICE)}</span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Forma de pagamento">
                {(
                  [
                    { id: 'pix', label: 'PIX', icon: QrCode },
                    { id: 'cartao', label: 'Cartão', icon: CreditCard },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={method === t.id}
                    onClick={() => {
                      haptic();
                      setMethod(t.id);
                    }}
                    className={cn(
                      'tap flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold',
                      method === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>

              {error && (
                <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200 ring-inset">{error}</p>
              )}

              {method === 'pix' ? <PixPanel onConfirm={() => confirmPayment('pix')} /> : <CardPanel onConfirm={() => confirmPayment('cartao')} />}

              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Ambiente de demonstração: nenhuma cobrança real é realizada.
              </p>
            </>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center py-12 text-center" role="status">
              <LoaderCircle className="h-12 w-12 animate-spin text-blue-600" />
              <p className="mt-4 font-semibold">Confirmando pagamento…</p>
              <p className="text-sm text-slate-500">Não feche esta janela.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="animate-pop flex flex-col items-center py-8 text-center" role="status">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CircleCheck className="h-10 w-10 text-emerald-600" />
              </div>
              <p className="mt-4 text-xl font-bold">Pagamento aprovado!</p>
              <p className="mt-1 text-sm text-slate-500">O laudo completo foi liberado e ficará salvo no seu histórico.</p>
              <p className="mt-3 font-mono text-xs text-slate-400">Transação {receiptRef.current?.transactionId}</p>
              <button
                onClick={onDone}
                className="tap mt-6 h-14 w-full rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              >
                Ver laudo completo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PixPanel({ onConfirm }: { onConfirm: (txid: string) => void }) {
  const txid = useMemo(newTxId, []);
  const payload = useMemo(() => buildPixPayload(txid, ADVANCED_PRICE), [txid]);
  const [qr, setQr] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(PIX_EXPIRATION_S);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(payload, { width: 440, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [payload]);

  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function copy() {
    haptic();
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function checkPayment() {
    haptic();
    setWaiting(true);
    setTimeout(() => onConfirm(`PIX-${txid}`), 1200);
  }

  const expired = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div className={cn('relative rounded-2xl border border-slate-200 p-2', expired && 'opacity-30')}>
        {qr ? (
          <img src={qr} alt="QR Code PIX para pagamento de R$ 35,00" className="h-56 w-56" />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      <p className={cn('mt-3 flex items-center gap-1.5 text-sm font-medium', remaining < 60 ? 'text-red-600' : 'text-slate-600')}>
        <Clock className="h-4 w-4" />
        {expired ? 'QR Code expirado' : `Expira em ${mm}:${ss}`}
      </p>

      {expired ? (
        <button onClick={() => setRemaining(PIX_EXPIRATION_S)} className="tap mt-3 h-12 w-full rounded-xl bg-slate-900 font-semibold text-white">
          Gerar novo QR Code
        </button>
      ) : (
        <>
          <p className="mt-3 text-center text-sm text-slate-500">Abra o app do seu banco, escolha <strong>Pagar com PIX</strong> e escaneie o código, ou use o Copia e Cola:</p>
          <div className="mt-3 w-full rounded-xl bg-slate-50 p-3 font-mono text-[11px] break-all text-slate-600">{payload}</div>
          <button
            onClick={copy}
            className={cn(
              'tap mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 font-semibold',
              copied ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-900 text-slate-900 hover:bg-slate-50',
            )}
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            {copied ? 'Código copiado!' : 'Copiar código PIX'}
          </button>
          <button
            onClick={checkPayment}
            disabled={waiting}
            className="tap mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            {waiting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {waiting ? 'Verificando pagamento…' : 'Já paguei'}
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CardPanel({ onConfirm }: { onConfirm: (txid: string) => void }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const brand = cardBrand(number);
  const maskCpf = (v: string) =>
    v
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!luhn(number)) errs.number = 'Número de cartão inválido.';
    if (name.trim().split(/\s+/).length < 2) errs.name = 'Informe o nome como está no cartão.';
    if (!validExpiry(expiry)) errs.expiry = 'Validade inválida.';
    if (!/^\d{3,4}$/.test(cvv)) errs.cvv = 'CVV inválido.';
    if (cpf.replace(/\D/g, '').length !== 11) errs.cpf = 'CPF inválido.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      haptic(30);
      return;
    }
    haptic();
    onConfirm(`CARD-${Date.now().toString(36).toUpperCase()}`);
  }

  const field = (key: string) =>
    cn(
      'h-12 w-full rounded-xl border bg-white px-3.5 text-base outline-none focus:ring-2',
      errors[key] ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100',
    );
  const err = (key: string) => errors[key] && <p className="mt-1 text-xs font-medium text-red-600">{errors[key]}</p>;

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div>
        <label htmlFor="cc-number" className="mb-1 flex justify-between text-sm font-medium text-slate-700">
          Número do cartão {brand && <span className="text-xs font-bold text-blue-700">{brand}</span>}
        </label>
        <input id="cc-number" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={number} onChange={(e) => setNumber(maskCard(e.target.value))} className={cn(field('number'), 'font-mono tracking-wider')} />
        {err('number')}
      </div>
      <div>
        <label htmlFor="cc-name" className="mb-1 block text-sm font-medium text-slate-700">Nome impresso no cartão</label>
        <input id="cc-name" autoComplete="cc-name" placeholder="NOME SOBRENOME" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className={field('name')} />
        {err('name')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cc-exp" className="mb-1 block text-sm font-medium text-slate-700">Validade</label>
          <input id="cc-exp" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={expiry} onChange={(e) => setExpiry(maskExpiry(e.target.value))} className={field('expiry')} />
          {err('expiry')}
        </div>
        <div>
          <label htmlFor="cc-cvv" className="mb-1 block text-sm font-medium text-slate-700">CVV</label>
          <input id="cc-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} className={field('cvv')} />
          {err('cvv')}
        </div>
      </div>
      <div>
        <label htmlFor="cc-cpf" className="mb-1 block text-sm font-medium text-slate-700">CPF do titular</label>
        <input id="cc-cpf" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} className={field('cpf')} />
        {err('cpf')}
      </div>
      <button type="submit" className="tap flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 font-bold text-white hover:bg-blue-800">
        <Lock className="h-5 w-5" /> Pagar {formatBRL(ADVANCED_PRICE)}
      </button>
      <p className="text-center text-xs text-slate-500">
        Cartão de teste: <button type="button" className="font-mono font-semibold text-blue-700 underline" onClick={() => { setNumber('4111 1111 1111 1111'); setName('CLIENTE TESTE'); setExpiry('12/30'); setCvv('123'); setCpf('123.456.789-09'); setErrors({}); }}>preencher automaticamente</button>
      </p>
    </form>
  );
}
