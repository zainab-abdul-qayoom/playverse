-- =====================================================================
--  PLAYVERSE  |  Database schema  |  Run ONCE in Supabase > SQL Editor
--  (Safe to re-run: it uses "if not exists" / "or replace" everywhere.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- Games (fees / open-closed / slot limits are editable from the CRM)
create table if not exists public.games (
  slug        text primary key,
  name        text not null,
  code        text not null unique,          -- used in Registration IDs
  reg_type    text not null check (reg_type in ('individual','team')),
  team_size   int  not null default 1,
  fee         numeric(10,0),                 -- PKR, NULL = "not announced yet"
  is_open     boolean not null default true,
  max_slots   int,                           -- NULL = unlimited
  sort_order  int not null default 0
);

insert into public.games (slug, name, code, reg_type, team_size, sort_order) values
  ('pubg',         'PUBG',         'PUBG', 'team',       4, 1),
  ('tekken',       'Tekken',       'TEK',  'individual', 1, 2),
  ('fifa',         'FIFA',         'FIFA', 'individual', 1, 3),
  ('mini-militia', 'Mini Militia', 'MM',   'individual', 1, 4),
  ('mafia-wars',   'Mafia Wars',   'MW',   'individual', 1, 5)
on conflict (slug) do nothing;

-- Per-game running number for Registration IDs (PV-TEK-0001 ...)
create table if not exists public.reg_counters (
  game        text primary key references public.games(slug),
  last_value  int not null default 0
);

-- CRM staff (linked to Supabase Auth users)
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null check (role in ('super_admin','registration_admin','finance')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One row per registration (a PUBG team = ONE registration)
create table if not exists public.registrations (
  id              uuid primary key default gen_random_uuid(),
  reg_code        text not null unique,
  game            text not null references public.games(slug),
  reg_type        text not null check (reg_type in ('individual','team')),
  source          text not null default 'online' check (source in ('online','on_spot')),
  team_name       text,
  payment_method  text not null default 'online' check (payment_method in ('online','cash','other')),
  payment_status  text not null default 'pending'
                  check (payment_status in ('pending','verified','rejected','cash_paid','complimentary')),
  status          text not null default 'new'
                  check (status in ('new','confirmed','pending','cancelled','checked_in')),
  receipt_path    text,
  receipt_name    text,
  consent_accepted boolean not null default false,
  consent_at      timestamptz,
  duplicate_flag  boolean not null default false,
  duplicate_note  text,
  notes           text,
  checked_in_at   timestamptz,
  checked_in_by   text,
  archived        boolean not null default false,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

-- People inside a registration (1 for individual games, 4 for PUBG)
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  slot             int  not null default 1 check (slot between 1 and 4),
  team_role        text not null default 'participant' check (team_role in ('participant','captain','player')),
  full_name        text not null,
  roll_number      text not null,
  department       text not null,
  contact          text not null,             -- always stored as 03XXXXXXXXX
  unique (registration_id, slot)
);

create index if not exists idx_reg_game        on public.registrations (game);
create index if not exists idx_reg_created     on public.registrations (created_at desc);
create index if not exists idx_reg_status      on public.registrations (status);
create index if not exists idx_part_reg        on public.participants (registration_id);
create index if not exists idx_part_roll       on public.participants (roll_number);
create index if not exists idx_part_contact    on public.participants (contact);
-- a receipt file can only ever belong to one registration
create unique index if not exists uq_reg_receipt on public.registrations (receipt_path) where receipt_path is not null;

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Role of the logged-in CRM user (NULL for the public / inactive users)
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p where p.user_id = auth.uid() and p.active limit 1
$$;

-- Who is doing this action (for "last updated by")
create or replace function public.pv_actor() returns text
language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'public')
$$;

-- Pakistani mobile numbers -> 03XXXXXXXXX  (NULL when invalid)
create or replace function public.pv_norm_phone(raw text) returns text
language plpgsql immutable as $$
declare d text;
begin
  d := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  if d like '0092%' then
    d := '0' || substr(d, 5);
  elsif d like '92%' and length(d) = 12 then
    d := '0' || substr(d, 3);
  elsif length(d) = 10 and d like '3%' then
    d := '0' || d;
  end if;
  if d ~ '^03[0-9]{9}$' then
    return d;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS  (timestamps, "updated by", finance restrictions)
-- ---------------------------------------------------------------------

create or replace function public.trg_registrations_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Finance users may ONLY change the payment status
  if public.app_role() = 'finance' then
    if (to_jsonb(new) - 'payment_status' - 'updated_at' - 'updated_by')
       is distinct from
       (to_jsonb(old) - 'payment_status' - 'updated_at' - 'updated_by') then
      raise exception 'Finance users can only change the payment status.';
    end if;
  end if;

  -- keep check-in fields consistent with the status
  if old.status = 'checked_in' and new.status <> 'checked_in' then
    new.checked_in_at := null;
    new.checked_in_by := null;
  end if;
  if new.status = 'checked_in' and new.checked_in_at is null then
    new.checked_in_at := now();
    new.checked_in_by := public.pv_actor();
  end if;

  if new.archived and not old.archived then
    new.archived_at := now();
  elsif not new.archived then
    new.archived_at := null;
  end if;

  new.updated_at := now();
  new.updated_by := public.pv_actor();
  return new;
end $$;

drop trigger if exists registrations_guard on public.registrations;
create trigger registrations_guard
  before update on public.registrations
  for each row execute function public.trg_registrations_guard();

-- Editing a participant also refreshes the registration's "last updated"
create or replace function public.trg_participants_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.registrations set updated_at = now() where id = new.registration_id;
  return null;
end $$;

drop trigger if exists participants_touch on public.participants;
create trigger participants_touch
  after update on public.participants
  for each row execute function public.trg_participants_touch();

-- ---------------------------------------------------------------------
-- 4. SUBMIT A REGISTRATION  (used by the public forms AND the on-spot form)
--    All validation happens here on the server, whatever the browser sends.
-- ---------------------------------------------------------------------

create or replace function public.submit_registration(p jsonb, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role     text := public.app_role();
  v_game     public.games%rowtype;
  v_source   text;
  v_items    jsonb;
  v_item     jsonb;
  v_i        int;
  v_prefix   text;
  v_name     text;
  v_roll     text;
  v_dept     text;
  v_phone    text;
  v_names    text[] := '{}';
  v_rolls    text[] := '{}';
  v_depts    text[] := '{}';
  v_phones   text[] := '{}';
  v_team     text;
  v_receipt  text;
  v_rname    text;
  v_method   text;
  v_pstatus  text;
  v_pinput   text;
  v_status   text;
  v_dup      text;
  v_num      int;
  v_code     text;
  v_id       uuid;
  v_taken    int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Invalid request.';
  end if;

  -- honeypot: real people never fill this hidden field
  if coalesce(p ->> 'hp', '') <> '' then
    return jsonb_build_object('ok', true, 'reg_code', 'PV-0000', 'game', 'PlayVerse',
                              'participant', 'Received', 'captain', 'Received', 'status', 'new');
  end if;

  v_source := coalesce(p ->> 'source', 'online');
  if v_source not in ('online', 'on_spot') then
    raise exception 'Invalid registration source.';
  end if;
  if v_source = 'on_spot' and coalesce(v_role, '') not in ('super_admin', 'registration_admin') then
    raise exception 'You are not allowed to create on-spot registrations.';
  end if;

  select * into v_game from public.games where slug = (p ->> 'game');
  if not found then
    raise exception 'Unknown game.';
  end if;
  if v_source = 'online' and not v_game.is_open then
    raise exception 'Registrations for % are closed.', v_game.name;
  end if;

  v_items := coalesce(p -> 'participants', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) <> v_game.team_size then
    raise exception '% needs exactly % player(s).', v_game.name, v_game.team_size;
  end if;

  -- validate every player
  for v_i in 0 .. v_game.team_size - 1 loop
    v_item   := v_items -> v_i;
    v_prefix := case when v_game.team_size > 1 then 'Player ' || (v_i + 1) || ': ' else '' end;
    v_name   := trim(regexp_replace(coalesce(v_item ->> 'full_name', ''), '\s+', ' ', 'g'));
    v_roll   := upper(regexp_replace(coalesce(v_item ->> 'roll_number', ''), '\s+', '', 'g'));
    v_dept   := trim(regexp_replace(coalesce(v_item ->> 'department', ''), '\s+', ' ', 'g'));
    v_phone  := public.pv_norm_phone(v_item ->> 'contact');

    if char_length(v_name) < 2 or char_length(v_name) > 80 then
      raise exception '%Enter a valid full name.', v_prefix;
    end if;
    if v_roll !~ '^[A-Z0-9][A-Z0-9/-]{2,29}$' then
      raise exception '%Enter a valid roll number (letters, numbers, - and / only).', v_prefix;
    end if;
    if char_length(v_dept) < 2 or char_length(v_dept) > 60 then
      raise exception '%Enter a valid department.', v_prefix;
    end if;
    if v_phone is null then
      raise exception '%Enter a valid Pakistani mobile number (03XX XXXXXXX).', v_prefix;
    end if;

    v_names  := array_append(v_names,  v_name);
    v_rolls  := array_append(v_rolls,  v_roll);
    v_depts  := array_append(v_depts,  v_dept);
    v_phones := array_append(v_phones, v_phone);
  end loop;

  if (select count(distinct r) from unnest(v_rolls) as r) <> array_length(v_rolls, 1) then
    raise exception 'Each player must have a different roll number.';
  end if;

  -- team name (PUBG only)
  if v_game.reg_type = 'team' then
    v_team := trim(regexp_replace(coalesce(p ->> 'team_name', ''), '\s+', ' ', 'g'));
    if char_length(v_team) < 2 or char_length(v_team) > 40 then
      raise exception 'Enter a team name (2 to 40 characters).';
    end if;
  else
    v_team := null;
  end if;

  -- receipt
  v_receipt := nullif(p ->> 'receipt_path', '');
  v_rname   := left(nullif(p ->> 'receipt_name', ''), 120);
  if v_receipt is not null then
    if v_receipt !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$' then
      raise exception 'Invalid receipt file.';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = v_receipt) then
      raise exception 'Receipt upload was not found. Please upload it again.';
    end if;
    if exists (select 1 from public.registrations r where r.receipt_path = v_receipt) then
      raise exception 'This receipt has already been used.';
    end if;
  end if;

  -- payment + status rules
  if v_source = 'online' then
    if v_receipt is null then
      raise exception 'Upload your payment receipt.';
    end if;
    if coalesce((p ->> 'consent')::boolean, false) is not true then
      raise exception 'Please accept all the required agreements.';
    end if;
    v_method  := 'online';
    v_pstatus := 'pending';
    v_status  := 'new';
  else
    v_method := coalesce(p ->> 'payment_method', 'cash');
    if v_method not in ('online', 'cash', 'other') then
      raise exception 'Invalid payment method.';
    end if;
    v_pinput := coalesce(p ->> 'payment_status', 'pending');
    if v_pinput = 'waived' then
      v_pstatus := 'complimentary';
    elsif v_pinput = 'paid' then
      v_pstatus := case when v_method = 'cash' then 'cash_paid' else 'verified' end;
    elsif v_pinput = 'pending' then
      v_pstatus := 'pending';
    else
      raise exception 'Invalid payment status.';
    end if;
    if coalesce((p ->> 'consent')::boolean, false) is not true then
      raise exception 'Confirm that the participant accepted the PlayVerse terms.';
    end if;
    v_status := 'confirmed';
  end if;

  -- slot limit (online registrations only)
  if v_source = 'online' and v_game.max_slots is not null then
    select count(*) into v_taken from public.registrations r
     where r.game = v_game.slug and not r.archived and r.status <> 'cancelled';
    if v_taken >= v_game.max_slots then
      raise exception 'Registrations for % are full.', v_game.name;
    end if;
  end if;

  -- duplicate check (same roll number OR same contact, same game)
  select r.reg_code into v_dup
    from public.registrations r
    join public.participants pt on pt.registration_id = r.id
   where r.game = v_game.slug and not r.archived and r.status <> 'cancelled'
     and (pt.roll_number = any (v_rolls) or pt.contact = any (v_phones))
   limit 1;

  if v_dup is not null and not p_force then
    return jsonb_build_object(
      'ok', false, 'duplicate', true,
      'message', 'Someone with the same roll number or contact number is already registered for ' || v_game.name || '.'
                 || case when v_role is not null then ' (' || v_dup || ')' else '' end
    );
  end if;

  -- next Registration ID for this game
  insert into public.reg_counters (game, last_value) values (v_game.slug, 1)
  on conflict (game) do update set last_value = reg_counters.last_value + 1
  returning last_value into v_num;
  v_code := 'PV-' || v_game.code || '-' || lpad(v_num::text, 4, '0');

  insert into public.registrations
    (reg_code, game, reg_type, source, team_name, payment_method, payment_status, status,
     receipt_path, receipt_name, consent_accepted, consent_at,
     duplicate_flag, duplicate_note, created_by)
  values
    (v_code, v_game.slug, v_game.reg_type, v_source, v_team, v_method, v_pstatus, v_status,
     v_receipt, v_rname, true, now(),
     v_dup is not null, case when v_dup is not null then 'Matches ' || v_dup else null end,
     public.pv_actor())
  returning id into v_id;

  for v_i in 1 .. v_game.team_size loop
    insert into public.participants
      (registration_id, slot, team_role, full_name, roll_number, department, contact)
    values
      (v_id, v_i,
       case when v_game.reg_type = 'team' then (case when v_i = 1 then 'captain' else 'player' end) else 'participant' end,
       v_names[v_i], v_rolls[v_i], v_depts[v_i], v_phones[v_i]);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'reg_code', v_code,
    'id', v_id,
    'game', v_game.name,
    'game_slug', v_game.slug,
    'team_name', v_team,
    'participant', v_names[1],
    'captain', v_names[1],
    'status', v_status,
    'payment_status', v_pstatus
  );
