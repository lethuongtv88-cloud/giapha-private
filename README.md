<p align="center">
  <img src="https://raw.githubusercontent.com/gdthuongle/giapha-private/main/public/icon.png" alt="Gia Phả OS Icon" width="100" height="100" style="border-radius: 22%; border: 0.5px solid rgba(0,0,0,0.1);" />
</p>

# Gia Phả OS

Gia Phả OS là hệ thống quản lý gia phả trực tuyến, tập trung vào cách trình bày dòng họ theo văn hóa Việt Nam. Dự án hỗ trợ lưu trữ thông tin thành viên, quan hệ huyết thống, hôn nhân, sự kiện gia đình, hình ảnh, thống kê, phân quyền theo nhánh và các công cụ tra cứu vai vế/xưng hô.

Mục tiêu của Gia Phả OS là giúp một dòng họ có thể số hóa dữ liệu gia phả, quản lý nhiều thế hệ, phân quyền cho từng thành viên, và hiển thị cây gia phả theo cách dễ hiểu, dễ tra cứu trên cả máy tính và thiết bị di động.

Dự án phù hợp với người Việt Nam, đặc biệt các gia đình muốn tự lưu trữ dữ liệu gia phả của mình thay vì phụ thuộc vào dịch vụ bên thứ ba.

## Mục lục

