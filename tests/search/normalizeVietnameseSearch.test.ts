import { describe, expect, it } from "vitest";
import {
  includesVietnameseSearch,
  normalizeVietnameseSearch,
} from "@/utils/search/normalizeVietnameseSearch";

describe("normalizeVietnameseSearch", () => {
  it("removes Vietnamese accents and normalizes spaces", () => {
    expect(normalizeVietnameseSearch("  Nguyễn   Văn  Đảo  ")).toBe(
      "nguyen van dao",
    );
  });

  it("matches accented source with unaccented query", () => {
    expect(includesVietnameseSearch("Trịnh Thị Phụng", "trinh thi phung")).toBe(
      true,
    );
  });

  it("matches unaccented source with accented query", () => {
    expect(includesVietnameseSearch("Nguyen Van A", "Nguyễn Văn")).toBe(true);
  });

  it("handles empty query as match-all", () => {
    expect(includesVietnameseSearch("Nguyễn Văn A", "")).toBe(true);
  });
});
