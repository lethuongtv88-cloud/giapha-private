import { describe, expect, it } from "vitest";
import { buildGedcomStagingPreview } from "@/services/import/gedcomStaging.service";

describe("buildGedcomStagingPreview", () => {
  it("parses persons into staging records", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @I1@ INDI",
      "1 NAME Văn An /Nguyễn/",
      "1 SEX M",
      "1 BIRT",
      "2 DATE 12 MAR 1981",
      "0 TRLR",
    ].join("\n");

    const preview = buildGedcomStagingPreview(gedcom);

    expect(preview.summary.persons).toBe(1);
    expect(preview.summary.names).toBe(1);
    expect(preview.summary.events).toBe(1);
    expect(preview.records.some((r) => r.record_type === "person")).toBe(true);
    expect(preview.records.some((r) => r.record_type === "event")).toBe(true);

    const person = preview.records.find((r) => r.record_type === "person");
    expect(person?.normalized_payload.full_name).toBe("Nguyễn Văn An");

    const name = preview.records.find((r) => r.record_type === "name");
    expect(name?.normalized_payload.full_name).toBe("Nguyễn Văn An");
    expect(name?.normalized_payload.surname).toBe("Nguyễn");
    expect(name?.normalized_payload.given_name).toBe("Văn An");
  });

  it("does not throw on invalid GEDCOM", () => {
    const preview = buildGedcomStagingPreview("not gedcom");
    expect(preview.summary.errors).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(preview.records)).toBe(true);
  });
});
  it("marks strong duplicate person as match instead of create", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @I1@ INDI",
      "1 NAME Văn An /Nguyễn/",
      "1 SEX M",
      "1 BIRT",
      "2 DATE 12 MAR 1981",
      "0 TRLR",
    ].join("\n");

    const preview = buildGedcomStagingPreview(gedcom, {
      existingPersons: [
        {
          id: "existing-p1",
          full_name: "Nguyễn Văn An",
          gender: "male",
          birth_year: 1981,
          birth_month: 3,
          birth_day: 12,
        },
      ],
    });

    const person = preview.records.find((r) => r.record_type === "person");

    expect(person?.action).toBe("match");
    expect(person?.status).toBe("skipped");
    expect(person?.normalized_payload.matched_person_id).toBe("existing-p1");
    expect(preview.summary.matches).toBe(1);
  });
  it("blocks dependent create records for possible duplicate person", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @I1@ INDI",
      "1 NAME Văn An /Nguyễn/",
      "1 SEX M",
      "1 BIRT",
      "2 DATE 1981",
      "0 TRLR",
    ].join("\n");

    const preview = buildGedcomStagingPreview(gedcom, {
      existingPersons: [
        {
          id: "existing-p1",
          full_name: "Nguyễn Văn An",
          gender: "male",
          birth_year: 1981,
        },
      ],
    });

    const person = preview.records.find((r) => r.record_type === "person");
    expect(person?.action).toBe("match");

    const name = preview.records.find((r) => r.record_type === "name");
    expect(name?.action).toBe("skip");
    expect(name?.status).toBe("skipped");

    const event = preview.records.find((r) => r.record_type === "event");
    expect(event?.action).toBe("skip");
    expect(event?.status).toBe("skipped");
  });