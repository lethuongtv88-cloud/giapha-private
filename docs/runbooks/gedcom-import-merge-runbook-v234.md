# GEDCOM Import / Merge Runbook v2.3.4

## 1. Mục tiêu

Quy trình GEDCOM v2.3.4 dùng để:

- Export GEDCOM UTF-8 từ Gia Phả.
- Import GEDCOM vào staging trước, không ghi thẳng vào dữ liệu chính.
- Chống tạo trùng person bằng stable UUID XREF.
- Review person match / possible match.
- Kiểm tra round-trip export → import.
- Tạo merge suggestions cho dữ liệu GEDCOM nguồn ngoài.
- Commit chỉ các merge suggestions đã được approve.

Nguyên tắc chính:

> Không import trực tiếp vào dữ liệu chính nếu chưa qua staging, review, dry-run và audit.

---

## 2. Các màn hình liên quan

### 2.1. Import chính

```text
/dashboard/import
````

Dùng để:

* Upload GEDCOM.
* Xem danh sách import sessions.
* Mở preview session.
* Xóa staging session chưa commit.

### 2.2. Import preview

```text
/dashboard/import/<SESSION_ID>
```

Dùng để:

* Xem summary parse.
* Xem GEDCOM round-trip report.
* Xem import safety gate.
* Mở Match Review.
* Mở Merge Plan.
* Mở Audit.
* Kiểm tra commit plan.
* Commit staging vào dữ liệu chính nếu thật sự cần.

### 2.3. Match Review

```text
/dashboard/import/<SESSION_ID>/matches
```

Dùng để:

* Xem strong matches.
* Xem possible matches.
* Xem create candidates.
* Xem unknown candidates.
* Skip possible matches nếu đúng là dữ liệu đã có.
* Chuyển một possible match thành create nếu xác nhận là người mới.

### 2.4. Merge Plan

```text
/dashboard/import/<SESSION_ID>/merge
```

Dùng để:

* Xem GEDCOM event nào có thể bổ sung cho matched persons.
* Tạo merge suggestions từ nhóm `can_create`.
* Approve / skip / reject từng suggestion.
* Commit approved suggestions vào `events` và `person_events`.

### 2.5. Audit

```text
/dashboard/import/<SESSION_ID>/audit
```

Dùng để kiểm tra sau import/merge:

* Active unknown persons.
* Orphan active events.
* Duplicate birth/death events.
* Events without person_events link.
* Active empty families.
* GEDCOM merge events.
* Committed merge suggestions.

---

## 3. Round-trip test từ chính app

Dùng khi muốn kiểm tra:

```text
Export GEDCOM từ Gia Phả → Import lại staging → Không tạo duplicate
```

### 3.1. Quy trình

1. Vào trang export GEDCOM.
2. Export file GEDCOM full mới.
3. Vào:

```text
/dashboard/import
```

4. Upload file GEDCOM vừa export.
5. Mở import preview session.

### 3.2. Kết quả đúng

Round-trip đúng khi summary có dạng:

```text
persons = matches
possibleMatches = 0
errors = 0
person create candidates = 0
```

Ví dụ tốt:

```text
persons: 453
matches: 453
possibleMatches: 0
errors: 0
```

Khi đó trang preview phải hiện:

```text
GEDCOM round-trip safe
```

và safety gate phải nhắc:

```text
Đây là session kiểm tra export/import, không cần COMMIT.
```

### 3.3. Không commit round-trip session

Với session round-trip từ chính app:

```text
KHÔNG bấm COMMIT.
```

Lý do:

* Dữ liệu đã có trong DB.
* Mục tiêu chỉ là chứng minh không duplicate.
* Nếu commit thì không có dữ liệu mới cần thêm.

Có thể xóa staging session sau khi kiểm tra:

```sql
DELETE FROM public.import_sessions
WHERE id = '<SESSION_ID>'
  AND status <> 'committed';