end $$;

grant execute on function public.submit_registration(jsonb, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. CHECK-IN  (duplicate check-in is blocked on the server)
-- ---------------------------------------------------------------------

create or replace function public.check_in_registration(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.app_role();
  v_row  public.registrations%rowtype;
begin
  if coalesce(v_role, '') not in ('super_admin', 'registration_admin') then
    raise exception 'You are not allowed to check in participants.';
  end if;
  select * into v_row from public.registrations where id = p_id for update;
  if not found then
    raise exception 'Registration not found.';
  end if;
  if v_row.status = 'checked_in' then
    raise exception 'Already checked in at %.',
      to_char(v_row.checked_in_at at time zone 'Asia/Karachi', 'DD Mon YYYY, HH12:MI AM');
  end if;
  if v_row.status = 'cancelled' or v_row.archived then
    raise exception 'Cancelled or archived registrations cannot be checked in.';
  end if;
  update public.registrations
     set status = 'checked_in', checked_in_at = now(), checked_in_by = public.pv_actor()
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.check_in_registration(uuid) from public;
grant execute on function public.check_in_registration(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. LINK A LOGIN TO A CRM ROLE (Super Admin only)
--    Create the login first in Supabase > Authentication > Users.
-- ---------------------------------------------------------------------

create or replace function public.admin_link_profile(p_email text, p_name text, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if coalesce(public.app_role(), '') <> 'super_admin' then
    raise exception 'Only a Super Admin can manage users.';
  end if;
  if p_role not in ('super_admin', 'registration_admin', 'finance') then
    raise exception 'Invalid role.';
  end if;
  select u.id into v_uid from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_uid is null then
    raise exception 'No login found for that email. Create it first in Supabase > Authentication > Users.';
  end if;
  insert into public.profiles (user_id, email, full_name, role, active)
  values (v_uid, lower(trim(p_email)), nullif(trim(p_name), ''), p_role, true)
  on conflict (user_id) do update
    set role = excluded.role,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        active = true;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.admin_link_profile(text, text, text) from public;
grant execute on function public.admin_link_profile(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY  (the public can NEVER read registrations)
-- ---------------------------------------------------------------------

alter table public.games         enable row level security;
alter table public.reg_counters  enable row level security;
alter table public.profiles      enable row level security;
alter table public.registrations enable row level security;
alter table public.participants  enable row level security;

revoke all on public.games, public.reg_counters, public.profiles,
              public.registrations, public.participants from anon, authenticated;

grant select on public.games to anon, authenticated;
grant update on public.games to authenticated;
grant select, update, delete on public.registrations to authenticated;
grant select, update on public.participants to authenticated;
grant select, update, delete on public.profiles to authenticated;

drop policy if exists games_read on public.games;
create policy games_read on public.games for select to anon, authenticated using (true);

drop policy if exists games_update on public.games;
create policy games_update on public.games for update to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

drop policy if exists reg_read on public.registrations;
create policy reg_read on public.registrations for select to authenticated
  using (public.app_role() is not null);

drop policy if exists reg_update on public.registrations;
create policy reg_update on public.registrations for update to authenticated
  using (public.app_role() is not null) with check (public.app_role() is not null);

drop policy if exists reg_delete on public.registrations;
create policy reg_delete on public.registrations for delete to authenticated
  using (public.app_role() = 'super_admin');

drop policy if exists part_read on public.participants;
create policy part_read on public.participants for select to authenticated
  using (public.app_role() is not null);

drop policy if exists part_update on public.participants;
create policy part_update on public.participants for update to authenticated
  using (public.app_role() in ('super_admin', 'registration_admin'))
  with check (public.app_role() in ('super_admin', 'registration_admin'));

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'super_admin');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.app_role() = 'super_admin');

-- ---------------------------------------------------------------------
-- 8. RECEIPT STORAGE  (private bucket, 5 MB, JPG/PNG/PDF only)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf'];

drop policy if exists pv_receipts_upload on storage.objects;
create policy pv_receipts_upload on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'receipts'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
  );

drop policy if exists pv_receipts_read on storage.objects;
create policy pv_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.app_role() is not null);

drop policy if exists pv_receipts_delete on storage.objects;
create policy pv_receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.app_role() = 'super_admin');

-- =====================================================================
--  DONE.  Next: create your first Super Admin (see DEPLOYMENT-GUIDE).
--
--  1) Supabase > Authentication > Users > Add user  (tick "Auto Confirm User")
--  2) Then run this (change the email + name):
--
--     insert into public.profiles (user_id, email, full_name, role)
--     select id, email, 'Your Name', 'super_admin'
--       from auth.users where email = 'you@example.com';
-- =====================================================================
