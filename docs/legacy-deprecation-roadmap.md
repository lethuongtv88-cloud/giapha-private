# Legacy Deprecation Roadmap

## 1. Bối Cảnh

Dự án hiện đang ở giai đoạn dual-write / compatibility.

Model mới:

```text
families
family_parents
family_children
events
person_events
person_names
```

Legacy còn tồn tại:

```text
relationships
persons.birth_year / birth_month / birth_day
persons.death_year / death_month / death_day
```

Một số UI đã đọc model mới, ví dụ Vietnamese Tree.

Một số UI/action vẫn còn phụ thuộc legacy, ví dụ RelationshipManager trước v2.4.2.

Không nên xóa legacy ngay.

---

## 2. Khi Nào Được Bỏ Legacy?

Chỉ nên bỏ hoàn toàn legacy khi đạt đủ 5 điều kiện:

```text
1. Tất cả UI đọc quan hệ từ Family Model / Event Model.
2. Tất cả action thêm/sửa/xóa quan hệ ghi vào Family Model / Event Model.
3. Legacy relationships/person date fields chỉ còn để audit, không còn là source of truth.
4. GEDCOM import/export dùng model mới hoàn toàn.
5. Audit chạy sạch trong ít nhất vài vòng sử dụng thật.
```

Hiện tại chưa đạt điều kiện 2.

---

## 3. Phase 1 — Hoàn Tất Dual-Write

Mục tiêu:

```text
Mọi thao tác mới đều có dữ liệu model mới.
```

Việc cần làm:

```text
- Add spouse: ghi relationships + families + family_parents.
- Add parent/child: ghi relationships + families + family_children/family_parents.
- Divorce/delete marriage: cập nhật relationships + families.status / deleted_at.
- Edit birth/death: ghi events/person_events, không chỉ ghi birth_year/death_year.
```

Yêu cầu:

- Không chỉ ghi legacy.
- Không để cây mới thiếu dữ liệu.
- Có test/build trước deploy.

---

## 4. Phase 2 — Chuyển Toàn Bộ Read Sang Model Mới

Các màn hình phải đọc từ model mới:

```text
- Vietnamese tree
- RelationshipManager / bảng Bố Mẹ Con Vợ Chồng
- Member detail
- Member list grouping
- Stats
- GEDCOM export
- Data Quality
- Kinship
- Lineage
- Dual ancestry
```

Legacy chỉ dùng làm fallback tạm thời.

---

## 5. Phase 3 — Legacy Audit

Tạo trang hoặc script:

```text
/dashboard/data-maintenance/legacy-compat
```

Kiểm tra:

```text
- relationships marriage không có families tương ứng
- relationships parent/child không có family_children tương ứng
- events không đồng bộ với birth_year/death_year
- person legacy date khác events
- family model có nhưng legacy thiếu
```

Khi audit còn lỗi thì repair, không xóa.

---

## 6. Phase 4 — Tắt Legacy Write

Sau khi dual-write ổn, chuyển sang:

```text
Model mới là source of truth.
```

Code action mới:

- Ghi Family Model / Event Model.
- Không ghi legacy nữa, hoặc chỉ ghi nếu bật compat mode.
- Legacy trở thành readonly fallback.

Flag nguy hiểm:

```env
NEXT_PUBLIC_FF_ALLOW_LEGACY_CLEANUP=false
```

Không bật thường trực production.

---

## 7. Phase 5 — Archive Legacy, Chưa Hard Delete

Không drop bảng ngay. Làm an toàn hơn:

```sql
ALTER TABLE public.relationships RENAME TO relationships_legacy_archive;
```

Hoặc tạo view readonly:

```sql
CREATE VIEW public.relationships_legacy AS
SELECT * FROM public.relationships;
```

Giữ vài tuần/tháng để rollback nếu cần.

---

## 8. Mốc Đề Xuất Cho Dự Án

```text
v2.4.2: Sửa RelationshipManager đọc Family Model đầy đủ.
v2.4.3: Sửa add/edit relationship ghi Family Model đầy đủ.
v2.4.4: Repair legacy marriages/parent-child còn thiếu Family Model.
v2.4.5: Legacy Compatibility Audit page.
v2.5.0: Model mới là source of truth, legacy chỉ readonly fallback.
v2.6.0: Archive legacy relationships nếu audit sạch lâu dài.
```

---

## 9. Việc Nên Làm Ngay

Ưu tiên:

```text
1. Khi thêm hôn nhân đa phu/đa thê → tạo families + family_parents.
2. Khi thêm cha/mẹ/con → tạo family_children/family_parents.
3. Repair các relationship cũ đã thêm nhưng chưa có family.
4. Sau đó tạo audit Legacy Compatibility.
```

---

## 10. Không Được Làm

```text
- Không drop relationships ngay.
- Không hard delete legacy date fields.
- Không tắt legacy fallback khi chưa có audit sạch.
- Không bật cleanup flag thường trực.
- Không migration destructive nếu chưa có backup.
```
