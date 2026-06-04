import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

type MigrationCheck = {
  file: string;
  required: boolean;
  phase: string;
  purpose: string;
};

const migrationDir = "docs/migrations";

const checks: MigrationCheck[] = [
  {
    file: "020_event_model_v234.sql",
    required: true,
    phase: "v2.3.4",
    purpose: "Event Model schema",
  },
  {
    file: "022_gedcom_staging_import_v234.sql",
    required: true,
    phase: "v2.3.4",
    purpose: "GEDCOM staging tables",
  },
  {
    file: "024_gedcom_merge_suggestions_v234.sql",
    required: true,
    phase: "v2.3.4",
    purpose: "GEDCOM merge suggestions table",
  },
  {
    file: "025_commit_gedcom_merge_suggestions_v234.sql",
    required: true,
    phase: "v2.3.4",
    purpose: "Commit approved merge suggestions RPC",
  },
  {
    file: "026_import_audit_rpcs_v234.sql",
    required: true,
    phase: "v2.3.4",
    purpose: "Import audit RPCs",
  },
  {
    file: "027_repair_events_missing_links_v235.sql",
    required: true,
    phase: "v2.3.5",
    purpose: "Repair missing person_events links RPC",
  },
  {
    file: "028_soft_delete_empty_families_v235.sql",
    required: true,
    phase: "v2.3.5",
    purpose: "Soft-delete empty families RPC",
  },
  {
    file: "029_soft_delete_duplicate_events_v235.sql",
    required: true,
    phase: "v2.3.5",
    purpose: "Soft-delete duplicate birth/death events RPC",
  },
];

function main() {
  const root = process.cwd();
  const dir = path.join(root, migrationDir);

  const existing = existsSync(dir)
    ? new Set(readdirSync(dir).filter((name) => name.endsWith(".sql")))
    : new Set<string>();

  const rows = checks.map((check) => {
    return {
      ...check,
      exists: existing.has(check.file) || existsSync(path.join(dir, check.file)),
    };
  });

  const missingRequired = rows.filter((row) => row.required && !row.exists);

  console.log("\n=== Migration Audit v2.4.0 ===\n");

  for (const row of rows) {
    const status = row.exists ? "OK" : row.required ? "MISSING" : "OPTIONAL";
    console.log(
      `${status.padEnd(8)} ${row.phase.padEnd(8)} ${row.file.padEnd(
        55,
      )} ${row.purpose}`,
    );
  }

  console.log("\n=== Summary ===");
  console.log(`checked: ${rows.length}`);
  console.log(`missing required: ${missingRequired.length}`);

  if (missingRequired.length > 0) {
    console.error("\nMissing required migration files:");
    for (const row of missingRequired) {
      console.error(`- ${row.file}: ${row.purpose}`);
    }

    process.exit(1);
  }

  console.log("\nMigration audit passed.");
}

main();