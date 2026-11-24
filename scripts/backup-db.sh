#!/usr/bin/env bash
set -euo pipefail
umask 077

# ==============================================================================
# Gestionale AMG Tech - Backup DB PostgreSQL automatizzato e cifrato (AES-256 GPG)
# Variabili richieste:
#   DATABASE_URL                 Stringa di connessione PostgreSQL
#   BACKUP_ENCRYPTION_PASSPHRASE Passphrase di cifratura GPG (almeno 16 caratteri)
# Opzionali:
#   BACKUP_DIR                   Directory destinazione (default: ./backups)
#   BACKUP_RETENTION_DAYS        Giorni conservazione locale (default: 30)
# ==============================================================================

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Errore: variabile DATABASE_URL non impostata." >&2
  exit 1
fi

if [[ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]]; then
  echo "Errore: variabile BACKUP_ENCRYPTION_PASSPHRASE non impostata." >&2
  exit 1
fi

for bin in pg_dump tar gpg; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Errore: comando richiesto '$bin' non trovato nel PATH." >&2
    exit 1
  fi
done

compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP_NAME="amgtech-db-${TIMESTAMP}.dump"
SHA_NAME="${DUMP_NAME}.sha256"
ARCHIVE_NAME="amgtech-db-${TIMESTAMP}.tar.gz"
ENCRYPTED_NAME="${ARCHIVE_NAME}.gpg"
OUTPUT_PATH="${BACKUP_DIR%/}/${ENCRYPTED_NAME}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -m 700 "$TMP_DIR/gnupg"
export GNUPGHOME="$TMP_DIR/gnupg"

echo "[1/4] Esecuzione pg_dump (formato custom compresso)..."
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$TMP_DIR/$DUMP_NAME" \
  "$DATABASE_URL"

echo "[2/4] Calcolo checksum SHA-256 di integrità..."
DUMP_SHA="$(compute_sha256 "$TMP_DIR/$DUMP_NAME")"
printf '%s  %s\n' "$DUMP_SHA" "$DUMP_NAME" > "$TMP_DIR/$SHA_NAME"

echo "[3/4] Creazione archivio e cifratura simmetrica GPG AES-256..."
tar -C "$TMP_DIR" -czf "$TMP_DIR/$ARCHIVE_NAME" "$DUMP_NAME" "$SHA_NAME"
gpg \
  --batch \
  --yes \
  --pinentry-mode loopback \
  --symmetric \
  --cipher-algo AES256 \
  --passphrase-fd 3 \
  --output "$OUTPUT_PATH" \
  "$TMP_DIR/$ARCHIVE_NAME" \
  3<<<"$BACKUP_ENCRYPTION_PASSPHRASE"

chmod 600 "$OUTPUT_PATH"

echo "[4/4] Applicazione retention locale (${BACKUP_RETENTION_DAYS} giorni)..."
if [[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$BACKUP_RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'amgtech-db-*.tar.gz.gpg' -mtime +"$BACKUP_RETENTION_DAYS" -delete
fi

echo "Backup DB cifrato completato con successo: $OUTPUT_PATH"
