import {
  AdminUser,
  AppDatabase,
  AuthUserProfile,
  Equipment,
  EquipmentLog,
  MaterialLog,
  PhotoLog,
  Site,
  TimeEntry,
  UserRole,
  Worker,
  WorkerType,
  WorkPhase,
} from '../types/models';
import { requireSupabase } from '../lib/supabaseClient';
import {
  ConcurrencyConflictError,
  PermissionDeniedError,
  ValidationError,
  mapDatabaseError,
} from './apiErrors';
import {
  formatIsoToLocalTimestamp,
  generateUuid,
  localTimestampToIso,
} from '../utils/formatters';

interface ProfileRow {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  worker_type: WorkerType | null;
  avatar_initials: string;
  active: boolean;
  is_root_admin: boolean;
  onboarding_completed_at?: string | null;
  version: number;
  created_at: string;
  deleted_at: string | null;
}

interface SiteRow {
  id: string;
  code: string;
  name: string;
  client: string;
  address: string;
  city: string;
  sectors: Site['sectors'];
  status: Site['status'];
  start_date: string;
  end_date: string;
  description: string;
  progress: number;
  version: number;
}

interface SiteWorkerRow {
  site_id: string;
  worker_id: string;
}

interface WorkPhaseRow {
  id: string;
  site_id: string;
  phase_order: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: WorkPhase['status'];
  progress: number;
  version: number;
}

interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  category: Equipment['category'];
  serial_or_plate: string;
  status: Equipment['status'];
  notes: string | null;
  version: number;
}

interface TimeEntryRow {
  id: string;
  site_id: string;
  phase_id: string | null;
  worker_id: string;
  worker_name: string;
  work_date: string;
  regular_hours: number | string;
  description: string;
  created_at: string;
  version: number;
}

interface MaterialLogRow {
  id: string;
  site_id: string;
  phase_id: string | null;
  worker_id: string;
  worker_name: string;
  log_date: string;
  article_code: string | null;
  material_name: string | null;
  category: MaterialLog['category'];
  quantity: number | string;
  unit: MaterialLog['unit'];
  notes: string | null;
  created_at: string;
  version: number;
}

interface EquipmentLogRow {
  id: string;
  equipment_id: string;
  equipment_name: string;
  site_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: 'Admin' | 'Dipendente';
  logged_at: string;
  hours_used: number | string | null;
  notes: string | null;
  version: number;
}

interface PhotoLogRow {
  id: string;
  site_id: string;
  phase_id: string | null;
  worker_id: string;
  worker_name: string;
  uploader_role: UserRole;
  photo_date: string;
  storage_path: string;
  caption: string;
  tag: PhotoLog['tag'];
  created_at: string;
  version: number;
}

function mapProfileRowToAuthUser(row: ProfileRow): AuthUserProfile {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name || '',
    name: row.full_name || row.first_name,
    role: row.role,
    workerType: row.worker_type || undefined,
    avatarInitials: row.avatar_initials,
    active: row.active,
    isRootAdmin: row.is_root_admin,
    onboardingCompletedAt: row.onboarding_completed_at || null,
    version: row.version,
  };
}

function mapProfileRowToAdmin(row: ProfileRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name || '',
    name: row.full_name || row.first_name,
    avatarInitials: row.avatar_initials,
    active: row.active,
    isRootAdmin: row.is_root_admin,
    version: row.version,
    createdAt: formatIsoToLocalTimestamp(row.created_at),
  };
}

function mapProfileRowToWorker(row: ProfileRow): Worker {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name || '',
    name: row.full_name || row.first_name,
    type: row.worker_type || 'Edilizia',
    avatarInitials: row.avatar_initials,
    active: row.active,
    version: row.version,
  };
}

function mapSiteRow(row: SiteRow, assignedWorkerIds: string[]): Site {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    address: row.address,
    city: row.city,
    sectors: row.sectors && row.sectors.length > 0 ? row.sectors : ['Edilizia'],
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    description: row.description || '',
    progress: row.progress,
    assignedWorkerIds,
    version: row.version,
  };
}

