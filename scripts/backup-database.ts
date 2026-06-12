#!/usr/bin/env tsx

import { createGzip } from "node:zlib";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import dotenv from "dotenv";

// Load local env files when the script is run manually/through cron.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

type BackupFile = {
  name: string;
  path: string;
  sizeBytes: number;
  mtimeMs: number;
  mtimeIso: string;
};

const DEFAULT_KEEP_LAST = 14;
const DEFAULT_BACKUP_DIR = "backups/database";
const DEFAULT_PREFIX = "giapha-db";

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getDatabaseUrl() {
  return (
    getEnv("DATABASE_BACKUP_URL") ||
    getEnv("SUPABASE_DB_URL") ||
    getEnv("POSTGRES_URL") ||
    getEnv("DATABASE_URL")
  );
}

function getBackupDir() {
  return resolve(getEnv("BACKUP_DIR") || DEFAULT_BACKUP_DIR);
}

function getKeepLast() {
  const raw = getEnv("BACKUP_KEEP_LAST");
  if (!raw) return DEFAULT_KEEP_LAST;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`BACKUP_KEEP_LAST không hợp lệ: ${raw}. Giá trị phải là số nguyên >= 1.`);
  }

  return parsed;
}

function getPrefix() {
  return getEnv("BACKUP_PREFIX") || DEFAULT_PREFIX;
}

function timestampForFileName(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

function ensureBackupDir() {
  const dir = getBackupDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function listBackups(): BackupFile[] {
  const dir = ensureBackupDir();
  const prefix = getPrefix();

  return readdirSync(dir)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".sql.gz"))
    .map((name) => {
      const path = join(dir, name);
      const stat = statSync(path);
      return {
        name,
        path,
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        mtimeIso: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function printBackups(backups = listBackups()) {
  if (backups.length === 0) {
    console.log("Chưa có file backup nào.");
    return;
  }

  for (const [index, backup] of backups.entries()) {
    console.log(
      `${String(index + 1).padStart(2, "0")}. ${backup.name}  ${formatBytes(backup.sizeBytes)}  ${backup.mtimeIso}`,
    );
  }
}

function cleanupOldBackups(keepLast = getKeepLast()) {
  const backups = listBackups();
  const keep = backups.slice(0, keepLast);
  const remove = backups.slice(keepLast);

  for (const backup of remove) {
    unlinkSync(backup.path);
    console.log(`Đã xóa backup cũ: ${backup.name}`);
  }

  return {
    kept: keep.length,
    removed: remove.length,
    totalBefore: backups.length,
  };
}

async function runPgDump(outputPath: string) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      [
        "Thiếu connection string để backup database.",
        "Hãy đặt một trong các biến môi trường sau:",
        "- DATABASE_BACKUP_URL (khuyến nghị)",
        "- SUPABASE_DB_URL",
        "- POSTGRES_URL",
        "- DATABASE_URL",
      ].join("\n"),
    );
  }

  const pgDumpArgs = [
    "--dbname",
    databaseUrl,
    "--format=plain",
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
  ];

  const pgDump = spawn("pg_dump", pgDumpArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(outputPath, { flags: "wx" });

  let stderr = "";
  pgDump.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  pgDump.stdout.pipe(gzip).pipe(output);

  const pgDumpExit = new Promise<void>((resolvePromise, rejectPromise) => {
    pgDump.on("error", (error) => {
      rejectPromise(
        new Error(
          `Không chạy được pg_dump. Hãy cài PostgreSQL client trên server. Chi tiết: ${error.message}`,
        ),
      );
    });

    pgDump.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(
          new Error(`pg_dump thất bại với exit code ${code}.\n${stderr.trim()}`),
        );
      }
    });
  });

  const outputDone = new Promise<void>((resolvePromise, rejectPromise) => {
    output.on("finish", () => resolvePromise());
    output.on("error", rejectPromise);
    gzip.on("error", rejectPromise);
  });

  await pgDumpExit;
  await outputDone;
}

async function createBackup() {
  const dir = ensureBackupDir();
  const prefix = getPrefix();
  const fileName = `${prefix}-${timestampForFileName()}.sql.gz`;
  const outputPath = join(dir, fileName);

  console.log(`Bắt đầu backup database: ${outputPath}`);

  try {
    await runPgDump(outputPath);
  } catch (error) {
    if (existsSync(outputPath)) {
      try {
        unlinkSync(outputPath);
      } catch {
        // ignore cleanup error
      }
    }
    throw error;
  }

  const stat = statSync(outputPath);
  console.log(`Backup hoàn tất: ${basename(outputPath)} (${formatBytes(stat.size)})`);

  const cleanup = cleanupOldBackups();
  console.log(
    `Retention: giữ ${cleanup.kept} bản gần nhất, xóa ${cleanup.removed} bản cũ.`,
  );

  return outputPath;
}

function printUsage() {
  console.log(`Gia Phả database backup

Cách dùng:
  bun run backup:db       Tạo backup database ngay
  bun run backup:list     Liệt kê các bản backup hiện có
  bun run backup:cleanup  Xóa bản backup cũ theo BACKUP_KEEP_LAST

Biến môi trường:
  DATABASE_BACKUP_URL     Connection string PostgreSQL/Supabase dùng cho pg_dump
  BACKUP_DIR              Thư mục lưu backup, mặc định: ${DEFAULT_BACKUP_DIR}
  BACKUP_KEEP_LAST        Số bản backup mới nhất cần giữ, mặc định: ${DEFAULT_KEEP_LAST}
  BACKUP_PREFIX           Prefix tên file, mặc định: ${DEFAULT_PREFIX}

Ví dụ cron hằng ngày lúc 02:30:
  30 2 * * * cd /opt/giapha-os && /usr/bin/bun run backup:db >> /opt/giapha-os/backups/backup.log 2>&1
`);
}

async function main() {
  const command = process.argv[2] || "run";

  if (command === "run" || command === "backup") {
    await createBackup();
    return;
  }

  if (command === "list") {
    printBackups();
    return;
  }

  if (command === "cleanup") {
    const result = cleanupOldBackups();
    console.log(
      `Đã cleanup backup: giữ ${result.kept}, xóa ${result.removed}, tổng trước cleanup ${result.totalBefore}.`,
    );
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  throw new Error(`Lệnh backup không hợp lệ: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
