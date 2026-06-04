export type HealthSeverity = "ok" | "info" | "warning" | "error";

export type AdminHealthMetric = {
  key: string;
  label: string;
  value: number;
  severity: HealthSeverity;
  href?: string;
  description: string;
};

export type AdminHealthResult = {
  ok: boolean;
  metrics: AdminHealthMetric[];
};

export function buildAdminHealthResult(input: {
  activeUnknownPersons: number;
  eventsMissingLinks: number;
  duplicateEventGroups: number;
  activeEmptyFamilies: number;
  openImportSessions: number;
  pendingMergeSuggestions: number;
  approvedMergeSuggestions: number;
}): AdminHealthResult {
  const metrics: AdminHealthMetric[] = [
    {
      key: "activeUnknownPersons",
      label: "Unknown persons",
      value: input.activeUnknownPersons,
      severity: input.activeUnknownPersons > 0 ? "warning" : "ok",
      href: "/dashboard/data-maintenance/unknown-persons",
      description: "Người active còn tên Unknown/Chưa rõ tên.",
    },
    {
      key: "eventsMissingLinks",
      label: "Events missing links",
      value: input.eventsMissingLinks,
      severity: input.eventsMissingLinks > 0 ? "error" : "ok",
      href: "/dashboard/data-maintenance/events-missing-links",
      description: "Birth/death events thiếu person_events link.",
    },
    {
      key: "duplicateEventGroups",
      label: "Duplicate event groups",
      value: input.duplicateEventGroups,
      severity: input.duplicateEventGroups > 0 ? "warning" : "ok",
      href: "/dashboard/data-maintenance/duplicate-events",
      description: "Nhóm birth/death events bị trùng exact-match.",
    },
    {
      key: "activeEmptyFamilies",
      label: "Empty families",
      value: input.activeEmptyFamilies,
      severity: input.activeEmptyFamilies > 0 ? "warning" : "ok",
      href: "/dashboard/data-maintenance/empty-families",
      description: "Families active không có parents và children.",
    },
    {
      key: "openImportSessions",
      label: "Open import sessions",
      value: input.openImportSessions,
      severity: input.openImportSessions > 0 ? "info" : "ok",
      href: "/dashboard/import",
      description: "Import sessions chưa committed/cancelled.",
    },
    {
      key: "pendingMergeSuggestions",
      label: "Pending merge suggestions",
      value: input.pendingMergeSuggestions,
      severity: input.pendingMergeSuggestions > 0 ? "info" : "ok",
      href: "/dashboard/import",
      description: "Merge suggestions đang chờ duyệt.",
    },
    {
      key: "approvedMergeSuggestions",
      label: "Approved merge suggestions",
      value: input.approvedMergeSuggestions,
      severity: input.approvedMergeSuggestions > 0 ? "warning" : "ok",
      href: "/dashboard/import",
      description: "Merge suggestions đã approve nhưng chưa commit.",
    },
  ];

  return {
    ok: metrics.every((metric) => metric.severity !== "error"),
    metrics,
  };
}
