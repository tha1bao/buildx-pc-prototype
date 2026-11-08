# BuildX PC (ISC301)

Hệ thống BuildX PC theo **Kế hoạch kinh doanh v3**: website bán PC, linh kiện, lắp ráp (khách hàng) và trang nội bộ (bán tại quầy, xử lý đơn, xưởng, kho, bảo hành). 42 màn hình SC01–SC42, 22 use case UC01–UC22.

Từ bản 2.0, dữ liệu không còn nằm trong bộ nhớ trang: **đơn hàng, tồn kho theo serial, đơn nhập, yêu cầu dịch vụ, RMA, bảo hành, mã giảm giá, tài khoản** được lưu trong PostgreSQL. Khách đặt hàng trên website thì nhân viên thấy ngay ở trang nội bộ (tự làm mới ~4 giây, có thông báo "Đơn mới"); nhân viên xác nhận, lắp ráp, xuất kho thì khách thấy tiến trình đơn cập nhật.

## Kiến trúc

| Thư mục | Nội dung |
|---|---|
| `public/` | Giao diện (JS thuần, router theo hash): `data.js` linh kiện, giá, combo; `engine.js` luật tương thích và nghiệp vụ đơn/kho **dùng chung cho trình duyệt và máy chủ**; `api-client.js` đồng bộ với máy chủ; `store.js` 21 màn khách; `admin.js` 21 màn nhân viên |
| `api/` | 4 Vercel Function: `auth`, `state`, `version`, `action` |
| `server/` | `api.js` thao tác nghiệp vụ và kiểm tra quyền; `db.js` bảng và giao dịch; `auth.js` phiên cookie ký HMAC, băm mật khẩu scrypt, OTP; `seed.js` dữ liệu mẫu; `dev.js` máy chủ chạy tại máy |
| `test/run.js` | 54 ca kiểm thử với CSDL thật |

Nguyên tắc:

- **Máy chủ quyết định.** Giá, luật tương thích R1–R8, giữ hàng, ngưỡng QC, chuyển trạng thái đơn đều tính lại ở máy chủ; giá hay kết quả gửi từ trình duyệt bị bỏ qua.
- **Không bán vượt số có.** Mọi thao tác ghi chạy trong một giao dịch có khóa (`pg_advisory_xact_lock`): hai khách tranh món cuối cùng thì chỉ một người được giữ hàng, người kia vào "Chờ hàng".
- **Phân quyền ở máy chủ** theo bảng `ROLES` (UC22); khóa tài khoản hay đổi vai trò có hiệu lực ngay.
- **Khách chỉ thấy dữ liệu của mình**: đơn đặt trên máy đó, hoặc mọi đơn theo SĐT sau khi đăng nhập OTP; không thấy serial kho, chỉ thấy số lượng còn hàng.
- Thao tác nhạy cảm (hủy, hoàn tiền, điều chỉnh kho, giảm giá ngoài chính sách, đổi vai trò…) ghi vào `audit_log`.

Bảng CSDL: `orders`, `stock_units`, `purchase_orders`, `service_requests`, `rma_tickets`, `warranties`, `coupons`, `customers`, `staff_users`, `otp_codes`, `audit_log`, `app_meta`. Mỗi bảng có cột khóa và cột truy vấn (SĐT, trạng thái, mã sản phẩm…) cộng cột `doc` (jsonb) chứa đầy đủ bản ghi. Bảng được tạo và nạp dữ liệu mẫu tự động ở lần gọi API đầu tiên.

## Chạy trên Vercel

1. Vercel → project `buildx-pc-prototype` → **Storage** → tạo **Neon (Postgres)** và gắn vào project. Biến `DATABASE_URL` được thêm tự động.
2. Deploy lại. Lần mở đầu tiên tạo bảng và dữ liệu mẫu.
3. (Tùy chọn) đặt `SESSION_SECRET`; nếu không, máy chủ tự sinh khóa và lưu trong CSDL.

## Chạy tại máy

```bash
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/buildx npm run dev   # http://localhost:3000
DATABASE_URL=postgres://user:pass@localhost:5432/buildx_test npm test # CSDL kiểm thử, sẽ bị xóa sạch
```

## Nghiệp vụ tài khoản và luật (bản 2.1)

