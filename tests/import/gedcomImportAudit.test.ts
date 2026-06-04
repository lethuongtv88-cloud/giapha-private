import { describe, expect, it } from "vitest";
import { buildImportAuditResult } from "@/services/import/gedcomImportAudit.service";

describe("GEDCOM import audit", () => {
  it("marks orphan events as error", () => {
    const result = buildImportAuditResult({
      activeUnknownPersons: 0,
      orphanEvents: 1,
      duplicatePersonEvents: 0,
      eventsWithoutPersonEvent: 0,
      activeEmptyFamilies: 0,
      mergeEvents: 0,
      committedMergeSuggestions: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.counts.find((item) => item.label === "Orphan active events")?.severity).toBe(
      "error",
    );
  });

  it("passes when no blocking issues exist", () => {
    const result = buildImportAuditResult({
      activeUnknownPersons: 4,
      orphanEvents: 0,
      duplicatePersonEvents: 0,
      eventsWithoutPersonEvent: 0,
      activeEmptyFamilies: 0,
      mergeEvents: 2,
      committedMergeSuggestions: 2,
    });

    expect(result.ok).toBe(true);
  });
});
