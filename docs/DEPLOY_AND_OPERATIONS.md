# Gestionale AMG Tech — Guida Step-by-Step al Deploy (Supabase + Vercel), Backup Cifrati e Operatività

Questa guida ti accompagna passo dopo passo nella pubblicazione online di **Gestionale AMG Tech** a costo zero (piano gratuito **Supabase Free + Vercel**), nell'attivazione dei **backup automatizzati criptati** e nella futura migrazione sul server aziendale dedicato senza alcuna perdita di dati.

---

## Prerequisiti sul tuo computer
- **Node.js 20+** (qui verificato con Node v22) e **npm**
- **Git** e un account **GitHub** (consigliato repository **privato**)
- Account gratuito su **[Supabase](https://supabase.com)**
- Account gratuito su **[Vercel](https://vercel.com)** (registrati preferibilmente con GitHub)

---

## Parte 1 — Configurazione Backend e Database su Supabase (Passo 1 → 5)

### Passo 1 — Crea il progetto su Supabase
1. Accedi a [Supabase Dashboard](https://supabase.com/dashboard) e clicca su **New project**.
2. Scegli la tua Organization, imposta:
   - **Name:** `gestionale-amg-tech`
   - **Database Password:** genera una password forte e **salvala subito** nel tuo password manager (ti servirà per `DATABASE_URL`).
   - **Region:** `Europe (Frankfurt)` o `Europe (Milan/West)` (la più vicina all'Italia).
3. Attendi 1–2 minuti che il database sia pronto (**Status: Healthy**).

### Passo 2 — Recupera le chiavi di progetto
Vai in **Project Settings** (icona ingranaggio in basso a sinistra) → **API** (o **Data API / API Keys**):
- **Project URL** (`https://xxxx.supabase.co`) → sarà `VITE_SUPABASE_URL` e `SUPABASE_URL`
- **anon / public key** (o **Publishable key**) → sarà `VITE_SUPABASE_ANON_KEY`
- **service_role key** (o **Secret key**) → sarà `SUPABASE_SERVICE_ROLE_KEY` *(chiave segreta server-side: **NON** inserirla mai su Vercel come `VITE_...`)*

Poi vai in **Connect** (in alto nella barra del progetto) oppure **Project Settings → Database** → **Connection string → URI**:
- Copia l'URI PostgreSQL sostituendo `[YOUR-PASSWORD]` con la password DB creata al Passo 1 → sarà `DATABASE_URL`.
  - *(Nota: per `pg_dump` e GitHub Actions usa la **Session pooler URI** su porta `5432` se GitHub Actions gira solo su IPv4, oppure l'URI diretta se hai il supporto IPv4/direct connection attivo).*

### Passo 3 — Disabilita la registrazione pubblica (obbligatorio)
Per impedire che chiunque dall'esterno possa registrarsi:
1. Nel menu a sinistra di Supabase vai in **Authentication → Providers** (o **Sign In / Providers**).
2. Espandi **Email**:
   - **Attiva** `Enable Email provider`.
   - **Disattiva** `Confirm email` (gli username interni usano il dominio interno `.internal` e non ricevono email reali; inoltre la Edge Function conferma gli utenti lato server).
3. Vai in **Authentication → Settings** (o **Sign In / Providers → User Signups**):
   - **Disattiva** `Allow new users to sign up` (così nessuna chiamata pubblica di sign-up potrà mai creare account).
   - Clicca su **Save**.

### Passo 4 — Applica lo schema del database (`0001_initial_schema.sql`)
1. Nel menu a sinistra di Supabase clicca su **SQL Editor → New query**.
2. Apri in locale il file [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql), seleziona tutto (`Cmd+A`), copialo e incollalo nell'editor SQL di Supabase.
3. Clicca su **Run** (`Cmd+Enter`) e attendi il messaggio **`Success. No rows returned`**.
4. Verifica in **Table Editor** che siano presenti le tabelle (`profiles`, `sites`, `site_workers`, `work_phases`, `equipment`, `time_entries`, `material_logs`, `equipment_logs`, `photo_logs`, `audit_logs`) e in **Storage** che esista il bucket privato **`site-photos`** (icona lucchetto).

### Passo 5 — Fai il deploy della Edge Function `manage-users`
La creazione di nuovi Amministratori e Dipendenti avviene tramite la Edge Function [`supabase/functions/manage-users/index.ts`](../supabase/functions/manage-users/index.ts), così la `service_role key` resta protetta sul server.

Dal terminale nella cartella del progetto:
```bash
# 1. Login su Supabase CLI (apre il browser per confermare)
npx supabase login

# 2. Collega la cartella locale al progetto Supabase
#    (trovi il Reference ID in Project Settings -> General -> Reference ID)
npx supabase link --project-ref IL_TUO_PROJECT_REF

# 3. Imposta il dominio email interno usato per mappare gli username nome.cognome
npx supabase secrets set AUTH_EMAIL_DOMAIN=amgtech.internal

# 4. Deploy della Edge Function (la verifica JWT + ruolo admin è eseguita dentro index.ts)
npx supabase functions deploy manage-users --no-verify-jwt
```
Verifica nella dashboard Supabase → **Edge Functions** che **`manage-users`** risulti attiva.

---

## Parte 2 — Creazione dei 2 Account Iniziali (`amministratore` e `dipendente`)

### Passo 6 — Configura `.env` locale ed esegui il seed una sola volta
1. Nella cartella del progetto crea `.env` partendo da [`.env.example`](../.env.example):
   ```bash
   cp .env.example .env
   ```
2. Apri `.env` e compila con i dati reali recuperati al Passo 2:
   ```dotenv
   VITE_SUPABASE_URL=https://IL_TUO_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=IL_TUO_ANON_KEY
   VITE_AUTH_EMAIL_DOMAIN=amgtech.internal

   SUPABASE_URL=https://IL_TUO_PROJECT_ID.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=LA_TUA_SERVICE_ROLE_KEY
   AUTH_EMAIL_DOMAIN=amgtech.internal

   SEED_ADMIN_PASSWORD=ScegliPasswordAdminForte123!
   SEED_WORKER_PASSWORD=ScegliPasswordDipendenteForte123!
   ```
3. Esegui lo script di seed idempotente:
   ```bash
   node scripts/seed-initial-users.mjs
   ```
   Output atteso:
   - `[CREATO] Account iniziale "amministratore" (ruolo: admin).`
   - `[CREATO] Account iniziale "dipendente" (ruolo: worker).`
   - Il database resta **vuoto** (nessun cantiere, mezzo o registrazione finta).

> **Verifica locale immediata (opzionale):** puoi già eseguire `npm run dev` in locale e aprire `http://localhost:5173` per testare subito il login prima ancora di andare su Vercel!

---

## Parte 3 — Pubblicazione Frontend Online su Vercel (Passo 7 → 8)

### Passo 7 — Carica il codice su GitHub (repository privato)
Il file [`.gitignore`](../.gitignore) esclude già `.env`, `node_modules/`, `dist/` e `backups/` in modo che nessuna chiave segreta finisca su Git.
```bash
git init
git add .
git status   # Controlla che .env NON compaia nella lista!
git commit -m "Prima release Gestionale AMG Tech"
git branch -M main
git remote add origin https://github.com/TUO_UTENTE/gestionale-amg-tech.git
git push -u origin main
```

### Passo 8 — Collega il repository su Vercel e pubblica
1. Accedi a [Vercel](https://vercel.com) → **Add New… → Project**.
2. Seleziona il repository **`gestionale-amg-tech`** dal tuo account GitHub e clicca **Import**.
3. Verifica le impostazioni di build (rilevate automaticamente):
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Apri **Environment Variables** e aggiungi **solo queste 3 variabili pubbliche** (mai `SUPABASE_SERVICE_ROLE_KEY` o `DATABASE_URL`!):
   - `VITE_SUPABASE_URL` = `https://IL_TUO_PROJECT_ID.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `IL_TUO_ANON_KEY`
   - `VITE_AUTH_EMAIL_DOMAIN` = `amgtech.internal`
5. Clicca su **Deploy**. Dopo circa 30–60 secondi Vercel ti darà l'URL pubblico HTTPS (es. `https://gestionale-amg-tech.vercel.app`) già compatibile con routing SPA e header di sicurezza tramite [`vercel.json`](../vercel.json).

---

## Parte 4 — Attivazione Backup Automatizzati Criptati (AES-256)

Il workflow [`.github/workflows/encrypted-backup.yml`](../.github/workflows/encrypted-backup.yml) esegue automaticamente ogni notte alle **02:30 UTC** il backup cifrato GPG AES-256 sia del database PostgreSQL che delle foto su Storage.

1. Su GitHub apri il repository → **Settings → Secrets and variables → Actions → New repository secret**.
2. Aggiungi i 4 secrets:
   - `DATABASE_URL`: la stringa PostgreSQL copiata al Passo 2 (usa la Session Pooler URI di Supabase su porta `5432` compatibile IPv4).
   - `BACKUP_ENCRYPTION_PASSPHRASE`: una passphrase lunga (es. 24+ caratteri) salvata in luogo sicuro fuori da GitHub.
   - `SUPABASE_URL`: `https://IL_TUO_PROJECT_ID.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: la tua `service_role key`
3. Vai nella scheda **Actions** su GitHub → seleziona **Backup Automatico Criptato (DB + Foto)** → **Run workflow** per eseguire subito un primo backup di verifica e controllare che gli archivi `.tar.gz.gpg` vengano prodotti correttamente.

---

## Parte 5 — Checklist Verifica Post-Deploy (prima di consegnare al cliente)

1. Apri l'URL Vercel su **PC** e accedi con username **`amministratore`** e la tua `SEED_ADMIN_PASSWORD`.
2. Al primo accesso di qualsiasi nuova utenza (sia Amministratore che Dipendente) si apre automaticamente la **Quick Start Guide interattiva**: testane i passaggi e verifica che resti sempre richiamabile dal pulsante **Guida** nella barra in alto.
3. Controlla che non ci siano dati demo (Cantieri = 0, Mezzi = 0, Dashboard vuota).
4. Vai nella sezione **Amministratori** → crea un amministratore di test (es. `Mario Rossi` → `mario.rossi`), verifica il login con `mario.rossi` in una scheda incognito e l'apertura automatica della guida dedicata.
5. Vai su **Dipendenti** → crea o verifica `dipendente`, apri l'URL Vercel dallo **smartphone**, accedi come `dipendente`, verifica la Quick Start Guide mobile e la schermata cantieri vuota (finché non viene assegnato a un cantiere).
6. Crea 1 cantiere di prova lato Admin, assegna `dipendente`, verifica il caricamento foto dal telefono e la sincronizzazione in tempo reale sul PC dell'Admin. (Se vuoi riconsegnarlo vuoto al cliente, archivia il cantiere di prova.)
7. Fai cambiare la password ad almeno un account tramite il tasto **Password** nell'header in alto.

---

## Parte 6 — Aggiornamenti Futuri & Migrazione sul Server Aziendale

- **Aggiornamenti senza perdita di dati:** ogni futura evoluzione usa migrazioni incrementali (`0002_...sql`, `0003_...sql`) con approccio *Expand & Contract*, testate prima su un progetto Supabase di `staging`, mai con `DROP TABLE` o `TRUNCATE` in produzione.
- **Ripristino verificato da backup cifrato:**
  ```bash
  BACKUP_ENCRYPTION_PASSPHRASE="LA_TUA_PASSPHRASE" \
    ./scripts/restore-db.sh ./backups/amgtech-db-XXXX.tar.gz.gpg "$TARGET_DATABASE_URL" --confirm-restore
  ```
- **Passaggio al server aziendale dedicato:** quando passerete dal piano gratuito al server aziendale, basterà esportare il dump DB + Storage (`backup-db.sh` e `backup-storage.mjs`), ripristinare su PostgreSQL + S3/Supabase self-hosted aziendale e puntare le variabili ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) al nuovo endpoint senza perdere alcun dato né account.