- [Các tính năng chính](#các-tính-năng-chính)
- [Demo](#demo)
- [Hình ảnh Giao diện](#hình-ảnh-giao-diện)
- [Cài đặt và Chạy dự án](#cài-đặt-và-chạy-dự-án)
  - [Cách 1: Deploy nhanh lên Vercel](#cách-1-deploy-nhanh-lên-vercel)
  - [Cách 2: Chạy trên máy cá nhân](#cách-2-chạy-trên-máy-cá-nhân)
- [Tài khoản đầu tiên](#tài-khoản-đầu-tiên)
- [Xử lý lỗi khi đăng ký](#xử-lý-lỗi-khi-đăng-ký)
- [Phân quyền người dùng (User Roles)](#phân-quyền-người-dùng-user-roles)
- [Đóng góp (Contributing)](#đóng-góp-contributing)
- [Tuyên bố từ chối trách nhiệm & Quyền riêng tư](#tuyên-bố-từ-chối-trách-nhiệm--quyền-riêng-tư)
- [Giấy phép (License)](#giấy-phép-license)

## Các tính năng chính

### Quản lý thành viên gia phả

- Thêm, sửa, xóa mềm và tra cứu thành viên trong gia phả.
- Lưu thông tin họ tên, giới tính, ngày sinh, ngày mất, ghi chú, trạng thái còn sống/đã mất.
- Hỗ trợ dữ liệu ngày tháng không đầy đủ: đủ ngày, chỉ tháng/năm, chỉ năm hoặc chưa rõ ngày.
- Hỗ trợ avatar, hồ sơ cá nhân và timeline sự kiện.

### Sơ đồ cây gia phả Việt Nam

- Hiển thị sơ đồ cây tối ưu cho gia phả Việt Nam.
- Hỗ trợ nhiều đời, nhiều nhánh, đa phu/đa thê, con chung, con riêng và các quan hệ hôn nhân phức tạp.
- Có tùy chọn chọn người gốc, mở rộng/thu gọn nhánh, ẩn/hiện dâu rể, ẩn nam/nữ và thu gọn khoảng cách sơ đồ.
- Hỗ trợ nhiều kiểu xem: cây gia phả, mindmap và bong bóng.

### Nội / Ngoại và Sui gia

- Trang Nội / Ngoại giúp so sánh các thế hệ hai bên nội ngoại của người được chọn.
- Trang Sui gia hiển thị tương quan giữa bên chồng và bên vợ, bao gồm nội ngoại hai bên.
- Có gợi ý vai vế/xưng hô theo miền Bắc, miền Nam hoặc cách gọi trung tính.
- Hữu ích khi gặp mặt họ hàng, sui gia, con cháu và các nhánh thông gia.

### Tra cứu danh xưng và vai vế

- Tra cứu quan hệ giữa hai người trong gia phả.
- Hỗ trợ xác định cách gọi, vai vế và mối liên hệ trong dòng họ.
- Có thể mở rộng theo cách xưng hô vùng miền.

### Sự kiện gia đình

- Quản lý sự kiện theo Event Model: sinh, mất, kết hôn, ly hôn, an táng, cư trú, nghề nghiệp, di cư, quân ngũ, ngày giỗ và sự kiện khác.
- Sự kiện có thể gắn với từng thành viên hoặc gia đình.
- Hỗ trợ ngày dương lịch, ngày âm lịch, độ chính xác ngày tháng và ghi chú.
- Sự kiện được dùng cho timeline cá nhân, GEDCOM export và các tính năng nhắc việc sau này.

### Hôn nhân, ly hôn và khôi phục hôn nhân

- Quản lý quan hệ vợ chồng, ly hôn và khôi phục hôn nhân.
- Khi ly hôn, trạng thái Family Model được cập nhật và đường nối vợ chồng trên cây có thể hiển thị nét đứt.
- Hỗ trợ ghi nhận sự kiện kết hôn/ly hôn để lưu lịch sử hôn nhân rõ ràng hơn.

### GEDCOM import/export

- Xuất dữ liệu GEDCOM chuẩn UTF-8 để dùng với phần mềm gia phả khác.
- Có chế độ export riêng cho FamilyGem để xử lý cách hiển thị họ tên tiếng Việt.
- Import GEDCOM qua staging, kiểm tra dữ liệu trước khi commit, gợi ý merge và audit import.

### Data Quality và Data Maintenance

- Kiểm tra dữ liệu lỗi như người không rõ thông tin, sự kiện trùng, sự kiện thiếu liên kết, family rỗng, lỗi Family Model, quan hệ hôn nhân/con cái thiếu đồng bộ và liên kết person_events sai.
- Có công cụ repair an toàn để giảm nhu cầu chạy SQL thủ công.

### Phân quyền theo thành viên gia phả

- Admin có thể gán mỗi tài khoản với một người trong gia phả.
- User thường chỉ xem được nhánh nội ngoại của mình, vợ/chồng của những người trong nhánh đó, và nhánh nội ngoại bên vợ/chồng trực tiếp của mình.
- Không xem được nhánh thông gia của dâu/rể người khác.
- Sự kiện, tìm kiếm, thống kê, sơ đồ cây, Nội / Ngoại và Sui gia đều được lọc theo phạm vi được phép xem.

### Quản lý người dùng

- Admin có thể tạo tài khoản, đổi email, tên hiển thị, vai trò, trạng thái, mật khẩu, người gốc mặc định và người trong gia phả được gán cho từng user.
- Người dùng có thể tự đổi mật khẩu và một số cài đặt cá nhân như gốc sơ đồ, gốc Nội / Ngoại, gốc Sui gia và gốc Thống kê.

### Audit Log

- Ghi lại các thao tác quan trọng như tạo/sửa/xóa user, reset mật khẩu, repair dữ liệu, import GEDCOM, thay đổi quan hệ, ly hôn, khôi phục hôn nhân và các trường hợp bị từ chối quyền truy cập.
- Giúp quản trị viên biết ai đã thay đổi dữ liệu, thay đổi lúc nào và liên quan đến đối tượng nào.

### Thống kê gia phả

- Thống kê số lượng thành viên, giới tính, trạng thái còn sống/đã mất, độ tuổi, thế hệ, quan hệ gia đình và các dữ liệu tổng hợp khác.
- Với user thường, thống kê được giới hạn trong phạm vi nhánh được phép xem.

### Tự lưu trữ và bảo mật dữ liệu

- Dự án được thiết kế để tự triển khai.
- Dữ liệu gia đình nằm trong Supabase/database do chính người dùng quản lý.
- Không tích hợp tracking, analytics hay telemetry.

## Demo

- Demo: [demo.thuongle.net](https://demo.thuongle.net)
- Tài khoản: `xem@thuongle.net`
- Mật khẩu: `giapha`

> Trang demo sử dụng dữ liệu mẫu hư cấu, không chứa thông tin người thật. Không nên nhập thông tin cá nhân thật vào trang demo.

## Hình ảnh Giao diện

![Dashboard](docs/screenshots/dashboard.png)

![Danh sách](docs/screenshots/list.png)

![Sơ đồ cây](docs/screenshots/tree.png)

![Mindmap](docs/screenshots/mindmap.png)

![Thống kê](docs/screenshots/stats.png)

![Tra cứu danh xưng](docs/screenshots/kinship.png)

![Sự kiện](docs/screenshots/events.png)

More screenshots: [docs/screenshots/](docs/screenshots/)

## Cài đặt và Chạy dự án

Chỉ cần khoảng 10 -> 15 phút là bạn có thể tự dựng hệ thống gia phả cho gia đình mình.

---

## 1. Tạo Database (Miễn phí với Supabase)

1. Tạo tài khoản miễn phí tại https://github.com nếu chưa có.
2. Tạo tài khoản miễn phí tại https://supabase.com nếu chưa có (khuyên dùng đăng ký bằng tài khoản GitHub cho nhanh).
3. Tạo **New Project**. Đợi khoảng 1 -> 2 phút để hệ thống khởi tạo xong.
4. Vào **Project Settings → API**, giữ lại 2 giá trị này để dùng ở bước tiếp theo:
   - `Project URL`
   - `Project API Keys`

---

## Cách 1: Deploy nhanh lên Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgdthuongle%2Fgiapha-private&env=SITE_NAME,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)

1. Tạo tài khoản miễn phí tại https://vercel.com nếu chưa có (khuyên dùng đăng ký bằng tài khoản GitHub cho nhanh).
2. Nhấn nút Deploy bên trên.
3. Điền các biến môi trường đã lưu ở **bước 1**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `Project URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` = `Project API Keys`
4. Nhấn **Deploy** và chờ 2 -> 3 phút.

Bạn sẽ có một đường link website để sử dụng ngay.

---

## Cách 2: Chạy trên máy cá nhân

Yêu cầu: máy đã cài [Node.js](https://nodejs.org/en) và [Bun](https://bun.sh/)

1. Clone hoặc tải project về máy.
2. Đổi tên file `.env.example` thành `.env.local`.
3. Mở file `.env.local` và điền các giá trị đã lưu ở **bước 1**.

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="your-anon-key"
```

4. Cài thư viện

```bash
bun install
```

5. Chạy dự án

```bash
bun run dev
```

Mở trình duyệt và truy cập: `http://localhost:3000`

---

## Tài khoản đầu tiên

- Đăng ký tài khoản mới khi vào web lần đầu.
- Người đăng ký đầu tiên sẽ tự động có quyền **admin**.
- Các tài khoản đăng ký sau sẽ mặc định là **member**.

## Xử lý lỗi khi đăng ký

Sau khi cài đặt xong, nếu bạn gặp lỗi `Failed to fetch` khi đăng ký:

**Nguyên nhân:** Supabase chặn các request từ domain chưa được thêm vào danh sách cho phép.

**Cách khắc phục:**

1. Vào [Supabase Dashboard](https://supabase.com/dashboard) → chọn Project của bạn.
2. Vào **Authentication → URL Configuration**.
3. Ở mục **Site URL**, điền URL chính của ứng dụng, ví dụ:
   - Vercel: `https://giapha-os.vercel.app`
   - Máy cá nhân: `http://localhost:3000`
4. Ở mục **Redirect URLs**, nhấn **Add URL** và thêm:
   - `https://giapha-os.vercel.app/**`
   - `http://localhost:3000/**` (nếu chạy local)
5. Nhấn **Save** và thử lại.

> **Lưu ý:** Thay `giapha-os.vercel.app` bằng domain thực tế của bạn. Nếu dùng domain tùy chỉnh, hãy thêm cả domain đó vào danh sách.

---

## Phân quyền người dùng (User Roles)

Hệ thống có 3 cấp độ phân quyền để dễ dàng quản lý ai được phép cập nhật gia phả:

1. **Admin (Quản trị viên):** Có toàn quyền đối với hệ thống.
2. **Editor (Biên soạn):** Cho phép thêm, sửa, xóa thông tin hồ sơ và các mối quan hệ.
3. **Member (Thành viên):** Chỉ có thể xem sơ đồ gia phả và các thống kê trực quan.

## Đóng góp (Contributing)

Dự án này là mã nguồn mở, hoan nghênh mọi đóng góp, báo cáo lỗi (issues) và yêu cầu sửa đổi (pull requests) để phát triển ứng dụng ngày càng tốt hơn.

## Tuyên bố từ chối trách nhiệm & Quyền riêng tư

> **Dự án này chỉ cung cấp mã nguồn (source code). Không có bất kỳ dữ liệu cá nhân nào được thu thập hay lưu trữ bởi tác giả.**

- **Tự lưu trữ hoàn toàn (Self-hosted):** Khi bạn triển khai ứng dụng, toàn bộ dữ liệu gia phả (tên, ngày sinh, quan hệ, thông tin liên hệ...) được lưu trữ **trong tài khoản Supabase của chính bạn**. Tác giả dự án không có quyền truy cập vào database đó.

- **Không thu thập dữ liệu:** Không có analytics, không có tracking, không có telemetry, không có bất kỳ hình thức thu thập thông tin người dùng nào được tích hợp trong mã nguồn.

- **Bạn kiểm soát dữ liệu của bạn:** Mọi dữ liệu gia đình, thông tin thành viên đều nằm hoàn toàn trong cơ sở dữ liệu Supabase mà bạn tạo và quản lý. Bạn có thể xóa, xuất hoặc di chuyển dữ liệu bất cứ lúc nào.

- **Demo công khai:** Trang demo tại `demo.thuongle.net` sử dụng dữ liệu mẫu hư cấu, không chứa thông tin của người thật. Không nên nhập thông tin cá nhân thật vào trang demo.

## Giấy phép (License)

Dự án được phân phối dưới giấy phép MIT.
