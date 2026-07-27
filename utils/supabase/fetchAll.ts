/**
 * Supabase/PostgREST mặc định giới hạn tối đa 1000 dòng cho mỗi request
 * (dù không dùng .limit()/.range()). Với `.select("*")` đơn giản trên các
 * bảng lớn (persons, relationships, family_parents, family_children,
 * person_events...), nếu bảng có > 1000 dòng thì dữ liệu trả về BỊ CẮT BỚT
 * một cách ÂM THẦM (không báo lỗi) - dẫn tới các phép so sánh kiểu
 * "person X có tồn tại trong tập đã fetch không" bị SAI (false positive),
 * ví dụ: các trang Data Quality báo hàng loạt "trỏ tới person không tồn
 * tại" dù person đó vẫn tồn tại bình thường, chỉ là không nằm trong 1000
 * dòng đầu được fetch.
 *
 * fetchAll() phân trang bằng .range() để lấy TOÀN BỘ dữ liệu của 1 bảng,
 * bất kể có bao nhiêu dòng.
 */
export async function fetchAll<T = any>(
  supabase: any,
  table: string,
  selectClause: string,
  pageSize = 1000,
): Promise<{ data: T[] | null; error: any }> {
  let all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectClause)
      .range(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    if (!data || data.length === 0) break;

    all = all.concat(data as T[]);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
