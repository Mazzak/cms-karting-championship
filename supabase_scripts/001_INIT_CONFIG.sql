-- CMS Karting Championship
-- Supabase / PostgreSQL schema
-- Base version for public site + admin panel

create extension if not exists pgcrypto;

-- =====================================================
-- 1) PROFILES
-- Linked to Supabase auth users
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- 2) CHAMPIONSHIPS
-- Allows future reuse for other editions/seasons
-- =====================================================
create table if not exists public.championships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  season integer not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists championships_slug_idx on public.championships(slug);
create index if not exists championships_active_idx on public.championships(is_active);

-- =====================================================
-- 3) CHAMPIONSHIP CONFIG
-- Points system and tie-break rules
-- =====================================================
create table if not exists public.championship_configs (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null unique references public.championships(id) on delete cascade,
  points_p1 integer not null default 25,
  points_p2 integer not null default 20,
  points_p3 integer not null default 16,
  points_p4 integer not null default 13,
  points_p5 integer not null default 11,
  points_p6 integer not null default 10,
  points_p7 integer not null default 9,
  points_p8 integer not null default 8,
  points_p9 integer not null default 7,
  points_p10 integer not null default 6,
  fastest_lap_points integer not null default 1,
  pole_position_points integer not null default 1,
  win_bonus_points integer not null default 0,
  dropped_results_count integer not null default 0,
  tie_break_order text[] not null default array['wins','second_places','third_places','latest_stage_result'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- 4) PILOTS
-- =====================================================
create table if not exists public.pilots (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  full_name text not null,
  kart_number integer,
  team_name text not null default 'CMS',
  email text,
  phone text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (championship_id, kart_number)
);

create index if not exists pilots_championship_idx on public.pilots(championship_id);
create index if not exists pilots_active_idx on public.pilots(championship_id, is_active);

-- =====================================================
-- 5) TRACKS
-- Reusable kart tracks
-- =====================================================
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text,
  country text default 'Portugal',
  address text,
  website_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- 6) STAGES / ROUNDS
-- =====================================================
create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete set null,
  round_number integer not null,
  name text not null,
  city text,
  stage_date date not null,
  check_in_time time,
  briefing_time time,
  race_time time,
  status text not null default 'draft' check (status in ('draft','scheduled','completed','cancelled')),
  is_public boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (championship_id, round_number)
);

create index if not exists stages_championship_idx on public.stages(championship_id);
create index if not exists stages_date_idx on public.stages(championship_id, stage_date);
create index if not exists stages_status_idx on public.stages(championship_id, status);

-- =====================================================
-- 7) STAGE ENTRIES
-- Which pilots are participating in each stage
-- =====================================================
create table if not exists public.stage_entries (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  pilot_id uuid not null references public.pilots(id) on delete cascade,
  attendance_status text not null default 'pending' check (attendance_status in ('pending','confirmed','declined','attended','dns')),
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, pilot_id)
);

create index if not exists stage_entries_stage_idx on public.stage_entries(stage_id);
create index if not exists stage_entries_pilot_idx on public.stage_entries(pilot_id);

-- =====================================================
-- 8) RESULTS
-- Main source for standings calculation
-- =====================================================
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  pilot_id uuid not null references public.pilots(id) on delete cascade,
  finish_position integer not null check (finish_position > 0),
  grid_position integer,
  pole_position boolean not null default false,
  fastest_lap boolean not null default false,
  best_lap_time_ms integer,
  total_points integer not null default 0,
  penalty_points integer not null default 0,
  penalty_notes text,
  did_not_start boolean not null default false,
  did_not_finish boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, pilot_id),
  unique (stage_id, finish_position)
);

create index if not exists results_stage_idx on public.results(stage_id);
create index if not exists results_pilot_idx on public.results(pilot_id);

-- Only one pole and one fastest lap per stage
create unique index if not exists results_one_pole_per_stage_idx
  on public.results(stage_id)
  where pole_position = true;

create unique index if not exists results_one_fastest_lap_per_stage_idx
  on public.results(stage_id)
  where fastest_lap = true;

