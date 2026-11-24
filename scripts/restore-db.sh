#!/usr/bin/env bash
set -euo pipefail
umask 077

# ==============================================================================
# Gestionale AMG Tech - Ripristino verificato da Backup DB Cifrato (.tar.gz.gpg)
# Uso:
#   BACKUP_ENCRYPTION_PASSPHRASE="..." ./scripts/restore-db.sh <file.gpg> <DATABASE_URL> --confirm-restore
# ==============================================================================

if [[ $# -lt 2 ]]; then
  echo "Uso: $0 <backup.tar.gz.gpg> <TARGET_DATABASE_URL> --confirm-restore" >&2
  exit 1
fi

ENCRYPTED_FILE="$1"
TARGET_DATABASE_URL="$2"
CONFIRM_FLAG="${3:-}"

if [[ "$CONFIRM_FLAG" != "--confirm-restore" ]]; then
  echo "Operazione annullata per sicurezza: passa esplicitamente '--confirm-restore' come terzo argomento." >&2
  exit 1
fi

if [[ ! -f "$ENCRYPTED_FILE" ]]; then
  echo "Errore: file backup '$ENCRYPTED_FILE' non trovato." >&2
  exit 1
fi

if [[ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]]; then
  echo "Errore: variabile BACKUP_ENCRYPTION_PASSPHRASE non impostata." >&2
  exit 1
fi

for bin in gpg tar pg_restore; do
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

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -m 700 "$TMP_DIR/gnupg"
export GNUPGHOME="$TMP_DIR/gnupg"

echo "[1/4] Decifratura archivio GPG..."
gpg \
  --batch \
  --yes \
  --pinentry-mode loopback \
  --decrypt \
  --passphrase-fd 3 \
  --output "$TMP_DIR/archive.tar.gz" \
  "$ENCRYPTED_FILE" \
  3<<<"$BACKUP_ENCRYPTION_PASSPHRASE"

echo "[2/4] Estrazione dump e verifica checksum SHA-256..."
tar -C "$TMP_DIR" -xzf "$TMP_DIR/archive.tar.gz"

SHA_FILE="$(find "$TMP_DIR" -maxdepth 1 -type f -name '*.sha256' | head -n 1)"
DUMP_FILE="$(find "$TMP_DIR" -maxdepth 1 -type f -name '*.dump' | head -n 1)"

if [[ -z "$SHA_FILE" || -z "$DUMP_FILE" ]]; then
  echo "Errore: archivio backup incompleto (file .dump o .sha256 mancanti)." >&2
  exit 1
fi

EXPECTED_SHA="$(awk '{print $1}' "$SHA_FILE")"
ACTUAL_SHA="$(compute_sha256 "$DUMP_FILE")"

if [[ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]]; then
  echo "ERRORE CRITICO: checksum SHA-256 non corrispondente! Ripristino bloccato." >&2
  exit 1
fi

echo "[3/4] Checksum verificato ($ACTUAL_SHA). Avvio pg_restore..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$TARGET_DATABASE_URL" \
  "$DUMP_FILE"

echo "[4/4] Ripristino database completato con successo."
