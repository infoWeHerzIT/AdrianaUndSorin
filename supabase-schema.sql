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

-- Spalte nachträglich auf bereits bestehender Tabelle ergänzen:
-- alter table events add column if not exists ressourcen_url text;

-- ── 2. PARTICIPANTS ──────────────────────────────────────────────
create table if not exists participants (
  id              uuid default gen_random_uuid() primary key,
  event_id        text references events(id) on delete set null,
  vorname         text not null,
  nachname        text not null,
  email           text not null,
  handy           text,
  ort             text,
  ticket_name     text,
  ticket_price    text,
  payment_status  text default 'pending',  -- pending | confirmed | cancelled
  registered_at   timestamptz default now()
);

-- ── 3. FEEDBACK ──────────────────────────────────────────────────
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

-- ── 4. ROW LEVEL SECURITY ────────────────────────────────────────
alter table events       enable row level security;
alter table participants enable row level security;
alter table feedback     enable row level security;

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

-- Teilnehmer: jeder darf sich eintragen (Registrierung)
create policy "participants_public_insert"
  on participants for insert with check (true);

-- Teilnehmer: nur eingeloggte Admins dürfen lesen/bearbeiten
create policy "participants_admin_read" on participants for select
  using (auth.role() = 'authenticated');
create policy "participants_admin_update" on participants for update
  using (auth.role() = 'authenticated');
create policy "participants_admin_delete" on participants for delete
  using (auth.role() = 'authenticated');

-- Feedback: jeder darf Feedback abgeben
create policy "feedback_public_insert"
  on feedback for insert with check (true);

-- Feedback: nur eingeloggte Admins dürfen lesen/bearbeiten
create policy "feedback_admin_read" on feedback for select
  using (auth.role() = 'authenticated');
create policy "feedback_admin_delete" on feedback for delete
  using (auth.role() = 'authenticated');
