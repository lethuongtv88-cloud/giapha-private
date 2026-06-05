# GEDCOM Import / Merge Runbook v2.3.4

## 1. Mục tiêu

GEDCOM Import/Merge v2.3.4 tạo luồng import an toàn cho dữ liệu gia phả:

- Parse GEDCOM vào staging trước.
- Không ghi trực tiếp vào dữ liệu chính.
- Matching người đã tồn tại.
- Review duplicate/possible match.
- Merge Plan preview.
- Merge Suggestions review.
- Commit chỉ các suggestion đã approved.
- Audit sau import/merge.
- Hỗ trợ GEDCOM round-trip từ chính app.

Nguyên tắc:

> Không commit khi chưa review. Round-trip từ file export của chính app phải match 100%, không tạo person mới.

---

## 2. Các route chính

```text
/dashboard/import
/dashboard/import/<SESSION_ID>
/dashboard/import/<SESSION_ID>/matches
/dashboard/import/<SESSION_ID>/merge
/dashboard/import/<SESSION_ID>/audit
```

Ý nghĩa:

- `/dashboard/import`: Upload file GEDCOM và tạo staging session.
- `/dashboard/import/<SESSION_ID>`: Tổng quan session.
- `/matches`: Review person duplicate/possible match.
- `/merge`: Xem Merge Plan và suggestion.
- `/audit`: Kiểm tra sau import/merge.

---

## 3. Feature flag

Production nên bật:

```env
NEXT_PUBLIC_FF_GEDCOM_IMPORT_STAGING=true
```

Không nên dùng import trực tiếp không qua staging.

---

## 4. Luồng import chuẩn

### 4.1. Upload GEDCOM

Vào:

```text
/dashboard/import
```

Upload file `.ged`.

Sau khi parse thành công, hệ thống tạo staging session với summary:

```text
Persons
Names
Families
Family parents
Family children
Events
Person events
Matches
Possible matches
Warnings
Errors
Session ID
```

Nếu `Errors > 0`, không commit.

---

### 4.2. Kiểm tra summary

Các trường hợp thường gặp:

#### Round-trip từ chính app

Kỳ vọng:

```text
persons = matches
possibleMatches = 0
errors = 0
person create pending = 0
```

Không commit round-trip session.

#### File GEDCOM từ nguồn ngoài

Có thể có:

```text
person create pending
person match pending
possible matches
warnings
```

Phải review trước khi commit.

---

## 5. Match Review

Route:

```text
/dashboard/import/<SESSION_ID>/matches
```

Dùng để xử lý:

- Strong duplicate.
- Weak duplicate.
- Unknown / Chưa rõ tên.
- Person có external id trùng.
- Person có tên giống nhưng thiếu ngày sinh.

Quy tắc:

```text
certain match -> skipped
review match -> user review
create certain -> có thể tạo nếu thật sự mới
create review -> phải kiểm tra kỹ
```

Không approve bừa các person `Unknown/Chưa rõ tên`.

---

## 6. Merge Plan

Route:

```text
/dashboard/import/<SESSION_ID>/merge
```

Mục tiêu:

- Xem dữ liệu GEDCOM có thể bổ sung cho matched persons.
- Chỉ preview.
- Không ghi DB nếu chưa approve suggestion.

Merge Plan dùng cho các trường hợp:

```text
- Người đã tồn tại nhưng thiếu ngày sinh/ngày mất.
- Tên phụ/other_names có thể bổ sung.
- Event có thể bổ sung.
- Relationship/family có thể bổ sung.
```

---

## 7. Merge Suggestions

Merge suggestions có status:

```text
pending
approved
skipped
rejected
committed
```

Quy tắc:

- Chỉ `approved` mới được commit.
- `pending` là chưa quyết định.
- `skipped` là bỏ qua an toàn.
- `rejected` là xác định không đúng.
- `committed` là đã ghi vào DB chính.

Không commit nếu còn approved suggestion chưa hiểu payload.

---

## 8. Commit approved merge suggestions

RPC liên quan:

```text
commit_gedcom_merge_suggestions()
```

Quy tắc commit:

- Chỉ commit suggestion `approved`.
- Có transaction.
- Có report inserted/skipped/errors.
- Sau commit phải refresh audit.

Nếu commit lỗi:

1. Không retry bừa.
2. Đọc error code.
3. Kiểm tra payload suggestion.
4. Sửa RPC/code nếu do schema mismatch.
5. Chạy lại test/build trước khi commit lại.

---

## 9. Commit staging import

Luồng commit staging chỉ dùng cho file từ nguồn ngoài sau khi review.

Commit plan cần hợp lệ:

```text
Persons
Person names
Families
Family parents
Family children
Events
Person events
Unsupported
```

Các lỗi từng gặp và cách hiểu:

