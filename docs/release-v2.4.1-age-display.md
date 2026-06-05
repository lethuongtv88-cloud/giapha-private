# Release v2.4.1 — Age Display Bugfix

## 1. Mục Tiêu

v2.4.1 là bản bugfix nhỏ sau v2.4.0, tập trung sửa cách hiển thị tuổi trong UI.

Trước đây với dữ liệu ngày sinh/ngày mất không chính xác theo ngày, UI có thể hiện:

```text
~60–61 tuổi
```

Yêu cầu mới:

```text
61 tuổi
```

Áp dụng cho cả:

- Người còn sống
- Người đã mất

---

## 2. Thay Đổi Chính

File chính:

```text
utils/calendar/ageCalculation.ts
tests/date/ageCalculation.test.ts
```

Thay đổi logic:

- Vẫn giữ `minAge` và `maxAge` nội bộ để biết độ bất định.
- `display` và `displayShort` hiển thị tuổi đơn, lấy `maxAge`.
- Không còn hiển thị dấu `~` hoặc khoảng `60–61` trong UI.

---

## 3. Kết Quả Hiển Thị

### Người sống chỉ có năm sinh

Ví dụ sinh năm 1965, hiện tại năm 2026:

Trước:

```text
~1965 – nay (~60–61 tuổi)
```

Sau:

```text
~1965 – nay (61 tuổi)
```

### Người mất chỉ có năm sinh/năm mất

Ví dụ sinh 1940, mất 2000:

Trước:

```text
1940 – 2000 (Mất lúc ~59–60 tuổi)
```

Sau:

```text
1940 – 2000 (Mất lúc 60 tuổi)
```

### Month precision

Ví dụ sinh 05/1970, tính đến 02/06/2026:

Nội bộ:

```text
minAge = 55
maxAge = 56
```

UI:

```text
56 tuổi
```

---

## 4. Test

Test liên quan:

```text
tests/date/ageCalculation.test.ts
```

Các case chính:

- Exact birth/death → exact age.
- Living exact birth → current age.
- Living year-only birth → single display age.
- Month precision → single display age.
- Deceased year-only birth/death → single display age.
- Deceased without death date → không tính current age.
- Missing birth event → empty label.

Chạy:

```bash
bun run test
bun run build
```

---

## 5. Deploy

Sau khi merge vào main:

```bash
git checkout main
git pull origin main

bun run release:check

sudo rm -rf .next
bun run build

sudo pm2 restart giapha --update-env
sudo pm2 save
```

---

## 6. Checklist

```text
□ test pass
□ build pass
□ release:check pass
□ Production PM2 online
□ Người sống không còn "~60–61 tuổi"
□ Người mất không còn "Mất lúc ~60–61 tuổi"
□ Cây gia phả không mất tuổi
□ Chi tiết thành viên hiển thị tuổi đúng
```
