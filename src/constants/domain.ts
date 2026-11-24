import {
  EquipmentCategory,
  EquipmentStatus,
  MaterialLog,
  PhaseStatus,
  PhotoTag,
  SiteSector,
  SiteStatus,
  WorkerType,
} from '../types/models';

export const SITE_SECTORS: SiteSector[] = [
  'Edilizia',
  'Termico',
  'Elettrico',
  'Idrico',
  'Rinnovabili',
];

export const SITE_STATUSES: SiteStatus[] = [
  'Pianificato',
  'In Corso',
  'Sospeso',
  'Completato',
];

export const PHASE_STATUSES: PhaseStatus[] = [
  'Da Iniziare',
  'In Corso',
  'Completata',
];

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'Mezzo / Veicolo',
  'Macchinario Cantiere',
  'Attrezzatura Elettrica / Impianti',
  'Strumento di Misura & Collaudo',
  'Ponteggio & Sicurezza',
];

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'Disponibile',
  'In Manutenzione',
];

export const MATERIAL_CATEGORIES: MaterialLog['category'][] = [
  'Edilizia',
  'Elettrico',
  'Idraulico',
  'Sicurezza/Ferramenta',
];

export const MATERIAL_UNITS: MaterialLog['unit'][] = [
  'pz',
  'm',
  'mq',
  'kg',
  'sacchi',
  'rotoli',
  'litri',
];

export const PHOTO_TAGS: PhotoTag[] = [
  'Avanzamento Lavori',
  'Anomalia',
  'Fine lavori',
];

export const WORKER_TYPES: WorkerType[] = ['Edilizia', 'Impiantistica'];

export function getSiteStatusBadge(status: SiteStatus): string {
  switch (status) {
    case 'Pianificato':
      return 'bg-sky-500/10 text-sky-800 border-sky-300/80';
    case 'In Corso':
      return 'bg-blue-500/12 text-blue-800 border-blue-300/90';
    case 'Sospeso':
      return 'bg-amber-500/15 text-amber-900 border-amber-300/90';
    case 'Completato':
      return 'bg-emerald-500/15 text-emerald-800 border-emerald-400/90';
  }
}

export function getPhaseStatusBadge(status: PhaseStatus): string {
  switch (status) {
    case 'Da Iniziare':
      return 'bg-sky-500/10 text-sky-800 border-sky-300/80';
    case 'In Corso':
      return 'bg-blue-500/12 text-blue-800 border-blue-300/90';
    case 'Completata':
      return 'bg-emerald-500/15 text-emerald-800 border-emerald-400/90';
  }
}

export function getProgressColor(progress: number, isCompleted?: boolean): string {
  if (isCompleted || progress === 100) return 'bg-emerald-500';
  if (progress >= 30) return 'bg-blue-600';
  return 'bg-sky-500';
}

export function getSliderAccent(progress: number, isCompleted?: boolean): string {
  if (isCompleted || progress === 100) return 'accent-emerald-600';
  if (progress >= 30) return 'accent-blue-600';
  return 'accent-sky-500';
}