function mapPhaseRow(row: WorkPhaseRow): WorkPhase {
  return {
    id: row.id,
    siteId: row.site_id,
    order: row.phase_order,
    title: row.title,
    description: row.description || '',
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    progress: row.progress,
    version: row.version,
  };
}

function mapEquipmentRow(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    serialOrPlate: row.serial_or_plate,
    status: row.status,
    notes: row.notes || undefined,
    version: row.version,
  };
}

function mapTimeEntryRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    siteId: row.site_id,
    phaseId: row.phase_id || '',
    workerId: row.worker_id,
    workerName: row.worker_name,
    date: row.work_date,
    regularHours: Number(row.regular_hours) || 0,
    description: row.description,
    createdAt: formatIsoToLocalTimestamp(row.created_at),
    version: row.version,
  };
}

function mapMaterialLogRow(row: MaterialLogRow): MaterialLog {
  return {
    id: row.id,
    siteId: row.site_id,
    phaseId: row.phase_id || '',
    workerId: row.worker_id,
    workerName: row.worker_name,
    date: row.log_date,
    articleCode: row.article_code || undefined,
    materialName: row.material_name || undefined,
    category: row.category,
    quantity: Number(row.quantity) || 0,
    unit: row.unit,
    notes: row.notes || undefined,
    createdAt: formatIsoToLocalTimestamp(row.created_at),
    version: row.version,
  };
}

function mapEquipmentLogRow(row: EquipmentLogRow): EquipmentLog {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    siteId: row.site_id,
    actorId: row.actor_id || undefined,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    timestamp: formatIsoToLocalTimestamp(row.logged_at),
    hoursUsed:
      row.hours_used !== null && row.hours_used !== undefined
        ? Number(row.hours_used)
        : undefined,
    notes: row.notes || undefined,
    version: row.version,
  };
}

function mapPhotoLogRow(
  row: PhotoLogRow,
  signedUrlMap: Map<string, string>
): PhotoLog {
  return {
    id: row.id,
    siteId: row.site_id,
    phaseId: row.phase_id || '',
    workerId: row.worker_id,
    workerName: row.worker_name,
    uploaderRole: row.uploader_role,
    date: row.photo_date,
    storagePath: row.storage_path,
    imageUrl: signedUrlMap.get(row.storage_path) || '',
    caption: row.caption || '',
    tag: row.tag,
    createdAt: formatIsoToLocalTimestamp(row.created_at),
    version: row.version,
  };
}

async function createSignedUrlMap(storagePaths: string[]): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)));
  const urlMap = new Map<string, string>();
  if (uniquePaths.length === 0) return urlMap;

  const client = requireSupabase();
  const batchSize = 150;

  for (let i = 0; i < uniquePaths.length; i += batchSize) {
    const chunk = uniquePaths.slice(i, i + batchSize);
    const { data, error } = await client.storage
      .from('site-photos')
      .createSignedUrls(chunk, 3600);

    if (error) {
      throw mapDatabaseError(error, 'Errore caricamento anteprime fotografiche.');
    }

    (data || []).forEach((item) => {
      if (item.path && item.signedUrl) {
        urlMap.set(item.path, item.signedUrl);
      }
    });
  }

  return urlMap;
}

async function invokeManageUsers<T>(body: Record<string, unknown>): Promise<T> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('manage-users', {
    body,
  });

  if (error) {
    let parsedBody: { error?: string; code?: string } | null = null;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      parsedBody = await context.json().catch(() => null);
    }

    const status = context?.status;
    const message =
      parsedBody?.error || error.message || 'Errore gestione account.';

    if (status === 409 || parsedBody?.code === 'CONCURRENCY_CONFLICT') {
      if (message.includes('username')) {
        throw new ValidationError(message);
      }
      throw new ConcurrencyConflictError(message);
    }
    if (status === 401 || status === 403) {
      throw new PermissionDeniedError(message);
    }
    throw new ValidationError(message);
  }

  return data as T;
}

export const EMPTY_DATABASE: AppDatabase = {
  admins: [],
  sites: [],
  phases: [],
  workers: [],
  equipment: [],
  timeEntries: [],
  materialLogs: [],
  photoLogs: [],
  equipmentLogs: [],
};

