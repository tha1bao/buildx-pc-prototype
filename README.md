# BuildX PC – Prototype (ISC301)

Prototype bấm được cho 42 màn hình của hệ thống BuildX PC, dựng theo **Kế hoạch kinh doanh v3 (27/10/2026)**. Mã màn hình SC01–SC42 và use case UC01–UC22 khớp sheet "Use Case" và "Product Tracking" trong file mô hình tài chính.

- Bản chạy trực tiếp: https://buildx-pc-prototype.vercel.app
- Khách hàng (SC01–SC21): tài khoản OTP, sổ địa chỉ, cấu hình đã lưu, danh mục, chi tiết sản phẩm, tư vấn 3 phương án, **Build PC bắt đầu từ mainboard** (ẩn linh kiện không tương thích, bộ đếm X/Y, Mua mới / Đã có / Bỏ trống kèm cảnh báo), **nâng cấp PC đang dùng** (kiểm tra dây chuyền nguồn, case), combo kèm linh kiện tùy chọn, giỏ hàng + mã giảm giá, đặt hàng (đặt trước, cọc 30% hàng nhóm C), thanh toán COD/MoMo/VNPAY/thẻ giả lập với OTP cho đơn rủi ro, theo dõi đơn và báo cáo burn-in, đặt lịch dịch vụ, bảo hành và BuildX Care.
- Nhân viên (SC22–SC42): bán tại quầy (POS), lead và báo giá 48 giờ, đơn hàng theo 8 trạng thái thống nhất, điều phối xưởng, phiếu lắp ráp & QC, đóng gói & xuất kho, tồn kho theo serial, phiếu kho, nhà cung cấp, đơn nhập, sản phẩm & giá, luật tương thích (24 ca kiểm thử chạy thật), combo, yêu cầu dịch vụ, RMA, mã giảm giá, banner & giới thiệu, báo cáo, phân quyền theo vai trò.

Luồng demo chạy trọn: Build PC → giỏ → thanh toán → đơn ở trang quản trị → giữ hàng (hoặc Chờ hàng → đơn nhập → nhận hàng) → lắp ráp & QC → đóng gói, xuất kho → hoàn tất.

## Số liệu

- Giá bán = giá lẻ thấp nhất thị trường (20/10/2026) × 1,08, làm tròn 10.000đ; giá vốn = giá thị trường × (1 − chiết khấu NPP giả định). Bốn combo: 21,68 / 25,83 / 40,12 / 44,67 triệu.
- Phí: lắp ráp 300.000đ (400.000đ nếu có linh kiện khách mang tới), vệ sinh 250.000đ, Care 450.000đ, tận nhà +100.000/150.000đ.
- Kế hoạch 12 tháng ở màn Báo cáo lấy từ kịch bản cơ sở v3.
- Mã linh kiện ghi "minh họa" là dữ liệu bổ sung để thử luật tương thích, không có trong sheet Linh kiện. Khách hàng, đơn hàng, nhà phân phối là dữ liệu mẫu. Trạng thái chỉ lưu trong bộ nhớ trang.

## Cấu trúc

| File | Nội dung |
|---|---|
| `data.js` | Linh kiện (thông số tương thích), model tham chiếu đã ngừng bán, 4 combo, phí dịch vụ, kế hoạch 12 tháng, vai trò |
| `engine.js` | Luật tương thích R1–R8, linh kiện bắt buộc, kho theo serial, đơn hàng và trạng thái, đơn nhập, dữ liệu mẫu |
| `app.js` | Khung trang, router theo hash, phân quyền theo vai trò |
| `store.js` | 21 màn phía khách hàng |
| `admin.js` | 21 màn phía nhân viên |

Mở `index.html` trực tiếp trong trình duyệt, không cần cài đặt.
