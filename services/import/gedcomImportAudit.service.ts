export type ImportAuditCount = {
  label: string;
  count: number;
  severity: "ok" | "info" | "warning" | "error";
};

export type ImportAuditResult = {
  ok: boolean;
  counts: ImportAuditCount[];
};

export function buildImportAuditResult(input: {
  activeUnknownPersons: number;
  orphanEvents: number;
  duplicatePersonEvents: number;
  eventsWithoutPersonEvent: number;
  activeEmptyFamilies: number;
  mergeEvents: number;
  committedMergeSuggestions: number;
}): ImportAuditResult {
  const counts: ImportAuditCount[] = [
    {
      label: "Active unknown persons",
      count: input.activeUnknownPersons,
      severity: input.activeUnknownPersons > 0 ? "info" : "ok",
    },
    {
      label: "Orphan active events",
      count: input.orphanEvents,
      severity: input.orphanEvents > 0 ? "error" : "ok",
    },
    {
      label: "Duplicate birth/death events",
      count: input.duplicatePersonEvents,
      severity: input.duplicatePersonEvents > 0 ? "warning" : "ok",
    },
    {
      label: "Events without person_events link",
      count: input.eventsWithoutPersonEvent,
      severity: input.eventsWithoutPersonEvent > 0 ? "warning" : "ok",
    },
    {
      label: "Active empty families",
      count: input.activeEmptyFamilies,
      severity: input.activeEmptyFamilies > 0 ? "warning" : "ok",
    },
    {
      label: "GEDCOM merge events",
      count: input.mergeEvents,
      severity: "info",
    },
    {
      label: "Committed merge suggestions",
      count: input.committedMergeSuggestions,
      severity: "info",
    },
  ];

  return {
    ok: counts.every((item) => item.severity !== "error"),
    counts,
  };
}
