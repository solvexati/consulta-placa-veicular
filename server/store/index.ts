import { getEnv } from '../env.js';
import { createMemoryStore } from './memory.js';
import { createSupabaseStore } from './supabase.js';
import type { Store } from './types.js';

let instance: Store | null = null;

/** Supabase quando SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY existem; senão, memória. */
export function getStore(): Store {
  if (instance) return instance;
  const { supabaseUrl, supabaseServiceRoleKey } = getEnv();
  instance =
    supabaseUrl && supabaseServiceRoleKey
      ? createSupabaseStore(supabaseUrl, supabaseServiceRoleKey)
      : createMemoryStore();
  return instance;
}
