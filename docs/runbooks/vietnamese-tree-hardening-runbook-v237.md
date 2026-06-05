# Vietnamese Tree Hardening Runbook v2.3.7

## 1. Mục tiêu

v2.3.7 tập trung hardening cây gia phả tiếng Việt:

- Thêm diagnostics panel.
- Đo performance layout.
- Cảnh báo khi cây quá lớn.
- Copy diagnostics snapshot để debug.
- Thêm large tree guard: auto-collapse to 4 generations.
- Bổ sung invariant tests cho Vietnamese tree layout.
- Giảm rủi ro khi render cây lớn và đa phu/đa thê.

Không thay đổi schema DB.

---

## 2. Các file chính

```text
components/VietnameseFamilyTree.tsx
components/MembersViews.tsx
utils/tree/vietnameseTreeLayout.ts
tests/tree/vietnameseTreeLayout.test.ts
app/dashboard/vietnamese-tree-test/page.tsx
```

---

## 3. Feature flag

Production nên bật:

```env
NEXT_PUBLIC_FF_VIETNAMESE_TREE_LAYOUT=true
```

Với cây mới đã hardening, nên dùng cây mới làm mặc định.

---

## 4. Client-side render

`VietnameseFamilyTree` nên render client-side qua dynamic import:

```ts
const VietnameseFamilyTree = dynamic(
  () => import("@/components/VietnameseFamilyTree"),
  {
    ssr: false,
  },
);
```

Lý do:

- Cây SVG lớn, tương tác nhiều.
- Tuổi phụ thuộc thời điểm render và timezone.
- SSR có thể gây hydration mismatch, ví dụ server render 39 tuổi nhưng client render 40 tuổi.
- Client-only hợp lý hơn cho tree view.

---

## 5. Diagnostics Panel

Trong cây gia phả, bấm:

```text
Tree diagnostics
```

Panel hiển thị:

```text
Total persons
Families
Visible nodes
Visible people
Family groups
Expanded
Collapsed
Max depth
Spouse nodes
Multi-spouse
Width
Height
Layout ms
Measured
```

Ý nghĩa:

- `Total persons`: tổng số person được load vào cây.
- `Families`: tổng số family active được load.
- `Visible nodes`: số node đang render thật.
- `Visible people`: số người duy nhất đang hiển thị.
- `Family groups`: số group gia đình visible.
- `Expanded`: số group đang mở.
- `Collapsed`: số group có con nhưng đang thu gọn.
- `Max depth`: độ sâu thế hệ visible.
- `Spouse nodes`: số node spouse đang render.
- `Multi-spouse`: số người có nhiều quan hệ spouse.
- `Width`: chiều rộng layout hiện tại.
- `Height`: chiều cao layout hiện tại.
- `Layout ms`: thời gian build layout gần nhất.
- `Measured`: thời điểm đo gần nhất.

---

## 6. Health status

Diagnostics có 3 trạng thái:

```text
Healthy
Large tree
Heavy tree
```

Ngưỡng hiện tại:

```text
visibleNodes >= 300 hoặc layoutDurationMs >= 80ms  -> Large tree
visibleNodes >= 600 hoặc layoutDurationMs >= 150ms -> Heavy tree
```

Nếu `Large tree` hoặc `Heavy tree`, panel hiện nút:

```text
Auto-collapse to 4 generations
```

Nút này chỉ đổi `autoCollapseLevel`, không sửa DB.

---

## 7. Copy snapshot

Bấm:

```text
Copy snapshot
```

Snapshot JSON gồm:

```json
{
  "kind": "vietnamese-tree-diagnostics",
  "version": "v2.3.7",
  "capturedAt": "...",
  "url": "/dashboard/members",
  "health": {
    "level": "ok",
    "label": "Healthy"
  },
  "diagnostics": {
    "totalPersons": 453,
    "totalFamilies": 125,
    "visibleNodes": 0,
    "visiblePeople": 0,
    "layoutDurationMs": 0
  }
}
```

