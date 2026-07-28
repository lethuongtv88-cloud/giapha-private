# utils/kinship — Ghi chú kiến trúc (cập nhật Module 0, Giai đoạn 1)

## Sơ đồ ai gọi ai

```
computeKinship()  (utils/kinshipHelpers.ts)
  │
  ├──► components/KinshipFinder.tsx (dùng trực tiếp)
  │      đọc: result.aCallsB, result.bCallsA, result.description, result.pathLabels
  │      LƯU Ý: có kiểm tra chuỗi cứng result.aCallsB.includes("/") hoặc
  │      .includes("họ hàng") để hiện dòng cảnh báo "danh xưng có thể chưa
  │      chắc chắn" (xem KinshipFinder.tsx dòng ~525-526).
  │
  └──► utils/tree/lineageComparison.ts (relationFromRoot, dòng ~156-194)
         chỉ lấy result.aCallsB, có kiểm tra CHUỖI CỨNG:
           - "chưa xác định"     -> dùng nhãn mặc định khác
           - "họ hàng cùng nhánh" -> dùng nhãn mặc định khác
         │
         ▼
       getInLawAddressDetail() / getInLawAddressSuggestion()
       (utils/kinship/inLawAddressing.ts)
         nhận relationLabel (= aCallsB ở trên) làm input, có danh sách
         GENERIC_LABEL_PATTERNS (dòng ~50-58) cũng kiểm tra đúng các chuỗi
         cứng này để biết khi nào KHÔNG áp thêm hậu tố "bên nội/bên ngoại".
         │
         ▼
       LineageComparisonResult / InLawComparisonResult
         │
         ▼
       components/InLawRelationsPanel.tsx
       components/VietnameseFamilyTree.tsx (dòng ~317, cùng kiểm tra chuỗi)
       utils/tree/centeredCoupleTreeLayout.ts (dòng ~1076, cùng kiểm tra chuỗi)
       (+ các sơ đồ SVG Nội Ngoại / Sui gia dùng chung CoupleBlock)
```

## 2 hợp đồng ngầm cần giữ nguyên (được test khoá lại ở `contractGuards.test.ts`)

`computeKinship()` có kiểu trả về rõ ràng (`KinshipResult`), nhưng **giá trị chuỗi cụ thể** của `aCallsB` trong 2 trường hợp sau đang được nhiều nơi dò bằng so sánh chuỗi (`===`), không phải kiểm tra qua kiểu dữ liệu:

| Trường hợp | Chuỗi bắt buộc | Ai đang dựa vào |
|---|---|---|
| Không tìm được quan hệ nào | `"chưa xác định"` | `lineageComparison.ts`, `VietnameseFamilyTree.tsx`, `centeredCoupleTreeLayout.ts` |
| Có quan hệ huyết thống nhưng không map được danh xưng cụ thể | `"họ hàng cùng nhánh"` | 3 nơi trên + `inLawAddressing.ts` (`GENERIC_LABEL_PATTERNS`) |

**Lịch sử:** Tính đến 2026-07-28, chuỗi thứ 2 từng bị đổi nhầm thành `"họ hàng xa cùng huyết thống"` ở `kinshipHelpers.ts`, khiến 4 nơi trên không nhận diện được nữa (chuỗi thô bị lọt ra giao diện). Đã khôi phục lại đúng ở Commit 2 (2026-07-28).

## Quy tắc cho Giai đoạn 2 (rule engine mới theo `he-thong-danh-xung-final-v3.md`)

1. **Không đổi chữ ký hàm `computeKinship()` hay kiểu `KinshipResult`.** Rule engine mới (`CanonicalRelation` và các hàm nội bộ) sẽ nằm trong file/hàm mới; `computeKinship()` cuối cùng chỉ là 1 lớp mỏng gọi vào rule engine mới rồi convert kết quả về đúng `KinshipResult` như hiện tại.
2. **Nếu cần đổi 1 trong 2 chuỗi ở bảng trên**, phải sửa đồng bộ cả 5 nơi liệt kê, không chỉ sửa 1 chỗ — và phải cập nhật `contractGuards.test.ts` trong cùng 1 commit.
3. Trước khi merge bất kỳ thay đổi nào vào `computeKinship`/`inLawAddressing`, chạy `npx vitest run tests/kinship` — hiện có 43 test (14 gốc + 27 snapshot dữ liệu thật + 2 hợp đồng ngầm) bảo vệ hành vi hiện tại.
