export type SqlSnippet = {
  id: string;
  title: string;
  description: string;
  /**
   * true = chỉ đọc dữ liệu (SELECT), không cần gõ CHAY-SQL để xác nhận.
   * false = có ghi/xóa dữ liệu, luôn cần xác nhận.
   */
  readOnly: boolean;
  sql: string;
};

export type SqlSnippetGroup = {
  id: string;
  label: string;
  snippets: SqlSnippet[];
};

export const adminSqlLibrary: SqlSnippetGroup[] = [
  {
    id: "audit",
    label: "Audit bảo mật",
    snippets: [
      {
        id: "audit-security-definer-unguarded",
        title: "Tìm SECURITY DEFINER function thiếu check admin",
        readOnly: true,
        description:
          "Liệt kê các function SECURITY DEFINER đang được cấp quyền cho role " +
          "'authenticated' hoặc 'anon'. Cột looks_guarded chỉ là suy đoán theo " +
          "cách heuristic (dò chữ 'role = admin' / 'is_admin' / 'isAdmin' trong " +
          "source code function) - looks_guarded = false nghĩa là CẦN TỰ ĐỌC LẠI " +
          "function đó để xác nhận có đang bị lộ cho non-admin gọi thẳng qua " +
          "PostgREST hay không (giống lỗi đã tìm thấy ở repair_events_missing_person_links, " +
          "soft_delete_empty_families, soft_delete_duplicate_birth_death_events trước khi vá).",
        sql: `BEGIN;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  r.rolname AS granted_to,
  CASE
    WHEN pg_get_functiondef(p.oid) ILIKE '%role = ''admin''%'
      OR pg_get_functiondef(p.oid) ILIKE '%is_admin%'
      OR pg_get_functiondef(p.oid) ILIKE '%isAdmin%'
      OR pg_get_functiondef(p.oid) ILIKE '%assertAdminAction%'
    THEN true
    ELSE false
  END AS looks_guarded
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL (
  SELECT (aclexplode(p.proacl)).grantee AS grantee_oid
) acl ON true
JOIN pg_roles r ON r.oid = acl.grantee_oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND r.rolname IN ('authenticated', 'anon')
ORDER BY looks_guarded ASC, function_name;

COMMIT;`,
      },
      {
        id: "audit-all-function-grants",
        title: "Liệt kê toàn bộ quyền EXECUTE trên function trong schema public",
        readOnly: true,
        description:
          "Xem tổng quan mọi function trong schema public đang được GRANT cho " +
          "role nào (anon/authenticated/service_role...), kèm có phải " +
          "SECURITY DEFINER hay không. Dùng để rà soát định kỳ, không chỉ khi " +
          "nghi ngờ có lỗi.",
        sql: `BEGIN;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer,
  r.rolname AS granted_to
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL (
  SELECT (aclexplode(p.proacl)).grantee AS grantee_oid
) acl ON true
JOIN pg_roles r ON r.oid = acl.grantee_oid
WHERE n.nspname = 'public'
ORDER BY function_name, granted_to;

COMMIT;`,
      },
      {
        id: "audit-rls-status",
        title: "Kiểm tra bảng nào chưa bật RLS",
        readOnly: true,
        description:
          "Liệt kê các bảng trong schema public chưa bật Row Level Security " +
          "(rls_enabled = false). Bảng không bật RLS mà có API tự động của " +
          "PostgREST thì mặc định lộ toàn bộ dữ liệu cho mọi request có key hợp lệ.",
        sql: `BEGIN;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY rls_enabled ASC, table_name;

COMMIT;`,
      },
      {
        id: "audit-policies-overview",
        title: "Xem toàn bộ RLS policy hiện có theo từng bảng",
        readOnly: true,
        description:
          "Liệt kê mọi policy đang áp dụng: bảng nào, lệnh nào (SELECT/INSERT/" +
          "UPDATE/DELETE), điều kiện USING/WITH CHECK. Dùng để soát lại sau khi " +
          "chạy các migration RLS 053-061, đảm bảo không có policy nào quá " +
          "permissive hoặc bị trùng.",
        sql: `BEGIN;

SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS command,
  roles,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

COMMIT;`,
      },
    ],
  },
  {
    id: "family-lookup",
    label: "Family Model - Xem thông tin",
    snippets: [
      {
        id: "lookup-person-families",
        title: "Xem 1 người đang thuộc (những) gia đình nào",
        readOnly: true,
        description:
          "Nhập person_id cần tra vào chỗ '<PERSON_ID>'. Trả về mọi dòng ở " +
          "family_parents (người này làm cha/mẹ) và family_children (người này " +
          "làm con) mà family vẫn đang active. Một người có thể xuất hiện ở " +
          "nhiều gia đình cùng lúc (VD: vừa là con trong gia đình gốc, vừa là " +
          "cha/mẹ trong gia đình do họ lập ra).",
        sql: `BEGIN;

SELECT
  'parent' AS vai_tro,
  fp.family_id,
  f.status AS family_status,
  fp.role::text AS chi_tiet_vai_tro,
  p.full_name AS ten_nguoi
FROM public.family_parents fp
JOIN public.families f ON f.id = fp.family_id AND f.deleted_at IS NULL
JOIN public.persons p ON p.id = fp.person_id
WHERE fp.person_id = '<PERSON_ID>'

UNION ALL

SELECT
  'child' AS vai_tro,
  fc.family_id,
  f.status AS family_status,
  fc.relationship_type::text AS chi_tiet_vai_tro,
  p.full_name AS ten_nguoi
FROM public.family_children fc
JOIN public.families f ON f.id = fc.family_id AND f.deleted_at IS NULL
JOIN public.persons p ON p.id = fc.person_id
WHERE fc.person_id = '<PERSON_ID>'

ORDER BY vai_tro;

COMMIT;`,
      },
      {
        id: "lookup-family-members",
        title: "Xem toàn bộ thành viên của 1 gia đình",
        readOnly: true,
        description:
          "Nhập family_id vào chỗ '<FAMILY_ID>'. Trả về danh sách cha/mẹ và " +
          "con trong gia đình đó, kèm tên và trạng thái đã xóa mềm hay chưa " +
          "(deleted_at) để phát hiện các liên kết trỏ tới người đã bị soft-delete.",
        sql: `BEGIN;

SELECT
  'parent' AS vai_tro,
  fp.role::text AS chi_tiet_vai_tro,
  p.id AS person_id,
  p.full_name AS ten_nguoi,
  p.deleted_at AS person_deleted_at
FROM public.family_parents fp
JOIN public.persons p ON p.id = fp.person_id
WHERE fp.family_id = '<FAMILY_ID>'

UNION ALL

SELECT
  'child' AS vai_tro,
  fc.relationship_type::text AS chi_tiet_vai_tro,
  p.id AS person_id,
  p.full_name AS ten_nguoi,
  p.deleted_at AS person_deleted_at
FROM public.family_children fc
JOIN public.persons p ON p.id = fc.person_id
WHERE fc.family_id = '<FAMILY_ID>'

ORDER BY vai_tro, ten_nguoi;

COMMIT;`,
      },
      {
        id: "lookup-person-search-id",
        title: "Tìm person_id theo tên (để dùng cho các SQL khác)",
        readOnly: true,
        description:
          "Tiện ích nhỏ: gõ 1 phần tên vào chỗ '<TU_KHOA>' để tìm person_id " +
          "tương ứng, vì hầu hết các SQL khác trong thư viện này cần person_id " +
          "(UUID) chứ không nhận tên trực tiếp.",
        sql: `BEGIN;

SELECT id, full_name, gender, birth_year, death_year, deleted_at
FROM public.persons
WHERE full_name ILIKE '%<TU_KHOA>%'
ORDER BY full_name
LIMIT 30;

COMMIT;`,
      },
    ],
  },
  {
    id: "family-move",
    label: "Family Model - Chuyển người giữa các gia đình",
    snippets: [
      {
        id: "move-child-between-families",
        title: "Chuyển 1 người (vai trò CON) từ gia đình A sang gia đình B",
        readOnly: false,
        description:
          "Dùng khi 1 người đang được gắn làm con (family_children) ở nhầm " +
          "gia đình, cần chuyển sang gia đình đúng. Thay '<PERSON_ID>', " +
          "'<FAMILY_ID_CU>', '<FAMILY_ID_MOI>' bằng giá trị thật. Có điều kiện " +
          "NOT EXISTS để tránh tạo dòng trùng nếu người này đã có sẵn ở gia " +
          "đình đích. relationship_type, sort_order và các cột khác được giữ " +
          "nguyên như cũ, chỉ đổi family_id. Chạy trong transaction, nếu " +
          "UPDATE ảnh hưởng 0 dòng nghĩa là không tìm thấy đúng cặp person/family " +
          "cũ - kiểm tra lại bằng SQL 'Xem 1 người đang thuộc gia đình nào' trước.",
        sql: `BEGIN;

UPDATE public.family_children
SET family_id = '<FAMILY_ID_MOI>'
WHERE person_id = '<PERSON_ID>'
  AND family_id = '<FAMILY_ID_CU>'
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_children fc2
    WHERE fc2.family_id = '<FAMILY_ID_MOI>'
      AND fc2.person_id = '<PERSON_ID>'
  );

COMMIT;`,
      },
      {
        id: "move-parent-between-families",
        title: "Chuyển 1 người (vai trò CHA/MẸ) từ gia đình A sang gia đình B",
        readOnly: false,
        description:
          "Dùng khi 1 người đang được gắn làm cha/mẹ (family_parents) ở nhầm " +
          "gia đình. Thay '<PERSON_ID>', '<FAMILY_ID_CU>', '<FAMILY_ID_MOI>'. " +
          "Cẩn thận: một family thường chỉ nên có tối đa 2 parent - chạy SQL " +
          "'Xem toàn bộ thành viên của 1 gia đình' trên FAMILY_ID_MOI trước để " +
          "chắc chắn không tạo ra family có 3+ parent.",
        sql: `BEGIN;

UPDATE public.family_parents
SET family_id = '<FAMILY_ID_MOI>'
WHERE person_id = '<PERSON_ID>'
  AND family_id = '<FAMILY_ID_CU>'
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_parents fp2
    WHERE fp2.family_id = '<FAMILY_ID_MOI>'
      AND fp2.person_id = '<PERSON_ID>'
  );

COMMIT;`,
      },
      {
        id: "remove-person-from-family",
        title: "Gỡ 1 người khỏi 1 gia đình (không chuyển sang đâu cả)",
        readOnly: false,
        description:
          "Dùng khi family_parents/family_children bị gắn sai hoàn toàn (không " +
          "phải chuyển nhầm mà là gắn thừa) và cần xóa hẳn dòng đó. Chỉ xóa " +
          "đúng 1 cặp person/family theo vai trò đã chọn (bỏ comment dòng " +
          "tương ứng - CHILD hoặc PARENT, không chạy cả hai cùng lúc nếu chỉ " +
          "muốn gỡ 1 vai trò).",
        sql: `BEGIN;

-- Gỡ vai trò CON:
DELETE FROM public.family_children
WHERE person_id = '<PERSON_ID>'
  AND family_id = '<FAMILY_ID>';

-- Gỡ vai trò CHA/ME (bỏ comment dòng dưới nếu cần):
-- DELETE FROM public.family_parents
-- WHERE person_id = '<PERSON_ID>'
--   AND family_id = '<FAMILY_ID>';

COMMIT;`,
      },
    ],
  },
];
