import { describe, expect, it } from "vitest";
import {
  buildUnknownPersonRows,
  isUnknownPersonName,
} from "@/services/data-maintenance/unknownPersons.service";

describe("unknown persons maintenance", () => {
  it("detects unknown names", () => {
    expect(isUnknownPersonName("Unknown")).toBe(true);
    expect(isUnknownPersonName("Chưa rõ tên")).toBe(true);
    expect(isUnknownPersonName("")).toBe(true);
    expect(isUnknownPersonName("Nguyễn Văn A")).toBe(false);
  });

  it("builds rows for active unknown persons only", () => {
    const rows = buildUnknownPersonRows([
      {
        id: "p1",
        full_name: "Unknown",
        gender: "male",
        birth_year: 1980,
        created_at: "2026-06-03T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "p2",
        full_name: "Nguyễn Văn A",
        gender: "male",
        created_at: "2026-06-03T11:00:00Z",
        deleted_at: null,
      },
      {
        id: "p3",
        full_name: "Chưa rõ tên",
        gender: "other",
        created_at: "2026-06-03T12:00:00Z",
        deleted_at: "2026-06-04T00:00:00Z",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("p1");
    expect(rows[0].birthText).toBe("1980");
  });
});
