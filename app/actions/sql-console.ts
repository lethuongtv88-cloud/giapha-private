"use server";

import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/services/audit/auditLog.service";
import { assertAdminAction } from "@/utils/permissions/assertPersonAccess";

// Cụm từ admin phải gõ đúng để xác nhận trước khi chạy SQL có ghi/xóa dữ liệu.
// Câu lệnh chỉ đọc (SELECT/WITH...SELECT, không có từ khóa ghi dữ liệu) được
// chạy thẳng, không cần xác nhận, để tiện cho việc tra cứu/audit hàng ngày.
const REQUIRED_CONFIRM_PHRASE = "CHAY-SQL";

const WRITE_KEYWORD_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|EXECUTE|MERGE)\b/i;

function isReadOnlySql(sqlText: string): boolean {
  return !WRITE_KEYWORD_PATTERN.test(sqlText);
}

let sqlClient: ReturnType<typeof postgres> | null = null;

function getSqlClient() {
  if (sqlClient) return sqlClient;

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_BACKUP_URL;

  if (!databaseUrl) {
    throw new Error(
      "Thiếu DATABASE_URL (connection string Postgres trực tiếp) trong .env. " +
        "SUPABASE_SERVICE_ROLE_KEY không dùng được cho việc này.",
    );
  }

  sqlClient = postgres(databaseUrl, {
    ssl: "require",
    max: 1,
    idle_timeout: 20,
  });

  return sqlClient;
}

export type SqlConsoleResult = {
  ok: boolean;
  error?: string;
  rowCount?: number;
  rows?: Record<string, unknown>[];
  durationMs?: number;
};

export async function runAdminSqlRepair(input: {
  sql: string;
  confirmPhrase: string;
}): Promise<SqlConsoleResult> {
  const permission = await assertAdminAction(
    "data_maintenance.sql_console_run",
    "data_maintenance",
  );
  if (!permission.ok) {
    return { ok: false, error: permission.error ?? "Chỉ quản trị viên mới được thực hiện thao tác này." };
  }

  const sqlText = input.sql?.trim();

  if (!sqlText) {
    return { ok: false, error: "Chưa nhập nội dung SQL." };
  }

  const readOnly = isReadOnlySql(sqlText);

  if (!readOnly && input.confirmPhrase !== REQUIRED_CONFIRM_PHRASE) {
    return {
      ok: false,
      error: `Câu lệnh này có ghi/xóa dữ liệu. Cần gõ đúng "${REQUIRED_CONFIRM_PHRASE}" để xác nhận.`,
    };
  }

  const startedAt = Date.now();
  const client = getSqlClient();

  try {
    // Toàn bộ nội dung chạy trong 1 transaction: lỗi giữa chừng -> rollback hết,
    // không để DB ở trạng thái dở dang.
    const result = await client.begin(async (tx) => {
      return await tx.unsafe(sqlText);
    });

    const durationMs = Date.now() - startedAt;
    const rows = Array.isArray(result) ? (result as unknown as Record<string, unknown>[]) : [];

    await recordAuditLog({
      action: "data_maintenance.sql_console_run",
      entityType: "data_maintenance",
      entityId: "sql_console",
      severity: "danger",
      metadata: {
        sql: sqlText.slice(0, 4000),
        truncated: sqlText.length > 4000,
        rowCount: rows.length,
        durationMs,
        outcome: "success",
      },
    });

    revalidatePath("/dashboard/data-maintenance");

    return {
      ok: true,
      rowCount: rows.length,
      rows: rows.slice(0, 200), // tránh trả về quá nhiều dữ liệu ra UI
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    const message = error?.message ?? String(error);

    await recordAuditLog({
      action: "data_maintenance.sql_console_run",
      entityType: "data_maintenance",
      entityId: "sql_console",
      severity: "danger",
      metadata: {
        sql: sqlText.slice(0, 4000),
        truncated: sqlText.length > 4000,
        durationMs,
        outcome: "error",
        error: message,
      },
    });

    return { ok: false, error: message, durationMs };
  }
}