-- =====================================================
-- 9) NOTIFICATIONS
-- Future phase: reminders / alerts
-- =====================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  stage_id uuid references public.stages(id) on delete cascade,
  pilot_id uuid references public.pilots(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  message_subject text,
  message_body text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================
-- 10) UPDATED_AT TRIGGER
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_profiles'
  ) then
    create trigger set_updated_at_profiles
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_championships'
  ) then
    create trigger set_updated_at_championships
    before update on public.championships
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_championship_configs'
  ) then
    create trigger set_updated_at_championship_configs
    before update on public.championship_configs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_pilots'
  ) then
    create trigger set_updated_at_pilots
    before update on public.pilots
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_tracks'
  ) then
    create trigger set_updated_at_tracks
    before update on public.tracks
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_stages'
  ) then
    create trigger set_updated_at_stages
    before update on public.stages
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_stage_entries'
  ) then
    create trigger set_updated_at_stage_entries
    before update on public.stage_entries
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_results'
  ) then
    create trigger set_updated_at_results
    before update on public.results
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- =====================================================
-- 11) AUTO-CALCULATE RESULT POINTS
-- =====================================================
create or replace function public.calculate_result_points()
returns trigger
language plpgsql
as $$
declare
  v_championship_id uuid;
  v_points integer := 0;
  v_fastest_lap_points integer := 0;
  v_pole_points integer := 0;
  v_win_bonus integer := 0;
begin
  select s.championship_id
    into v_championship_id
  from public.stages s
  where s.id = new.stage_id;

  select
    case new.finish_position
      when 1 then c.points_p1
      when 2 then c.points_p2
      when 3 then c.points_p3
      when 4 then c.points_p4
      when 5 then c.points_p5
      when 6 then c.points_p6
      when 7 then c.points_p7
      when 8 then c.points_p8
      when 9 then c.points_p9
      when 10 then c.points_p10
      else 0
    end,
    case when new.fastest_lap then c.fastest_lap_points else 0 end,
    case when new.pole_position then c.pole_position_points else 0 end,
    case when new.finish_position = 1 then c.win_bonus_points else 0 end
  into v_points, v_fastest_lap_points, v_pole_points, v_win_bonus
  from public.championship_configs c
  where c.championship_id = v_championship_id;

  new.total_points := greatest(0, v_points + v_fastest_lap_points + v_pole_points + v_win_bonus - coalesce(new.penalty_points, 0));
  return new;
end;
$$;

drop trigger if exists calculate_result_points_trigger on public.results;
create trigger calculate_result_points_trigger
before insert or update on public.results
for each row execute function public.calculate_result_points();

-- =====================================================
-- 12) PUBLIC STANDINGS VIEW
-- =====================================================
create or replace view public.championship_standings as
select
  p.championship_id,
  p.id as pilot_id,
  p.full_name,
  p.kart_number,
  p.team_name,
  coalesce(sum(r.total_points), 0) as total_points,
  count(*) filter (where r.finish_position = 1) as wins,
  count(*) filter (where r.finish_position = 2) as second_places,
  count(*) filter (where r.finish_position = 3) as third_places,
  count(*) filter (where r.finish_position <= 3) as podiums,
  rank() over (
    partition by p.championship_id
    order by
      coalesce(sum(r.total_points), 0) desc,
      count(*) filter (where r.finish_position = 1) desc,
      count(*) filter (where r.finish_position = 2) desc,
      count(*) filter (where r.finish_position = 3) desc,
      p.full_name asc
  ) as standing_position
from public.pilots p
left join public.results r on r.pilot_id = p.id
where p.is_active = true
group by p.championship_id, p.id, p.full_name, p.kart_number, p.team_name;

-- =====================================================
-- 13) RLS
-- Public can read public data
-- Only admins can write
-- =====================================================
alter table public.profiles enable row level security;
alter table public.championships enable row level security;
alter table public.championship_configs enable row level security;
alter table public.pilots enable row level security;
alter table public.tracks enable row level security;
alter table public.stages enable row level security;
alter table public.stage_entries enable row level security;
alter table public.results enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- PROFILES
create policy "Users can read own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "Admins can manage profiles"
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

-- CHAMPIONSHIPS
create policy "Public can read championships"
on public.championships
for select
using (true);

create policy "Admins can manage championships"
on public.championships
for all
using (public.is_admin())
with check (public.is_admin());

-- CONFIG
create policy "Public can read championship configs"
on public.championship_configs
for select
using (true);

create policy "Admins can manage championship configs"
on public.championship_configs
for all
using (public.is_admin())
with check (public.is_admin());

