# Release v2.4.2 — Family Model Relationship Panel Fix

## 1. Mục Tiêu

v2.4.2 sửa lỗi bảng quan hệ trong chi tiết thành viên không đồng bộ với Family Model.

Triệu chứng:

- Cây gia phả render đúng cha/mẹ/con vì cây đọc từ `families`, `family_parents`, `family_children`.
- Nhưng khi bấm vào một người, bảng quan hệ chỉ hiện cha, thiếu mẹ.
- Khi bấm vào mẹ, không thấy con.
- Nguyên nhân: `RelationshipManager` vẫn đọc chủ yếu từ legacy `relationships`.

Mục tiêu v2.4.2:

```text
Relationship panel phải hiển thị đúng quan hệ từ Family Model:
child -> father/mother
parent -> children
```

---

## 2. File Chính

```text
components/RelationshipManager.tsx
components/MembersViews.tsx
components/VietnameseFamilyTree.tsx
```

---

## 3. Thay Đổi RelationshipManager

### 3.1. Con thấy đủ cha/mẹ

Bổ sung fallback đọc cha/mẹ từ Family Model:

```text
family_children -> family_id -> family_parents -> persons
```

Logic:

1. Từ `personId` hiện tại, tìm các `family_id` trong `family_children`.
2. Từ các `family_id`, lấy `family_parents`.
3. Lấy thông tin `persons` của các parent.
4. Merge vào `formattedRels` direction `parent`.
5. Chống trùng với legacy parent đã có.

Kết quả:

```text
Con -> Bố / Mẹ: hiện đủ cha và mẹ
```

---

### 3.2. Mẹ/cha thấy con

Bổ sung fallback đọc con từ Family Model:

```text
family_parents -> family_id -> family_children -> persons
```

Logic:

1. Từ `personId` hiện tại, tìm các `family_id` trong `family_parents`.
2. Từ các `family_id`, lấy `family_children`.
3. Lấy thông tin `persons` của các child.
4. Merge vào `formattedRels` direction `child`.
5. Chống trùng với legacy child đã có.

Kết quả:

```text
Mẹ -> Con: hiện con
Cha -> Con: hiện con
```

---

## 4. Lỗi Đã Gặp Và Cách Sửa

### 4.1. PGRST200 nested select

Lỗi:

```text
Could not find a relationship between 'family_children' and 'family_parents'
```

Nguyên nhân:

PostgREST không có FK trực tiếp để nested select từ `family_children` sang `family_parents`.

Cách sửa:

Không dùng nested select. Dùng query 2 bước:

```text
family_children -> family_id
family_parents -> person_id
persons -> details
```

---

### 4.2. Cột `phone_number` không tồn tại

Lỗi:

```text
column persons.phone_number does not exist
```

Nguyên nhân:

Query select quá nhiều cột từ bảng `persons`, có cột không tồn tại trong schema thật.

Cách sửa:

Chỉ select các cột chắc chắn đang có:

```text
id
full_name
gender
birth_year
birth_month
birth_day
death_year
death_month
death_day
avatar_url
note
created_at
updated_at
is_deceased
is_in_law
birth_order
generation
other_names
```

Nếu schema thay đổi, kiểm tra bằng:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'persons'
ORDER BY ordinal_position;
```

---

## 5. Vietnamese Tree Hydration Fix

Lỗi:

```text
Hydration failed because server rendered age 39, client rendered age 40
```

Nguyên nhân:

Tuổi trong SVG tree phụ thuộc thời điểm render. SSR và browser có thể lệch timezone/thời điểm.

Cách sửa:

`VietnameseFamilyTree` được render client-only bằng dynamic import:

```ts
const VietnameseFamilyTree = dynamic(
  () => import("@/components/VietnameseFamilyTree"),
  {
    ssr: false,
  },
);
```

Kết quả:

- Không còn hydration mismatch tuổi.
- Tuổi vẫn hiển thị trong cây.
- Tree vẫn giữ diagnostics/performance tools.

---

## 6. Hạn Chế Còn Lại

v2.4.2 mới sửa read panel. Các action add/edit relationship vẫn còn giai đoạn dual-write.

Các bước tiếp theo nên làm:

```text
- Add spouse phải tạo families + family_parents.
- Add parent/child phải tạo family_children/family_parents.
- Repair legacy relationships chưa có Family Model.
- Tạo Legacy Compatibility Audit page.
```

---

## 7. Test UI

Kiểm tra:

```text
□ Vào /dashboard/members
□ Mở cây gia phả
□ Bấm một người con: Bố / Mẹ hiện đủ cha và mẹ
□ Bấm người mẹ: thấy danh sách con
□ Bấm người cha: thấy danh sách con
□ Cây vẫn render tuổi
□ Không còn hydration mismatch tuổi
□ Không còn lỗi PGRST200
□ Không còn lỗi column persons.phone_number does not exist
```

---

## 8. Test/Build

```bash
bun run test
bun run build
bun run release:check
```

---

## 9. Deploy

```bash
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
sudo pm2 list
curl -I http://127.0.0.1:3000
```

---

## 10. Checklist Hoàn Thành

```text
□ Relationship panel đọc được Family Model parents.
□ Relationship panel đọc được Family Model children.
□ Cây gia phả vẫn đúng.
□ Tuổi vẫn hiện trong cây.
□ test pass.
□ build pass.
□ release:check pass.
□ production restart thành công.
```
