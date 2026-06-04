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
  it("marks weak duplicate candidate as pending match instead of create", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @I1@ INDI",
      "1 NAME Ngọc Đang /Nguyễn/",
      "1 SEX F",
      "0 TRLR",
    ].join("\n");

    const preview = buildGedcomStagingPreview(gedcom, {
      existingPersons: [
        {
          id: "existing-p1",
          full_name: "Nguyễn Ngọc Đang",
          gender: "female",
          birth_year: null,
          birth_month: null,
          birth_day: null,
        },
      ],
    });

    const person = preview.records.find((r) => r.record_type === "person");

    expect(person?.action).toBe("match");
    expect(person?.status).toBe("pending");
    expect(person?.confidence).toBe("review");
    expect(person?.normalized_payload.match_level).toBe("weak");
    expect(person?.normalized_payload.matched_person_id).toBe("existing-p1");
    expect(preview.summary.possibleMatches).toBe(1);

    const name = preview.records.find((r) => r.record_type === "name");
    expect(name?.action).toBe("skip");
    expect(name?.status).toBe("skipped");
  });
  it("matches exported GEDCOM person by external id even when name is unknown", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @54af0953-78a1-463c-8703-243378987027@ INDI",
      "1 NAME Chưa rõ tên",
      "1 SEX U",
      "0 TRLR",
    ].join("\n");

    const preview = buildGedcomStagingPreview(gedcom, {
      existingPersons: [
        {
          id: "54af0953-78a1-463c-8703-243378987027",
          full_name: "Chưa rõ tên",
          gender: "other",
        },
      ],
    });

    const person = preview.records.find((r) => r.record_type === "person");

    expect(person?.action).toBe("match");
    expect(person?.status).toBe("skipped");
    expect(person?.confidence).toBe("certain");
    expect(person?.normalized_payload.matched_person_id).toBe(
      "54af0953-78a1-463c-8703-243378987027",
    );
    expect(person?.normalized_payload.match_score).toBe(999);
    expect(person?.normalized_payload.match_reason).toContain("external_id");
  });