```text
column gender is of type gender_enum but expression is of type text
-> cần cast enum.

column status is of type family_status_enum but expression is of type text
-> cần cast enum.

type public.family_parent_role_enum does not exist
-> schema thực tế không có enum tên đó, phải dùng enum/cột thật.

column sort_order of relation person_events does not exist
-> schema thật không có sort_order, bỏ khỏi insert.

column full_name of relation person_names does not exist
-> schema person_names thật khác thiết kế, phải map đúng cột.
```

---

## 10. GEDCOM round-trip validation

Round-trip nghĩa là:

```text
Export GEDCOM từ app -> import lại chính file đó
```

Kỳ vọng:

```text
persons = matches
possibleMatches = 0
errors = 0
families create = 0
family_parents create = 0
family_children create = 0 hoặc chỉ những dữ liệu mới thật sự thiếu
```

Không commit round-trip session vì mục tiêu chỉ là kiểm tra export/import.

Quan trọng:

- GEDCOM exporter phải dùng stable UUID XREF.
- GEDCOM parser phải giữ UUID XREF nếu XREF là UUID.
- Unknown/Chưa rõ tên vẫn phải match được bằng external id, không tạo mới.

---

## 11. Stable UUID XREF

Khi export GEDCOM từ app, XREF phải giữ định danh ổn định:

```text
0 @<person_uuid>@ INDI
```

Khi import lại, parser phải preserve UUID XREF thành external id/person id để matching chính xác.

Mục tiêu:

```text
Người tên Unknown/Chưa rõ tên vẫn match được nếu XREF là UUID của person hiện có.
```

---

## 12. Post-import audit

Route:

```text
/dashboard/import/<SESSION_ID>/audit
```

Kiểm tra:

- Unknown persons.
- Duplicate events.
- Missing person event links.
- Empty families.
- Pending/approved merge suggestions.
- Staging records chưa xử lý.

Nếu audit còn lỗi blocking, không xem import là hoàn tất.

---

## 13. SQL kiểm tra session

Danh sách session:

```sql
SELECT id, file_name, status, created_at
FROM public.import_sessions
ORDER BY created_at DESC
LIMIT 20;
```

Đếm staging records:

```sql
SELECT record_type, action, status, confidence, COUNT(*)
FROM public.import_staging_records
WHERE session_id = '<SESSION_ID>'
GROUP BY record_type, action, status, confidence
ORDER BY record_type, action, status, confidence;
```

Pending merge suggestions:

```sql
SELECT status, COUNT(*)
FROM public.import_merge_suggestions
WHERE session_id = '<SESSION_ID>'
GROUP BY status
ORDER BY status;
```

---

## 14. Dọn session test

Chỉ xóa session chưa committed:

```sql
DELETE FROM public.import_sessions
WHERE id = '<SESSION_ID>'
  AND status <> 'committed';
```

Không xóa session đã committed nếu chưa có backup/audit rõ ràng.

---

## 15. Các migration/RPC liên quan

Các file migration liên quan phase GEDCOM Import/Merge:

```text
022_gedcom_staging_import_v234.sql
024_gedcom_merge_suggestions_v234.sql
025_commit_gedcom_merge_suggestions_v234.sql
026_import_audit_rpcs_v234.sql
```

Các RPC/audit thường dùng:

```text
commit_gedcom_merge_suggestions()
count_events_without_person_events()
count_active_empty_families()
count_duplicate_birth_death_events()
```

---

## 16. Không được làm

Không làm:

```text
- Không import trực tiếp vào DB chính nếu chưa staging.
- Không commit round-trip session.
- Không approve merge suggestion nếu chưa hiểu payload.
- Không hard delete dữ liệu import đã committed.
- Không sửa staging bằng tay nếu chưa backup.
- Không tắt RLS/trigger safety để ép commit.
```

---

## 17. Checklist hoàn thành v2.3.4

Đạt khi:

```text
- GEDCOM upload tạo staging session.
- Round-trip export/import match sạch.
- Match Review mở được.
- Merge Plan mở được.
- Merge Suggestions approve/skip/reject được.
- Commit approved suggestions chạy được.
- Import audit mở được.
- test pass.
- build pass.
- route audit pass.
```

---

## 18. Quy trình kiểm tra nhanh

```bash
bun run test
bun run build
bun run audit:routes
```

Nếu đã có release check:

```bash
bun run release:check
```

---

## 19. Deploy sau khi sửa GEDCOM import

```bash
cd /opt/giapha-os

git checkout main
git pull origin main

bun run release:check

sudo rm -rf .next
bun run build

sudo pm2 restart giapha --update-env
sudo pm2 save
```

Kiểm tra:

```bash
curl -I http://127.0.0.1:3000
sudo pm2 list
```