```

---

## 4. Nếu round-trip không đạt

### 4.1. Có person create candidates

Nếu file export từ chính app mà có:

```text
person action=create
```

thì kiểm tra:

```sql
SELECT id, full_name
FROM public.persons
WHERE id = '<external_id_bị_create>';
```

Nếu không có dòng nào, có thể file GEDCOM được export từ phiên bản cũ chưa dùng stable UUID XREF.

Cần:

1. Export lại file GEDCOM mới.
2. Import staging lại.
3. Không dùng file GEDCOM cũ để đánh giá round-trip.

### 4.2. Có possible matches

Nếu có:

```text
person action=match status=pending
```

thì mở:

```text
/dashboard/import/<SESSION_ID>/matches
```

Nếu đây là file export từ chính app và các possible matches đúng là người đã có:

```text
Skip tất cả possible matches
```

Sau đó chạy lại kiểm tra commit plan hoặc refresh preview.

---

## 5. Import GEDCOM nguồn ngoài

GEDCOM nguồn ngoài là file không xuất từ app hiện tại, ví dụ:

* File từ phần mềm gia phả khác.
* File cũ.
* File do người khác gửi.
* File đã chỉnh tay.

Không được coi là round-trip safe.

### 5.1. Quy trình an toàn

1. Upload GEDCOM vào staging.
2. Xem preview summary.
3. Mở Match Review.
4. Xử lý từng nhóm:

   * Strong matches: thường để skipped.
   * Possible matches: review kỹ.
   * Create candidates: chỉ approve nếu chắc là người mới.
   * Unknown: không approve nếu chưa rõ.
5. Mở Merge Plan.
6. Nếu có `can_create`, tạo merge suggestions.
7. Review từng merge suggestion.
8. Approve suggestion thật sự muốn merge.
9. Commit approved merge suggestions.
10. Mở Audit.

---

## 6. Merge suggestions

Merge suggestions là lớp review giữa GEDCOM staging và dữ liệu chính.

### 6.1. Tạo suggestions

Trong Merge Plan:

```text
Tạo suggestions
```

Hệ thống chỉ tạo suggestion cho các event có trạng thái:

```text
can_create
```

Hiện tại hỗ trợ:

```text
create_event
```

cho:

```text
birth
death
```

### 6.2. Duyệt suggestions

Trạng thái:

```text
pending
approved
skipped
rejected
committed
```

Ý nghĩa:

* `pending`: mới tạo, chưa quyết định.
* `approved`: sẽ được commit nếu bấm commit approved suggestions.
* `skipped`: bỏ qua.
* `rejected`: từ chối.
* `committed`: đã ghi vào dữ liệu chính.

### 6.3. Commit suggestions

Chỉ bấm:

```text
Commit approved suggestions
```

sau khi đã kiểm tra kỹ.

RPC commit sẽ:

* Insert vào `events`.
* Insert vào `person_events`.
* Không tạo duplicate nếu event cùng person/type/date đã tồn tại.
* Đổi suggestion thành `committed`.

---

## 7. Audit sau import/merge

Sau khi commit merge suggestions, mở:

```text
/dashboard/import/<SESSION_ID>/audit
```

Audit tốt khi:

```text
Orphan active events = 0
Duplicate birth/death events = 0
Events without person_events link = 0
Active empty families = 0
```

`Active unknown persons` có thể > 0 nếu đây là những người được nhập thủ công chưa biết tên. Trường hợp này là info, không nhất thiết là lỗi.

---

## 8. SQL kiểm tra nhanh

### 8.1. Unknown active persons

```sql
SELECT COUNT(*) AS active_unknown_left
FROM public.persons
WHERE full_name IN ('Unknown', 'Chưa rõ tên')
  AND deleted_at IS NULL;
```

### 8.2. Orphan active events

```sql
SELECT COUNT(*) AS orphan_active_events
FROM public.events e
WHERE e.deleted_at IS NULL
  AND e.family_id IS NULL
  AND e.legacy_person_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.person_events pe
    WHERE pe.event_id = e.id
  );
```

### 8.3. Events missing person_events link

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

### 8.4. Empty active families

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

### 8.5. Staging summary

```sql
SELECT record_type, action, status, confidence, COUNT(*)
FROM public.import_staging_records
WHERE session_id = '<SESSION_ID>'
GROUP BY record_type, action, status, confidence
ORDER BY record_type, action, status, confidence;
```

### 8.6. Merge suggestions summary

```sql
SELECT suggestion_type, status, COUNT(*)
FROM public.import_merge_suggestions
WHERE session_id = '<SESSION_ID>'
GROUP BY suggestion_type, status
ORDER BY suggestion_type, status;
```

---

## 9. Những việc không được làm

Không làm:

```text
- Không hard delete events.
- Không hard delete persons thật.
- Không commit round-trip session.
- Không approve tất cả nếu còn possible matches chưa hiểu rõ.
- Không commit file GEDCOM nguồn ngoài nếu chưa mở Match Review.
- Không commit merge suggestions khi chưa chạy Audit hoặc chưa hiểu can_create.
- Không tắt trigger safety.
```

---

## 10. Quy ước commit code

Sau mỗi mốc pass:

```bash
bun run test
bun run build
git status
git add <files>
git commit -m "<message>"
git push
```

Gợi ý commit messages:

```text
fix(gedcom): use stable UUID XREFs for round-trip import
feat(import): add GEDCOM round-trip validation report
feat(import): add preview-only GEDCOM merge plan
feat(import): add GEDCOM merge suggestions review layer
feat(import): commit approved GEDCOM merge suggestions
feat(import): add GEDCOM post-import audit report
feat(import): add import safety gate
docs(import): add GEDCOM import merge runbook
```

---

## 11. Trạng thái hoàn thành v2.3.4 GEDCOM Import/Merge

Đạt khi:

```text
- GEDCOM export dùng person.id làm INDI XREF.
- GEDCOM parser giữ UUID XREF.
- Import staging match 100% với file export từ app.
- Match Review hoạt động.
- Round-trip report hoạt động.
- Merge Plan hoạt động.
- Merge Suggestions hoạt động.
- Commit approved merge suggestions hoạt động.
- Audit report hoạt động.
- Safety Gate hoạt động.
- Runbook được commit vào repo.
```

````

---

## 2. Chạy test/build

```bash
bun run test
bun run build
````

## 3. Commit

```bash
git status

git add docs/runbooks/gedcom-import-merge-runbook-v234.md

git commit -m "docs(import): add GEDCOM import merge runbook"

git push
```

---

Sau bước này, mảng **GEDCOM Import/Merge v2.3.4** xem như đã khóa mốc. Tiếp theo nên chuyển sang **cleanup/hardening cuối phase**: rà lại migration files, gộp docs, kiểm tra route import, và chuẩn bị merge branch về main.
