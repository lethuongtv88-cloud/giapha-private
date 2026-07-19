#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="$(basename "$ROOT")"
DATE="$(date +%Y%m%d-%H%M)"
OUT="${PROJECT}-source-${DATE}.zip"

echo "======================================"
echo " Packaging ${PROJECT}"
echo "======================================"

rm -f "$OUT"

zip -r "$OUT" . \
\
-x ".git/*" \
-x ".github/workflows/*.log" \
\
-x "node_modules/*" \
-x ".next/*" \
-x ".turbo/*" \
-x "coverage/*" \
\
-x ".env" \
-x ".env.local" \
-x ".env.production" \
-x ".env.development" \
\
-x "backups/*" \
-x "schema-review/*" \
-x "giapha-review/*" \
-x "dist-sql/*" \
\
-x "*.zip" \
-x "*.tar" \
-x "*.tar.gz" \
-x "*.sql" \
-x "*.dump" \
-x "*.bak" \
\
-x "*.ged" \
-x "*.GED" \
\
-x "screenshots/*" \
-x "screenshot/*" \
-x "Screenshot/*" \
-x "Screenshots/*" \
\
-x "*.png" \
-x "*.jpg" \
-x "*.jpeg" \
-x "*.webp" \
\
-x ".DS_Store" \
-x "Thumbs.db"

echo
echo "Done!"
echo
ls -lh "$OUT"
