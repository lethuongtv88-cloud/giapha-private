import { describe, expect, it } from "vitest";
import {
  buildVietnameseFamilyLayout,
  VIET_NODE_HEIGHT,
  VIET_NODE_WIDTH,
  VIET_SPOUSE_GAP,
  type VietnameseTreePerson,
} from "../../utils/tree/vietnameseTreeLayout";

function person(
  id: string,
  fullName: string,
  extra: Partial<VietnameseTreePerson> = {},
): VietnameseTreePerson {
  return {
    id,
    full_name: fullName,
    ...extra,
  };
}

function centerX(x: number) {
  return x + VIET_NODE_WIDTH / 2;
}

function centerY(y: number) {
  return y + VIET_NODE_HEIGHT / 2;
}

describe("buildVietnameseFamilyLayout", () => {
  it("places parents horizontally and children below family center", () => {
    const layout = buildVietnameseFamilyLayout({
      familyId: "f1",
      parents: [
        {
          role: "husband",
          person: person("father", "Nguyễn Văn Cha", { gender: "male" }),
        },
        {
          role: "wife",
          person: person("mother", "Trần Thị Mẹ", { gender: "female" }),
        },
      ],
      children: [
        person("c1", "Nguyễn Con Một", { birth_order: 1, birth_year: 1980 }),
        person("c2", "Nguyễn Con Hai", { birth_order: 2, birth_year: 1982 }),
      ],
    });

    const parents = layout.nodes.filter((node) => node.role === "parent");
    const children = layout.nodes.filter((node) => node.role === "child");

    expect(parents).toHaveLength(2);
    expect(children).toHaveLength(2);

    expect(parents[0].y).toBe(parents[1].y);
    expect(children[0].y).toBeGreaterThan(parents[0].y);

    expect(layout.lines.some((line) => line.type === "spouse")).toBe(true);
    expect(layout.lines.filter((line) => line.type === "child-down")).toHaveLength(2);
    expect(layout.lines.some((line) => line.type === "sibling-bar")).toBe(true);
  });

  it("sorts children by birth_order then birth_year", () => {
    const layout = buildVietnameseFamilyLayout({
      familyId: "f1",
      parents: [
        {
          role: "husband",
          person: person("father", "Nguyễn Văn Cha"),
        },
      ],
      children: [
        person("c2", "Con Hai", { birth_order: 2, birth_year: 1982 }),
        person("c1", "Con Một", { birth_order: 1, birth_year: 1980 }),
      ],
    });

    const children = layout.nodes.filter((node) => node.role === "child");

    expect(children[0].person.id).toBe("c1");
    expect(children[1].person.id).toBe("c2");
  });

  it("keeps every child-down line aligned with the center of its child node", () => {
    const layout = buildVietnameseFamilyLayout({
      familyId: "f-child-line",
      parents: [
        {
          role: "husband",
          person: person("father", "Cha"),
        },
        {
          role: "wife",
          person: person("mother", "Mẹ"),
        },
      ],
      children: [
        person("c1", "Con 1", { birth_order: 1 }),
        person("c2", "Con 2", { birth_order: 2 }),
        person("c3", "Con 3", { birth_order: 3 }),
      ],
    });

    const children = layout.nodes.filter((node) => node.role === "child");
    const childDownLines = layout.lines.filter((line) => line.type === "child-down");

    expect(childDownLines).toHaveLength(children.length);

    for (const child of children) {
      const cx = centerX(child.x);
      const matchingLine = childDownLines.find((line) => line.x1 === cx && line.x2 === cx);

      expect(matchingLine, `missing child-down line for ${child.person.id}`).toBeTruthy();
      expect(matchingLine?.y2).toBe(child.y);
      expect(matchingLine?.y1).toBeLessThan(child.y);
    }
  });

  it("uses the midpoint between parents as the family center and vertical connector", () => {
    const layout = buildVietnameseFamilyLayout({
      familyId: "f-center",
      parents: [
        {
          role: "husband",
          person: person("father", "Cha"),
        },
        {
          role: "wife",
          person: person("mother", "Mẹ"),
        },
      ],
      children: [person("c1", "Con 1")],
    });

    const parents = layout.nodes.filter((node) => node.role === "parent");
    const expectedCenterX =
      (centerX(parents[0].x) + centerX(parents[1].x)) / 2;

    expect(layout.centerX).toBe(expectedCenterX);

    const spouseLine = layout.lines.find((line) => line.type === "spouse");
    expect(spouseLine).toBeTruthy();
    expect(spouseLine?.x1).toBe(centerX(parents[0].x));
    expect(spouseLine?.x2).toBe(centerX(parents[1].x));
    expect(spouseLine?.y1).toBe(centerY(parents[0].y));
    expect(spouseLine?.y2).toBe(centerY(parents[1].y));

    const centerDown = layout.lines.find((line) => line.type === "center-down");
    expect(centerDown).toBeTruthy();
    expect(centerDown?.x1).toBe(layout.centerX);
    expect(centerDown?.x2).toBe(layout.centerX);
  });

  it("allocates enough width for expanded child spouses", () => {
    const spouse1 = person("spouse1", "Dâu 1");
    const spouse2 = person("spouse2", "Dâu 2");

    const expandedSpousesByChildId = new Map<string, VietnameseTreePerson[]>([
      ["c1", [spouse1, spouse2]],
    ]);

    const layout = buildVietnameseFamilyLayout({
      familyId: "f-child-spouses",
      parents: [
        {
          role: "husband",
          person: person("father", "Cha"),
        },
      ],
      children: [
        person("c1", "Con 1", { birth_order: 1 }),
        person("c2", "Con 2", { birth_order: 2 }),
      ],
      expandedSpousesByChildId,
    });

    const child = layout.nodes.find(
      (node) => node.role === "child" && node.person.id === "c1",
    );
    const spouses = layout.nodes.filter(
      (node) => node.role === "child-spouse" && node.anchorChildId === "c1",
    );

    expect(child).toBeTruthy();
    expect(spouses).toHaveLength(2);

    const naturalUnitWidth =
      3 * VIET_NODE_WIDTH + 2 * VIET_SPOUSE_GAP;

    const left = Math.min(child!.x, ...spouses.map((node) => node.x));
    const right = Math.max(
      child!.x + VIET_NODE_WIDTH,
      ...spouses.map((node) => node.x + VIET_NODE_WIDTH),
    );

    expect(right - left).toBe(naturalUnitWidth);
    expect(layout.width).toBeGreaterThanOrEqual(naturalUnitWidth);
  });

  it("connects child-spouse lines from child center to each spouse center", () => {
    const spouse1 = person("spouse1", "Dâu 1");
    const spouse2 = person("spouse2", "Dâu 2");

    const layout = buildVietnameseFamilyLayout({
      familyId: "f-child-spouse-lines",
      parents: [
        {
          role: "husband",
          person: person("father", "Cha"),
        },
      ],
      children: [person("c1", "Con 1")],
      expandedSpousesByChildId: new Map([["c1", [spouse1, spouse2]]]),
    });

    const child = layout.nodes.find(
      (node) => node.role === "child" && node.person.id === "c1",
    );
    const spouseNodes = layout.nodes.filter(
      (node) => node.role === "child-spouse" && node.anchorChildId === "c1",
    );

    expect(child).toBeTruthy();
    expect(spouseNodes).toHaveLength(2);

    for (const spouse of spouseNodes) {
      const line = layout.lines.find(
        (item) =>
          item.id ===
          `f-child-spouse-lines:child-spouse-line:c1:${spouse.person.id}`,
      );

      expect(line).toBeTruthy();
      expect(line?.type).toBe("spouse");
      expect(line?.x1).toBe(centerX(child!.x));
      expect(line?.y1).toBe(centerY(child!.y));
      expect(line?.x2).toBe(centerX(spouse.x));
      expect(line?.y2).toBe(centerY(spouse.y));
    }
  });

  it("honors requested child unit width when wider than natural width", () => {
    const requestedWidth = 600;

    const layout = buildVietnameseFamilyLayout({
      familyId: "f-requested-width",
      parents: [
        {
          role: "husband",
          person: person("father", "Cha"),
        },
      ],
      children: [person("c1", "Con 1")],
      childUnitWidthByChildId: new Map([["c1", requestedWidth]]),
    });

    expect(layout.width).toBeGreaterThanOrEqual(requestedWidth);

    const child = layout.nodes.find(
      (node) => node.role === "child" && node.person.id === "c1",
    );

    expect(child).toBeTruthy();
    expect(centerX(child!.x)).toBe(layout.width / 2);
  });
});