#!/bin/bash
set -euo pipefail

DATE=$(date +%Y-%m-%d_%H-%M)
DIR="./backups/$DATE"
mkdir -p "$DIR"

echo "=== BACKUP BẮT ĐẦU: $DATE ==="

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL chưa được set. Hãy export DATABASE_URL trước."
  exit 1
fi

PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PSQL_BIN="${PSQL_BIN:-psql}"

echo "1/2 Backup database dump..."
"$PG_DUMP_BIN" "$DATABASE_URL" \
  --no-owner --no-acl \
  --format=custom \
  -f "$DIR/database.dump"

echo "2/2 Export JSONL bảng legacy..."
"$PSQL_BIN" "$DATABASE_URL" -c "\COPY (SELECT row_to_json(p) FROM public.persons p) TO '$DIR/persons.jsonl'"
"$PSQL_BIN" "$DATABASE_URL" -c "\COPY (SELECT row_to_json(r) FROM public.relationships r) TO '$DIR/relationships.jsonl'"

echo "=== BACKUP XONG: $DIR ==="
echo "Restore khi cần: pg_restore --clean --if-exists -d \$DATABASE_URL $DIR/database.dump"
