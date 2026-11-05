/**
 * Limitador de requisições em memória (janela deslizante).
 *
 * Na Vercel (Fluid Compute) as instâncias são reaproveitadas, então isso já
 * barra abusos simples. Para um limite global entre todas as instâncias,
 * troque por uma tabela no Supabase ou pelas regras de rate limit do Vercel Firewall.
 */

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - recent[0]) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 };
}

/** Remove chaves antigas para não crescer indefinidamente. */
function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= windowMs)) hits.delete(key);
  }
}

/** Apenas para testes. */
export function resetRateLimit(): void {
  hits.clear();
}