Nếu clipboard API bị chặn trên HTTP LAN, fallback dùng textarea copy. Nếu vẫn lỗi, snapshot được ghi ra browser Console.

Khi báo lỗi cây, gửi kèm:

```text
- Ảnh màn hình
- Snapshot JSON
- Root person đang chọn
- Các filter đang bật/tắt
- Mô tả thao tác ngay trước khi lỗi
```

---

## 8. Layout invariant tests

Test file:

```text
tests/tree/vietnameseTreeLayout.test.ts
```

Đã kiểm tra:

- Parent/spouse horizontal alignment.
- Children nằm dưới family center.
- Child-down line đi đúng tâm node con.
- Spouse line đi đúng tâm child ↔ spouse.
- Layout đủ rộng khi child có expanded spouses.
- Requested child unit width được tôn trọng.
- Children sort theo birth_order rồi birth_year.

Chạy:

```bash
bun run test
```

---

## 9. Test UI thủ công

Mở:

```text
/dashboard/members
```

Kiểm tra:

```text
□ Cây render được.
□ Nút Tree diagnostics hiện.
□ Panel mở/đóng được.
□ Layout ms có giá trị.
□ Copy snapshot copy được.
□ Nếu tree Large/Heavy, nút Auto-collapse hiện.
□ Bấm Auto-collapse không crash.
□ Expand/collapse vẫn hoạt động.
□ Filter nam/nữ/dâu/rể/con trai/con gái vẫn hoạt động.
□ Đường nối spouse/child không lệch rõ rệt.
□ Đa phu/đa thê không làm giao tuyến sai nghiêm trọng.
□ Bấm person mở bảng quan hệ đúng.
```

Test route phụ:

```text
/dashboard/vietnamese-tree-test
```

---

## 10. Vấn đề đã phát hiện sau v2.3.7

### 10.1. Hydration mismatch tuổi

Triệu chứng:

```text
Hydration failed because the server rendered text didn't match the client.
server rendered age: 39
client rendered age: 40
```

Nguyên nhân:

- Tuổi tính theo `new Date()`.
- Server/client lệch timezone hoặc thời điểm render.
- SVG text của tuổi khác nhau giữa SSR và client.

Cách xử lý đã chọn:

```text
Render VietnameseFamilyTree client-only bằng dynamic import ssr:false.
```

Không nên chỉ suppress warning trong `<tspan>` vì SVG tree lớn vẫn có thể rehydrate mismatch.

### 10.2. Tuổi bị mất sau khi thử isMounted

Nếu từng thêm điều kiện:

```tsx
{isMounted && dateParts.age ? (...)}
```

và tuổi không hiện, nên bỏ điều kiện này sau khi đã chuyển cả tree sang client-only:

```tsx
{dateParts.age ? (...)}
```

---

## 11. SQL/DB

Phase này không có migration DB.

Không cần chạy SQL.

---

## 12. Không được làm

Không làm trong phase này:

```text
- Không đổi schema.
- Không sửa GEDCOM/import.
- Không sửa statistics.
- Không hard delete dữ liệu.
- Không đổi layout algorithm lớn nếu chưa có snapshot/lỗi cụ thể.
```

---

## 13. Checklist hoàn thành v2.3.7

Hoàn thành khi:

```text
- Tree diagnostics panel hoạt động.
- Layout ms hiển thị.
- Copy snapshot hoạt động trên HTTP LAN.
- Large tree warning hoạt động.
- Auto-collapse guard hoạt động.
- Vietnamese tree invariant tests pass.
- Cây render client-only, không còn hydration mismatch tuổi.
- bun run test pass.
- bun run build pass.
- Runbook được commit.
```

---

## 14. Deploy/restart production

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
sudo pm2 list
sudo ss -ltnp | grep ':3000'
curl -I http://127.0.0.1:3000
```
