# utils/kinship — Ghi chú kiến trúc (cập nhật sau Commit 12, Giai đoạn 2)

## Trạng thái hiện tại: Rule Engine V2 đã CẮT THẬT vào computeKinship()

Kể từ Commit 11, `computeKinship()` không còn chỉ dùng `termFromPath()` (logic cũ, dò chuỗi/regex) — nó thử **Rule Engine V2** trước, chỉ rơi về `termFromPath()` khi V2 chưa phủ tới trường hợp đó:

```
computeKinship(personA, personB, ...)
  │
  ├─► renderKinshipTermV2(personA, personB, ...)   (utils/kinship/ruleEngine.ts)
  │     │
  │     ├─► renderSuiGiaTerm()              — mục 4 dòng 1 (Ông sui/Bà sui)
  │     ├─► buildRelationshipContext()      — utils/kinship/relationshipContext.ts
  │     │     │
  │     │     ├─► renderDirectLineageTerm()            — mục 2
  │     │     ├─► renderImmediateParentSiblingTerm()   — mục 3.1
  │     │     ├─► renderGreatUncleAuntBranchTerm()     — mục 3.2 (D=1,2)
  │     │     ├─► renderDeepAncestorSiblingTerm()      — mục 3.3 (D=1)
  │     │     ├─► renderSiblingTerm()                  — mục 3.5
  │     │     ├─► renderNiblingTerm()                  — mục 3.6 (cháu)
  │     │     ├─► renderChildOrGrandchildInLawTerm()   — mục 3.6 (dâu/rể)
  │     │     └─► renderDongHaoTerm()                  — mục 3.4
  │     │
  │     └─► trả `null` nếu không rule set nào khớp
  │
  └─► NẾU null: termFromPath() cũ (không đổi, vẫn nguyên vẹn — KHÔNG xoá)
```

**Đo trên dữ liệu thật (137 người, 10.894 cặp có đáp án cụ thể ở code cũ), tính đến Commit 11:**
- ~27% khớp chính xác qua Rule Engine V2
- ~73% rơi về `termFromPath()` cũ — an toàn, không mất câu trả lời
- ~0,1% (11 cặp) thiếu hậu tố "bên chồng/bên vợ" so với code cũ — biết trước, không phải lỗi

**`termFromPath()` và các hàm liên quan (`genericCollateralTerm`, `spouseOfKinshipTerm`, `sameGenerationCollateralTerm`...) KHÔNG được xoá** — chúng vẫn là lớp dự phòng thật sự cho phần lớn trường hợp, không phải code chết.

## Backlog — chưa làm, không phải lỗi, để dành nếu muốn mở rộng thêm

| Việc | Ghi chú |
|---|---|
| Mục 3.2, D≥3 ("anh/chị/em họ" cùng vai vế qua nhánh xa) | Hiện rơi về code cũ |
| Mục 3.3, D≥2 (con cháu của anh em ruột cụ/sơ) | Theo bản v3, phạm vi thực tế không cần chi tiết, nhưng nếu muốn vẫn làm được |
| Mục 4, dòng 2-3 (họ hàng khác của 2 bên sui gia) | Phức tạp hơn — cần tính vai vế độc lập ở cả 2 nhà |
| Vợ/chồng của người bàng hệ (vd "thím", "dượng") | Hiện `spouseOfKinshipTerm()` cũ xử lý, hoạt động tốt, chưa cần viết lại |
| Hậu tố "bên chồng/bên vợ" khi root là dâu/rể trong nhà | 11 case thật bị ảnh hưởng, không sai bản chất, chỉ thiếu chi tiết |

## Sơ đồ 3 nơi tiêu thụ computeKinship() (giữ nguyên từ Module 0)

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

**Lịch sử:** Tính đến 2026-07-28, chuỗi thứ 2 từng bị đổi nhầm thành `"họ hàng xa cùng huyết thống"` ở `kinshipHelpers.ts`, khiến 4 nơi trên không nhận diện được nữa (chuỗi thô bị lọt ra giao diện). Đã khôi phục lại đúng ở Commit 2 (2026-07-28). Rule Engine V2 (từ Commit 4 trở đi) không đụng tới 2 chuỗi này — vẫn do `termFromPath()` cũ sinh ra khi V2 trả `null`.

## Bài học từ quá trình xây Rule Engine V2 (Commit 3-11)

1. **Luôn kiểm tra N×N trên dữ liệu thật trước khi cắt sang dùng thật**, không chỉ vài chục case chọn tay — Commit 10b và bản vá bổ sung ở Commit 11 chỉ phát hiện được nhờ quét toàn bộ ~11.000 cặp.
2. **`isBornBefore()` bị copy thành 5 bản riêng** (1 file mỗi rule set) thay vì dùng chung 1 hàm — khi phát hiện lỗi ở Commit 10b, phải sửa cả 5 nơi. Nếu làm lại, nên tách thành 1 hàm dùng chung ngay từ Commit 5.
3. **Đường dẫn `import type` sai vẫn "chạy được"** vì bị xoá lúc build — chỉ lộ ra khi có `import` giá trị thật đầu tiên (Commit 10, `suiGia.ts`). Đã sửa lại đúng cho toàn bộ 6 file ở Commit 12.
4. **`RelationshipContext` không được giả định hình dạng đường đi** (`ascendSteps=0` không có nghĩa "phần còn lại chắc chắn toàn child") — lỗi này chỉ lộ ra khi kiểm thử N×N ở Commit 11, với trường hợp hiếm (2 người có con chung nhưng không kết hôn).

