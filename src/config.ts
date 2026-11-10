/**
 * Configuração PÚBLICA do app (vai para o navegador).
 * A chave "publishable" do Supabase é feita para ficar no app: ela só permite
 * o que as regras do banco liberam (nossas tabelas não liberam nada ao público).
 * NUNCA coloque aqui a chave service_role nem chaves de API pagas.
 */
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://rejbibahyvrjnqipsaqu.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_EGKNNp1anTrWSunepGd2Nw_EVQu4U-V';

export const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
