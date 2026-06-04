import { existsSync } from "node:fs";
import path from "node:path";

type RouteCheck = {
  route: string;
  file: string;
  required: boolean;
};

const checks: RouteCheck[] = [
  {
    route: "/dashboard",
    file: "app/dashboard/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/members",
    file: "app/dashboard/members/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/stats",
    file: "app/dashboard/stats/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/data-quality",
    file: "app/dashboard/data-quality/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/data-maintenance",
    file: "app/dashboard/data-maintenance/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/data-maintenance/unknown-persons",
    file: "app/dashboard/data-maintenance/unknown-persons/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/data-maintenance/duplicate-events",
    file: "app/dashboard/data-maintenance/duplicate-events/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/data-maintenance/events-missing-links",
    file: "app/dashboard/data-maintenance/events-missing-links/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/data-maintenance/empty-families",
    file: "app/dashboard/data-maintenance/empty-families/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/admin-health",
    file: "app/dashboard/admin-health/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/import",
    file: "app/dashboard/import/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/import/[sessionId]",
    file: "app/dashboard/import/[sessionId]/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/import/[sessionId]/matches",
    file: "app/dashboard/import/[sessionId]/matches/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/import/[sessionId]/merge",
    file: "app/dashboard/import/[sessionId]/merge/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/import/[sessionId]/audit",
    file: "app/dashboard/import/[sessionId]/audit/page.tsx",
    required: true,
  },
  {
    route: "/dashboard/vietnamese-tree-test",
    file: "app/dashboard/vietnamese-tree-test/page.tsx",
    required: true,
  },
];

function main() {
  const root = process.cwd();

  const rows = checks.map((check) => {
    const fullPath = path.join(root, check.file);
    const exists = existsSync(fullPath);

    return {
      ...check,
      exists,
    };
  });

  const missingRequired = rows.filter((row) => row.required && !row.exists);

  console.log("\n=== Route Audit v2.4.0 ===\n");

  for (const row of rows) {
    const status = row.exists ? "OK" : row.required ? "MISSING" : "OPTIONAL";
    console.log(`${status.padEnd(8)} ${row.route.padEnd(48)} ${row.file}`);
  }

  console.log("\n=== Summary ===");
  console.log(`checked: ${rows.length}`);
  console.log(`missing required: ${missingRequired.length}`);

  if (missingRequired.length > 0) {
    console.error("\nMissing required route files:");
    for (const row of missingRequired) {
      console.error(`- ${row.route}: ${row.file}`);
    }

    process.exit(1);
  }

  console.log("\nRoute audit passed.");
}

main();