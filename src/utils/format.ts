const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatBRL = (value: number): string => brl.format(value);

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return formatDate(iso);
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Vibração curta para feedback tátil em dispositivos que suportam. */
export function haptic(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem suporte */
  }
}
