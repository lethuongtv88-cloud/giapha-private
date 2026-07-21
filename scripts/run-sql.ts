#!/usr/bin/env tsx
/**
 * Chạy trực tiếp 1 (hoặc nhiều) file .sql vào database Postgres của Supabase,
 * không cần mở Supabase SQL Editor trên web.
 *
 * QUAN TRỌNG: Service Role Key (SUPABASE_SERVICE_ROLE_KEY) KHÔNG dùng được ở đây.
 * Key đó chỉ dùng cho supabase-js gọi qua REST/PostgREST (select/insert/rpc...),
 * không thể chạy DDL thô (CREATE POLICY, ALTER TABLE, CREATE FUNCTION...).
 * Để chạy SQL thô cần connection string Postgres thật (user/password/host),
 * lấy ở Supabase Dashboard > Project Settings > Database > Connection string
 * (dùng "Session pooler" hoặc "Direct connection", KHÔNG phải anon/service key).
 *
 * Set biến này trong .env.local (đặt tên DATABASE_URL, hoặc tái dùng
 * DATABASE_BACKUP_URL đã có sẵn trong .env.example):
 *   DATABASE_URL="postgresql://postgres:MATKHAU@db.xxxx.supabase.co:5432/postgres?sslmode=require"
 *
 * Cách dùng:
 *   npx tsx scripts/run-sql.ts supabase/migrations/061_xxx.sql
 *   npx tsx scripts/run-sql.ts supabase/migrations/*.sql        (chạy nhiều file, theo thứ tự tên)
 *   npx tsx scripts/run-sql.ts --pending                        (chạy các migration CHƯA chạy, tự track)
 *
 * An toàn:
 * - Mỗi file được chạy trong 1 transaction riêng (BEGIN...COMMIT tự động của
 *   postgres.js qua sql.begin()). Nếu file có lỗi -> ROLLBACK toàn bộ file đó,
 *   các file trước đó (đã COMMIT) không bị ảnh hưởng.
 * - Nếu file tự chứa BEGIN/COMMIT riêng, đoạn đó sẽ lồng vào transaction ngoài
 *   (Postgres cho phép, chỉ COMMIT ngoài cùng mới thực sự ghi xuống đĩa).
 * - Luôn nên chạy `bun run backup:db` (hoặc script backup) TRƯỚC khi chạy repair.
 */

import postgres from "postgres";
import { config as dotenvConfig } from "dotenv";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { basename } from "node:path";

dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: ".env" });

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_BACKUP_URL;
  if (!url) {
    console.error(
      "Thiếu DATABASE_URL / SUPABASE_DB_URL / DATABASE_BACKUP_URL trong .env.local.\n" +
        "Lấy connection string Postgres tại: Supabase Dashboard > Project Settings > Database > Connection string.\n" +
        "Đây KHÔNG phải là SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }
  return url;
}

const TRACK_TABLE = "public._manual_sql_runs";

async function ensureTrackingTable(sql: postgres.Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(TRACK_TABLE)} (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `.catch(async () => {
    // sql() helper không nhận tên có schema dạng "public.x" trực tiếp -> fallback raw
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ${TRACK_TABLE} (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  });
}

async function alreadyApplied(sql: postgres.Sql, filename: string) {
  const rows = await sql.unsafe(
    `SELECT 1 FROM ${TRACK_TABLE} WHERE filename = $1`,
    [filename]
  );
  return rows.length > 0;
}

async function markApplied(sql: postgres.Sql, filename: string) {
  await sql.unsafe(
    `INSERT INTO ${TRACK_TABLE} (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
    [filename]
  );
}

async function runFile(sql: postgres.Sql, path: string) {
  const filename = basename(path);
  const content = readFileSync(path, "utf8");
  console.log(`\n>> Đang chạy: ${filename}`);
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
    });
    await markApplied(sql, filename);
    console.log(`   OK - đã commit: ${filename}`);
    return true;
  } catch (err: any) {
    console.error(`   LỖI trong ${filename}: ${err.message ?? err}`);
    console.error("   -> Đã tự động ROLLBACK, file này chưa được áp dụng.");
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Dùng: npx tsx scripts/run-sql.ts <file1.sql> [file2.sql ...] | --pending"
    );
    process.exit(1);
  }

  const databaseUrl = getDatabaseUrl();
  const sql = postgres(databaseUrl, {
    ssl: "require",
    max: 1,
    onnotice: (n) => console.log(`   [NOTICE] ${n.message}`),
  });

  try {
    await ensureTrackingTable(sql);

    let files: string[] = [];

    if (args[0] === "--pending") {
      const { readdirSync } = await import("node:fs");
      const dir = "supabase/migrations";
      files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => `${dir}/${f}`);
    } else {
      files = args;
    }

    let successCount = 0;
    for (const file of files) {
      if (!existsSync(file)) {
        console.error(`Bỏ qua - không tìm thấy file: ${file}`);
        continue;
      }
      const filename = basename(file);
      if (args[0] === "--pending" && (await alreadyApplied(sql, filename))) {
        console.log(`- Bỏ qua (đã chạy trước đó): ${filename}`);
        continue;
      }
      const ok = await runFile(sql, file);
      if (ok) successCount++;
      else {
        console.error("\nDừng lại vì có lỗi. Sửa file rồi chạy lại.");
        break;
      }
    }

    console.log(`\nHoàn tất: ${successCount}/${files.length} file chạy thành công.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Lỗi không mong muốn:", err);
  process.exit(1);
});
