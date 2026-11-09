-- ============================================================
-- 0003 — Login Google: laudos e consultas vinculados à conta do usuário
-- ============================================================

-- Laudo comprado pertence a um usuário (recuperável em qualquer aparelho)
alter table public.unlocks
  add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists unlocks_user_id_idx on public.unlocks (user_id);

-- Consulta registrada com o usuário (controle de abuso por conta, não só por IP)
alter table public.lookup_logs
  add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists lookup_logs_user_id_idx on public.lookup_logs (user_id);
