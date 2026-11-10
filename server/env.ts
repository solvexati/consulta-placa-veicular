/**
 * Configuração do backend lida das variáveis de ambiente.
 * Em produção: `vercel env add NOME`. Em desenvolvimento: arquivo `.env.local`.
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getEnv() {
  const e = process.env;
  return {
    /** Provedor de dados veiculares: `mock` (padrão) ou o nome de um adaptador real. */
    vehicleProvider: (e.VEHICLE_PROVIDER || 'mock').toLowerCase(),
    providerApiUrl: e.VEHICLE_PROVIDER_API_URL ?? '',
    providerApiKey: e.VEHICLE_PROVIDER_API_KEY ?? '',
    /** Tempo máximo de espera por resposta da API (ms). */
    providerTimeoutMs: num(e.PROVIDER_TIMEOUT_MS, 15_000),
    /** Novas tentativas em falha de rede / 429 / 5xx (0 = nenhuma). */
    providerRetries: Math.max(0, Math.floor(Number(e.PROVIDER_RETRIES ?? 2)) || 0),

    /** Substituir o valor FIPE do provedor pelo preço oficial atual (BrasilAPI/Parallelum). */
    fipeEnrich: bool(e.FIPE_ENRICH, true),
    /** Fontes de preço FIPE, na ordem de tentativa. */
    fipeSources: (e.FIPE_SOURCES || 'brasilapi,parallelum')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),

    supabaseUrl: e.SUPABASE_URL || e.VITE_SUPABASE_URL || 'https://rejbibahyvrjnqipsaqu.supabase.co',
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY ?? '',
    /** Chave pública do Supabase — a mesma do app (basta definir VITE_SUPABASE_PUBLISHABLE_KEY). */
    supabasePublishableKey:
      e.SUPABASE_PUBLISHABLE_KEY || e.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_EGKNNp1anTrWSunepGd2Nw_EVQu4U-V',

    /**
     * Exigir login Google nas rotas de consulta (padrão: true). Na prática só passa
     * a valer quando o provedor Google estiver ATIVADO no painel do Supabase.
     */
    authRequired: bool(e.AUTH_REQUIRED, true),

    /** Validade do cache dos dados básicos (horas). */
    basicCacheHours: num(e.CACHE_BASIC_TTL_HOURS, 24 * 7),
    /** Validade do cache do laudo completo (horas). */
    reportCacheHours: num(e.CACHE_REPORT_TTL_HOURS, 24),

    /** Consultas por minuto por IP. */
    rateLimitPerMinute: num(e.RATE_LIMIT_PER_MINUTE, 20),

    /**
     * Enquanto não houver gateway de pagamento, o desbloqueio é simulado.
     * Desligue (`false`) ao integrar o gateway real.
     */
    simulatedPayments: bool(e.SIMULATED_PAYMENTS, true),

    /** Sal para anonimizar IPs nos logs (LGPD). */
    ipHashSalt: e.IP_HASH_SALT || 'consulta-placa',
  };
}

/**
 * Segredo que assina os tokens de acesso ao laudo. Lido só quando necessário,
 * para que a busca grátis continue funcionando mesmo sem ele configurado.
 * Em dev usa um segredo fixo; na Vercel (preview/produção) é obrigatório.
 */
export function getAccessTokenSecret(): string {
  const value = process.env.ACCESS_TOKEN_SECRET;
  if (value) return value;
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') {
    throw new Error('ACCESS_TOKEN_SECRET não configurado. Rode: vercel env add ACCESS_TOKEN_SECRET');
  }
  return 'dev-only-secret-nao-use-em-producao';
}

export type Env = ReturnType<typeof getEnv>;
