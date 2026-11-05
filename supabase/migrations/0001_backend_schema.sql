-- ============================================================
-- Consulta Placa Veicular — esquema do backend
-- Acesso SOMENTE pelo servidor (chave service_role).
-- RLS ativo e sem policies: o app no navegador não lê nem grava nada aqui.
-- ============================================================

-- Cache das respostas do provedor de dados (evita pagar a API duas vezes)
create table if not exists public.vehicle_cache (
  plate       text        not null check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  kind        text        not null check (kind in ('basic', 'report')),
  provider    text        not null,
  data        jsonb       not null,
  fetched_at  timestamptz not null default now(),
  primary key (plate, kind)
);

-- Laudos liberados. O token de acesso nunca é guardado — só o hash SHA-256.
create table if not exists public.unlocks (
  id              uuid        primary key default gen_random_uuid(),
  plate           text        not null check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  method          text        not null check (method in ('pix', 'cartao')),
  amount_cents    integer     not null check (amount_cents > 0),
  token_hash      text        not null unique,
  transaction_id  text        not null unique,
  status          text        not null default 'paid' check (status in ('pending', 'paid', 'refunded')),
  created_at      timestamptz not null default now()
);
create index if not exists unlocks_plate_idx on public.unlocks (plate);

-- Log de consultas (IP anonimizado por hash — LGPD)
create table if not exists public.lookup_logs (
  id          bigint      generated always as identity primary key,
  plate       text        not null,
  kind        text        not null check (kind in ('basic', 'report')),
  source      text        not null check (source in ('cache', 'provider')),
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists lookup_logs_created_at_idx on public.lookup_logs (created_at desc);

alter table public.vehicle_cache enable row level security;
alter table public.unlocks       enable row level security;
alter table public.lookup_logs   enable row level security;

-- Garante que os papéis públicos não tenham acesso algum
revoke all on public.vehicle_cache, public.unlocks, public.lookup_logs from anon, authenticated;
