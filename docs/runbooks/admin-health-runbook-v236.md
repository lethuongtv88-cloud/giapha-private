# Admin Health Runbook v2.3.6

## 1. Mục tiêu

Admin Health là trang tổng quan nhanh cho quản trị viên sau các phase:

- Family Model migration
- Event Model migration
- GEDCOM Import/Merge
- Data Maintenance
- Vietnamese Tree hardening

Route:

```text
/dashboard/admin-health
```

Trang này chỉ đọc dữ liệu, không sửa DB.

Admin Health giúp phát hiện nhanh các nhóm vấn đề thường gặp sau khi import, merge, repair hoặc chỉnh dữ liệu:

- Người còn tên Unknown/Chưa rõ tên.
- Birth/death events thiếu `person_events`.
- Nhóm birth/death events bị duplicate.
- Families active bị rỗng.
- Import sessions còn mở.
- Merge suggestions còn pending/approved.

---

## 2. Các chỉ số chính

Admin Health hiện theo dõi:

```text
Unknown persons
Events missing links
Duplicate event groups
Empty families
Open import sessions
Pending merge suggestions
Approved merge suggestions
```

Ý nghĩa mức độ:

```text
ok       Không cần xử lý.
info     Có dữ liệu đang chờ, không nhất thiết là lỗi.
warning  Nên kiểm tra và xử lý khi rảnh.
error    Lỗi blocking, cần xử lý trước khi tiếp tục import/merge lớn.
```

---

## 3. Ý nghĩa từng chỉ số

### 3.1. Unknown persons

Link:

```text
/dashboard/data-maintenance/unknown-persons
```

Ý nghĩa:

```text
Người active còn tên Unknown hoặc Chưa rõ tên.
```

Kỳ vọng tốt:

```text
0
```

Nếu > 0:

1. Mở card Unknown persons.
2. Kiểm tra từng người.
3. Nếu là người thật, cập nhật tên trong trang sửa person.
4. Nếu là dữ liệu import lỗi, xử lý theo Data Maintenance hoặc soft-delete theo policy riêng.

SQL kiểm tra:

```sql
SELECT COUNT(*) AS active_unknown_left
FROM public.persons
WHERE full_name IN ('Unknown', 'Chưa rõ tên')
  AND deleted_at IS NULL;
```

---

### 3.2. Events missing links

Link:

```text
/dashboard/data-maintenance/events-missing-links
```

Ý nghĩa:

```text
Birth/death events có legacy_person_id nhưng thiếu person_events link.
```

Kỳ vọng tốt:

```text
0
```

Nếu > 0:

1. Mở Events missing links.
2. Kiểm tra danh sách.
3. Bấm Repair links nếu đúng.
4. Repair dùng RPC:

```text
repair_events_missing_person_links()
```

Quy tắc repair:

```text
birth -> principal
death -> deceased
ON CONFLICT DO NOTHING
```

Đây là lỗi blocking trong Admin Health vì event không link được về person thì UI/timeline/statistics có thể thiếu dữ liệu.

SQL kiểm tra:

```sql
SELECT COUNT(*) AS events_without_person_events
FROM public.events e
WHERE e.deleted_at IS NULL
  AND e.legacy_person_id IS NOT NULL
  AND e.type IN ('birth', 'death')
  AND NOT EXISTS (
    SELECT 1 FROM public.person_events pe
    WHERE pe.event_id = e.id
      AND pe.person_id = e.legacy_person_id
  );
```

---

### 3.3. Duplicate event groups

Link:

```text
/dashboard/data-maintenance/duplicate-events
```

Ý nghĩa:

```text
Nhóm birth/death events trùng exact-match theo:
legacy_person_id + type + start_date + sort_date
```

Kỳ vọng tốt:

```text
0
```

Nếu > 0:

1. Mở Duplicate events.
2. Xem danh sách.
3. Nếu đúng là duplicate, bấm soft-delete duplicates.
4. RPC:

```text
soft_delete_duplicate_birth_death_events()
```

Quy tắc:

```text
Mỗi nhóm giữ lại 1 event đại diện.
Các event còn lại chỉ set deleted_at.
Không hard delete.
```

SQL kiểm tra:

```sql
WITH grouped AS (
  SELECT
    e.legacy_person_id,
    e.type,
    e.start_date,
    e.sort_date,
    COUNT(*) AS c
  FROM public.events e
  WHERE e.deleted_at IS NULL
    AND e.legacy_person_id IS NOT NULL
    AND e.type IN ('birth', 'death')
  GROUP BY e.legacy_person_id, e.type, e.start_date, e.sort_date
  HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS duplicate_groups
FROM grouped;
```

---

### 3.4. Empty families

Link:

```text
/dashboard/data-maintenance/empty-families
```

Ý nghĩa:

```text
Families active không có family_parents và không có family_children.
```

Kỳ vọng tốt:

```text
0
```

Nếu > 0:

1. Mở Empty families.
2. Kiểm tra danh sách.
3. Nếu đúng là rỗng/thừa, bấm soft-delete.
4. RPC:

```text
soft_delete_empty_families()
```

Quy tắc:

```text
Chỉ set deleted_at.
Không hard delete.
Không đụng family có parent hoặc child.
```

SQL kiểm tra:

