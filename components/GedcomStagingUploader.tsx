"use client";

import Link from "next/link";
import { useState } from "react";
import { createGedcomStagingSession } from "@/app/actions/import-staging";
import { AlertTriangle, CheckCircle2, Eye, FileUp, Loader2 } from "lucide-react";

export default function GedcomStagingUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    sessionId?: string;
    error?: string;
    summary?: {
      persons: number;
      names: number;
      families: number;
      familyParents: number;
      familyChildren: number;
      events: number;
      personEvents: number;
      matches: number;
      possibleMatches: number;
      warnings: number;
      errors: number;
    };
  }>(null);

  async function handleUpload() {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const content = await file.text();

      const res = await createGedcomStagingSession({
        fileName: file.name,
        fileSize: file.size,
        content,
      });

      setResult(res);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle className="size-5" />
          Chế độ staging an toàn
        </div>
        <p className="mt-2">
          Bước này chỉ tạo import session và staging records. Chưa ghi vào
          persons, person_names, families, family_parents, family_children,
          events hoặc person_events.
        </p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">
            Chọn file GEDCOM
          </span>
          <input
            type="file"
            accept=".ged,.gedcom,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
          />
        </label>

        {file ? (
          <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
            File: <span className="font-semibold">{file.name}</span> —{" "}
            {(file.size / 1024).toFixed(1)} KB
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileUp className="size-4" />
          )}
          Parse vào staging
        </button>
      </section>

      {result ? (
        <section
          className={`rounded-2xl border p-5 shadow-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {result.ok ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
            {result.ok ? "Đã tạo staging session" : "Import staging lỗi"}
          </div>

          {result.error ? <p className="mt-2 text-sm">{result.error}</p> : null}

          {result.ok && result.summary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Summary label="Persons" value={result.summary.persons} />
              <Summary label="Names" value={result.summary.names} />
              <Summary label="Families" value={result.summary.families} />
              <Summary
                label="Family parents"
                value={result.summary.familyParents}
              />
              <Summary
                label="Family children"
                value={result.summary.familyChildren}
              />
              <Summary label="Events" value={result.summary.events} />
              <Summary
                label="Person events"
                value={result.summary.personEvents}
              />
              <Summary label="Matches" value={result.summary.matches} />
              <Summary label="Possible matches" value={result.summary.possibleMatches} />
              <Summary label="Warnings" value={result.summary.warnings} />
              <Summary label="Errors" value={result.summary.errors} />
            </div>
          ) : null}

          {result.sessionId ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-white/70 px-3 py-2 text-sm">
                Session ID: <span className="font-mono">{result.sessionId}</span>
              </div>

              <Link
                href={`/dashboard/import/${result.sessionId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <Eye className="size-4" />
                Xem preview chi tiết
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/70 p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}