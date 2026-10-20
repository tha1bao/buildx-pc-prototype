// Dữ liệu mẫu cho prototype – giá khớp file Excel (giá thị trường thấp nhất 20/10/2026, giá bán = ×1,06 làm tròn 10.000đ).
// Linh kiện gắn dấu * là giá tham khảo thêm để minh họa kiểm tra tương thích.
window.BX = (function () {
  const MARKUP = 0.06;
  const sell = (m) => Math.round(m * (1 + MARKUP) / 10000) * 10000;
  const C = {
    cpu: [
      { id: "C01", n: "Intel Core i5-12400F (Tray)", mkt: 3050000, socket: "LGA1700", w: 117, stock: 6, brand: "Intel", spec: { "Nhân/luồng": "6/12", "Xung tối đa": "4,4 GHz", "Socket": "LGA1700", "Điện năng tối đa": "117 W" }, why: "6 nhân 12 luồng, đủ cho mọi GPU tới RTX 5060 Ti; rẻ nhất nền LGA1700 + DDR4." },
      { id: "C02", n: "Intel Core i5-14600KF (Tray)", mkt: 5690000, socket: "LGA1700", w: 181, stock: 0, brand: "Intel", spec: { "Nhân/luồng": "14/20", "Xung tối đa": "5,3 GHz", "Socket": "LGA1700", "Điện năng tối đa": "181 W" }, why: "14 nhân, mạnh khi dựng video/render, không nghẽn RTX 5070." },
      { id: "X01", n: "AMD Ryzen 5 7500F *", mkt: 3450000, socket: "AM5", w: 88, stock: 0, brand: "AMD", spec: { "Nhân/luồng": "6/12", "Socket": "AM5", "RAM": "Chỉ DDR5" }, why: "Nền AM5 nâng cấp lâu dài nhưng bắt buộc DDR5 (đang rất đắt)." }],
    main: [
      { id: "M01", n: "ASUS Prime H610M-K D4", mkt: 1690000, socket: "LGA1700", ram: "DDR4", ff: "mATX", stock: 4, brand: "ASUS", spec: { "Chipset": "H610", "Khe RAM": "2 × DDR4", "Kích thước": "mATX" }, why: "Đủ cho i5-12400F, tiết kiệm để dồn tiền cho VGA." },
      { id: "M02", n: "ASUS Prime B760M-A D4", mkt: 2550000, socket: "LGA1700", ram: "DDR4", ff: "mATX", stock: 5, brand: "ASUS", spec: { "Chipset": "B760", "Khe RAM": "4 × DDR4", "Kích thước": "mATX" }, why: "4 khe RAM để nâng 32GB sau này, VRM tốt hơn H610." },
      { id: "M03", n: "Gigabyte B760M Gaming Plus WiFi DDR4", mkt: 3199000, socket: "LGA1700", ram: "DDR4", ff: "mATX", stock: 3, brand: "Gigabyte", spec: { "Chipset": "B760", "Khe RAM": "4 × DDR4", "WiFi": "WiFi 6" }, why: "WiFi 6, VRM đủ cho i5-14600KF chạy tải dài." },
      { id: "X02", n: "Mainboard B650M DDR5 *", mkt: 3200000, socket: "AM5", ram: "DDR5", ff: "mATX", stock: 0, brand: "MSI", spec: { "Chipset": "B650", "Khe RAM": "4 × DDR5" }, why: "Dành cho Ryzen AM5, chỉ nhận RAM DDR5." }],
    ram: [
      { id: "R01", n: "RAM DDR4 16GB 3200", mkt: 2690000, type: "DDR4", gb: 16, stock: 14, brand: "G.Skill", spec: { "Dung lượng": "16 GB", "Bus": "3200 MHz" }, why: "DDR4 rẻ hơn DDR5 khoảng 2,5 lần (10/2026), chênh FPS nhỏ." },
      { id: "R02", n: "RAM DDR4 32GB (2×16GB) 3200", mkt: 5380000, type: "DDR4", gb: 32, stock: 4, brand: "TeamGroup", spec: { "Dung lượng": "2 × 16 GB", "Bus": "3200 MHz" }, why: "32GB cho Premiere, Blender, AI cục bộ, stream." },
      { id: "X03", n: "RAM DDR5 16GB 5600 *", mkt: 6690000, type: "DDR5", gb: 16, stock: 0, brand: "Kingston", spec: { "Dung lượng": "16 GB", "Bus": "5600 MHz" }, why: "Chỉ dùng với mainboard DDR5; giá rất cao năm 2026." }],
    ssd: [
      { id: "S01", n: "SSD NVMe Gen3 512GB", mkt: 2150000, stock: 11, brand: "Hiksemi", spec: { "Chuẩn": "PCIe 3.0 x4", "Dung lượng": "512 GB" }, why: "Đủ Windows + 3–4 game; còn khe M.2 để nâng thêm." },
      { id: "S02", n: "SSD NVMe Gen4 1TB", mkt: 4990000, stock: 5, brand: "WD", spec: { "Chuẩn": "PCIe 4.0 x4", "Dung lượng": "1 TB" }, why: "Chứa thư viện game lớn hoặc project video." }],
    vga: [
      { id: "G01", n: "GeForce RTX 5050 8GB", mkt: 7900000, w: 130, len: 225, tier: 1, stock: 2, brand: "NVIDIA", spec: { "VRAM": "8 GB", "TBP": "130 W", "Dài": "225 mm" }, why: "eSports 1080p trên 144 FPS, chi phí thấp nhất có DLSS 4." },
      { id: "G02", n: "GeForce RTX 5060 8GB", mkt: 10390000, w: 145, len: 240, tier: 2, stock: 1, brand: "NVIDIA", spec: { "VRAM": "8 GB GDDR7", "TBP": "145 W", "Dài": "240 mm" }, why: "Điểm cân bằng tốt nhất cho game AAA 1080p năm 2026." },
      { id: "G03", n: "GeForce RTX 5060 Ti 16GB", mkt: 14390000, w: 180, len: 280, tier: 3, stock: 0, brand: "NVIDIA", spec: { "VRAM": "16 GB GDDR7", "TBP": "180 W", "Dài": "280 mm" }, why: "16GB VRAM cho đồ họa, AI và game nặng texture ở 1440p." },
      { id: "G04", n: "GeForce RTX 5070 12GB", mkt: 18500000, w: 250, len: 300, tier: 4, stock: 0, brand: "NVIDIA", spec: { "VRAM": "12 GB GDDR7", "TBP": "250 W", "Dài": "300 mm" }, why: "Hiệu năng cao cho 1440p, render nhanh hơn rõ rệt." }],
    psu: [
      { id: "P01", n: "Cooler Master MWE 650 Bronze V3", mkt: 1499000, w: 650, stock: 8, brand: "Cooler Master", spec: { "Công suất": "650 W", "Chuẩn": "80 Plus Bronze" }, why: "650W Bronze, dư tải an toàn cho cấu hình tầm trung." },
      { id: "P02", n: "Cooler Master MWE 750 Bronze V3", mkt: 1599000, w: 750, stock: 3, brand: "Cooler Master", spec: { "Công suất": "750 W", "Chuẩn": "80 Plus Bronze" }, why: "Dư tải cho RTX 5070 + CPU K." }],
    case: [
      { id: "K01", n: "Case mATX phổ thông có kính", mkt: 690000, ff: ["mATX", "ITX"], gpu: 300, cool: 155, stock: 6, brand: "Xigmatek", spec: { "Hỗ trợ main": "mATX, ITX", "VGA tối đa": "300 mm", "Tản tối đa": "155 mm" }, why: "Gọn, đủ gió cho cấu hình eSports." },
      { id: "K02", n: "Cooler Master MasterBox TD500 Mesh V2", mkt: 1190000, ff: ["ATX", "mATX", "ITX"], gpu: 410, cool: 165, stock: 5, brand: "Cooler Master", spec: { "Hỗ trợ main": "ATX, mATX, ITX", "VGA tối đa": "410 mm", "Tản tối đa": "165 mm" }, why: "Mặt lưới thoáng, nhiệt độ thấp khi burn-in và chơi lâu." },
      { id: "X04", n: "Case Mini-ITX nhỏ gọn *", mkt: 1500000, ff: ["ITX"], gpu: 200, cool: 70, stock: 0, brand: "Jonsbo", spec: { "Hỗ trợ main": "ITX", "VGA tối đa": "200 mm" }, why: "Rất nhỏ, chỉ hợp main ITX và VGA ngắn." }],
    cool: [
      { id: "T01", n: "Cooler Master Hyper 212 Spectrum V3", mkt: 399000, h: 152, tdp: 150, stock: 9, brand: "Cooler Master", spec: { "Chiều cao": "152 mm", "Tản nhiệt": "~150 W" }, why: "CPU bản Tray không kèm quạt; tháp đơn đủ cho i5-12400F." },
      { id: "T02", n: "Cooler Master Hyper 620S ARGB", mkt: 799000, h: 157, tdp: 220, stock: 4, brand: "Cooler Master", spec: { "Chiều cao": "157 mm", "Tản nhiệt": "~220 W" }, why: "Tháp đôi cho i5-14600KF chạy tải lâu." }],
  };
  const SLOTS = [["cpu", "CPU"], ["main", "Mainboard"], ["ram", "RAM"], ["ssd", "SSD"], ["vga", "VGA"], ["psu", "Nguồn"], ["case", "Case"], ["cool", "Tản nhiệt"]];
  const TIERS = [
    { key: "esports", name: "BX Esports", use: "LoL, Valorant, CS2, học tập – 1080p", b: { cpu: "C01", main: "M01", ram: "R01", ssd: "S01", vga: "G01", psu: "P01", case: "K01", cool: "T01" }, comp: null },
    { key: "gamer", name: "BX Gamer", use: "Game AAA 1080p, stream nhẹ", b: { cpu: "C01", main: "M02", ram: "R01", ssd: "S01", vga: "G02", psu: "P01", case: "K02", cool: "T01" }, comp: 27690000 },
    { key: "creator", name: "BX Creator", use: "Đồ họa, dựng video, AI nhẹ – 1440p", b: { cpu: "C02", main: "M03", ram: "R02", ssd: "S02", vga: "G03", psu: "P01", case: "K02", cool: "T02" }, comp: 39150000 },
    { key: "pro", name: "BX Pro", use: "Game 1440p cao, render", b: { cpu: "C02", main: "M03", ram: "R02", ssd: "S02", vga: "G04", psu: "P02", case: "K02", cool: "T02" }, comp: null },
  ];
  const APPS = {
    game: ["Valorant", "CS2", "Liên Minh Huyền Thoại", "Black Myth: Wukong", "GTA V", "PUBG"],
    esports: ["Valorant", "CS2", "Liên Minh Huyền Thoại", "FC Online", "PUBG"],
    creator: ["Premiere Pro", "Photoshop", "Blender", "DaVinci Resolve", "Stable Diffusion"],
    study: ["Visual Studio Code", "Office", "Android Studio", "Valorant"],
  };
  const FPS = { "Valorant": [260, 330, 400, 450], "CS2": [170, 230, 290, 340], "Liên Minh Huyền Thoại": [240, 300, 340, 360], "Black Myth: Wukong": [45, 60, 78, 95], "GTA V": [120, 150, 175, 200], "PUBG": [110, 145, 180, 210], "FC Online": [200, 240, 270, 290] };
  const ORDER_STEPS = [["Chờ thanh toán", "Giữ hàng tạm 30 phút"], ["Đã đặt cọc", "Đối soát VietQR tự động"], ["Đã xác nhận", "Tư vấn gọi xác nhận, chấm rủi ro"], ["Chờ hàng / giữ hàng", "Giữ serial; CPU/VGA nhập theo đơn"], ["Đang lắp ráp", "Theo checklist, chụp ảnh đi dây"], ["Burn-in & QC", "MemTest86, FurMark, Cinebench R23"], ["Đang giao", "Đóng gói chống sốc, vận đơn"], ["Hoàn tất", "Kích hoạt bảo hành theo serial"]];
  const ORDERS = [
    { id: "BX-2702-0118", d: "18/02/2027", cust: "Nguyễn Minh Anh", phone: "0912 345 678", item: "BX Gamer", total: 25340000, paid: 7600000, step: 5, ship: "Nội thành HN", risk: 12, jit: ["G02"], tech: "Trần Đức Huy" },
    { id: "BX-2702-0117", d: "18/02/2027", cust: "Lê Quang Thắng", phone: "0987 222 019", item: "BX Creator", total: 39850000, paid: 11960000, step: 3, ship: "Liên tỉnh – Hải Phòng", risk: 35, jit: ["C02", "G03"], tech: "" },
    { id: "BX-2702-0116", d: "17/02/2027", cust: "Phạm Thu Trang", phone: "0903 556 120", item: "BX Esports", total: 21260000, paid: 21260000, step: 4, ship: "Nội thành HN", risk: 5, jit: [], tech: "Trần Đức Huy" },
    { id: "BX-2702-0115", d: "17/02/2027", cust: "Đỗ Hoàng Nam", phone: "0868 441 902", item: "BX Pro", total: 43820000, paid: 13150000, step: 2, ship: "Nội thành HN", risk: 64, jit: ["C02", "G04"], tech: "" },
    { id: "BX-2702-0114", d: "16/02/2027", cust: "Vũ Khánh Linh", phone: "0977 120 334", item: "RAM DDR4 16GB 3200", total: 2850000, paid: 2850000, step: 6, ship: "Liên tỉnh – Thanh Hóa", risk: 3, jit: [], tech: "" },
    { id: "BX-2702-0112", d: "15/02/2027", cust: "Bùi Tiến Dũng", phone: "0934 781 556", item: "BX Gamer", total: 25830000, paid: 25830000, step: 7, ship: "Nội thành HN", risk: 8, jit: [], tech: "Ngô Văn Long" },
    { id: "BX-2702-0110", d: "14/02/2027", cust: "Hoàng Bảo Ngọc", phone: "0915 909 221", item: "Lắp ráp hộ", total: 300000, paid: 0, step: 4, ship: "Tại xưởng", risk: 2, jit: [], tech: "Ngô Văn Long" },
  ];
  const LEADS = [
    { id: "L-0931", name: "Trịnh Văn Khoa", src: "TikTok – video 'Build PC 25 triệu'", need: "Gaming, 25 tr, case trắng", st: "Mới", ago: "12 phút" },
    { id: "L-0930", name: "Ngô Thị Hà", src: "Booth ĐH Bách khoa", need: "Đồ họa, 35–40 tr", st: "Đang tư vấn", ago: "1 giờ" },
    { id: "L-0928", name: "Phan Đức Mạnh", src: "Google Search Ads", need: "Valorant 240Hz, 20 tr", st: "Đã gửi báo giá", ago: "3 giờ" },
    { id: "L-0925", name: "Lý Minh Tuấn", src: "Giới thiệu – mã TUAN200", need: "Nâng cấp VGA", st: "Đã chốt", ago: "Hôm qua" },
    { id: "L-0921", name: "Đặng Hải Yến", src: "Livestream 'Build theo ngân sách'", need: "PC học lập trình, 18 tr", st: "Mất", ago: "2 ngày" },
  ];
  const SUPPLIERS = [
    { id: "NCC01", name: "Nhà phân phối A (Hà Nội)", grp: "CPU, VGA, mainboard", disc: "5–8%", debt: "Chưa có (thanh toán ngay)", lead: "Trong ngày", rma: "1 đổi 1 trong 7 ngày", score: 4.6 },
    { id: "NCC02", name: "Nhà phân phối B (Hà Nội)", grp: "RAM, SSD", disc: "7–8%", debt: "Đàm phán 7 ngày từ T5", lead: "1 ngày", rma: "1 đổi 1 trong 30 ngày", score: 4.3 },
    { id: "NCC03", name: "Nhà phân phối C (Hà Nội)", grp: "Nguồn, case, tản nhiệt", disc: "12–15%", debt: "15 ngày", lead: "1–2 ngày", rma: "Bảo hành tại hãng", score: 4.1 },
    { id: "NCC04", name: "Nhà phân phối D (TP.HCM)", grp: "VGA cao cấp (dự phòng)", disc: "4–6%", debt: "Không", lead: "2–3 ngày", rma: "1 đổi 1 trong 7 ngày", score: 3.8 },
  ];
  const PLAN = {
    months: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
    pc: [8, 12, 25, 32, 38, 42, 50, 62, 66, 62, 72, 80],
    net: [243.4, 349.0, 693.1, 882.3, 1041.8, 1148.3, 1365.6, 1684.5, 1791.3, 1690.5, 1956.4, 2169.5],
    ebt: [-65.7, -78.7, -77.4, -55.1, -40.7, -21.9, -12.7, -18.3, -4.3, -1.0, 10.0, 42.5],
  };
  const RULES = [
    ["R01", "Socket CPU = socket mainboard", "Chặn", "cpu.socket == main.socket"],
    ["R02", "Chuẩn RAM = chuẩn mainboard hỗ trợ", "Chặn", "ram.type == main.ram"],
    ["R03", "Form factor mainboard nằm trong danh sách case hỗ trợ", "Chặn", "case.ff ∋ main.ff"],
    ["R04", "Chiều dài VGA ≤ khoảng trống VGA của case", "Chặn", "vga.len ≤ case.gpu"],
    ["R05", "Chiều cao tản ≤ giới hạn tản của case", "Chặn", "cool.h ≤ case.cool"],
    ["R06", "Công suất nguồn ≥ 1,3 × (CPU + VGA + 75 W)", "Cảnh báo / chặn nếu < 1,1×", "psu.w ≥ 1.3 × load"],
    ["R07", "Khả năng tản ≥ điện năng tối đa của CPU", "Cảnh báo", "cool.tdp ≥ cpu.w"],
    ["R08", "CPU bản Tray phải đi kèm tản nhiệt", "Chặn", "cpu.tray → cool ≠ null"],
    ["R09", "Đầu cấp nguồn VGA (8-pin/12V-2x6) có trên nguồn", "Chặn", "psu.conn ⊇ vga.conn"],
    ["R10", "Số SSD M.2 ≤ số khe M.2 mainboard", "Chặn", "count(ssd.m2) ≤ main.m2"],
    ["R11", "Dung lượng RAM ≤ tối đa mainboard", "Chặn", "ram.gb ≤ main.maxRam"],
    ["R12", "Màu case khớp sở thích khách", "Gợi ý", "case.color == need.color"],
  ];
  return { C, SLOTS, TIERS, APPS, FPS, ORDER_STEPS, ORDERS, LEADS, SUPPLIERS, PLAN, RULES, sell, MARKUP };
})();