export const databaseService = {
  async fetchCurrentProfile(userId: string): Promise<AuthUserProfile | null> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select(
        'id, username, first_name, last_name, full_name, role, worker_type, avatar_initials, active, is_root_admin, onboarding_completed_at, version, created_at, deleted_at'
      )
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) return null;
    return mapProfileRowToAuthUser(data as ProfileRow);
  },

  async completeOwnOnboarding(): Promise<string> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('complete_own_onboarding');
    if (error) throw mapDatabaseError(error);
    return data ? String(data) : new Date().toISOString();
  },

  async fetchDatabaseSnapshot(currentUser: AuthUserProfile): Promise<AppDatabase> {
    const client = requireSupabase();

    const [
      profilesRes,
      sitesRes,
      siteWorkersRes,
      phasesRes,
      equipmentRes,
      timeEntriesRes,
      materialLogsRes,
      equipmentLogsRes,
      photoLogsRes,
    ] = await Promise.all([
      currentUser.role === 'admin'
        ? client
            .from('profiles')
            .select(
              'id, username, first_name, last_name, full_name, role, worker_type, avatar_initials, active, is_root_admin, version, created_at, deleted_at'
            )
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      client
        .from('sites')
        .select('*')
        .is('deleted_at', null)
        .order('start_date', { ascending: false }),
      client.from('site_workers').select('site_id, worker_id'),
      client
        .from('work_phases')
        .select('*')
        .is('deleted_at', null)
        .order('phase_order', { ascending: true }),
      client
        .from('equipment')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      client
        .from('time_entries')
        .select('*')
        .is('deleted_at', null)
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false }),
      client
        .from('material_logs')
        .select('*')
        .is('deleted_at', null)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false }),
      client
        .from('equipment_logs')
        .select('*')
        .is('deleted_at', null)
        .order('logged_at', { ascending: false }),
      client
        .from('photo_logs')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    const errors = [
      profilesRes.error,
      sitesRes.error,
      siteWorkersRes.error,
      phasesRes.error,
      equipmentRes.error,
      timeEntriesRes.error,
      materialLogsRes.error,
      equipmentLogsRes.error,
      photoLogsRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw mapDatabaseError(errors[0], 'Errore caricamento dati dal database.');
    }

    const profiles = (profilesRes.data || []) as ProfileRow[];
    const admins = profiles
      .filter((p) => p.role === 'admin')
      .map(mapProfileRowToAdmin);
    const workers = profiles
      .filter((p) => p.role === 'worker')
      .map(mapProfileRowToWorker);

    const assignedWorkersBySite = new Map<string, string[]>();
    ((siteWorkersRes.data || []) as SiteWorkerRow[]).forEach((sw) => {
      const list = assignedWorkersBySite.get(sw.site_id) || [];
      list.push(sw.worker_id);
      assignedWorkersBySite.set(sw.site_id, list);
    });

    const photoRows = (photoLogsRes.data || []) as PhotoLogRow[];
    const signedUrlMap = await createSignedUrlMap(
      photoRows.map((p) => p.storage_path)
    );

    return {
      admins,
      workers,
      sites: ((sitesRes.data || []) as SiteRow[]).map((s) =>
        mapSiteRow(s, assignedWorkersBySite.get(s.id) || [])
      ),
      phases: ((phasesRes.data || []) as WorkPhaseRow[]).map(mapPhaseRow),
      equipment: ((equipmentRes.data || []) as EquipmentRow[]).map(mapEquipmentRow),
      timeEntries: ((timeEntriesRes.data || []) as TimeEntryRow[]).map(
        mapTimeEntryRow
      ),
      materialLogs: ((materialLogsRes.data || []) as MaterialLogRow[]).map(
        mapMaterialLogRow
      ),
      equipmentLogs: ((equipmentLogsRes.data || []) as EquipmentLogRow[]).map(
        mapEquipmentLogRow
      ),
      photoLogs: photoRows.map((row) => mapPhotoLogRow(row, signedUrlMap)),
    };
  },

  async fetchNextSiteCode(year = new Date().getFullYear()): Promise<string> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('next_site_code', {
      p_year: year,
    });
    if (error) throw mapDatabaseError(error);
    return String(data);
  },

  async fetchNextEquipmentCode(): Promise<string> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('next_equipment_code');
    if (error) throw mapDatabaseError(error);
    return String(data);
  },

  // SITES & WORKERS ASSIGNMENT
  async createSite(
    payload: Omit<Site, 'id' | 'progress' | 'assignedWorkerIds' | 'version'>
  ): Promise<Site> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('sites')
      .insert({
        code: payload.code.trim(),
        name: payload.name.trim(),
        client: payload.client.trim(),
        address: payload.address.trim(),
        city: payload.city.trim(),
        sectors: payload.sectors,
        status: payload.status,
        start_date: payload.startDate,
        end_date: payload.endDate,
        description: payload.description.trim(),
        progress: 0,
      })
      .select()
      .single();

    if (error) throw mapDatabaseError(error);
    return mapSiteRow(data as SiteRow, []);
  },

  async updateSite(site: Site): Promise<Site> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('sites')
      .update({
        code: site.code.trim(),
        name: site.name.trim(),
        client: site.client.trim(),
        address: site.address.trim(),
        city: site.city.trim(),
        sectors: site.sectors,
        status: site.status,
        start_date: site.startDate,
        end_date: site.endDate,
        description: site.description.trim(),
      })
      .eq('id', site.id)
      .eq('version', site.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapSiteRow(data as SiteRow, site.assignedWorkerIds);
  },

  async updateSiteStatus(
    site: Site,
    status: Site['status'],
    progress?: number
  ): Promise<Site> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('sites')
      .update({
        status,
        progress: progress !== undefined ? progress : site.progress,
      })
      .eq('id', site.id)
      .eq('version', site.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapSiteRow(data as SiteRow, site.assignedWorkerIds);
  },

  async setWorkerSiteAssignment(
    siteId: string,
    workerId: string,
    assign: boolean,
    actorId: string
  ): Promise<void> {
    const client = requireSupabase();
    if (assign) {
      const { error } = await client
        .from('site_workers')
        .upsert(
          { site_id: siteId, worker_id: workerId, assigned_by: actorId },
          { onConflict: 'site_id,worker_id', ignoreDuplicates: true }
        );
      if (error) throw mapDatabaseError(error);
    } else {
      const { error } = await client
        .from('site_workers')
        .delete()
        .eq('site_id', siteId)
        .eq('worker_id', workerId);
      if (error) throw mapDatabaseError(error);
    }
  },

  async deleteSite(siteId: string, expectedVersion: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_site', {
      p_site_id: siteId,
      p_expected_version: expectedVersion,
    });
    if (error) throw mapDatabaseError(error);
  },

  // PHASES
  async createPhase(phase: Omit<WorkPhase, 'id' | 'version'>): Promise<WorkPhase> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('work_phases')
      .insert({
        site_id: phase.siteId,
        phase_order: phase.order,
        title: phase.title.trim(),
        description: phase.description.trim(),
        start_date: phase.startDate,
        end_date: phase.endDate,
        status: phase.status,
        progress: phase.progress,
      })
      .select()
      .single();

    if (error) throw mapDatabaseError(error);
    return mapPhaseRow(data as WorkPhaseRow);
  },

  async updatePhase(phase: WorkPhase, isWorkerActor: boolean): Promise<WorkPhase> {
    const client = requireSupabase();
    const patch = isWorkerActor
      ? { status: phase.status, progress: phase.progress }
      : {
          phase_order: phase.order,
          title: phase.title.trim(),
          description: phase.description.trim(),
          start_date: phase.startDate,
          end_date: phase.endDate,
          status: phase.status,
          progress: phase.progress,
        };

    const { data, error } = await client
      .from('work_phases')
      .update(patch)
      .eq('id', phase.id)
      .eq('version', phase.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapPhaseRow(data as WorkPhaseRow);
  },

  async deletePhase(phaseId: string, expectedVersion: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_phase', {
      p_phase_id: phaseId,
      p_expected_version: expectedVersion,
    });
    if (error) throw mapDatabaseError(error);
  },

  // EQUIPMENT
  async createEquipment(eq: Omit<Equipment, 'id' | 'version'>): Promise<Equipment> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('equipment')
      .insert({
        code: eq.code.trim(),
        name: eq.name.trim(),
        category: eq.category,
        serial_or_plate: eq.serialOrPlate.trim() || 'N/D',
        status: eq.status === 'In Manutenzione' ? 'In Manutenzione' : 'Disponibile',
        notes: eq.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw mapDatabaseError(error);
    return mapEquipmentRow(data as EquipmentRow);
  },

  async updateEquipment(eq: Equipment): Promise<Equipment> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('equipment')
      .update({
        code: eq.code.trim(),
        name: eq.name.trim(),
        category: eq.category,
        serial_or_plate: eq.serialOrPlate.trim() || 'N/D',
        status: eq.status === 'In Manutenzione' ? 'In Manutenzione' : 'Disponibile',
        notes: eq.notes?.trim() || null,
      })
      .eq('id', eq.id)
      .eq('version', eq.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapEquipmentRow(data as EquipmentRow);
  },

  async deleteEquipment(equipmentId: string, expectedVersion: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_equipment', {
      p_equipment_id: equipmentId,
      p_expected_version: expectedVersion,
    });
    if (error) throw mapDatabaseError(error);
  },

  // EQUIPMENT USAGE LOGS
  async createEquipmentUsageLog(params: {
    equipmentId: string;
    equipmentName: string;
    siteId: string;
    actorId?: string;
    actorName: string;
    actorRole: 'Admin' | 'Dipendente';
    hoursUsed?: number;
    timestamp?: string;
    notes?: string;
    clientRequestId?: string;
  }): Promise<EquipmentLog> {
    const client = requireSupabase();
    const requestId = params.clientRequestId || generateUuid();
    const validHours =
      params.hoursUsed !== undefined &&
      !Number.isNaN(params.hoursUsed) &&
      params.hoursUsed > 0
        ? params.hoursUsed
        : null;

    const { data, error } = await client
      .from('equipment_logs')
      .insert({
        equipment_id: params.equipmentId,
        equipment_name: params.equipmentName,
        site_id: params.siteId,
        actor_id: params.actorId || null,
        actor_name: params.actorName,
        actor_role: params.actorRole,
        logged_at: localTimestampToIso(params.timestamp),
        hours_used: validHours,
        notes: params.notes?.trim() || null,
        client_request_id: requestId,
      })
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' &&
        `${error.message || ''} ${error.details || ''}`.includes('client_request_id')
      ) {
        const { data: existing, error: fetchErr } = await client
          .from('equipment_logs')
          .select('*')
          .eq('client_request_id', requestId)
          .single();
        if (!fetchErr && existing) {
          return mapEquipmentLogRow(existing as EquipmentLogRow);
        }
      }
      throw mapDatabaseError(error);
    }
    return mapEquipmentLogRow(data as EquipmentLogRow);
  },

  async updateEquipmentLog(log: EquipmentLog, isWorkerActor: boolean): Promise<EquipmentLog> {
    const client = requireSupabase();
    const validHours =
      log.hoursUsed !== undefined &&
      !Number.isNaN(log.hoursUsed) &&
      log.hoursUsed > 0
        ? log.hoursUsed
        : null;

    const patch = isWorkerActor
      ? {
          equipment_id: log.equipmentId,
          equipment_name: log.equipmentName,
          logged_at: localTimestampToIso(log.timestamp),
          hours_used: validHours,
          notes: log.notes?.trim() || null,
        }
      : {
          equipment_id: log.equipmentId,
          equipment_name: log.equipmentName,
          actor_id: log.actorId || null,
          actor_name: log.actorName,
          actor_role: log.actorRole,
          logged_at: localTimestampToIso(log.timestamp),
          hours_used: validHours,
          notes: log.notes?.trim() || null,
        };

    const { data, error } = await client
      .from('equipment_logs')
      .update(patch)
      .eq('id', log.id)
      .eq('version', log.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapEquipmentLogRow(data as EquipmentLogRow);
  },

  async deleteEquipmentLog(id: string, expectedVersion?: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_equipment_log', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });
    if (error) throw mapDatabaseError(error);
  },

  // TIME ENTRIES
  async createTimeEntry(
    entry: Omit<TimeEntry, 'id' | 'createdAt' | 'version'> & {
      clientRequestId?: string;
    }
  ): Promise<TimeEntry> {
    const client = requireSupabase();
    const requestId = entry.clientRequestId || generateUuid();
    const { data, error } = await client
      .from('time_entries')
      .insert({
        site_id: entry.siteId,
        phase_id: entry.phaseId || null,
        worker_id: entry.workerId,
        worker_name: entry.workerName,
        work_date: entry.date,
        regular_hours: entry.regularHours,
        description: entry.description.trim(),
        client_request_id: requestId,
      })
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' &&
        `${error.message || ''} ${error.details || ''}`.includes('client_request_id')
      ) {
        const { data: existing, error: fetchErr } = await client
          .from('time_entries')
          .select('*')
          .eq('client_request_id', requestId)
          .single();
        if (!fetchErr && existing) {
          return mapTimeEntryRow(existing as TimeEntryRow);
        }
      }
      throw mapDatabaseError(error);
    }
    return mapTimeEntryRow(data as TimeEntryRow);
  },

  async updateTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('time_entries')
      .update({
        phase_id: entry.phaseId || null,
        worker_id: entry.workerId,
        worker_name: entry.workerName,
        work_date: entry.date,
        regular_hours: entry.regularHours,
        description: entry.description.trim(),
      })
      .eq('id', entry.id)
      .eq('version', entry.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapTimeEntryRow(data as TimeEntryRow);
  },

  async deleteTimeEntry(id: string, expectedVersion?: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_time_entry', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });
    if (error) throw mapDatabaseError(error);
  },

  // MATERIAL LOGS
  async createMaterialLog(
    log: Omit<MaterialLog, 'id' | 'createdAt' | 'version'> & {
      clientRequestId?: string;
    }
  ): Promise<MaterialLog> {
    const client = requireSupabase();
    const requestId = log.clientRequestId || generateUuid();
    const { data, error } = await client
      .from('material_logs')
      .insert({
        site_id: log.siteId,
        phase_id: log.phaseId || null,
        worker_id: log.workerId,
        worker_name: log.workerName,
        log_date: log.date,
        article_code: log.articleCode?.trim() || null,
        material_name: log.materialName?.trim() || null,
        category: log.category,
        quantity: log.quantity,
        unit: log.unit,
        notes: log.notes?.trim() || null,
        client_request_id: requestId,
      })
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' &&
        `${error.message || ''} ${error.details || ''}`.includes('client_request_id')
      ) {
        const { data: existing, error: fetchErr } = await client
          .from('material_logs')
          .select('*')
          .eq('client_request_id', requestId)
          .single();
        if (!fetchErr && existing) {
          return mapMaterialLogRow(existing as MaterialLogRow);
        }
      }
      throw mapDatabaseError(error);
    }
    return mapMaterialLogRow(data as MaterialLogRow);
  },

  async updateMaterialLog(log: MaterialLog, isWorkerActor: boolean): Promise<MaterialLog> {
    const client = requireSupabase();
    const patch = isWorkerActor
      ? {
          phase_id: log.phaseId || null,
          log_date: log.date,
          article_code: log.articleCode?.trim() || null,
          material_name: log.materialName?.trim() || null,
          category: log.category,
          quantity: log.quantity,
          unit: log.unit,
          notes: log.notes?.trim() || null,
        }
      : {
          phase_id: log.phaseId || null,
          worker_id: log.workerId,
          worker_name: log.workerName,
          log_date: log.date,
          article_code: log.articleCode?.trim() || null,
          material_name: log.materialName?.trim() || null,
          category: log.category,
          quantity: log.quantity,
          unit: log.unit,
          notes: log.notes?.trim() || null,
        };

    const { data, error } = await client
      .from('material_logs')
      .update(patch)
      .eq('id', log.id)
      .eq('version', log.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
    return mapMaterialLogRow(data as MaterialLogRow);
  },

  async deleteMaterialLog(id: string, expectedVersion?: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_material_log', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });
    if (error) throw mapDatabaseError(error);
  },

  // PHOTO LOGS + OBJECT STORAGE
  async uploadPhotoBlob(
    siteId: string,
    userId: string,
    blob: Blob
  ): Promise<string> {
    const client = requireSupabase();
    const path = `${siteId}/${userId}/${generateUuid()}.jpg`;
    const { error } = await client.storage
      .from('site-photos')
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw mapDatabaseError(error, 'Errore caricamento fotografia sullo storage.');
    }
    return path;
  },

  async createPhotoLogs(
    photos: Array<{
      siteId: string;
      phaseId: string;
      workerId: string;
      workerName: string;
      uploaderRole: UserRole;
      date: string;
      blob: Blob;
      caption: string;
      tag: PhotoLog['tag'];
    }>
  ): Promise<void> {
    if (photos.length === 0) return;
    const client = requireSupabase();

    const uploaded = await Promise.all(
      photos.map(async (item) => {
        const storagePath = await this.uploadPhotoBlob(
          item.siteId,
          item.workerId,
          item.blob
        );
        return { item, storagePath };
      })
    );

    const { error } = await client.from('photo_logs').insert(
      uploaded.map(({ item, storagePath }) => ({
        site_id: item.siteId,
        phase_id: item.phaseId || null,
        worker_id: item.workerId,
        worker_name: item.workerName,
        uploader_role: item.uploaderRole,
        photo_date: item.date,
        storage_path: storagePath,
        caption: item.caption.trim(),
        tag: item.tag,
      }))
    );

    if (error) throw mapDatabaseError(error);
  },

  async updatePhotoLog(params: {
    photo: PhotoLog;
    newBlob?: Blob;
    actorId: string;
  }): Promise<void> {
    const client = requireSupabase();
    const { photo, newBlob, actorId } = params;
    let storagePath = photo.storagePath;

    if (newBlob) {
      storagePath = await this.uploadPhotoBlob(photo.siteId, actorId, newBlob);
    }

    const { data, error } = await client
      .from('photo_logs')
      .update({
        phase_id: photo.phaseId || null,
        tag: photo.tag,
        caption: photo.caption.trim(),
        storage_path: storagePath,
      })
      .eq('id', photo.id)
      .eq('version', photo.version)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) throw mapDatabaseError(error);
    if (!data) throw new ConcurrencyConflictError();
  },

  async deletePhotoLog(id: string, expectedVersion?: number): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('soft_delete_photo_log', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });
    if (error) throw mapDatabaseError(error);
  },

  // ACCOUNT MANAGEMENT (SOLO ADMIN VIA EDGE FUNCTION `manage-users`)
  async createUserAccount(params: {
    firstName: string;
    lastName: string;
    role: UserRole;
    workerType?: WorkerType;
    password: string;
    customUsername?: string;
  }): Promise<{ username: string; name: string }> {
    const res = await invokeManageUsers<{ user: ProfileRow }>({
      action: 'create_user',
      ...params,
    });
    return {
      username: res.user.username,
      name: res.user.full_name || res.user.first_name,
    };
  },

  async updateUserAccount(params: {
    userId: string;
    firstName: string;
    lastName: string;
    workerType?: WorkerType;
    expectedVersion: number;
  }): Promise<void> {
    await invokeManageUsers<{ user: ProfileRow }>({
      action: 'update_user',
      ...params,
    });
  },

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await invokeManageUsers<{ ok: boolean }>({
      action: 'reset_password',
      userId,
      newPassword,
    });
  },

  async setUserActive(
    userId: string,
    active: boolean,
    expectedVersion: number
  ): Promise<void> {
    await invokeManageUsers<{ user: ProfileRow }>({
      action: 'set_active',
      userId,
      active,
      expectedVersion,
    });
  },
};
