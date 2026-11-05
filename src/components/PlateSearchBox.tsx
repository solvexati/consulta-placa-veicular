import { useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, Search, Sparkles } from 'lucide-react';
import { TEST_PLATES } from '../../shared/testPlates';
import { cn, haptic } from '../utils/format';
import { formatPlate, getPlateFormat, maskPlateInput, plateValidationMessage } from '../../shared/plateFormatter';

interface Props {
  loading: boolean;
  onSearch: (plate: string) => void;
}

export default function PlateSearchBox({ loading, onSearch }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isComplete = value.length === 7;
  const format = isComplete ? getPlateFormat(value) : null;

  function submit(plate: string) {
    const msg = plateValidationMessage(plate);
    if (msg) {
      setError(msg);
      haptic(30);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    haptic();
    inputRef.current?.blur();
    onSearch(plate);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!loading) submit(value);
  }

  function quickSearch(plate: string) {
    setValue(plate);
    submit(plate);
  }

  return (
    <section className="animate-slide-up" aria-labelledby="search-title">
      <div className="mb-5 text-center">
        <h1 id="search-title" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Consulte qualquer veículo pela placa
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 sm:text-base">
          Dados cadastrais e tabela FIPE grátis. Laudo completo por <strong className="text-slate-700">R$ 35,00</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-md">
        {/* Placa estilo Mercosul */}
        <label htmlFor="plate-input" className="sr-only">
          Placa do veículo
        </label>
        <div
          className={cn(
            'overflow-hidden rounded-2xl border-[3px] bg-white shadow-lg transition-colors',
            error ? 'border-red-500' : 'border-slate-900 focus-within:border-blue-700',
          )}
          onClick={() => inputRef.current?.focus()}
        >
          <div className="flex items-center justify-between bg-plate-blue px-3 py-1 text-white">
            <span className="text-[10px] font-semibold tracking-wider opacity-80">MERCOSUL</span>
            <span className="text-sm font-extrabold tracking-[0.35em]">BRASIL</span>
            <span className="flex h-4 w-6 items-center justify-center rounded-[2px] bg-green-600" aria-hidden>
              <span className="h-2.5 w-2.5 rotate-45 bg-yellow-400" />
            </span>
          </div>
          <input
            ref={inputRef}
            id="plate-input"
            value={formatPlate(value)}
            onChange={(e) => {
              setValue(maskPlateInput(e.target.value));
              setError(null);
            }}
            placeholder="ABC1D23"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="search"
            maxLength={8}
            aria-invalid={Boolean(error)}
            aria-describedby="plate-help"
            className="w-full bg-transparent px-4 py-3 text-center font-mono text-4xl font-extrabold tracking-[0.18em] text-slate-900 uppercase placeholder:text-slate-300 focus:outline-none sm:text-5xl"
          />
        </div>

        <p id="plate-help" className={cn('mt-2 min-h-5 text-center text-sm', error ? 'font-medium text-red-600' : 'text-slate-500')} role={error ? 'alert' : undefined}>
          {error ??
            (format === 'antiga'
              ? 'Placa padrão antigo detectada'
              : format === 'mercosul'
                ? 'Placa padrão Mercosul detectada'
                : 'Aceita padrão Mercosul (BRA2E19) e antigo (ABC-1234)')}
        </p>

        <button
          type="submit"
          disabled={loading}
          className="tap mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-70"
        >
          {loading ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin" /> Consultando bases…
            </>
          ) : (
            <>
              <Search className="h-5 w-5" /> Consultar placa grátis
            </>
          )}
        </button>
      </form>

      {/* Placas de teste */}
      <div className="mx-auto mt-6 max-w-md">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <Sparkles className="h-3.5 w-3.5" /> Placas de teste
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TEST_PLATES.map((t) => (
            <button
              key={t.plate}
              type="button"
              disabled={loading}
              onClick={() => quickSearch(t.plate)}
              className="tap min-h-14 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
            >
              <span className="block font-mono text-sm font-bold text-slate-900">{formatPlate(t.plate)}</span>
              <span className="block text-xs text-slate-500">
                {t.label} · {t.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
