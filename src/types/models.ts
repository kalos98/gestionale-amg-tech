export type UserRole = 'admin' | 'worker';

export type SiteSector =
  | 'Edilizia'
  | 'Termico'
  | 'Elettrico'
  | 'Idrico'
  | 'Rinnovabili';

export type SiteStatus = 'Pianificato' | 'In Corso' | 'Sospeso' | 'Completato';

export type PhaseStatus = 'Da Iniziare' | 'In Corso' | 'Completata';

export type EquipmentCategory =
  | 'Mezzo / Veicolo'
  | 'Macchinario Cantiere'
  | 'Attrezzatura Elettrica / Impianti'
  | 'Strumento di Misura & Collaudo'
  | 'Ponteggio & Sicurezza';

export type EquipmentStatus = 'Disponibile' | 'In Manutenzione';

export type WorkerType = 'Edilizia' | 'Impiantistica';

export interface AuthUserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string;
  role: UserRole;
  workerType?: WorkerType;
  avatarInitials: string;
  active: boolean;
  isRootAdmin: boolean;
  onboardingCompletedAt: string | null;
  version: number;
}

export interface AdminUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string;
  avatarInitials: string;
  active: boolean;
  isRootAdmin: boolean;
  version: number;
  createdAt: string;
}

export interface Worker {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string; // Nome + Cognome
  type: WorkerType;
  avatarInitials: string;
  active: boolean;
  version: number;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  serialOrPlate: string;
  status: EquipmentStatus;
  notes?: string;
  version: number;
}

export interface WorkPhase {
  id: string;
  siteId: string;
  order: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  progress: number; // 0 - 100
  version: number;
}

export interface Site {
  id: string;
  code: string;
  name: string;
  client: string;
  address: string;
  city: string;
  sectors: SiteSector[];
  status: SiteStatus;
  startDate: string;
  endDate: string;
  description: string;
  progress: number;
  assignedWorkerIds: string[];
  version: number;
}

export interface TimeEntry {
  id: string;
  siteId: string;
  phaseId: string;
  workerId: string;
  workerName: string;
  date: string;
  regularHours: number;
  description: string;
  createdAt: string;
  version: number;
}

export interface MaterialLog {
  id: string;
  siteId: string;
  phaseId: string;
  workerId: string;
  workerName: string;
  date: string;
  articleCode?: string;
  materialName?: string;
  category: 'Edilizia' | 'Elettrico' | 'Idraulico' | 'Sicurezza/Ferramenta';
  quantity: number;
  unit: 'pz' | 'm' | 'mq' | 'kg' | 'sacchi' | 'rotoli' | 'litri';
  notes?: string;
  createdAt: string;
  version: number;
}

export type PhotoTag =
  | 'Avanzamento Lavori'
  | 'Anomalia'
  | 'Fine lavori';

export interface PhotoLog {
  id: string;
  siteId: string;
  phaseId: string;
  workerId: string;
  workerName: string;
  uploaderRole: UserRole;
  date: string;
  imageUrl: string;
  storagePath: string;
  caption: string;
  tag: PhotoTag;
  createdAt: string;
  version: number;
}

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  equipmentName: string;
  siteId: string;
  actorId?: string;
  actorName: string;
  actorRole: 'Admin' | 'Dipendente';
  timestamp: string;
  hoursUsed?: number;
  notes?: string;
  version: number;
}

export interface AppDatabase {
  admins: AdminUser[];
  sites: Site[];
  phases: WorkPhase[];
  workers: Worker[];
  equipment: Equipment[];
  timeEntries: TimeEntry[];
  materialLogs: MaterialLog[];
  photoLogs: PhotoLog[];
  equipmentLogs: EquipmentLog[];
}
