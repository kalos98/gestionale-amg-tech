import { Equipment, EquipmentLog, PhaseStatus } from '../types/models';

export function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Returns YYYY-MM-DD in the user's local timezone, optionally offset by days.
 */
export function getLocalDateString(offsetDays = 0): string {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-DD HH:mm strictly in local timezone.
 */
export function formatLocalTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Converts an ISO timestamp string to local YYYY-MM-DD HH:mm.
 */
export function formatIsoToLocalTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return String(iso);
  return formatLocalTimestamp(parsed);
}

/**
 * Converts a local `YYYY-MM-DD HH:mm` (or `YYYY-MM-DD`) string into an ISO 8601 UTC string.
 */
export function localTimestampToIso(ts: string | undefined): string {
  if (!ts) return new Date().toISOString();
  const trimmed = ts.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(trimmed);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      0
    ).toISOString();
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nextSequentialCode(
  existingCodes: string[],
  prefix: string,
  padLength = 2
): string {
  const existingSet = new Set(existingCodes.map((c) => c.trim().toUpperCase()));
  let maxNum = 0;

  existingCodes.forEach((code) => {
    if (code.startsWith(prefix)) {
      const suffix = code.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const parsed = parseInt(suffix, 10);
        if (parsed > maxNum) maxNum = parsed;
      }
    }
  });

  let next = maxNum + 1;
  let candidate = `${prefix}${String(next).padStart(padLength, '0')}`;
  while (existingSet.has(candidate.toUpperCase())) {
    next += 1;
    candidate = `${prefix}${String(next).padStart(padLength, '0')}`;
  }
  return candidate;
}

export function phaseStatusFromProgress(progress: number): PhaseStatus {
  if (progress === 100) return 'Completata';
  if (progress > 0) return 'In Corso';
  return 'Da Iniziare';
}

export function autoProgressFromPhaseStatus(
  status: PhaseStatus,
  currentProgress: number
): number {
  if (status === 'Completata') return 100;
  if (status === 'Da Iniziare') return 0;
  return currentProgress === 0 || currentProgress === 100 ? 50 : currentProgress;
}

interface EquipmentHoursSummaryItem {
  equipmentId: string;
  code: string;
  name: string;
  hours: number;
}

export function aggregateEquipmentHours(
  logs: EquipmentLog[],
  equipmentList: Equipment[]
): {
  totals: EquipmentHoursSummaryItem[];
  totalHours: number;
} {
  const eqById = new Map(equipmentList.map((e) => [e.id, e]));
  const map = new Map<string, EquipmentHoursSummaryItem>();
  let totalHours = 0;

  logs.forEach((log) => {
    if (log.hoursUsed && log.hoursUsed > 0) {
      const eq = eqById.get(log.equipmentId);
      totalHours += log.hoursUsed;
      const prev = map.get(log.equipmentId) || {
        equipmentId: log.equipmentId,
        code: eq?.code || 'MEZ',
        name: log.equipmentName,
        hours: 0,
      };
      prev.hours += log.hoursUsed;
      map.set(log.equipmentId, prev);
    }
  });

  return {
    totals: Array.from(map.values()),
    totalHours,
  };
}

export function compareByDateDesc(
  a: { date?: string; createdAt?: string },
  b: { date?: string; createdAt?: string }
): number {
  return (
    (b.date || '').localeCompare(a.date || '') ||
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export function buildGoogleMapsUrl(address: string, city: string): string {
  const query = [address, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
