# BuildX PC – Prototype (ISC301)

Prototype bấm được cho toàn bộ 38 màn hình của hệ thống BuildX PC – mô hình B2C bán lẻ linh kiện và lắp ráp PC theo đơn tại Hà Nội.

- Bản chạy trực tiếp: https://buildx-pc-prototype.vercel.app
- Website khách hàng: 20 màn (S00–S20) – tư vấn cấu hình 4 bước, 3 phương án, tự build có kiểm tra tương thích, giỏ hàng, đặt cọc VietQR, theo dõi đơn & báo cáo burn-in, bảo hành, BuildX Care, giới thiệu bạn bè.
- Hệ thống nội bộ: 18 màn (A01–A18) – dashboard kế hoạch, CRM lead, báo giá, xác nhận đơn, nhập kho serial, tồn kho, PO JIT, nhà cung cấp, điều phối xưởng, QC burn-in, đóng gói, RMA, sản phẩm & giá, luật tương thích, phân quyền, quảng cáo, gian lận.

Mỗi màn gắn mã use case (UC01–UC33) theo tài liệu dự án.

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | Khung trang |
| `app.css` | Giao diện (sáng/tối) |
| `data.js` | Dữ liệu: linh kiện, gói PC, đơn mẫu, kế hoạch 12 tháng, luật tương thích |
| `app.js` | Router theo hash (`#/home`, `#/dashboard`…) và render từng màn |

Giá bán = giá thị trường thấp nhất (10/2026) × 1,06, làm tròn 10.000đ. Khách hàng, đơn hàng, nhà phân phối là dữ liệu minh họa. Trạng thái chỉ lưu trong bộ nhớ trang.

## Chạy local

Mở `index.html` trực tiếp trong trình duyệt, không cần cài đặt.
