import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
const VALID_WORKER_TYPES = new Set(['Edilizia', 'Impiantistica']);
const VALID_ROLES = new Set(['admin', 'worker']);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeUsernameSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeLoginUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

function buildUsername(firstName: string, lastName: string): string {
  const first = normalizeUsernameSegment(firstName);
  const last = normalizeUsernameSegment(lastName);
  if (first && last) return `${first}.${last}`;
  return first || last;
}

function computeInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  const combined = `${a}${b}`.toUpperCase();
  if (combined.length >= 2) return combined;
  const fallback = firstName.trim().slice(0, 2).toUpperCase();
  return fallback || 'UT';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authEmailDomain = (
    Deno.env.get('AUTH_EMAIL_DOMAIN') || 'amgtech.internal'
  )
    .trim()
    .toLowerCase();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Configurazione server Supabase incompleta.' },
      500
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return jsonResponse({ error: 'Sessione non autenticata.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: callerUser },
    error: callerAuthErr,
  } = await adminClient.auth.getUser(token);

  if (callerAuthErr || !callerUser) {
    return jsonResponse({ error: 'Token di sessione non valido o scaduto.' }, 401);
  }

  const { data: callerProfile, error: callerProfileErr } = await adminClient
    .from('profiles')
    .select('id, role, active, deleted_at')
    .eq('id', callerUser.id)
    .maybeSingle();

  if (
    callerProfileErr ||
    !callerProfile ||
    callerProfile.role !== 'admin' ||
    !callerProfile.active ||
    callerProfile.deleted_at !== null
  ) {
    return jsonResponse(
      {
        error:
          'Permesso negato: solo un amministratore attivo può gestire gli account.',
      },
      403
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Corpo della richiesta JSON non valido.' }, 400);
  }

  const action = String(payload.action || '');

  try {
    if (action === 'create_user') {
      const firstName = String(payload.firstName || '').trim();
      const lastName = String(payload.lastName || '').trim();
      const role = String(payload.role || '');
      const workerType = payload.workerType
        ? String(payload.workerType)
        : undefined;
      const password = String(payload.password || '');
      const rawCustomUsername =
        typeof payload.customUsername === 'string'
          ? payload.customUsername.trim()
          : '';

      if (!firstName || !lastName) {
        return jsonResponse(
          { error: 'Nome e Cognome sono obbligatori.' },
          400
        );
      }

      if (!VALID_ROLES.has(role)) {
        return jsonResponse({ error: 'Ruolo utente non valido.' }, 400);
      }

      if (role === 'worker' && (!workerType || !VALID_WORKER_TYPES.has(workerType))) {
        return jsonResponse(
          { error: 'Seleziona la tipologia del dipendente (Edilizia o Impiantistica).' },
          400
        );
      }

      if (password.length < 8) {
        return jsonResponse(
          { error: 'La password iniziale deve contenere almeno 8 caratteri.' },
          400
        );
      }

      let finalUsername = '';
      if (rawCustomUsername) {
        finalUsername = normalizeLoginUsername(rawCustomUsername);
        if (!finalUsername || !USERNAME_REGEX.test(finalUsername)) {
          return jsonResponse(
            {
              error:
                'Username non valido. Usa il formato nome.cognome con sole lettere minuscole e numeri.',
            },
            400
          );
        }

        const { data: existingExact } = await adminClient
          .from('profiles')
          .select('id')
          .ilike('username', finalUsername)
          .maybeSingle();

        if (existingExact) {
          return jsonResponse(
            { error: `Lo username "${finalUsername}" è già in uso.` },
            409
          );
        }
      } else {
        const baseUsername = buildUsername(firstName, lastName);
        if (!baseUsername || !USERNAME_REGEX.test(baseUsername)) {
          return jsonResponse(
            {
              error:
                'Impossibile generare uno username valido da Nome e Cognome.',
            },
            400
          );
        }

        const { data: existingSimilar } = await adminClient
          .from('profiles')
          .select('username')
          .ilike('username', `${baseUsername}%`);

        const taken = new Set(
          (existingSimilar || []).map((row) =>
            String(row.username || '').toLowerCase()
          )
        );

        finalUsername = baseUsername;
        let suffix = 2;
        while (taken.has(finalUsername)) {
          finalUsername = `${baseUsername}${suffix}`;
          suffix += 1;
        }
      }

      const internalEmail = `${finalUsername}@${authEmailDomain}`;
      const avatarInitials = computeInitials(firstName, lastName);
      const fullName = `${firstName} ${lastName}`.trim();

      const { data: createdAuth, error: authCreateErr } =
        await adminClient.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
          user_metadata: {
            username: finalUsername,
            role,
            full_name: fullName,
          },
        });

      if (authCreateErr || !createdAuth.user) {
        const errMsg = authCreateErr?.message || 'Errore creazione credenziali.';
        const isDuplicate =
          errMsg.toLowerCase().includes('already') ||
          errMsg.toLowerCase().includes('registered');
        return jsonResponse(
          {
            error: isDuplicate
              ? `Esiste già un account associato allo username "${finalUsername}".`
              : errMsg,
          },
          isDuplicate ? 409 : 400
        );
      }

      const { data: insertedProfile, error: profileInsertErr } = await adminClient
        .from('profiles')
        .insert({
          id: createdAuth.user.id,
          username: finalUsername,
          first_name: firstName,
          last_name: lastName,
          role,
          worker_type: role === 'worker' ? workerType : null,
          avatar_initials: avatarInitials,
          active: true,
          is_root_admin: false,
          created_by: callerUser.id,
          updated_by: callerUser.id,
        })
        .select()
        .single();

      if (profileInsertErr || !insertedProfile) {
        await adminClient.auth.admin.deleteUser(createdAuth.user.id);
        return jsonResponse(
          {
            error:
              profileInsertErr?.message ||
              'Errore salvataggio profilo utente nel database.',
          },
          500
        );
      }

      return jsonResponse({ user: insertedProfile }, 201);
    }

    if (action === 'update_user') {
      const userId = String(payload.userId || '').trim();
      const firstName = String(payload.firstName || '').trim();
      const lastName = String(payload.lastName || '').trim();
      const expectedVersion = Number(payload.expectedVersion);

      if (!userId || !firstName || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
        return jsonResponse({ error: 'Parametri di aggiornamento non validi.' }, 400);
      }

      const { data: targetProfile, error: fetchTargetErr } = await adminClient
        .from('profiles')
        .select('id, role, last_name, is_root_admin')
        .eq('id', userId)
        .maybeSingle();

      if (fetchTargetErr || !targetProfile) {
        return jsonResponse({ error: 'Utente non trovato.' }, 404);
      }

      if (targetProfile.last_name !== '' && !lastName) {
        return jsonResponse({ error: 'Il cognome è obbligatorio.' }, 400);
      }

      let nextWorkerType: string | null = null;
      if (targetProfile.role === 'worker') {
        const requestedType = String(payload.workerType || '');
        if (!VALID_WORKER_TYPES.has(requestedType)) {
          return jsonResponse({ error: 'Tipologia dipendente non valida.' }, 400);
        }
        nextWorkerType = requestedType;
      }

      const avatarInitials = computeInitials(firstName, lastName);

      const { data: updatedProfile, error: updateErr } = await adminClient
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          worker_type: nextWorkerType,
          avatar_initials: avatarInitials,
          updated_by: callerUser.id,
        })
        .eq('id', userId)
        .eq('version', expectedVersion)
        .is('deleted_at', null)
        .select()
        .maybeSingle();

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 400);
      }

      if (!updatedProfile) {
        return jsonResponse(
          {
            error:
              'Utente modificato contemporaneamente da un altro amministratore. Ricarica e riprova.',
            code: 'CONCURRENCY_CONFLICT',
          },
          409
        );
      }

      return jsonResponse({ user: updatedProfile }, 200);
    }

    if (action === 'reset_password') {
      const userId = String(payload.userId || '').trim();
      const newPassword = String(payload.newPassword || '');

      if (!userId) {
        return jsonResponse({ error: 'ID utente mancante.' }, 400);
      }
      if (newPassword.length < 8) {
        return jsonResponse(
          { error: 'La nuova password deve contenere almeno 8 caratteri.' },
          400
        );
      }

      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!targetProfile) {
        return jsonResponse({ error: 'Utente non trovato.' }, 404);
      }

      const { error: resetErr } = await adminClient.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (resetErr) {
        return jsonResponse({ error: resetErr.message }, 400);
      }

      return jsonResponse({ ok: true }, 200);
    }

    if (action === 'set_active') {
      const userId = String(payload.userId || '').trim();
      const active = Boolean(payload.active);
      const expectedVersion = Number(payload.expectedVersion);

      if (!userId || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
        return jsonResponse({ error: 'Parametri non validi.' }, 400);
      }

      if (userId === callerUser.id && !active) {
        return jsonResponse(
          { error: 'Non puoi disattivare il tuo stesso account.' },
          400
        );
      }

      const { data: targetProfile, error: targetErr } = await adminClient
        .from('profiles')
        .select('id, role, is_root_admin')
        .eq('id', userId)
        .maybeSingle();

      if (targetErr || !targetProfile) {
        return jsonResponse({ error: 'Utente non trovato.' }, 404);
      }

      if (targetProfile.is_root_admin && !active) {
        return jsonResponse(
          { error: "Impossibile disattivare l'amministratore originario." },
          400
        );
      }

      const { data: updatedProfile, error: updateErr } = await adminClient
        .from('profiles')
        .update({
          active,
          deleted_at: active ? null : new Date().toISOString(),
          updated_by: callerUser.id,
        })
        .eq('id', userId)
        .eq('version', expectedVersion)
        .select()
        .maybeSingle();

      if (updateErr) {
        const msg = updateErr.message || '';
        if (
          msg.includes('LAST_ADMIN_PROTECTED') ||
          msg.includes('ROOT_ADMIN_PROTECTED')
        ) {
          return jsonResponse({ error: msg }, 400);
        }
        return jsonResponse({ error: msg }, 400);
      }

      if (!updatedProfile) {
        return jsonResponse(
          {
            error:
              'Account modificato contemporaneamente da un altro amministratore. Ricarica e riprova.',
            code: 'CONCURRENCY_CONFLICT',
          },
          409
        );
      }

      const { error: banErr } = await adminClient.auth.admin.updateUserById(
        userId,
        { ban_duration: active ? 'none' : '876000h' }
      );

      if (banErr) {
        return jsonResponse(
          {
            error: `Stato profilo aggiornato, ma blocco credenziali non riuscito: ${banErr.message}`,
          },
          500
        );
      }

      if (targetProfile.role === 'worker' && !active) {
        await adminClient
          .from('site_workers')
          .delete()
          .eq('worker_id', userId);
      }

      return jsonResponse({ user: updatedProfile }, 200);
    }

    return jsonResponse({ error: `Azione non supportata: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore imprevisto.';
    return jsonResponse({ error: message }, 500);
  }
});
