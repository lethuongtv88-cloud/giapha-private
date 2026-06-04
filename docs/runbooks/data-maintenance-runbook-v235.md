# Data Maintenance Runbook v2.3.5

## 1. Mục tiêu

Data Maintenance v2.3.5 cung cấp các công cụ kiểm tra và sửa dữ liệu sau migration/import/merge.

Các nhóm đã có:

- Unknown persons
- Duplicate birth/death events
- Events missing person_events links
- Empty families
- Data Maintenance index page

Nguyên tắc:

> Preview trước, repair sau. Không hard delete. Mọi thao tác repair phải có confirm.

---

## 2. Trang tổng quan

```text
/dashboard/data-maintenance

Dùng để vào nhanh các công cụ maintenance.

Kiểm tra tại đây:

Unknown persons count
Events missing links count
Empty families count
Link đến duplicate events
Link đến từng trang maintenance
3. Unknown Persons
/dashboard/data-maintenance/unknown-persons

Dùng để liệt kê người active có tên:

Unknown
Chưa rõ tên

Trang này chỉ liệt kê và dẫn đến trang sửa person.

Sau khi sửa tên, kiểm tra SQL:

SELECT COUNT(*) AS active_unknown_left
FROM public.persons
WHERE full_name IN ('Unknown', 'Chưa rõ tên')
  AND deleted_at IS NULL;

Kỳ vọng:

0
4. Duplicate Events
/dashboard/data-maintenance/duplicate-events

Dùng để tìm duplicate exact-match của event:

birth
death

Điều kiện group duplicate:

legacy_person_id
type
start_date
sort_date

Nếu có duplicate, trang có nút:

Soft-delete duplicates

RPC:

public.soft_delete_duplicate_birth_death_events()

Quy tắc:

Giữ lại 1 event đầu tiên mỗi nhóm.
Set deleted_at cho các event còn lại.
Không hard delete.

Kiểm tra SQL sau repair:

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

Kỳ vọng:

0
5. Events Missing Links
/dashboard/data-maintenance/events-missing-links

Dùng để tìm events active có:

legacy_person_id IS NOT NULL
type IN ('birth', 'death')

nhưng thiếu link tương ứng trong:

person_events

Nếu có missing links, trang có nút:

Repair N links

RPC:

public.repair_events_missing_person_links()

Quy tắc:

birth → role principal
death → role deceased
ON CONFLICT DO NOTHING
Không tạo trùng link

Kiểm tra SQL sau repair:

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

Kỳ vọng:

0
6. Empty Families
/dashboard/data-maintenance/empty-families

Dùng để tìm families active không có:

family_parents
family_children

Nếu có empty families, trang có nút:

Soft-delete N families

RPC:

public.soft_delete_empty_families()

Quy tắc:

Chỉ set deleted_at.
Không hard delete.
Không đụng family có parent hoặc child.

Kiểm tra SQL sau repair:

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

Kỳ vọng:

0
7. Full audit SQL

Chạy sau mỗi lần repair lớn:

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

Kỳ vọng sạch:

active_unknown_left = 0
events_without_person_events = 0
duplicate_groups = 0
active_empty_families = 0
8. Các migration liên quan
027_repair_events_missing_links_v235.sql
028_soft_delete_empty_families_v235.sql
029_soft_delete_duplicate_events_v235.sql

Các RPC repair:

repair_events_missing_person_links()
soft_delete_empty_families()
soft_delete_duplicate_birth_death_events()
9. Không được làm

Không làm:

- Không hard delete persons.
- Không hard delete events.
- Không hard delete families.
- Không repair khi chưa xem preview.
- Không chạy SQL delete thủ công nếu đã có RPC repair.
- Không tắt trigger prevent_hard_delete.
10. Checklist hoàn thành v2.3.5

Đạt khi:

- /dashboard/data-maintenance mở được.
- Unknown persons = 0.
- Duplicate events = 0 nhóm hoặc đã xử lý.
- Events missing links = 0 hoặc đã repair.
- Empty families = 0 hoặc đã soft-delete.
- test pass.
- build pass.
- runbook được commit.

---

## 2. Chạy test/build

```bash
bun run test
bun run build
3. Commit runbook
git status

git add docs/runbooks/data-maintenance-runbook-v235.md

git commit -m "docs(data): add data maintenance runbook"

git push
4. Kiểm tra audit cuối phase

Chạy SQL:

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
5. Nếu sạch, merge phase v2.3.5 về main
git checkout main
git pull origin main
git merge upgrade-v2.3.5-data-maintenance

bun run test
bun run build

git push origin main

git tag -a v2.3.5-data-maintenance -m "v2.3.5 Data Maintenance tools"
git push origin v2.3.5-data-maintenance

Sau khi xong v2.3.5, bước tiếp theo hợp lý là v2.3.6 Admin UX / navigation polish hoặc quay lại Vietnamese Tree performance/hardening.
