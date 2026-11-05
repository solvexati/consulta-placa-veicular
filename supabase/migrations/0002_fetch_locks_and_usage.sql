-- ============================================================
-- 0002 — Proteção contra chamadas simultâneas e relatório de uso
-- ============================================================

-- Qual provedor (API) respondeu cada consulta — essencial ao trocar de API
alter table public.lookup_logs add column if not exists provider text;

-- Trava por placa: se duas pessoas consultarem a mesma placa ao mesmo tempo,
-- só uma chamada vai à API paga; a outra espera o resultado entrar no cache.
create table if not exists public.fetch_locks (
  plate         text        not null,
  kind          text        not null check (kind in ('basic', 'report')),
  locked_until  timestamptz not null,
  primary key (plate, kind)
);

alter table public.fetch_locks enable row level security;
revoke all on public.fetch_locks from anon, authenticated;

-- Tenta obter a trava de forma atômica. Retorna true se conseguiu.
-- Uma trava vencida (ex.: função caiu no meio) é reaproveitada.
create or replace function public.try_acquire_fetch_lock(p_plate text, p_kind text, p_ttl_seconds integer default 20)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  acquired boolean;
begin
  insert into public.fetch_locks as l (plate, kind, locked_until)
  values (p_plate, p_kind, now() + make_interval(secs => p_ttl_seconds))
  on conflict (plate, kind) do update
    set locked_until = excluded.locked_until
    where l.locked_until < now()
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_fetch_lock(p_plate text, p_kind text)
returns void
language sql
set search_path = public
as $$
  delete from public.fetch_locks where plate = p_plate and kind = p_kind;
$$;

revoke all on function public.try_acquire_fetch_lock(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_fetch_lock(text, text) from public, anon, authenticated;

-- Relatório diário: quantas consultas vieram do cache (grátis) x da API (paga)
create or replace view public.api_usage_daily
with (security_invoker = true) as
select
  (created_at at time zone 'America/Sao_Paulo')::date as dia,
  kind                                                as tipo,
  coalesce(provider, '-')                             as provedor,
  count(*) filter (where source = 'provider')         as chamadas_api,
  count(*) filter (where source = 'cache')            as respostas_cache,
  count(*)                                            as total,
  round(100.0 * count(*) filter (where source = 'cache') / nullif(count(*), 0), 1) as economia_pct
from public.lookup_logs
group by 1, 2, 3
order by 1 desc, 2;

revoke all on public.api_usage_daily from anon, authenticated;
