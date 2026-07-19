import { createClient } from "@/utils/supabase/client";

export type RootPreferenceKind = "tree" | "dualAncestry" | "inLaw" | "stats";

export type RootPreferences = Record<RootPreferenceKind, string | null>;

export const ROOT_PREFERENCE_KINDS: Array<{
  kind: RootPreferenceKind;
  label: string;
  description: string;
}> = [
  {
    kind: "tree",
    label: "Gốc sơ đồ",
    description:
      "Dùng chung khi mở Cây gia phả, Mindmap, Bong bóng và Thống kê (gốc gia phả cũng là gốc thống kê mặc định).",
  },
  {
    kind: "dualAncestry",
    label: "Gốc Nội / Ngoại",
    description: "Dùng khi mở bảng tương quan họ nội, họ ngoại.",
  },
  {
    kind: "inLaw",
    label: "Gốc Sui gia",
    description: "Dùng khi mở bảng so vai vế sui gia hai bên.",
  },
  {
    kind: "stats",
    label: "Gốc Thống kê",
    description: "Dùng cho phần thống kê theo gốc gia phả.",
  },
];

const DB_COLUMN_BY_KIND: Record<RootPreferenceKind, string> = {
  tree: "default_tree_root_id",
  dualAncestry: "default_dual_ancestry_root_id",
  inLaw: "default_in_law_root_id",
  stats: "default_stats_root_id",
};

export function getRootPreferenceAccountKey(input?: {
  userId?: string | null;
  email?: string | null;
}) {
  return input?.userId || input?.email || "local";
}

export function getRootPreferenceStorageKey(
  kind: RootPreferenceKind,
  accountKey: string,
) {
  return `giapha:root:${kind}:${accountKey}`;
}

export function getLegacyRootPreferenceKeys(kind: RootPreferenceKind) {
  switch (kind) {
    case "tree":
      return [
        "members_rootId",
        getRootPreferenceStorageKey("tree", "local"),
        "giapha:root:mindmap:local",
        "giapha:root:bubble:local",
      ];
    case "dualAncestry":
      return ["giapha:root:dual-ancestry:local"];
    case "inLaw":
      return ["giapha:root:in-law-relations:local"];
    default:
      return [];
  }
}

export function createEmptyRootPreferences(): RootPreferences {
  return {
    tree: null,
    dualAncestry: null,
    inLaw: null,
    stats: null,
  };
}

export function readRootPreference(
  kind: RootPreferenceKind,
  accountKey: string,
): string | null {
  if (typeof window === "undefined") return null;

  const direct = window.localStorage.getItem(
    getRootPreferenceStorageKey(kind, accountKey),
  );
  if (direct) return direct;

  for (const legacyKey of getLegacyRootPreferenceKeys(kind)) {
    const value = window.localStorage.getItem(legacyKey);
    if (value) return value;
  }

  return null;
}

export function writeRootPreference(
  kind: RootPreferenceKind,
  accountKey: string,
  personId: string | null,
) {
  if (typeof window === "undefined") return;

  const key = getRootPreferenceStorageKey(kind, accountKey);
  if (personId) {
    window.localStorage.setItem(key, personId);
  } else {
    window.localStorage.removeItem(key);
  }

  // Keep old pages / old builds compatible while we migrate all root pickers.
  if (kind === "tree") {
    if (personId) window.localStorage.setItem("members_rootId", personId);
    else window.localStorage.removeItem("members_rootId");
  }
}

export function readAllRootPreferences(accountKey: string): RootPreferences {
  return {
    tree: readRootPreference("tree", accountKey),
    dualAncestry: readRootPreference("dualAncestry", accountKey),
    inLaw: readRootPreference("inLaw", accountKey),
    stats: readRootPreference("stats", accountKey),
  };
}

export function writeAllRootPreferences(
  accountKey: string,
  preferences: RootPreferences,
) {
  for (const kind of Object.keys(preferences) as RootPreferenceKind[]) {
    writeRootPreference(kind, accountKey, preferences[kind]);
  }
}

export async function readAllRootPreferencesFromDb(
  userId: string | null | undefined,
): Promise<RootPreferences | null> {
  if (!userId) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "default_tree_root_id, default_dual_ancestry_root_id, default_in_law_root_id, default_stats_root_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Cannot read user root preferences from database:", error);
    return null;
  }

  if (!data) return null;

  return {
    tree: (data.default_tree_root_id as string | null) ?? null,
    dualAncestry: (data.default_dual_ancestry_root_id as string | null) ?? null,
    inLaw: (data.default_in_law_root_id as string | null) ?? null,
    stats: (data.default_stats_root_id as string | null) ?? null,
  };
}

export async function writeAllRootPreferencesToDb(
  userId: string | null | undefined,
  preferences: RootPreferences,
) {
  if (!userId) return { ok: false, error: "Chưa đăng nhập." };

  const supabase = createClient();
  const payload = {
    user_id: userId,
    [DB_COLUMN_BY_KIND.tree]: preferences.tree,
    [DB_COLUMN_BY_KIND.dualAncestry]: preferences.dualAncestry,
    [DB_COLUMN_BY_KIND.inLaw]: preferences.inLaw,
    [DB_COLUMN_BY_KIND.stats]: preferences.stats,
  };

  const { error } = await supabase.from("user_preferences").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    console.warn("Cannot write user root preferences to database:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}

export async function hydrateRootPreferencesFromDb(input: {
  userId?: string | null;
  email?: string | null;
}) {
  const accountKey = getRootPreferenceAccountKey(input);
  const dbPreferences = await readAllRootPreferencesFromDb(input.userId);

  if (!dbPreferences) return readAllRootPreferences(accountKey);

  // Mirror DB preferences to localStorage so older pages and client-only fallbacks
  // use the same root values after login.
  writeAllRootPreferences(accountKey, dbPreferences);
  return dbPreferences;
}
