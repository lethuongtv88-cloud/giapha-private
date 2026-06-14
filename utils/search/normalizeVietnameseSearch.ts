export function normalizeVietnameseSearch(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function includesVietnameseSearch(
  source: unknown,
  query: unknown,
): boolean {
  const normalizedQuery = normalizeVietnameseSearch(query);

  if (!normalizedQuery) return true;

  return normalizeVietnameseSearch(source).includes(normalizedQuery);
}
