import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authEmailDomain = (
  process.env.AUTH_EMAIL_DOMAIN ||
  process.env.VITE_AUTH_EMAIL_DOMAIN ||
  'amgtech.internal'
)
  .trim()
  .toLowerCase();

const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AmgAdmin2026!';
const workerPassword = process.env.SEED_WORKER_PASSWORD || 'AmgDipendente2026!';

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Errore: imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nelle variabili ambiente o in .env.'
  );
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const match = (data.users || []).find(
      (u) => (u.email || '').toLowerCase() === email.toLowerCase()
    );
    if (match) return match;
    if (!data.users || data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureSeedAccount({
  username,
  firstName,
  lastName,
  role,
  workerType,
  avatarInitials,
  isRootAdmin,
  password,
}) {
  const email = `${username}@${authEmailDomain}`;

  const { data: existingProfile, error: profileReadErr } = await adminClient
    .from('profiles')
    .select('id, username, role, active')
    .ilike('username', username)
    .maybeSingle();

  if (profileReadErr) throw profileReadErr;

  if (existingProfile) {
    console.log(
      `[OK] Account "${username}" (${existingProfile.role}) già presente, nessuna modifica effettuata.`
    );
    return;
  }

  let authUser = await findAuthUserByEmail(email);

  if (!authUser) {
    const { data: created, error: createAuthErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          role,
          full_name: firstName,
        },
      });
    if (createAuthErr || !created.user) {
      throw createAuthErr || new Error(`Impossibile creare auth user per ${username}`);
    }
    authUser = created.user;
  }

  const { error: insertProfileErr } = await adminClient.from('profiles').insert({
    id: authUser.id,
    username,
    first_name: firstName,
    last_name: lastName,
    role,
    worker_type: role === 'worker' ? workerType : null,
    avatar_initials: avatarInitials,
    active: true,
    is_root_admin: isRootAdmin,
  });

  if (insertProfileErr) {
    throw insertProfileErr;
  }

  console.log(
    `[CREATO] Account iniziale "${username}" (ruolo: ${role}).`
  );
}

async function main() {
  console.log('Inizializzazione account di base Gestionale AMG Tech...');

  await ensureSeedAccount({
    username: 'amministratore',
    firstName: 'Amministratore',
    lastName: '',
    role: 'admin',
    workerType: null,
    avatarInitials: 'AM',
    isRootAdmin: true,
    password: adminPassword,
  });

  await ensureSeedAccount({
    username: 'dipendente',
    firstName: 'Dipendente',
    lastName: '',
    role: 'worker',
    workerType: 'Edilizia',
    avatarInitials: 'DI',
    isRootAdmin: false,
    password: workerPassword,
  });

  console.log(
    'Seed completato: il database è vuoto (nessun cantiere/mezzo fittizio) e pronto per i test con il cliente.'
  );
}

main().catch((err) => {
  console.error('Errore durante il seed iniziale:', err);
  process.exit(1);
});