```sql
SELECT COUNT(*) AS active_empty_families
FROM public.families f
WHERE f.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.family_parents fp
    WHERE fp.family_id = f.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.family_children fc
    WHERE fc.family_id = f.id
  );
```

---

### 3.5. Open import sessions

Link:

```text
/dashboard/import
```

Ý nghĩa:

```text
Import sessions chưa committed/cancelled.
```

Có thể > 0 nếu đang test GEDCOM round-trip hoặc đang review import.

Nếu là session test đã xong, có thể xóa session chưa committed:

```sql
DELETE FROM public.import_sessions
WHERE id = '<SESSION_ID>'
  AND status <> 'committed';
```

Không xóa session đã `committed`.

SQL kiểm tra:

```sql
SELECT id, file_name, status, created_at
FROM public.import_sessions
WHERE status NOT IN ('committed', 'cancelled')
ORDER BY created_at DESC;
```

---

### 3.6. Pending merge suggestions

Link:

```text
/dashboard/import
```

Ý nghĩa:

```text
Merge suggestions đang chờ duyệt.
```

Nếu > 0:

1. Mở session import tương ứng.
2. Vào Merge Plan.
3. Approve / skip / reject từng suggestion.

SQL kiểm tra:

```sql
SELECT status, COUNT(*)
FROM public.import_merge_suggestions
GROUP BY status
ORDER BY status;
```

---

### 3.7. Approved merge suggestions

Link:

```text
/dashboard/import
```

Ý nghĩa:

```text
Merge suggestions đã approve nhưng chưa commit.
```

Nếu > 0:

1. Mở Merge Plan.
2. Kiểm tra lại.
3. Nếu đúng, bấm Commit approved suggestions.
4. Nếu chưa chắc, chuyển về pending/skipped/rejected.

Approved suggestions chưa commit là warning vì dữ liệu đang ở trạng thái nửa chừng.

---

## 4. Full SQL audit

Dùng khi muốn kiểm tra nhanh ngoài UI.

```sql
SELECT COUNT(*) AS active_unknown_left
FROM public.persons
WHERE full_name IN ('Unknown', 'Chưa rõ tên')
  AND deleted_at IS NULL;

SELECT COUNT(*) AS events_without_person_events
FROM public.events e
WHERE e.deleted_at IS NULL
  AND e.legacy_person_id IS NOT NULL
  AND e.type IN ('birth', 'death')
  AND NOT EXISTS (
    SELECT 1 FROM public.person_events pe
    WHERE pe.event_id = e.id
      AND pe.person_id = e.legacy_person_id
  );

WITH grouped AS (
  SELECT
    e.legacy_person_id,
    e.type,
    e.start_date,
    e.sort_date,
    COUNT(*) AS c
  FROM public.events e
  WHERE e.deleted_at IS NULL
    AND e.legacy_person_id IS NOT NULL
    AND e.type IN ('birth', 'death')
  GROUP BY e.legacy_person_id, e.type, e.start_date, e.sort_date
  HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS duplicate_groups
FROM grouped;

SELECT COUNT(*) AS active_empty_families
FROM public.families f
WHERE f.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.family_parents fp
    WHERE fp.family_id = f.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.family_children fc
    WHERE fc.family_id = f.id
  );

SELECT COUNT(*) AS open_import_sessions
FROM public.import_sessions
WHERE status NOT IN ('committed', 'cancelled');

SELECT status, COUNT(*)
FROM public.import_merge_suggestions
GROUP BY status
ORDER BY status;
```

Kỳ vọng tốt:

```text
active_unknown_left = 0
events_without_person_events = 0
duplicate_groups = 0
active_empty_families = 0
approved merge suggestions = 0 hoặc đã hiểu rõ
pending merge suggestions = 0 hoặc đang review
```

---

## 5. Quy tắc an toàn

Không làm:

```text
- Không hard delete persons.
- Không hard delete events.
- Không hard delete families.
- Không commit import session round-trip.
- Không commit approved merge suggestions nếu chưa hiểu payload.
- Không chạy SQL update/delete thủ công khi đã có RPC maintenance.
```

---

## 6. CLI kiểm tra liên quan

Chạy đầy đủ trước khi deploy/tag:

```bash
bun run audit:routes
bun run audit:migrations
bun run test
bun run build
```

Hoặc nếu đã có script tổng:

```bash
bun run release:check
```

---

## 7. Checklist hoàn thành v2.3.6

Hoàn thành khi:

```text
- /dashboard/admin-health mở được.
- Dashboard có card Admin Health.
- HeaderMenu có link Admin Health.
- Data Quality có quick link Admin Health.
- Admin Health metrics load được.
- Events missing links = 0.
- Duplicate event groups = 0 hoặc đã hiểu rõ.
- Empty families = 0 hoặc đã xử lý.
- Unknown persons = 0.
- test pass.
- build pass.
- runbook được commit.
```

---

## 8. Deploy/restart production

Production hiện chạy bằng root PM2:

```text
name: giapha
cwd: /opt/giapha-os
command: bun run start
port: 3000
```

Deploy chuẩn:

```bash
cd /opt/giapha-os

git checkout main
git pull origin main

bun install
bun run release:check

sudo rm -rf .next
bun run build

sudo pm2 restart giapha --update-env
sudo pm2 save
```

Kiểm tra:

```bash
sudo pm2 list
sudo ss -ltnp | grep ':3000'
curl -I http://127.0.0.1:3000
```