-- PILOTS
create policy "Public can read pilots"
on public.pilots
for select
using (true);

create policy "Admins can manage pilots"
on public.pilots
for all
using (public.is_admin())
with check (public.is_admin());

-- TRACKS
create policy "Public can read tracks"
on public.tracks
for select
using (true);

create policy "Admins can manage tracks"
on public.tracks
for all
using (public.is_admin())
with check (public.is_admin());

-- STAGES
create policy "Public can read visible stages"
on public.stages
for select
using (is_public = true);

create policy "Admins can manage stages"
on public.stages
for all
using (public.is_admin())
with check (public.is_admin());

-- STAGE ENTRIES
create policy "Admins can read stage entries"
on public.stage_entries
for select
using (public.is_admin());

create policy "Admins can manage stage entries"
on public.stage_entries
for all
using (public.is_admin())
with check (public.is_admin());

-- RESULTS
create policy "Public can read results"
on public.results
for select
using (true);

create policy "Admins can manage results"
on public.results
for all
using (public.is_admin())
with check (public.is_admin());

-- NOTIFICATIONS
create policy "Admins can read notifications"
on public.notifications
for select
using (public.is_admin());

create policy "Admins can manage notifications"
on public.notifications
for all
using (public.is_admin())
with check (public.is_admin());

-- =====================================================
-- 14) SEED DATA
-- =====================================================
insert into public.championships (name, slug, season, description, is_active)
values (
  'CMS Karting Championship',
  'cms-karting-championship-2026',
  2026,
  '1.º Campeonato de Karting - CMS Edition',
  true
)
on conflict (slug) do nothing;

with championship_row as (
  select id from public.championships where slug = 'cms-karting-championship-2026'
)
insert into public.championship_configs (
  championship_id,
  points_p1, points_p2, points_p3, points_p4, points_p5,
  points_p6, points_p7, points_p8, points_p9, points_p10,
  fastest_lap_points, pole_position_points, win_bonus_points, dropped_results_count
)
select
  id,
  25, 20, 16, 13, 11,
  10, 9, 8, 7, 6,
  1, 1, 0, 0
from championship_row
on conflict (championship_id) do nothing;

insert into public.tracks (name, city)
values
  ('Kartódromo Internacional de Braga', 'Braga'),
  ('Kartódromo de Baltar', 'Baltar'),
  ('Kartódromo Cabo do Mundo', 'Matosinhos'),
  ('Kartódromo de Viana do Castelo', 'Viana do Castelo')
on conflict (name) do nothing;

with championship_row as (
  select id from public.championships where slug = 'cms-karting-championship-2026'
),
track_rows as (
  select id, name, city from public.tracks
)
insert into public.stages (championship_id, track_id, round_number, name, city, stage_date, status, is_public)
select c.id, t.id,
  case t.name
    when 'Kartódromo Internacional de Braga' then 1
    when 'Kartódromo de Baltar' then 2
    when 'Kartódromo Cabo do Mundo' then 3
    when 'Kartódromo de Viana do Castelo' then 4
  end,
  t.name,
  t.city,
  case t.name
    when 'Kartódromo Internacional de Braga' then date '2026-04-18'
    when 'Kartódromo de Baltar' then date '2026-05-23'
    when 'Kartódromo Cabo do Mundo' then date '2026-06-20'
    when 'Kartódromo de Viana do Castelo' then date '2026-07-18'
  end,
  'scheduled',
  true
from championship_row c
cross join track_rows t
on conflict (championship_id, round_number) do nothing;

alter table public.tracks
add column if not exists google_maps_url text;

update public.tracks
set google_maps_url = 'https://maps.google.com/?q=Kartodromo+Internacional+de+Braga'
where name = 'Kartódromo Internacional de Braga';

update public.tracks
set google_maps_url = 'https://maps.google.com/?q=Kartodromo+de+Baltar'
where name = 'Kartódromo de Baltar';

update public.tracks
set google_maps_url = 'https://maps.google.com/?q=Kartodromo+Cabo+do+Mundo'
where name = 'Kartódromo Cabo do Mundo';

update public.tracks
set google_maps_url = 'https://maps.google.com/?q=Kartodromo+de+Viana+do+Castelo'
where name = 'Kartódromo de Viana do Castelo';