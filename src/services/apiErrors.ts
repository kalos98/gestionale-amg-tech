export class ConcurrencyConflictError extends Error {
  readonly code = 'CONCURRENCY_CONFLICT';
  constructor(
    message = 'I dati sono stati modificati nel frattempo da un altro utente. I dati aggiornati sono stati ricaricati.'
  ) {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED';
  constructor(
    message = 'Permesso negato per questa operazione.'
  ) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

interface RawDbError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export function mapDatabaseError(
  err: unknown,
  fallbackMessage = 'Operazione non riuscita. Riprova.'
): Error {
  if (
    err instanceof ConcurrencyConflictError ||
    err instanceof PermissionDeniedError ||
    err instanceof ValidationError
  ) {
    return err;
  }

  const dbErr = (err || {}) as RawDbError;
  const code = String(dbErr.code || '');
  const msg = String(dbErr.message || '');

  if (code === '40001' || msg.includes('CONCURRENCY_CONFLICT')) {
    return new ConcurrencyConflictError();
  }

  if (code === '42501' || msg.includes('PERMISSION_DENIED')) {
    return new PermissionDeniedError(
      'Non hai i permessi necessari per eseguire questa operazione.'
    );
  }

  if (msg.includes('ROOT_ADMIN_PROTECTED')) {
    return new ValidationError(
      "Impossibile disattivare o modificare il ruolo dell'amministratore originario."
    );
  }

  if (msg.includes('LAST_ADMIN_PROTECTED')) {
    return new ValidationError(
      'Deve rimanere almeno un amministratore attivo nel sistema.'
    );
  }

  if (code === '23505') {
    if (msg.includes('sites_code_upper_uidx')) {
      return new ValidationError(
        'Codice cantiere già esistente: scegline uno diverso.'
      );
    }
    if (msg.includes('equipment_code_upper_uidx')) {
      return new ValidationError(
        'Codice mezzo/attrezzatura già esistente: scegline uno diverso.'
      );
    }
    if (msg.includes('profiles_username_lower_uidx')) {
      return new ValidationError('Username già in uso.');
    }
    return new ValidationError('Elemento duplicato: valore già registrato.');
  }

  if (code === '23514' || code === '22P02' || code === '23502') {
    return new ValidationError(
      'Alcuni dati inseriti non rispettano i vincoli richiesti. Verifica i campi e riprova.'
    );
  }

  if (err instanceof Error && err.message) {
    return new Error(err.message);
  }

  return new Error(fallbackMessage);
}

export function toFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return 'Si è verificato un errore imprevisto.';
}
