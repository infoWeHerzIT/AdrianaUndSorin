-- ================================================================
-- MIGRATION: alte participants → neue participants + event_participations
-- Im Supabase SQL Editor ausführen (einmalig)
-- ================================================================

-- ── Schritt 1: Alte Tabelle sichern ──────────────────────────────
alter table if exists participants rename to participants_old;

-- ── Schritt 2: Neue participants Tabelle ─────────────────────────
create table participants (
  id         uuid default gen_random_uuid() primary key,
  vorname    text not null,
  nachname   text not null,
  email      text not null,
  handy      text unique,
  ort        text,
  created_at timestamptz default now()
);

-- ── Schritt 3: event_participations Tabelle ──────────────────────
create table event_participations (
  id              uuid default gen_random_uuid() primary key,
  event_id        text references events(id) on delete set null,
  participant_id  uuid references participants(id) on delete cascade,
  ticket_name     text,
  ticket_price    text,
  payment_status  text default 'pending',
  registered_at   timestamptz default now(),
  unique(event_id, participant_id)
);

-- ── Schritt 4: Daten migrieren ────────────────────────────────────

-- 4a. Eindeutige Participants aus alter Tabelle übernehmen
--     Wenn Handy vorhanden: dedup per Handy (neuester Eintrag gewinnt)
--     Wenn kein Handy:      dedup per E-Mail
insert into participants (id, vorname, nachname, email, handy, ort, created_at)
select distinct on (coalesce(nullif(trim(handy), ''), email))
  gen_random_uuid(),
  coalesce(vorname, ''),
  coalesce(nachname, ''),
  coalesce(email, ''),
  nullif(trim(handy), ''),
  ort,
  registered_at
from participants_old
where email is not null and email <> ''
order by coalesce(nullif(trim(handy), ''), email), registered_at desc
on conflict (handy) do nothing;

-- 4b. Event-Teilnahmen migrieren
insert into event_participations (event_id, participant_id, ticket_name, ticket_price, payment_status, registered_at)
select
  o.event_id,
  p.id,
  o.ticket_name,
  o.ticket_price,
  coalesce(o.payment_status, 'pending'),
  o.registered_at
from participants_old o
join participants p
  on (
    nullif(trim(o.handy), '') is not null
    and p.handy = nullif(trim(o.handy), '')
  )
  or (
    nullif(trim(o.handy), '') is null
    and p.email = o.email
    and p.handy is null
  )
where o.event_id is not null
on conflict (event_id, participant_id) do nothing;

-- ── Schritt 5: RLS ───────────────────────────────────────────────
alter table participants         enable row level security;
alter table event_participations enable row level security;

-- Participants: öffentlich anlegen/aktualisieren (für Registrierung)
create policy "participants_public_insert"
  on participants for insert with check (true);
create policy "participants_public_update"
  on participants for update using (true);

-- Participants: nur Admins lesen/löschen
create policy "participants_admin_read" on participants for select
  using (auth.role() = 'authenticated');
create policy "participants_admin_delete" on participants for delete
  using (auth.role() = 'authenticated');

-- EventParticipations: öffentlich eintragen (Registrierung)
create policy "event_participations_public_insert"
  on event_participations for insert with check (true);

-- EventParticipations: nur Admins lesen/bearbeiten
create policy "event_participations_admin_read" on event_participations for select
  using (auth.role() = 'authenticated');
create policy "event_participations_admin_update" on event_participations for update
  using (auth.role() = 'authenticated');
create policy "event_participations_admin_delete" on event_participations for delete
  using (auth.role() = 'authenticated');

-- ── Schritt 6 (optional): Alte Tabelle löschen ───────────────────
-- Erst ausführen nachdem du die Daten geprüft hast:
-- drop table participants_old;
