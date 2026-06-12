"use server";

import { recordAuditLog } from "@/services/audit/auditLog.service";
import { getProfile } from "@/utils/supabase/queries";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DEFAULT_BACKUP_DIR = "backups/database";
const DEFAULT_BACKUP_CONFIG_PATH = "backups/backup-config.json";
const DEFAULT_BACKUP_PREFIX = "giapha-db";
const DEFAULT_KEEP_LAST = 14;
const BACKUPS_PAGE = "/dashboard/data-maintenance/backups";

type BackupConfig = {
  keepLast?: number;
};

export type BackupFileInfo = {
  name: string;
  sizeBytes: number;
  mtimeIso: string;
  path: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getBackupDirSync() {
  return resolve(getEnv("BACKUP_DIR") || DEFAULT_BACKUP_DIR);
}

export async function getBackupDir() {
  return getBackupDirSync();
}


function getBackupConfigPath() {
  return resolve(getEnv("BACKUP_CONFIG_PATH") || DEFAULT_BACKUP_CONFIG_PATH);
}

function getBackupPrefix() {
  return getEnv("BACKUP_PREFIX") || DEFAULT_BACKUP_PREFIX;
}

function ensureBackupDir() {
  const dir = getBackupDirSync();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readBackupConfig(): BackupConfig {
  const configPath = getBackupConfigPath();
  if (!existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as BackupConfig;
  } catch (error) {
    console.error("Không đọc được backup config:", error);
    return {};
  }
}

function writeBackupConfig(config: BackupConfig) {
  const configPath = getBackupConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function parseKeepLast(value: unknown, source: string) {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new Error(`${source} phải là số nguyên từ 1 đến 365.`);
  }

  return parsed;
}

export async function requireBackupAdmin() {
  const profile = await getProfile();

  if (profile?.role !== "admin") {
    throw new Error("Chỉ quản trị viên mới được quản lý backup.");
  }

  return profile;
}

export async function getBackupConfig() {
  await requireBackupAdmin();

  const config = readBackupConfig();
  const configKeepLast = parseKeepLast(config.keepLast, "Số bản backup cần giữ");
  const envKeepLast = parseKeepLast(getEnv("BACKUP_KEEP_LAST"), "BACKUP_KEEP_LAST");

  return {
    keepLast: configKeepLast ?? envKeepLast ?? DEFAULT_KEEP_LAST,
    keepLastSource: configKeepLast ? "config" : envKeepLast ? "env" : "default",
    backupDir: getBackupDirSync(),
    configPath: getBackupConfigPath(),
    prefix: getBackupPrefix(),
    hasDatabaseUrl: Boolean(
      getEnv("DATABASE_BACKUP_URL") ||
        getEnv("SUPABASE_DB_URL") ||
        getEnv("POSTGRES_URL") ||
        getEnv("DATABASE_URL"),
    ),
  };
}

export async function listBackups() {
  await requireBackupAdmin();

  const dir = ensureBackupDir();
  const prefix = getBackupPrefix();

  return readdirSync(dir)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".sql.gz"))
    .map((name): BackupFileInfo => {
      const path = join(dir, name);
      const stat = statSync(path);
      return {
        name,
        path,
        sizeBytes: stat.size,
        mtimeIso: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => Date.parse(b.mtimeIso) - Date.parse(a.mtimeIso));
}

function getSafeBackupPath(fileName: string) {
  const dir = ensureBackupDir();
  const safeName = basename(fileName);
  const prefix = getBackupPrefix();

  if (safeName !== fileName || !safeName.startsWith(`${prefix}-`) || !safeName.endsWith(".sql.gz")) {
    throw new Error("Tên file backup không hợp lệ.");
  }

  const path = resolve(dir, safeName);
  if (!path.startsWith(resolve(dir))) {
    throw new Error("Đường dẫn backup không hợp lệ.");
  }

  return path;
}

function redirectWithStatus(status: "ok" | "error", message: string): never {
  redirect(`${BACKUPS_PAGE}?${status}=${encodeURIComponent(message)}`);
}

async function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        rejectPromise(
          new Error(
            [
              `${command} ${args.join(" ")} thất bại với exit code ${code}.`,
              stderr.trim(),
              stdout.trim(),
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        );
      }
    });
  });
}

export async function runDatabaseBackupAction() {
  let status: "ok" | "error" = "ok";
  let message = "Đã tạo backup database.";

  try {
    await requireBackupAdmin();
    const result = await runCommand("bun", ["run", "backup:db"]);

    await recordAuditLog({
      action: "backup.created",
      entityType: "backup",
      entityId: "database",
      entityLabel: "Database backup",
      metadata: {
        stdout: result.stdout.slice(-4000),
        stderr: result.stderr.slice(-4000),
        backupDir: getBackupDirSync(),
      },
    });

    revalidatePath(BACKUPS_PAGE);
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Không tạo được backup database.";

    await recordAuditLog({
      action: "backup.failed",
      entityType: "backup",
      entityId: "database",
      entityLabel: "Database backup",
      severity: "danger",
      metadata: { error: message },
    });
  }

  redirectWithStatus(status, message);
}

export async function deleteBackupAction(formData: FormData) {
  let status: "ok" | "error" = "ok";
  let message = "Đã xóa backup.";

  try {
    await requireBackupAdmin();

    const fileName = String(formData.get("fileName") ?? "");
    const path = getSafeBackupPath(fileName);

    if (!existsSync(path)) {
      throw new Error("File backup không tồn tại.");
    }

    unlinkSync(path);
    message = `Đã xóa backup ${fileName}.`;

    await recordAuditLog({
      action: "backup.deleted",
      entityType: "backup",
      entityId: fileName,
      entityLabel: fileName,
      severity: "warning",
      metadata: { fileName },
    });

    revalidatePath(BACKUPS_PAGE);
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Không xóa được backup.";
  }

  redirectWithStatus(status, message);
}

export async function cleanupBackupsAction() {
  let status: "ok" | "error" = "ok";
  let message = "Đã cleanup backup cũ theo retention.";

  try {
    await requireBackupAdmin();
    await runCommand("bun", ["run", "backup:cleanup"]);

    await recordAuditLog({
      action: "backup.cleanup",
      entityType: "backup",
      entityId: "database",
      entityLabel: "Cleanup backup",
      severity: "warning",
      metadata: { keepLast: (await getBackupConfig()).keepLast },
    });

    revalidatePath(BACKUPS_PAGE);
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Không cleanup được backup.";
  }

  redirectWithStatus(status, message);
}

export async function saveBackupConfigAction(formData: FormData) {
  let status: "ok" | "error" = "ok";
  let message = "Đã lưu cấu hình backup.";

  try {
    await requireBackupAdmin();

    const keepLast = parseKeepLast(formData.get("keepLast"), "Số bản backup cần giữ");
    if (!keepLast) throw new Error("Vui lòng nhập số bản backup cần giữ.");

    writeBackupConfig({ keepLast });
    message = `Đã lưu cấu hình giữ ${keepLast} bản backup gần nhất.`;

    await recordAuditLog({
      action: "backup.retention_updated",
      entityType: "backup",
      entityId: "retention",
      entityLabel: "Cấu hình retention backup",
      metadata: { keepLast },
    });

    revalidatePath(BACKUPS_PAGE);
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Không lưu được cấu hình backup.";
  }

  redirectWithStatus(status, message);
}
