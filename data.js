// BuildX PC – dữ liệu mẫu theo Kế hoạch kinh doanh v3 (27/10/2026) và file mô hình tài chính.
// Giá bán = giá lẻ thấp nhất thị trường × (1 + 8%), làm tròn 10.000đ (sheet "Linh kiện").
// Giá vốn = giá thị trường × (1 − chiết khấu NPP giả định).
// Mã gắn demo:true là dữ liệu bổ sung để thử luật tương thích, giá minh họa (không có trong sheet Linh kiện).
// Mã gắn ref:true là model tham chiếu đã ngừng bán, chỉ dùng để khai báo "Đã có" và nâng cấp.
window.BX = (function () {
  const MARKUP = 0.08;
  const sell = (m) => Math.round((m * (1 + MARKUP)) / 10000) * 10000;

  const CAT = { main: "Mainboard", cpu: "CPU", ram: "RAM", vga: "VGA", ssd: "Lưu trữ", cool: "Tản nhiệt", case: "Case", psu: "Nguồn", opt: "Phụ kiện" };
  // Thứ tự Build PC theo v3 mục 14.3: mainboard trước, rồi CPU → RAM → VGA → lưu trữ → tản nhiệt → case → nguồn
  const ORDER = ["main", "cpu", "ram", "vga", "ssd", "cool", "case", "psu"];

  const P = [
    // ---- CPU ----
    { id: "C01", cat: "cpu", n: "Intel Core i5-12400F (Tray)", brand: "Intel", mkt: 3050000, disc: 0.05, grp: "B", stock: 10, socket: "LGA1700", w: 117, igpu: false, box: false, why: "6 nhân 12 luồng, đủ cho GPU tới RTX 5060 Ti; nền LGA1700 + DDR4 rẻ nhất.", spec: { "Nhân/luồng": "6/12", "Xung tối đa": "4,4 GHz" } },
    { id: "C02", cat: "cpu", n: "Intel Core i5-14600KF (Tray)", brand: "Intel", mkt: 5690000, disc: 0.05, grp: "C", stock: 0, socket: "LGA1700", w: 181, igpu: false, box: false, why: "14 nhân, mạnh khi dựng video và render, không nghẽn RTX 5070.", spec: { "Nhân/luồng": "14/20", "Xung tối đa": "5,3 GHz" } },
    { id: "C03", cat: "cpu", n: "Intel Core i5-12400 (Box, có GPU tích hợp)", brand: "Intel", mkt: 3690000, disc: 0.05, grp: "B", stock: 3, socket: "LGA1700", w: 117, igpu: true, box: true, demo: true, why: "Có GPU tích hợp và tản kèm hộp: dựng được máy văn phòng không cần VGA rời.", spec: { "Nhân/luồng": "6/12", "GPU": "UHD 730" } },
    { id: "C04", cat: "cpu", n: "AMD Ryzen 5 7500F", brand: "AMD", mkt: 3450000, disc: 0.05, grp: "B", stock: 2, socket: "AM5", w: 88, igpu: false, box: false, demo: true, why: "Nền AM5 nâng cấp lâu dài nhưng bắt buộc RAM DDR5 (giá cao năm 2026).", spec: { "Nhân/luồng": "6/12", "RAM": "Chỉ DDR5" } },
    // ---- Mainboard ----
    { id: "M01", cat: "main", n: "ASUS Prime H610M-K D4", brand: "ASUS", mkt: 1690000, disc: 0.08, grp: "B", stock: 6, socket: "LGA1700", ram: "DDR4", slots: 2, maxRam: 64, bus: 3200, ff: "mATX", m2: 1, sata: 4, x1: 1, wifi: false, why: "Đủ cho i5-12400F, tiết kiệm để dồn tiền cho VGA.", spec: { "Chipset": "H610" } },
    { id: "M02", cat: "main", n: "ASUS Prime B760M-A D4", brand: "ASUS", mkt: 2550000, disc: 0.08, grp: "B", stock: 7, socket: "LGA1700", ram: "DDR4", slots: 4, maxRam: 128, bus: 3200, ff: "mATX", m2: 2, sata: 4, x1: 1, wifi: false, why: "4 khe RAM để nâng 32GB sau này, 2 khe M.2.", spec: { "Chipset": "B760" } },
    { id: "M03", cat: "main", n: "Gigabyte B760M Gaming Plus WiFi DDR4", brand: "Gigabyte", mkt: 3199000, disc: 0.08, grp: "B", stock: 3, socket: "LGA1700", ram: "DDR4", slots: 4, maxRam: 128, bus: 3200, ff: "mATX", m2: 2, sata: 4, x1: 1, wifi: true, why: "WiFi 6, VRM đủ cho i5-14600KF chạy tải dài.", spec: { "Chipset": "B760" } },
    { id: "M04", cat: "main", n: "MSI PRO B650M-P (AM5, DDR5)", brand: "MSI", mkt: 3290000, disc: 0.08, grp: "B", stock: 2, socket: "AM5", ram: "DDR5", slots: 4, maxRam: 192, bus: 6000, ff: "mATX", m2: 2, sata: 4, x1: 1, wifi: false, demo: true, why: "Dành cho Ryzen AM5, chỉ nhận RAM DDR5.", spec: { "Chipset": "B650" } },
    { id: "M05", cat: "main", n: "ASUS Prime H610I-Plus D4 (Mini-ITX)", brand: "ASUS", mkt: 2890000, disc: 0.08, grp: "B", stock: 1, socket: "LGA1700", ram: "DDR4", slots: 2, maxRam: 64, bus: 3200, ff: "ITX", m2: 1, sata: 2, x1: 0, wifi: false, demo: true, why: "Mini-ITX cho máy nhỏ gọn; ít khe mở rộng.", spec: { "Chipset": "H610" } },
    { id: "M06", cat: "main", n: "MSI PRO B760-P DDR4 II (ATX)", brand: "MSI", mkt: 3390000, disc: 0.08, grp: "B", stock: 2, socket: "LGA1700", ram: "DDR4", slots: 4, maxRam: 128, bus: 3200, ff: "ATX", m2: 2, sata: 4, x1: 2, wifi: false, demo: true, why: "ATX nhiều khe mở rộng; cần case ATX.", spec: { "Chipset": "B760" } },
    // ---- RAM (mỗi mã là 1 thanh) ----
    { id: "R01", cat: "ram", n: "RAM DDR4 16GB 3200", brand: "G.Skill", mkt: 2690000, disc: 0.07, grp: "A", stock: 16, type: "DDR4", gb: 16, bus: 3200, why: "DDR4 rẻ hơn DDR5 khoảng 2,5 lần (10/2026), chênh FPS nhỏ.", spec: {} },
    { id: "R03", cat: "ram", n: "RAM DDR4 8GB 3200", brand: "TeamGroup", mkt: 1390000, disc: 0.07, grp: "A", stock: 8, type: "DDR4", gb: 8, bus: 3200, demo: true, why: "Thanh 8GB để nâng máy cũ lên 16GB.", spec: {} },
    { id: "R04", cat: "ram", n: "RAM DDR4 16GB 3600", brand: "Kingston", mkt: 2890000, disc: 0.07, grp: "A", stock: 4, type: "DDR4", gb: 16, bus: 3600, demo: true, why: "Bus 3600, mainboard H610/B760 DDR4 chạy ở 3200.", spec: {} },
    { id: "R02", cat: "ram", n: "RAM DDR5 16GB 5600", brand: "Kingston", mkt: 6690000, disc: 0.07, grp: "A", stock: 2, type: "DDR5", gb: 16, bus: 5600, demo: true, why: "Chỉ dùng với mainboard DDR5; giá rất cao năm 2026.", spec: {} },
    // ---- VGA ----
    { id: "G01", cat: "vga", n: "GeForce RTX 5050 8GB", brand: "NVIDIA", mkt: 7900000, disc: 0.05, grp: "B", stock: 5, w: 130, len: 225, pin8: 1, p16: false, tier: 1, why: "eSports 1080p trên 144 FPS, rẻ nhất có DLSS 4.", spec: { "VRAM": "8 GB" } },
    { id: "G02", cat: "vga", n: "GeForce RTX 5060 8GB", brand: "NVIDIA", mkt: 10390000, disc: 0.05, grp: "B", stock: 6, w: 145, len: 240, pin8: 1, p16: false, tier: 2, why: "Điểm cân bằng tốt nhất cho game AAA 1080p năm 2026.", spec: { "VRAM": "8 GB GDDR7" } },
    { id: "G03", cat: "vga", n: "GeForce RTX 5060 Ti 16GB", brand: "NVIDIA", mkt: 14390000, disc: 0.05, grp: "C", stock: 0, w: 180, len: 280, pin8: 1, p16: false, tier: 3, why: "16GB VRAM cho đồ họa, AI và game nặng texture ở 1440p.", spec: { "VRAM": "16 GB GDDR7" } },
    { id: "G04", cat: "vga", n: "GeForce RTX 5070 12GB", brand: "NVIDIA", mkt: 18500000, disc: 0.05, grp: "C", stock: 0, w: 250, len: 300, pin8: 2, p16: true, tier: 4, why: "Hiệu năng cao cho 1440p, render nhanh hơn rõ rệt.", spec: { "VRAM": "12 GB GDDR7" } },
    { id: "G05", cat: "vga", n: "GeForce RTX 5070 Ti 16GB", brand: "NVIDIA", mkt: 25990000, disc: 0.05, grp: "C", stock: 0, w: 300, len: 330, pin8: 3, p16: true, tier: 4, demo: true, why: "Card dài 330 mm, cần case lớn và nguồn ≥ 750W.", spec: { "VRAM": "16 GB GDDR7" } },
    // ---- Lưu trữ ----
    { id: "S01", cat: "ssd", n: "SSD NVMe Gen3 512GB", brand: "Hiksemi", mkt: 2150000, disc: 0.08, grp: "A", stock: 11, iface: "NVMe", form: "M.2", gb: 512, why: "Đủ Windows và 3–4 game.", spec: {} },
    { id: "S02", cat: "ssd", n: "SSD NVMe Gen4 1TB", brand: "WD", mkt: 4990000, disc: 0.08, grp: "A", stock: 5, iface: "NVMe", form: "M.2", gb: 1000, why: "Chứa thư viện game lớn hoặc project video.", spec: {} },
    { id: "S03", cat: "ssd", n: "SSD SATA 2.5\" 512GB", brand: "Kingston", mkt: 1690000, disc: 0.08, grp: "A", stock: 6, iface: "SATA", form: "2.5", gb: 512, demo: true, why: "Dùng cổng SATA, hợp máy đã hết khe M.2.", spec: {} },
    // ---- Tản nhiệt ----
    { id: "T01", cat: "cool", n: "Cooler Master Hyper 212 Spectrum V3", brand: "Cooler Master", mkt: 399000, disc: 0.15, grp: "A", stock: 9, sockets: ["LGA1700", "AM5", "AM4"], h: 152, rad: 0, tdp: 150, why: "CPU bản Tray không kèm quạt; tháp đơn đủ cho i5-12400F.", spec: {} },
    { id: "T02", cat: "cool", n: "Cooler Master Hyper 620S ARGB", brand: "Cooler Master", mkt: 799000, disc: 0.15, grp: "A", stock: 4, sockets: ["LGA1700", "AM5", "AM4"], h: 157, rad: 0, tdp: 220, why: "Tháp đôi cho i5-14600KF chạy tải lâu.", spec: {} },
    { id: "T03", cat: "cool", n: "Tản low-profile 47 mm", brand: "Noctua", mkt: 450000, disc: 0.15, grp: "A", stock: 3, sockets: ["LGA1700"], h: 47, rad: 0, tdp: 95, demo: true, why: "Cho case Mini-ITX thấp; chỉ đủ CPU ≤ 95W.", spec: {} },
    { id: "T04", cat: "cool", n: "Tản nước AIO 240 mm", brand: "Cooler Master", mkt: 1990000, disc: 0.15, grp: "A", stock: 2, sockets: ["LGA1700", "AM5"], h: 0, rad: 240, tdp: 250, demo: true, why: "Tản nước 240 mm, cần case có chỗ lắp radiator 240.", spec: {} },
    // ---- Case ----
    { id: "K01", cat: "case", n: "Case mATX phổ thông có kính", brand: "Xigmatek", mkt: 690000, disc: 0.15, grp: "A", stock: 6, ff: ["mATX", "ITX"], gpu: 300, cool: 155, rad: 120, fans: 4, pre: 1, color: "Đen", why: "Gọn, đủ gió cho cấu hình eSports.", spec: {} },
    { id: "K02", cat: "case", n: "Cooler Master MasterBox TD500 Mesh V2", brand: "Cooler Master", mkt: 1190000, disc: 0.15, grp: "A", stock: 7, ff: ["ATX", "mATX", "ITX"], gpu: 410, cool: 165, rad: 360, fans: 6, pre: 3, color: "Đen", why: "Mặt lưới thoáng, nhiệt độ thấp khi burn-in và chơi lâu.", spec: {} },
    { id: "K03", cat: "case", n: "Case Mini-ITX nhỏ gọn", brand: "Jonsbo", mkt: 1500000, disc: 0.15, grp: "A", stock: 2, ff: ["ITX"], gpu: 200, cool: 70, rad: 0, fans: 2, pre: 1, color: "Đen", demo: true, why: "Rất nhỏ, chỉ hợp main ITX, VGA ngắn và tản thấp.", spec: {} },
    { id: "K04", cat: "case", n: "Case mATX màu trắng có kính", brand: "Xigmatek", mkt: 790000, disc: 0.15, grp: "A", stock: 4, ff: ["mATX", "ITX"], gpu: 320, cool: 160, rad: 240, fans: 6, pre: 0, color: "Trắng", demo: true, why: "Bản màu trắng cho khách thích build trắng.", spec: {} },
    // ---- Nguồn ----
    { id: "P01", cat: "psu", n: "Cooler Master MWE 650 Bronze V3", brand: "Cooler Master", mkt: 1499000, disc: 0.12, grp: "A", stock: 12, w: 650, pin8: 2, p16: false, why: "650W Bronze, dư tải an toàn cho cấu hình tầm trung.", spec: {} },
    { id: "P02", cat: "psu", n: "Cooler Master MWE 750 Bronze V3", brand: "Cooler Master", mkt: 1599000, disc: 0.12, grp: "A", stock: 3, w: 750, pin8: 4, p16: false, why: "Dư tải cho RTX 5070 và CPU dòng K.", spec: {} },
    { id: "P03", cat: "psu", n: "Nguồn 550W Bronze", brand: "Xigmatek", mkt: 1090000, disc: 0.12, grp: "A", stock: 4, w: 550, pin8: 1, p16: false, demo: true, why: "Đủ cho máy văn phòng, eSports nhẹ.", spec: {} },
    // ---- Phụ kiện tùy chọn (UC07) ----
    { id: "F01", cat: "opt", n: "Bộ 3 quạt case 120 mm ARGB", brand: "Cooler Master", mkt: 390000, disc: 0.15, grp: "A", stock: 10, need: "fan3", why: "Tăng luồng gió; cần case còn 3 vị trí quạt.", spec: {} },
    { id: "W01", cat: "opt", n: "Card WiFi 6 + Bluetooth PCIe", brand: "TP-Link", mkt: 450000, disc: 0.12, grp: "A", stock: 6, need: "x1", why: "Cho mainboard không có WiFi; cần khe PCIe x1 trống.", spec: {} },
    { id: "D01", cat: "opt", n: "Màn hình 24\" 165Hz IPS", brand: "ASUS", mkt: 2990000, disc: 0.08, grp: "A", stock: 5, need: "", why: "Tận dụng FPS cao của cấu hình gaming.", spec: {} },
    { id: "KB1", cat: "opt", n: "Bộ phím chuột gaming", brand: "Rapoo", mkt: 690000, disc: 0.15, grp: "A", stock: 8, need: "", why: "Bộ cơ bản đi kèm PC mới.", spec: {} },
    // ---- Model tham chiếu đã ngừng bán (chỉ khai báo "Đã có") ----
    { id: "XC9", cat: "cpu", n: "Intel Core i5-9400F (đã ngừng bán)", ref: true, socket: "LGA1151", w: 65, igpu: false, box: true, mkt: 0 },
    { id: "XC5", cat: "cpu", n: "AMD Ryzen 5 5600 (đã ngừng bán)", ref: true, socket: "AM4", w: 76, igpu: false, box: true, mkt: 0 },
    { id: "XM9", cat: "main", n: "Mainboard B365M DDR4 (đã ngừng bán)", ref: true, socket: "LGA1151", ram: "DDR4", slots: 2, maxRam: 64, bus: 2666, ff: "mATX", m2: 1, sata: 4, x1: 1, wifi: false, mkt: 0 },
    { id: "XM5", cat: "main", n: "Mainboard B450M DDR4 (đã ngừng bán)", ref: true, socket: "AM4", ram: "DDR4", slots: 4, maxRam: 64, bus: 3200, ff: "mATX", m2: 1, sata: 4, x1: 1, wifi: false, mkt: 0 },
    { id: "XR8", cat: "ram", n: "RAM DDR4 8GB 2666 (đã ngừng bán)", ref: true, type: "DDR4", gb: 8, bus: 2666, mkt: 0 },
    { id: "XG6", cat: "vga", n: "GeForce GTX 1660 Super (đã ngừng bán)", ref: true, w: 125, len: 230, pin8: 1, p16: false, tier: 1, mkt: 0 },
    { id: "XS2", cat: "ssd", n: "SSD SATA 240GB cũ", ref: true, iface: "SATA", form: "2.5", gb: 240, mkt: 0 },
    { id: "XP4", cat: "psu", n: "Nguồn 450W cũ (đã ngừng bán)", ref: true, w: 450, pin8: 1, p16: false, mkt: 0 },
    { id: "XK8", cat: "case", n: "Case mATX cũ (VGA tối đa 250 mm)", ref: true, ff: ["mATX", "ITX"], gpu: 250, cool: 150, rad: 0, fans: 3, pre: 1, color: "Đen", mkt: 0 },
  ];
  P.forEach((p) => { if (!p.ref) { p.price = sell(p.mkt); p.cost = Math.round(p.mkt * (1 - p.disc)); } });

  // 4 combo theo sheet "Bảng giá SP" (giá gồm VAT, chưa gồm lắp ráp). qty RAM = số thanh.
  const COMBOS = [
    { key: "esports", name: "BX Esports", use: "Esports (LoL, Valorant, CS2), học tập · 1080p", share: 35, parts: { main: "M01", cpu: "C01", ram: "R01", ramQty: 1, vga: "G01", ssd: "S01", cool: "T01", case: "K01", psu: "P01" }, comp: null },
    { key: "gamer", name: "BX Gamer", use: "Game AAA 1080p thiết lập cao, stream nhẹ", share: 40, parts: { main: "M02", cpu: "C01", ram: "R01", ramQty: 1, vga: "G02", ssd: "S01", cool: "T01", case: "K02", psu: "P01" }, comp: { price: 27690000, src: "GEARVN PC GVN i5-12400F/RTX 5060 (Main H), 20/10/2026" } },
    { key: "creator", name: "BX Creator", use: "Đồ họa, dựng video, AI nhẹ · 1440p", share: 17, parts: { main: "M03", cpu: "C02", ram: "R01", ramQty: 2, vga: "G03", ssd: "S02", cool: "T02", case: "K02", psu: "P01" }, comp: { price: 39150000, src: "GEARVN PC GVN i5-12400F/RTX 5060 Ti, 20/10/2026 (CPU yếu hơn, 16GB)" } },
    { key: "pro", name: "BX Pro", use: "Game 1440p thiết lập cao, render", share: 8, parts: { main: "M03", cpu: "C02", ram: "R01", ramQty: 2, vga: "G04", ssd: "S02", cool: "T02", case: "K02", psu: "P02" }, comp: null },
  ];
  // Linh kiện tùy chọn khai báo cho từng combo (UC18 – SC36)
  const COMBO_OPTS = { esports: ["R01", "S03", "F01", "W01", "D01", "KB1"], gamer: ["R01", "S02", "F01", "W01", "D01", "KB1"], creator: ["R01", "S01", "F01", "D01", "KB1"], pro: ["R01", "S01", "F01", "D01", "KB1"] };

  // Bảng giá dịch vụ (v3 mục 6)
  const FEES = { asm: 300000, asmOwn: 400000, clean: 250000, care: 450000, homeIn: 100000, homeOut: 150000, depositRate: 0.3, asmCost: 20000, cleanCost: 40000, careCost: 100000 };

  const APPS = {
    game: ["Valorant", "CS2", "Liên Minh Huyền Thoại", "Black Myth: Wukong", "GTA V", "PUBG"],
    esports: ["Valorant", "CS2", "Liên Minh Huyền Thoại", "FC Online", "PUBG"],
    creator: ["Premiere Pro", "Photoshop", "Blender", "DaVinci Resolve", "Stable Diffusion"],
    study: ["Visual Studio Code", "Office", "Android Studio", "Valorant"],
  };
  const FPS = { "Valorant": [260, 330, 400, 450], "CS2": [170, 230, 290, 340], "Liên Minh Huyền Thoại": [240, 300, 340, 360], "Black Myth: Wukong": [45, 60, 78, 95], "GTA V": [120, 150, 175, 200], "PUBG": [110, 145, 180, 210], "FC Online": [200, 240, 270, 290] };

  // Trạng thái đơn thống nhất (v3 mục 14.6)
  const STATUSES = ["Mới", "Đã xác nhận", "Chờ hàng", "Lắp ráp & QC", "Đóng gói", "Đang giao / Chờ nhận", "Hoàn tất", "Đã hủy"];

  // Kế hoạch 12 tháng (sheet "Doanh thu 12T" và "P&L – Dòng tiền", kịch bản cơ sở v3)
  const PLAN = {
    months: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
    pc: [12, 16, 20, 24, 27, 30, 32, 35, 38, 40, 44, 48],
    net: [359.2, 467.8, 577.4, 689.4, 771.5, 853.7, 908.6, 990.8, 1073.1, 1128.1, 1237.7, 1347.4],
    ebt: [-92.7, -59.7, -47.2, -33.0, -23.7, -14.3, -8.0, 1.4, 10.8, 17.2, 29.7, 42.2],
    kpi: { margin: 13.9, marginAlert: 13, breakeven: 35, cac: 390000, visitLead: 3, leadOrder: 20, asm: 85, care: 20 },
  };

  const ROLES = {
    "Quản lý": ["*"],
    "Nhân viên bán hàng": ["pos", "orders", "order", "leads", "quote"],
    "Nhân viên tư vấn": ["leads", "quote", "pos", "orders", "order"],
    "Thủ kho": ["stock", "stockdoc", "po", "suppliers", "packing", "orders", "order"],
    "Kỹ thuật viên": ["workshop", "ticket", "packing", "requests", "rma"],
    "Quản trị viên": ["users"],
  };

  return { P, CAT, ORDER, COMBOS, COMBO_OPTS, FEES, APPS, FPS, STATUSES, PLAN, ROLES, sell, MARKUP };
})();
