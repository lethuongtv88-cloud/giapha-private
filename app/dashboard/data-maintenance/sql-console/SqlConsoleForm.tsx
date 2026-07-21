"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Play, ShieldAlert, BookMarked } from "lucide-react";
import { runAdminSqlRepair, type SqlConsoleResult } from "@/app/actions/sql-console";
import { adminSqlLibrary } from "@/utils/sqlSnippets/adminSqlLibrary";

const CONFIRM_PHRASE = "CHAY-SQL";

export function SqlConsoleForm() {
  const [sql, setSql] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [result, setResult] = useState<SqlConsoleResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState(adminSqlLibrary[0]?.id ?? "");
  const [snippetId, setSnippetId] = useState("");

  const activeGroup = useMemo(
    () => adminSqlLibrary.find((g) => g.id === groupId) ?? adminSqlLibrary[0],
    [groupId],
  );
  const activeSnippet = useMemo(
    () => activeGroup?.snippets.find((s) => s.id === snippetId) ?? null,
    [activeGroup, snippetId],
  );

  const looksReadOnly = !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|EXECUTE|MERGE)\b/i.test(
    sql,
  );

  function handleInsertSnippet() {
    if (!activeSnippet) return;
    setSql(activeSnippet.sql);
    setResult(null);
  }

  const canSubmit =
    sql.trim().length > 0 && (looksReadOnly || confirmPhrase === CONFIRM_PHRASE) && !isPending;

  function handleRun() {
    setResult(null);
    startTransition(async () => {
      const res = await runAdminSqlRepair({ sql, confirmPhrase });
      setResult(res);
      if (res.ok) {
        setConfirmPhrase("");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-900">
          <BookMarked className="size-4" />
          Thư viện SQL mẫu
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              setSnippetId("");
            }}
            className="rounded-lg border border-indigo-200 bg-white p-2 text-sm sm:w-64"
          >
            {adminSqlLibrary.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>

          <select
            value={snippetId}
            onChange={(e) => setSnippetId(e.target.value)}
            className="flex-1 rounded-lg border border-indigo-200 bg-white p-2 text-sm"
          >
            <option value="">— Chọn SQL mẫu —</option>
            {activeGroup?.snippets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.readOnly ? "🔍" : "✏️"} {s.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleInsertSnippet}
            disabled={!activeSnippet}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Chèn vào ô SQL
          </button>
        </div>

        {activeSnippet ? (
          <p className="mt-3 text-sm leading-relaxed text-indigo-900">
            {activeSnippet.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">SQL chạy trực tiếp trên database production.</p>
          <p className="mt-1 opacity-90">
            Toàn bộ nội dung chạy trong 1 transaction — lỗi giữa chừng sẽ tự rollback.
            Nhưng nếu SQL đúng cú pháp và tự COMMIT logic sai (VD: xóa nhầm điều kiện),
            hệ thống không thể tự cứu. Hãy backup trước (mục &quot;Backup database&quot;) và
            đọc kỹ SQL trước khi chạy. Nếu SQL mẫu có chỗ như{" "}
            <code className="rounded bg-white/60 px-1">{"<PERSON_ID>"}</code>, nhớ thay
            bằng UUID thật trước khi chạy.
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Nội dung SQL repair
        </label>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder={"BEGIN;\n-- dán nội dung file migration/repair vào đây\nCOMMIT;"}
          className="w-full rounded-xl border border-stone-300 bg-stone-950 p-4 font-mono text-sm text-emerald-300 shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Gõ <code className="rounded bg-stone-100 px-1 py-0.5">{CONFIRM_PHRASE}</code> để xác nhận
            {looksReadOnly ? (
              <span className="ml-2 text-xs font-normal text-emerald-700">
                (không bắt buộc — câu lệnh chỉ đọc dữ liệu)
              </span>
            ) : (
              <span className="ml-2 text-xs font-normal text-red-600">
                (bắt buộc — câu lệnh có ghi/xóa dữ liệu)
              </span>
            )}
          </label>
          <input
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-64"
          />
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="size-4" />
          {isPending ? "Đang chạy..." : "Chạy SQL"}
        </button>
      </div>

      {result ? (
        result.ok ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">
              Thành công — {result.rowCount ?? 0} dòng trả về ({result.durationMs}ms)
            </p>
            {result.rows && result.rows.length > 0 ? (
              <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-white/70 p-3 text-xs">
                {JSON.stringify(result.rows, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Lỗi — đã rollback, chưa có gì thay đổi</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{result.error}</pre>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
