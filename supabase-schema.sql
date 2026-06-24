-- ================================================================
-- Adriana & Sorin – Supabase Schema
-- Ausführen im Supabase SQL Editor (supabase.com → SQL Editor)
-- ================================================================

-- ── 1. EVENTS ────────────────────────────────────────────────────
create table if not exists events (
  id               text primary key,
  name             text not null,
  type             text not null default 'Workshop',
  year             integer not null,
  month            integer not null,
  day              integer not null,
  time_from        text,
  time_to          text,
  location         text,
  format           text not null default 'Präsenz',
  price            text,
  spots            text,
  description      text,
  url              text default 'register.html',
  payment_url      text,
  video_meeting_url text,
  ressourcen_url   text,
  created_at       timestamptz default now()
);

-- ── 2. PARTICIPANTS ──────────────────────────────────────────────
-- Einmalige Kontaktdaten je Person. Unique Key = Handynummer.
create table if not exists participants (
  id         uuid default gen_random_uuid() primary key,
  vorname    text not null,
  nachname   text not null,
  email      text not null,
  handy      text unique,
  ort        text,
  created_at timestamptz default now()
);

-- ── 3. EVENT_PARTICIPATIONS ──────────────────────────────────────
-- N:M Beziehung zwischen Events und Participants.
-- 1 Participant kann an mehreren Events teilnehmen.
-- 1 Event kann mehrere Participants haben.
create table if not exists event_participations (
  id              uuid default gen_random_uuid() primary key,
  event_id        text references events(id) on delete set null,
  participant_id  uuid references participants(id) on delete cascade,
  ticket_name     text,
  ticket_price    text,
  payment_status  text default 'pending',  -- pending | confirmed | cancelled
  registered_at   timestamptz default now(),
  unique(event_id, participant_id)
);

-- ── 4. FEEDBACK ──────────────────────────────────────────────────
create table if not exists feedback (
  id              uuid default gen_random_uuid() primary key,
  event_id        text references events(id) on delete set null,
  ort             text,
  vorname         text,
  email           text,
  rating          integer not null check (rating between 1 and 5),
  recommend       text,
  highlight       text,
  improvement     text,
  testimonial_ok  boolean default false,
  created_at      timestamptz default now()
);

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────
alter table events              enable row level security;
alter table participants        enable row level security;
alter table event_participations enable row level security;
alter table feedback            enable row level security;

-- Events: jeder kann lesen (Kalender & Startseite)
create policy "events_public_read"
  on events for select using (true);

-- Events: nur eingeloggte Admins dürfen schreiben
create policy "events_admin_insert" on events for insert
  with check (auth.role() = 'authenticated');
create policy "events_admin_update" on events for update
  using (auth.role() = 'authenticated');
create policy "events_admin_delete" on events for delete
  using (auth.role() = 'authenticated');

-- Participants: öffentlich anlegen/aktualisieren (Registrierung)
create policy "participants_public_insert"
  on participants for insert with check (true);
create policy "participants_public_update"
  on participants for update using (true);

-- Participants: nur Admins dürfen lesen/löschen
create policy "participants_admin_read" on participants for select
  using (auth.role() = 'authenticated');
create policy "participants_admin_delete" on participants for delete
  using (auth.role() = 'authenticated');

-- EventParticipations: jeder darf sich eintragen (Registrierung)
create policy "event_participations_public_insert"
  on event_participations for insert with check (true);

-- EventParticipations: nur Admins dürfen lesen/bearbeiten
create policy "event_participations_admin_read" on event_participations for select
  using (auth.role() = 'authenticated');
create policy "event_participations_admin_update" on event_participations for update
  using (auth.role() = 'authenticated');
create policy "event_participations_admin_delete" on event_participations for delete
  using (auth.role() = 'authenticated');

-- Feedback: jeder darf Feedback abgeben
create policy "feedback_public_insert"
  on feedback for insert with check (true);

-- Feedback: nur eingeloggte Admins dürfen lesen/bearbeiten
create policy "feedback_admin_read" on feedback for select
  using (auth.role() = 'authenticated');
create policy "feedback_admin_delete" on feedback for delete
  using (auth.role() = 'authenticated');


-- ================================================================
-- MIGRATION (nur einmal ausführen auf bestehender Datenbank)
-- ================================================================
-- Führe diese Blöcke der Reihe nach im SQL Editor aus,
-- falls die alte "participants"-Tabelle bereits Daten enthält.

-- Schritt 1: Neue participants Tabelle (falls noch nicht vorhanden)
-- → siehe oben (create table if not exists participants ...)

-- Schritt 2: Bestehende Daten in neue participants Tabelle migrieren
-- (dedup nach handy; bei fehlender Nummer dedup nach email)
/*
insert into participants (id, vorname, nachname, email, handy, ort, created_at)
select distinct on (coalesce(nullif(handy,''), email))
  gen_random_uuid(), vorname, nachname, email, nullif(handy,''), ort, registered_at
from participants_old   -- ← alter Name der Original-Tabelle
order by coalesce(nullif(handy,''), email), registered_at desc
on conflict (handy) do nothing;
*/

-- Schritt 3: EventParticipations befüllen
/*
insert into event_participations (event_id, participant_id, ticket_name, ticket_price, payment_status, registered_at)
select
  o.event_id,
  p.id,
  o.ticket_name,
  o.ticket_price,
  o.payment_status,
  o.registered_at
from participants_old o
join participants p
  on coalesce(nullif(o.handy,''), o.email) = coalesce(nullif(p.handy,'')::text, p.email)
on conflict (event_id, participant_id) do nothing;
*/

-- Schritt 4: Alte Tabelle umbenennen (Backup) oder löschen
-- alter table participants_old rename to participants_backup;
-- drop table participants_backup;
