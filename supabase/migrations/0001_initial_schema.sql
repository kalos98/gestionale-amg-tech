-- ============================================================================
-- Gestionale AMG Tech - Migrazione Iniziale 0001
-- Database PostgreSQL 15+ (Supabase Free / Self-Hosted Postgres)
--
-- Convenzioni per futuri aggiornamenti senza perdita di dati:
--   1. Non eseguire MAI DROP TABLE, DROP COLUMN o TRUNCATE durante i deploy
--      standard: usare il pattern Expand & Contract con nuove migrazioni
--      incrementali (0002_..., 0003_...).
--   2. Ogni tabella critica implementa:
--      - Optimistic Locking tramite colonna `version`
--      - Soft-delete tramite `deleted_at` (nessun dato viene perso)
--      - Foreign key `ON DELETE RESTRICT` per impedire perdite a cascata
--      - Audit trail append-only in `public.audit_logs`
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. SEQUENZE ATOMICHE PER CODICI UNIVOCI
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.site_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.equipment_code_seq START WITH 1 INCREMENT BY 1;

-- ----------------------------------------------------------------------------
-- 2. TABELLE ANAGRAFICHE E OPERATIVE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  username text NOT NULL CHECK (username ~ '^[a-z0-9]+(\.[a-z0-9]+)*$'),
  first_name text NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name text NOT NULL DEFAULT '',
  full_name text GENERATED ALWAYS AS (
    trim(
      trim(first_name) ||
      CASE WHEN trim(last_name) <> '' THEN ' ' || trim(last_name) ELSE '' END
    )
  ) STORED,
  role text NOT NULL CHECK (role IN ('admin', 'worker')),
  worker_type text NULL CHECK (
    worker_type IS NULL OR worker_type IN ('Edilizia', 'Impiantistica')
  ),
  avatar_initials text NOT NULL CHECK (length(trim(avatar_initials)) BETWEEN 1 AND 4),
  active boolean NOT NULL DEFAULT true,
  is_root_admin boolean NOT NULL DEFAULT false,
  must_change_password boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  CONSTRAINT profiles_worker_type_required CHECK (
    role <> 'worker' OR worker_type IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username));

CREATE INDEX IF NOT EXISTS profiles_role_active_idx
  ON public.profiles (role, active)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (length(trim(code)) > 0),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  client text NOT NULL CHECK (length(trim(client)) > 0),
  address text NOT NULL CHECK (length(trim(address)) > 0),
  city text NOT NULL CHECK (length(trim(city)) > 0),
  sectors text[] NOT NULL CHECK (
    array_length(sectors, 1) >= 1
    AND sectors <@ ARRAY['Edilizia', 'Termico', 'Elettrico', 'Idrico', 'Rinnovabili']::text[]
  ),
  status text NOT NULL DEFAULT 'In Corso' CHECK (
    status IN ('Pianificato', 'In Corso', 'Sospeso', 'Completato')
  ),
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sites_code_upper_uidx
  ON public.sites (upper(code));

