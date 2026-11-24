export const AUTH_EMAIL_DOMAIN = (
  import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'amgtech.internal'
)
  .trim()
  .toLowerCase();

export const USERNAME_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

/**
 * Normalizes a first or last name segment into lowercase ASCII [a-z0-9]
 * (accents removed, spaces and punctuation stripped).
 */
export function normalizeUsernameSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Builds the canonical `nome.cognome` username from first and last name.
 */
export function buildUsername(firstName: string, lastName: string): string {
  const first = normalizeUsernameSegment(firstName);
  const last = normalizeUsernameSegment(lastName);
  if (first && last) return `${first}.${last}`;
  return first || last;
}

/**
 * Normalizes user-typed username on login or custom username edit.
 */
export function normalizeLoginUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

/**
 * Maps a `nome.cognome` username to the internal Auth email identity.
 */
export function usernameToInternalEmail(username: string): string {
  const clean = normalizeLoginUsername(username);
  return `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

/**
 * Generates an initial temporary password that meets minimum complexity rules.
 */
export function generateTemporaryPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  const result: string[] = [];
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i += 1) {
      result.push(chars[bytes[i] % chars.length]);
    }
  } else {
    for (let i = 0; i < length; i += 1) {
      result.push(chars[Math.floor(Math.random() * chars.length)]);
    }
  }
  return result.join('');
}
