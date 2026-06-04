import { describe, expect, it } from "vitest";
import { buildAdminHealthResult } from "@/services/admin-health/adminHealth.service";

describe("admin health", () => {
  it("passes when no blocking issues exist", () => {
    const result = buildAdminHealthResult({
      activeUnknownPersons: 0,
      eventsMissingLinks: 0,
      duplicateEventGroups: 0,
      activeEmptyFamilies: 0,
      openImportSessions: 0,
      pendingMergeSuggestions: 0,
      approvedMergeSuggestions: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.every((metric) => metric.severity === "ok")).toBe(true);
  });

  it("marks missing event links as blocking error", () => {
    const result = buildAdminHealthResult({
      activeUnknownPersons: 0,
      eventsMissingLinks: 2,
      duplicateEventGroups: 0,
      activeEmptyFamilies: 0,
      openImportSessions: 0,
      pendingMergeSuggestions: 0,
      approvedMergeSuggestions: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.metrics.find((metric) => metric.key === "eventsMissingLinks")?.severity).toBe(
      "error",
    );
  });

  it("marks approved merge suggestions as warning", () => {
    const result = buildAdminHealthResult({
      activeUnknownPersons: 0,
      eventsMissingLinks: 0,
      duplicateEventGroups: 0,
      activeEmptyFamilies: 0,
      openImportSessions: 0,
      pendingMergeSuggestions: 0,
      approvedMergeSuggestions: 1,
    });

    expect(result.ok).toBe(true);
    expect(
      result.metrics.find((metric) => metric.key === "approvedMergeSuggestions")?.severity,
    ).toBe("warning");
  });
});
