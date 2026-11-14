-- Teanote: snapshot of the hosted Supabase project's schema.
--
-- Read from the Postgres catalog on 2026-11-14 (Postgres 17, region eu-west-1).
-- It records structure only: tables, indexes, row-level security, policies,
-- functions, triggers, storage buckets and the realtime publication. It holds
-- no rows and no secrets.
--
-- This is a readable record, not a migration. It was assembled from catalog
-- queries, has never been run against an empty database, and the project has
-- no migration history. For a baseline migration that can rebuild the
-- database, run `supabase db pull` (needs Docker and the database password)
-- and commit the file it writes under supabase/migrations/.
--
-- Things worth knowing when reading it:
--   * updated_at is overwritten with now() by a BEFORE UPDATE trigger on every
--     synced table, so the server clock, not the client's, stamps updates.
--   * deleted_at and the settings timestamps are "timestamp without time zone";
--     every other timestamp is "with time zone".
--   * settings.theme defaults to 'teanote-default', a value its own check
--     constraint does not allow; inserts must pass a theme explicitly.
--   * profiles still carries the trial and subscription columns. No code reads
--     them since the app became free; handle_new_user() still fills them.
--   * "Update own teas" has no WITH CHECK. Postgres then applies its USING
--     expression to the new row as well, so it is equivalent to the others.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.brews (
  id uuid not null,
  user_id uuid not null,
  "teaId" uuid not null,
  "journalId" uuid,
  "startedAt" timestamp with time zone not null default now(),
  "finishedAt" timestamp with time zone,
  infusions jsonb not null default '[]'::jsonb,
  notes text,
  rating integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp without time zone,
  "presetId" character varying(255),
  constraint brews_pkey PRIMARY KEY (id),
  constraint brews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.journals (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  "teaId" text not null,
  brew_preset_id uuid,
  title text not null,
  rating integer,
  content text not null,
  "dateAdded" timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp without time zone,
  images jsonb default '[]'::jsonb,
  constraint journals_pkey PRIMARY KEY (id),
  constraint journals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.presets (
  id uuid not null,
  user_id uuid not null,
  name text not null,
  "teaId" uuid,
  "teaType" text,
  "infusionsAmount" integer not null,
  "infusionTimes" integer[] not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp without time zone,
  constraint presets_pkey PRIMARY KEY (id),
  constraint presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.profiles (
  id uuid not null,
  trial_start timestamp with time zone,
  subscription_start timestamp with time zone,
  subscription_end timestamp with time zone,
  is_subscribed boolean default false,
  created_at timestamp with time zone default now(),
  email text,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.settings (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  theme text default 'teanote-default'::text,
  ai_enabled boolean default false,
  language text default 'en'::text,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now(),
  deleted_at timestamp without time zone,
  constraint settings_pkey PRIMARY KEY (id),
  constraint settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  constraint settings_language_check CHECK ((language = ANY (ARRAY['en'::text, 'sk'::text, 'ja'::text, 'zh'::text, 'ko'::text]))),
  constraint settings_theme_check CHECK ((theme = ANY (ARRAY['Teanote Default'::text, 'Teanote Cozy'::text, 'Teanote Night'::text, 'Teanote Sakura'::text])))
);

create table public.teas (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text not null,
  origin text,
  year text,
  vendor text,
  notes text,
  image text,
  link text,
  "dateAdded" timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp without time zone,
  inventory text,
  image_path text,
  constraint teas_pkey PRIMARY KEY (id),
  constraint teas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Indexes (beyond the primary keys)
-- ---------------------------------------------------------------------------

CREATE INDEX idx_teas_deleted_at ON public.teas USING btree (deleted_at);
CREATE UNIQUE INDEX settings_user_unique ON public.settings USING btree (user_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.brews enable row level security;
alter table public.journals enable row level security;
alter table public.presets enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.teas enable row level security;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, email, trial_start, is_subscribed, subscription_start, subscription_end)
  values (new.id, new.email, now(), false, null, null);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_settings_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER update_brews_updated_at BEFORE UPDATE ON public.brews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journals_updated_at BEFORE UPDATE ON public.journals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON public.presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_settings_timestamp BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_settings_timestamp();
CREATE TRIGGER update_teas_updated_at BEFORE UPDATE ON public.teas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Policies: public schema (every policy is owner-only)
-- ---------------------------------------------------------------------------

create policy "Allow delete own brews" on public.brews as permissive for delete to public using ((user_id = auth.uid()));
create policy "Allow insert own brews" on public.brews as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Allow select own brews" on public.brews as permissive for select to public using ((user_id = auth.uid()));
create policy "Allow update own brews" on public.brews as permissive for update to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy "Delete own journals" on public.journals as permissive for delete to public using ((user_id = auth.uid()));
create policy "Insert own journals" on public.journals as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Select own journals" on public.journals as permissive for select to public using ((user_id = auth.uid()));
create policy "Update own journals" on public.journals as permissive for update to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy "Allow delete own presets" on public.presets as permissive for delete to public using ((user_id = auth.uid()));
create policy "Allow insert own presets" on public.presets as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Allow select own presets" on public.presets as permissive for select to public using ((user_id = auth.uid()));
create policy "Allow update own presets" on public.presets as permissive for update to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy "Users can insert own profile" on public.profiles as permissive for insert to public with check ((auth.uid() = id));
create policy "Users can read their own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));
create policy "Users can update own profile" on public.profiles as permissive for update to public using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "users can insert their own profile" on public.profiles as permissive for insert to public with check ((auth.uid() = id));
create policy "users can read their own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));

create policy "Users can insert their own settings" on public.settings as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can read their own settings" on public.settings as permissive for select to public using ((auth.uid() = user_id));
create policy "Users can soft delete their own settings" on public.settings as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can update their own settings" on public.settings as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Delete own teas" on public.teas as permissive for delete to public using ((auth.uid() = user_id));
create policy "Insert own teas" on public.teas as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Select own teas" on public.teas as permissive for select to public using ((auth.uid() = user_id));
create policy "Update own teas" on public.teas as permissive for update to public using ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Storage: buckets (both private) and per-user-folder policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('sessions', 'sessions', false, null, null);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('teas', 'teas', false, 2097152, null);

create policy "Give users access to own folder 247s3_0" on storage.objects as permissive for select to authenticated using (((bucket_id = 'teas'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));
create policy "Give users access to own folder 247s3_1" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'teas'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));
create policy "Give users access to own folder 247s3_2" on storage.objects as permissive for update to authenticated using (((bucket_id = 'teas'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));
create policy "Give users access to own folder 247s3_3" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'teas'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));

create policy "Give users access to own folder n8jqfx_0" on storage.objects as permissive for select to authenticated using (((bucket_id = 'sessions'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));
create policy "Give users access to own folder n8jqfx_1" on storage.objects as permissive for update to authenticated using (((bucket_id = 'sessions'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));
create policy "Give users access to own folder n8jqfx_2" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'sessions'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));
create policy "Give users access to own folder n8jqfx_3" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'sessions'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.brews;
alter publication supabase_realtime add table public.journals;
alter publication supabase_realtime add table public.presets;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.teas;