- **Phải đăng nhập (SĐT + OTP) mới đặt được hàng**; khách chưa đăng nhập vẫn xem, build PC và thêm vào giỏ (giỏ giữ lại sau đăng nhập). Đơn gắn với tài khoản, SĐT người nhận có thể khác.
- **Đăng ký mới luôn là Member** với điểm và chi tiêu bằng 0. Đơn **Hoàn tất** cộng 1% giá trị đơn thành điểm (1 điểm = 1.000đ) và cộng tổng chi tiêu; Member chi tiêu từ 50 triệu tự lên VIP. Tài khoản doanh nghiệp B2B: khách gửi yêu cầu kèm mã số thuế, Quản lý/Quản trị viên duyệt ở màn Người dùng.
- **Quản lý chỉnh luật tương thích** ở màn SC35: mỗi luật R1–R8 chọn *Chặn theo thiết kế / Chỉ cảnh báo / Tắt*, sửa % dự phòng nguồn, công suất nền, khoảng chừa VGA–case, bật/tắt cảnh báo bus RAM và công suất tản. Cấu hình lưu trong CSDL (`app_meta.rules`), áp dụng ngay cho Build PC, giỏ hàng, POS và kiểm tra đơn ở máy chủ; mỗi thay đổi ghi nhật ký. 24 ca kiểm thử luôn chạy trên bộ luật mặc định, kèm cột "theo cấu hình hiện tại".
- **Giỏ hàng** hiện mục "Đơn đã đặt" với sản phẩm/combo, tiến trình và trạng thái từng đơn (tự cập nhật).
- **Tư vấn nhu cầu**: ngân sách nhập tay (10–200 triệu, chấp nhận "25.000.000", "25 triệu", "25tr", báo lỗi ngay dưới ô); độ phân giải 1080p, 1080p 240Hz, 2K, Ultrawide, 4K, lọc combo theo sức mạnh VGA.

## Tài khoản demo

- Nhân viên (mật khẩu `BuildX@2026`): `bao@buildx.vn` Quản lý · `viet.pham@buildx.vn` Bán hàng · `thao.le@buildx.vn` Tư vấn · `huy.tran@buildx.vn` Kỹ thuật viên · `khoa.do@buildx.vn` Thủ kho · `nhung.vu@buildx.vn` Quản trị viên. Đổi mật khẩu ở màn Người dùng trước khi dùng thật.
- Khách: đăng nhập bằng SĐT + OTP. Chưa nối nhà cung cấp SMS nên mã OTP hiện ngay trên màn hình (đặt `SMS_PROVIDER` để tắt). SĐT `0912 345 678` có sẵn đơn và phiếu bảo hành.
- Màn Người dùng có nút **Khôi phục dữ liệu mẫu** để làm sạch trước buổi demo.

## Kịch bản demo hai phía

Mở hai cửa sổ (một cửa sổ ẩn danh): cửa sổ 1 là khách, cửa sổ 2 đăng nhập `bao@buildx.vn`.

1. Khách: Combo BX Gamer → giỏ → đặt hàng COD. Nhân viên thấy "Đơn mới" ở Đơn hàng.
2. Nhân viên: gọi xác minh (đơn COD lần đầu) → Xác nhận & giữ hàng. Khách thấy "Đã xác nhận".
3. Chuyển xưởng → Phiếu lắp ráp & QC (đăng nhập `huy.tran@buildx.vn`) → ghi burn-in. Khách xem được báo cáo nhiệt độ.
4. Đóng gói & bàn giao → xuất kho → Đã giao. Đơn Hoàn tất, phiếu bảo hành theo serial xuất hiện ở màn Bảo hành của khách.

## Giai đoạn 2 (chưa làm)

Lead và link báo giá, nhà cung cấp, sửa sản phẩm/giá/luật/combo từ trang quản trị, banner và giới thiệu bạn bè vẫn là dữ liệu minh họa trên trình duyệt (màn hình có ghi chú). Cổng thanh toán và SMS đang mô phỏng: nút "thanh toán thành công" thay cho IPN có chữ ký của MoMo/VNPAY sandbox.

## Số liệu

- Giá bán = giá lẻ thấp nhất thị trường (20/10/2026) × 1,08, làm tròn 10.000đ; giá vốn = giá thị trường × (1 − chiết khấu NPP giả định).
- Phí: lắp ráp 300.000đ (400.000đ nếu có linh kiện khách mang tới), vệ sinh 250.000đ, Care 450.000đ, tận nhà +100.000/150.000đ.
- Mã linh kiện ghi "minh họa" là dữ liệu bổ sung để thử luật tương thích.