CREATE INDEX IF NOT EXISTS sites_active_status_idx
  ON public.sites (status, start_date DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.site_workers (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  PRIMARY KEY (site_id, worker_id)
);

CREATE INDEX IF NOT EXISTS site_workers_worker_idx
  ON public.site_workers (worker_id, site_id);

CREATE TABLE IF NOT EXISTS public.work_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  phase_order integer NOT NULL DEFAULT 1 CHECK (phase_order >= 1),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'Da Iniziare' CHECK (
    status IN ('Da Iniziare', 'In Corso', 'Completata')
  ),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS work_phases_site_order_idx
  ON public.work_phases (site_id, phase_order)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (length(trim(code)) > 0),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  category text NOT NULL CHECK (
    category IN (
      'Mezzo / Veicolo',
      'Macchinario Cantiere',
      'Attrezzatura Elettrica / Impianti',
      'Strumento di Misura & Collaudo',
      'Ponteggio & Sicurezza'
    )
  ),
  serial_or_plate text NOT NULL CHECK (length(trim(serial_or_plate)) > 0),
  status text NOT NULL DEFAULT 'Disponibile' CHECK (
    status IN ('Disponibile', 'In Manutenzione')
  ),
  notes text NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS equipment_code_upper_uidx
  ON public.equipment (upper(code));

CREATE INDEX IF NOT EXISTS equipment_active_category_idx
  ON public.equipment (category, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  phase_id uuid NULL REFERENCES public.work_phases(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  worker_name text NOT NULL CHECK (length(trim(worker_name)) > 0),
  work_date date NOT NULL,
  regular_hours numeric(5,2) NOT NULL CHECK (regular_hours > 0 AND regular_hours <= 24),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  client_request_id uuid NULL UNIQUE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS time_entries_site_date_idx
  ON public.time_entries (site_id, work_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS time_entries_worker_idx
  ON public.time_entries (worker_id, work_date DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.material_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  phase_id uuid NULL REFERENCES public.work_phases(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  worker_name text NOT NULL CHECK (length(trim(worker_name)) > 0),
  log_date date NOT NULL,
  article_code text NULL,
  material_name text NULL,
  category text NOT NULL CHECK (
    category IN ('Edilizia', 'Elettrico', 'Idraulico', 'Sicurezza/Ferramenta')
  ),
  quantity numeric(10,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL CHECK (
    unit IN ('pz', 'm', 'mq', 'kg', 'sacchi', 'rotoli', 'litri')
  ),
  notes text NULL,
  client_request_id uuid NULL UNIQUE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  CONSTRAINT material_logs_identifier_required CHECK (
    coalesce(nullif(trim(article_code), ''), nullif(trim(material_name), '')) IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS material_logs_site_date_idx
  ON public.material_logs (site_id, log_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS material_logs_worker_idx
  ON public.material_logs (worker_id, log_date DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.equipment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  equipment_name text NOT NULL CHECK (length(trim(equipment_name)) > 0),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_name text NOT NULL CHECK (length(trim(actor_name)) > 0),
  actor_role text NOT NULL CHECK (actor_role IN ('Admin', 'Dipendente')),
  logged_at timestamptz NOT NULL DEFAULT now(),
  hours_used numeric(5,2) NULL CHECK (
    hours_used IS NULL OR (hours_used > 0 AND hours_used <= 24)
  ),
  notes text NULL,
  client_request_id uuid NULL UNIQUE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS equipment_logs_site_ts_idx
  ON public.equipment_logs (site_id, logged_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS equipment_logs_eq_ts_idx
  ON public.equipment_logs (equipment_id, logged_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.photo_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  phase_id uuid NULL REFERENCES public.work_phases(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  worker_name text NOT NULL CHECK (length(trim(worker_name)) > 0),
  uploader_role text NOT NULL DEFAULT 'worker' CHECK (
    uploader_role IN ('admin', 'worker')
  ),
  photo_date date NOT NULL,
  storage_path text NOT NULL CHECK (length(trim(storage_path)) > 0),
  caption text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT 'Avanzamento Lavori' CHECK (
    tag IN ('Avanzamento Lavori', 'Anomalia', 'Fine lavori')
  ),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS photo_logs_site_created_idx
  ON public.photo_logs (site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS photo_logs_worker_idx
  ON public.photo_logs (worker_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOG APPEND-ONLY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'SOFT_DELETE', 'DELETE')),
  actor_id uuid NULL,
  old_data jsonb NULL,
  new_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx
  ON public.audit_logs (table_name, record_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. HELPER DI SICUREZZA (SECURITY DEFINER + search_path BLOCCATO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.active = true
      AND p.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_worker()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'worker'
      AND p.active = true
      AND p.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = true
      AND p.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_worker_assigned_to_active_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.site_workers sw
    JOIN public.sites s ON s.id = sw.site_id
    WHERE sw.site_id = p_site_id
      AND sw.worker_id = auth.uid()
      AND s.deleted_at IS NULL
      AND s.status <> 'Completato'
      AND public.is_active_worker()
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. TRIGGER DI INTEGRITA', CONCORRENZA E SINCRONIZZAZIONE ATOMICA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_audit_columns_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  NEW.version := GREATEST(COALESCE(NEW.version, 1), 1);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_version_and_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);

  -- Evita falsi conflitti di versione su `sites` quando un trigger interno
  -- ricalcola progress/status o sincronizza i nomi visualizzati nei log.
  IF current_setting('app.internal_sync', true) IS DISTINCT FROM '1' THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'HARD_DELETE_FORBIDDEN: usare il soft-delete su %', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_zero_active_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_root_admin AND (
    NEW.active = false
    OR NEW.deleted_at IS NOT NULL
    OR NEW.role <> 'admin'
  ) THEN
    RAISE EXCEPTION 'ROOT_ADMIN_PROTECTED: impossibile disattivare o declassare l''amministratore originario'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.role = 'admin'
     AND OLD.active = true
     AND OLD.deleted_at IS NULL
     AND (NEW.role <> 'admin' OR NEW.active = false OR NEW.deleted_at IS NOT NULL) THEN
    PERFORM 1
    FROM public.profiles p
    WHERE p.role = 'admin'
      AND p.active = true
      AND p.deleted_at IS NULL
      AND p.id <> OLD.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED: deve rimanere almeno un amministratore attivo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_worker_phase_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') AND NOT public.is_active_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.site_id IS DISTINCT FROM OLD.site_id
       OR NEW.phase_order IS DISTINCT FROM OLD.phase_order
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: i dipendenti possono aggiornare solo lo stato di avanzamento della fase'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.progress = 100 THEN
      NEW.status := 'Completata';
    ELSIF NEW.progress > 0 THEN
      NEW.status := 'In Corso';
    ELSE
      NEW.status := 'Da Iniziare';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_worker_log_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.internal_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF auth.role() IN ('anon', 'authenticated') AND NOT public.is_active_admin() THEN
    IF TG_TABLE_NAME = 'material_logs' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.site_id IS DISTINCT FROM OLD.site_id
         OR NEW.worker_id IS DISTINCT FROM OLD.worker_id
         OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: modifica non consentita'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_TABLE_NAME = 'equipment_logs' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.site_id IS DISTINCT FROM OLD.site_id
         OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
         OR NEW.actor_role IS DISTINCT FROM OLD.actor_role
         OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: modifica non consentita'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_TABLE_NAME = 'photo_logs' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.site_id IS DISTINCT FROM OLD.site_id
         OR NEW.worker_id IS DISTINCT FROM OLD.worker_id
         OR NEW.uploader_role IS DISTINCT FROM OLD.uploader_role
         OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: modifica non consentita'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_site_progress_from_phases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id uuid;
  v_site public.sites%ROWTYPE;
  v_phase_count integer;
  v_avg_progress integer;
  v_next_status text;
  v_prev_sync text;
BEGIN
  v_site_id := COALESCE(NEW.site_id, OLD.site_id);
  IF v_site_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT *
  INTO v_site
  FROM public.sites s
  WHERE s.id = v_site_id
  FOR UPDATE;

  IF NOT FOUND OR v_site.deleted_at IS NOT NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*), COALESCE(ROUND(AVG(wp.progress))::integer, 0)
  INTO v_phase_count, v_avg_progress
  FROM public.work_phases wp
  WHERE wp.site_id = v_site_id
    AND wp.deleted_at IS NULL;

  IF v_phase_count = 0 THEN
    v_avg_progress := 0;
    v_next_status := CASE
      WHEN v_site.status = 'Completato' THEN 'In Corso'
      ELSE v_site.status
    END;
  ELSE
    IF v_avg_progress = 100 THEN
      v_next_status := 'Completato';
    ELSIF (
      v_site.status = 'Completato'
      OR (v_site.status = 'Pianificato' AND v_avg_progress > 0)
    ) AND v_avg_progress < 100 THEN
      v_next_status := 'In Corso';
    ELSE
      v_next_status := v_site.status;
    END IF;
  END IF;

  IF v_site.progress IS DISTINCT FROM v_avg_progress
     OR v_site.status IS DISTINCT FROM v_next_status THEN
    v_prev_sync := current_setting('app.internal_sync', true);
    PERFORM set_config('app.internal_sync', '1', true);
    UPDATE public.sites
    SET progress = v_avg_progress,
        status = v_next_status
    WHERE id = v_site_id;
    PERFORM set_config('app.internal_sync', COALESCE(v_prev_sync, '0'), true);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_site_on_field_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site public.sites%ROWTYPE;
  v_prev_sync text;
BEGIN
  SELECT *
  INTO v_site
  FROM public.sites s
  WHERE s.id = NEW.site_id
  FOR UPDATE;

  IF FOUND
     AND v_site.deleted_at IS NULL
     AND v_site.status IN ('Pianificato', 'Sospeso') THEN
    v_prev_sync := current_setting('app.internal_sync', true);
    PERFORM set_config('app.internal_sync', '1', true);
    UPDATE public.sites
    SET status = 'In Corso'
    WHERE id = NEW.site_id;
    PERFORM set_config('app.internal_sync', COALESCE(v_prev_sync, '0'), true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_sync text;
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    v_prev_sync := current_setting('app.internal_sync', true);
    PERFORM set_config('app.internal_sync', '1', true);

    UPDATE public.time_entries
    SET worker_name = NEW.full_name
    WHERE worker_id = NEW.id AND worker_name IS DISTINCT FROM NEW.full_name;

    UPDATE public.material_logs
    SET worker_name = NEW.full_name
    WHERE worker_id = NEW.id AND worker_name IS DISTINCT FROM NEW.full_name;

    UPDATE public.photo_logs
    SET worker_name = NEW.full_name
    WHERE worker_id = NEW.id AND worker_name IS DISTINCT FROM NEW.full_name;

    UPDATE public.equipment_logs
    SET actor_name = NEW.full_name
    WHERE actor_id = NEW.id AND actor_name IS DISTINCT FROM NEW.full_name;

    PERFORM set_config('app.internal_sync', COALESCE(v_prev_sync, '0'), true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_equipment_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_sync text;
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_prev_sync := current_setting('app.internal_sync', true);
    PERFORM set_config('app.internal_sync', '1', true);
    UPDATE public.equipment_logs
    SET equipment_name = NEW.name
    WHERE equipment_id = NEW.id AND equipment_name IS DISTINCT FROM NEW.name;
    PERFORM set_config('app.internal_sync', COALESCE(v_prev_sync, '0'), true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_record_id text;
  v_old_json jsonb;
  v_new_json jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', '');
    v_old_json := NULL;
    v_new_json := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    IF (v_old_json - ARRAY['updated_at', 'updated_by', 'version'])
       IS NOT DISTINCT FROM
       (v_new_json - ARRAY['updated_at', 'updated_by', 'version']) THEN
      RETURN NEW;
    END IF;
    v_action := CASE
      WHEN (v_old_json->>'deleted_at') IS NULL
           AND (v_new_json->>'deleted_at') IS NOT NULL
      THEN 'SOFT_DELETE'
      ELSE 'UPDATE'
    END;
    v_record_id := COALESCE(v_new_json->>'id', '');
  ELSE
    v_action := 'DELETE';
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
    v_record_id := COALESCE(v_old_json->>'id', '');
  END IF;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    actor_id,
    old_data,
    new_data
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    v_action,
    auth.uid(),
    v_old_json,
    v_new_json
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Registrazione trigger su tutte le tabelle versionate
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'sites',
    'work_phases',
    'equipment',
    'time_entries',
    'material_logs',
    'equipment_logs',
    'photo_logs'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_insert_audit_cols ON public.%I;
       CREATE TRIGGER trg_%I_insert_audit_cols
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns_on_insert();',
      t, t, t, t
    );

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_bump_version ON public.%I;
       CREATE TRIGGER trg_%I_bump_version
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();',
      t, t, t, t
    );

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_prevent_hard_delete ON public.%I;
       CREATE TRIGGER trg_%I_prevent_hard_delete
       BEFORE DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();',
      t, t, t, t
    );

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_record_audit ON public.%I;
       CREATE TRIGGER trg_%I_record_audit
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();',
      t, t, t, t
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_prevent_mutation ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_profiles_protect_admins ON public.profiles;
CREATE TRIGGER trg_profiles_protect_admins
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_zero_active_admins();

DROP TRIGGER IF EXISTS trg_profiles_sync_name ON public.profiles;
CREATE TRIGGER trg_profiles_sync_name
  AFTER UPDATE OF first_name, last_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_display_name();

DROP TRIGGER IF EXISTS trg_equipment_sync_name ON public.equipment;
CREATE TRIGGER trg_equipment_sync_name
  AFTER UPDATE OF name ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.sync_equipment_display_name();

DROP TRIGGER IF EXISTS trg_work_phases_worker_guard ON public.work_phases;
CREATE TRIGGER trg_work_phases_worker_guard
  BEFORE UPDATE ON public.work_phases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_phase_update();

DROP TRIGGER IF EXISTS trg_work_phases_sync_site ON public.work_phases;
CREATE TRIGGER trg_work_phases_sync_site
  AFTER INSERT OR UPDATE OF progress, status, deleted_at OR DELETE ON public.work_phases
  FOR EACH ROW EXECUTE FUNCTION public.sync_site_progress_from_phases();

DROP TRIGGER IF EXISTS trg_material_logs_worker_guard ON public.material_logs;
CREATE TRIGGER trg_material_logs_worker_guard
  BEFORE UPDATE ON public.material_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_log_immutability();

DROP TRIGGER IF EXISTS trg_equipment_logs_worker_guard ON public.equipment_logs;
CREATE TRIGGER trg_equipment_logs_worker_guard
  BEFORE UPDATE ON public.equipment_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_log_immutability();

DROP TRIGGER IF EXISTS trg_photo_logs_worker_guard ON public.photo_logs;
CREATE TRIGGER trg_photo_logs_worker_guard
  BEFORE UPDATE ON public.photo_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_log_immutability();

DROP TRIGGER IF EXISTS trg_time_entries_activate_site ON public.time_entries;
CREATE TRIGGER trg_time_entries_activate_site
  AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.activate_site_on_field_activity();

DROP TRIGGER IF EXISTS trg_material_logs_activate_site ON public.material_logs;
CREATE TRIGGER trg_material_logs_activate_site
  AFTER INSERT ON public.material_logs
  FOR EACH ROW EXECUTE FUNCTION public.activate_site_on_field_activity();

DROP TRIGGER IF EXISTS trg_equipment_logs_activate_site ON public.equipment_logs;
CREATE TRIGGER trg_equipment_logs_activate_site
  AFTER INSERT ON public.equipment_logs
  FOR EACH ROW EXECUTE FUNCTION public.activate_site_on_field_activity();

-- ----------------------------------------------------------------------------
-- 6. RPC PER CODICI SEQUENZIALI & SOFT-DELETE ATOMICO
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_site_code(
  p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'CNT-' || p_year::text || '-';
  v_seq bigint;
  v_max_existing bigint;
  v_candidate text;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    MAX(
      CASE
        WHEN substring(code FROM ('^' || v_prefix || '(\d+)$')) IS NOT NULL
        THEN substring(code FROM ('^' || v_prefix || '(\d+)$'))::bigint
        ELSE 0
      END
    ),
    0
  )
  INTO v_max_existing
  FROM public.sites;

  LOOP
    v_seq := nextval('public.site_code_seq');
    IF v_seq <= v_max_existing THEN
      PERFORM setval('public.site_code_seq', v_max_existing + 1, false);
      v_seq := nextval('public.site_code_seq');
    END IF;
    v_candidate := v_prefix || lpad(v_seq::text, 2, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.sites s WHERE upper(s.code) = upper(v_candidate)
    );
  END LOOP;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_equipment_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'MEZ-';
  v_seq bigint;
  v_max_existing bigint;
  v_candidate text;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    MAX(
      CASE
        WHEN substring(code FROM ('^' || v_prefix || '(\d+)$')) IS NOT NULL
        THEN substring(code FROM ('^' || v_prefix || '(\d+)$'))::bigint
        ELSE 0
      END
    ),
    0
  )
  INTO v_max_existing
  FROM public.equipment;

  LOOP
    v_seq := nextval('public.equipment_code_seq');
    IF v_seq <= v_max_existing THEN
      PERFORM setval('public.equipment_code_seq', v_max_existing + 1, false);
      v_seq := nextval('public.equipment_code_seq');
    END IF;
    v_candidate := v_prefix || lpad(v_seq::text, 2, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.equipment e WHERE upper(e.code) = upper(v_candidate)
    );
  END LOOP;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_site(
  p_site_id uuid,
  p_expected_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sites
  SET deleted_at = now()
  WHERE id = p_site_id
    AND deleted_at IS NULL
    AND version = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: il cantiere è stato modificato o archiviato da un altro utente'
      USING ERRCODE = '40001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_phase(
  p_phase_id uuid,
  p_expected_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase public.work_phases%ROWTYPE;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_phase
  FROM public.work_phases
  WHERE id = p_phase_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_phase.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: la fase è stata modificata o eliminata da un altro utente'
      USING ERRCODE = '40001';
  END IF;

  PERFORM set_config('app.internal_sync', '1', true);

  UPDATE public.time_entries
  SET phase_id = NULL
  WHERE phase_id = p_phase_id;

  UPDATE public.material_logs
  SET phase_id = NULL
  WHERE phase_id = p_phase_id;

  UPDATE public.photo_logs
  SET phase_id = NULL
  WHERE phase_id = p_phase_id;

  PERFORM set_config('app.internal_sync', '0', true);

  UPDATE public.work_phases
  SET deleted_at = now()
  WHERE id = p_phase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_equipment(
  p_equipment_id uuid,
  p_expected_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.equipment
  SET deleted_at = now()
  WHERE id = p_equipment_id
    AND deleted_at IS NULL
    AND version = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: il mezzo è stato modificato o archiviato da un altro utente'
      USING ERRCODE = '40001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_time_entry(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.time_entries
  SET deleted_at = now()
  WHERE id = p_id
    AND deleted_at IS NULL
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: la registrazione ore è stata modificata o eliminata'
      USING ERRCODE = '40001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_material_log(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.material_logs%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.material_logs
  WHERE id = p_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: materiale non trovato o già eliminato'
      USING ERRCODE = '40001';
  END IF;

  IF NOT (
    public.is_active_admin()
    OR (
      v_row.worker_id = auth.uid()
      AND public.is_worker_assigned_to_active_site(v_row.site_id)
    )
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NOT NULL AND v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: la voce materiale è stata modificata da un altro utente'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.material_logs
  SET deleted_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_equipment_log(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.equipment_logs%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.equipment_logs
  WHERE id = p_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: utilizzo mezzo non trovato o già eliminato'
      USING ERRCODE = '40001';
  END IF;

  IF NOT (
    public.is_active_admin()
    OR (
      v_row.actor_id = auth.uid()
      AND v_row.actor_role = 'Dipendente'
      AND public.is_worker_assigned_to_active_site(v_row.site_id)
    )
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NOT NULL AND v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: la registrazione utilizzo è stata modificata da un altro utente'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.equipment_logs
  SET deleted_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_photo_log(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.photo_logs%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.photo_logs
  WHERE id = p_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: foto non trovata o già eliminata'
      USING ERRCODE = '40001';
  END IF;

  IF NOT (
    public.is_active_admin()
    OR (
      v_row.worker_id = auth.uid()
      AND v_row.uploader_role = 'worker'
      AND public.is_worker_assigned_to_active_site(v_row.site_id)
    )
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NOT NULL AND v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONCURRENCY_CONFLICT: la fotografia è stata modificata da un altro utente'
      USING ERRCODE = '40001';
  END IF;

  -- Soft-delete logico: il file su Object Storage non viene eliminato fisicamente
  -- per preservare il ripristino in caso di errore operativo.
  UPDATE public.photo_logs
  SET deleted_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_own_onboarding()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_sync text;
  v_completed_at timestamptz;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  v_prev_sync := current_setting('app.internal_sync', true);
  PERFORM set_config('app.internal_sync', '1', true);

  UPDATE public.profiles
  SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE id = auth.uid()
    AND deleted_at IS NULL
  RETURNING onboarding_completed_at INTO v_completed_at;

  PERFORM set_config('app.internal_sync', COALESCE(v_prev_sync, '0'), true);
  RETURN v_completed_at;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT
  USING (public.is_active_admin());

DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT
  USING (auth.uid() = id AND deleted_at IS NULL);

-- SITES
DROP POLICY IF EXISTS sites_select_admin ON public.sites;
CREATE POLICY sites_select_admin ON public.sites
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS sites_select_worker ON public.sites;
CREATE POLICY sites_select_worker ON public.sites
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(id)
  );

DROP POLICY IF EXISTS sites_insert_admin ON public.sites;
CREATE POLICY sites_insert_admin ON public.sites
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS sites_update_admin ON public.sites;
CREATE POLICY sites_update_admin ON public.sites
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

-- SITE_WORKERS
DROP POLICY IF EXISTS site_workers_select_admin ON public.site_workers;
CREATE POLICY site_workers_select_admin ON public.site_workers
  FOR SELECT
  USING (public.is_active_admin());

DROP POLICY IF EXISTS site_workers_select_worker ON public.site_workers;
CREATE POLICY site_workers_select_worker ON public.site_workers
  FOR SELECT
  USING (worker_id = auth.uid() AND public.is_active_worker());

DROP POLICY IF EXISTS site_workers_insert_admin ON public.site_workers;
CREATE POLICY site_workers_insert_admin ON public.site_workers
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS site_workers_delete_admin ON public.site_workers;
CREATE POLICY site_workers_delete_admin ON public.site_workers
  FOR DELETE
  USING (public.is_active_admin());

-- WORK_PHASES
DROP POLICY IF EXISTS work_phases_select_admin ON public.work_phases;
CREATE POLICY work_phases_select_admin ON public.work_phases
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS work_phases_select_worker ON public.work_phases;
CREATE POLICY work_phases_select_worker ON public.work_phases
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS work_phases_insert_admin ON public.work_phases;
CREATE POLICY work_phases_insert_admin ON public.work_phases
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS work_phases_update_admin ON public.work_phases;
CREATE POLICY work_phases_update_admin ON public.work_phases
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS work_phases_update_worker ON public.work_phases;
CREATE POLICY work_phases_update_worker ON public.work_phases
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(site_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(site_id)
  );

-- EQUIPMENT
DROP POLICY IF EXISTS equipment_select_all_active ON public.equipment;
CREATE POLICY equipment_select_all_active ON public.equipment
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_user());

DROP POLICY IF EXISTS equipment_insert_admin ON public.equipment;
CREATE POLICY equipment_insert_admin ON public.equipment
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS equipment_update_admin ON public.equipment;
CREATE POLICY equipment_update_admin ON public.equipment
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

-- TIME_ENTRIES
DROP POLICY IF EXISTS time_entries_select_admin ON public.time_entries;
CREATE POLICY time_entries_select_admin ON public.time_entries
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS time_entries_select_worker ON public.time_entries;
CREATE POLICY time_entries_select_worker ON public.time_entries
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND worker_id = auth.uid()
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS time_entries_insert_admin ON public.time_entries;
CREATE POLICY time_entries_insert_admin ON public.time_entries
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS time_entries_insert_worker ON public.time_entries;
CREATE POLICY time_entries_insert_worker ON public.time_entries
  FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS time_entries_update_admin ON public.time_entries;
CREATE POLICY time_entries_update_admin ON public.time_entries
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

-- MATERIAL_LOGS
DROP POLICY IF EXISTS material_logs_select_admin ON public.material_logs;
CREATE POLICY material_logs_select_admin ON public.material_logs
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS material_logs_select_worker ON public.material_logs;
CREATE POLICY material_logs_select_worker ON public.material_logs
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS material_logs_insert_admin ON public.material_logs;
CREATE POLICY material_logs_insert_admin ON public.material_logs
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS material_logs_insert_worker ON public.material_logs;
CREATE POLICY material_logs_insert_worker ON public.material_logs
  FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS material_logs_update_admin ON public.material_logs;
CREATE POLICY material_logs_update_admin ON public.material_logs
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS material_logs_update_worker ON public.material_logs;
CREATE POLICY material_logs_update_worker ON public.material_logs
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND worker_id = auth.uid()
    AND public.is_worker_assigned_to_active_site(site_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND worker_id = auth.uid()
    AND public.is_worker_assigned_to_active_site(site_id)
  );

-- EQUIPMENT_LOGS
DROP POLICY IF EXISTS equipment_logs_select_admin ON public.equipment_logs;
CREATE POLICY equipment_logs_select_admin ON public.equipment_logs
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS equipment_logs_select_worker ON public.equipment_logs;
CREATE POLICY equipment_logs_select_worker ON public.equipment_logs
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS equipment_logs_insert_admin ON public.equipment_logs;
CREATE POLICY equipment_logs_insert_admin ON public.equipment_logs
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS equipment_logs_insert_worker ON public.equipment_logs;
CREATE POLICY equipment_logs_insert_worker ON public.equipment_logs
  FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND actor_role = 'Dipendente'
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS equipment_logs_update_admin ON public.equipment_logs;
CREATE POLICY equipment_logs_update_admin ON public.equipment_logs
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS equipment_logs_update_worker ON public.equipment_logs;
CREATE POLICY equipment_logs_update_worker ON public.equipment_logs
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND actor_id = auth.uid()
    AND actor_role = 'Dipendente'
    AND public.is_worker_assigned_to_active_site(site_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND actor_id = auth.uid()
    AND actor_role = 'Dipendente'
    AND public.is_worker_assigned_to_active_site(site_id)
  );

-- PHOTO_LOGS
DROP POLICY IF EXISTS photo_logs_select_admin ON public.photo_logs;
CREATE POLICY photo_logs_select_admin ON public.photo_logs
  FOR SELECT
  USING (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS photo_logs_select_worker ON public.photo_logs;
CREATE POLICY photo_logs_select_worker ON public.photo_logs
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS photo_logs_insert_admin ON public.photo_logs;
CREATE POLICY photo_logs_insert_admin ON public.photo_logs
  FOR INSERT
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS photo_logs_insert_worker ON public.photo_logs;
CREATE POLICY photo_logs_insert_worker ON public.photo_logs
  FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND uploader_role = 'worker'
    AND public.is_worker_assigned_to_active_site(site_id)
  );

DROP POLICY IF EXISTS photo_logs_update_admin ON public.photo_logs;
CREATE POLICY photo_logs_update_admin ON public.photo_logs
  FOR UPDATE
  USING (deleted_at IS NULL AND public.is_active_admin())
  WITH CHECK (deleted_at IS NULL AND public.is_active_admin());

DROP POLICY IF EXISTS photo_logs_update_worker ON public.photo_logs;
CREATE POLICY photo_logs_update_worker ON public.photo_logs
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND worker_id = auth.uid()
    AND uploader_role = 'worker'
    AND public.is_worker_assigned_to_active_site(site_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND worker_id = auth.uid()
    AND uploader_role = 'worker'
    AND public.is_worker_assigned_to_active_site(site_id)
  );

-- AUDIT_LOGS (sola lettura per admin attivi)
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT
  USING (public.is_active_admin());

-- ----------------------------------------------------------------------------
-- 8. STORAGE PRIVATO PER FOTO CANTIERE (bucket `site-photos`)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-photos',
  'site-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS site_photos_select_authorized ON storage.objects;
CREATE POLICY site_photos_select_authorized ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'site-photos'
    AND (
      public.is_active_admin()
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.is_worker_assigned_to_active_site(((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS site_photos_insert_authorized ON storage.objects;
CREATE POLICY site_photos_insert_authorized ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'site-photos'
    AND (
      public.is_active_admin()
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND (storage.foldername(name))[2] = auth.uid()::text
        AND public.is_worker_assigned_to_active_site(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 9. REALTIME MULTI-UTENTE
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  rt text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH rt IN ARRAY ARRAY[
      'profiles',
      'sites',
      'site_workers',
      'work_phases',
      'equipment',
      'time_entries',
      'material_logs',
      'equipment_logs',
      'photo_logs'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = rt
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', rt);
      END IF;
    END LOOP;
  END IF;
END;
$$;
