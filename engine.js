// BuildX PC – engine dùng chung cho website, POS và báo giá:
// luật tương thích (v3 mục 14.3), tồn kho theo serial, đơn hàng theo bảng trạng thái (v3 mục 14.6).
// Trạng thái chỉ lưu trong bộ nhớ trang (prototype).
window.BXE = (function () {
  const { P, ORDER, COMBOS, FEES, STATUSES, CUST_TIERS, PRESET_CUSTOMERS } = window.BX;
  const byId = (id) => P.find((p) => p.id === id);
  const TODAY = new Date(2027, 3, 16, 10, 0);
  const days = (d) => Math.floor((TODAY - d) / 864e5);
  const dstr = (d) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const tstr = (d) => d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  // ===================== CẤU HÌNH =====================
  // cfg[slot] = { mode: "buy" | "own" | "skip" | null, id, qty }; cfg.extras = [{ id, qty }]
  const emptyCfg = () => { const c = { extras: [] }; ORDER.forEach((s) => (c[s] = { mode: null, id: null, qty: 1 })); return c; };
  const cfgFromCombo = (key) => {
    const cb = COMBOS.find((x) => x.key === key), c = emptyCfg();
    ORDER.forEach((s) => (c[s] = { mode: "buy", id: cb.parts[s], qty: s === "ram" ? cb.parts.ramQty : 1 }));
    return c;
  };
  const clone = (c) => JSON.parse(JSON.stringify(c));
  const part = (c, s) => (c[s] && (c[s].mode === "buy" || c[s].mode === "own") && c[s].id ? byId(c[s].id) : null);
  const sticks = (c) => { const r = part(c, "ram"); let n = r ? c.ram.qty : 0; c.extras.forEach((e) => { if (byId(e.id).cat === "ram") n += e.qty; }); return n; };
  const ramGb = (c) => { const r = part(c, "ram"); let g = r ? r.gb * c.ram.qty : 0; c.extras.forEach((e) => { const x = byId(e.id); if (x.cat === "ram") g += x.gb * e.qty; }); return g; };
  const drives = (c, form) => { let n = 0; const s = part(c, "ssd"); if (s && s.form === form) n++; c.extras.forEach((e) => { const x = byId(e.id); if (x.cat === "ssd" && x.form === form) n += e.qty; }); return n; };
  const load = (c) => { const cpu = part(c, "cpu"), vga = part(c, "vga"); return (cpu ? cpu.w : 0) + (vga ? vga.w : 0) + 75; };

  // Luật: trả về danh sách { r, lv: "ok"|"warn"|"bad", slots, m }
  const RULES = [
    { id: "R1", name: "CPU và mainboard", cond: "Cùng socket; chipset hỗ trợ thế hệ CPU", lv: "Chặn cứng", data: "Socket, chipset" },
    { id: "R2", name: "RAM và mainboard", cond: "Cùng loại DDR; không vượt số khe, dung lượng tối đa", lv: "Chặn cứng; bus vượt mức chỉ cảnh báo", data: "Loại RAM, số khe, dung lượng và bus tối đa" },
    { id: "R3", name: "Mainboard và case", cond: "Case hỗ trợ kích thước board (ATX, mATX, ITX)", lv: "Chặn cứng", data: "Kích thước board, chuẩn case hỗ trợ" },
    { id: "R4", name: "VGA và case", cond: "Chiều dài VGA không vượt giới hạn của case", lv: "Chặn cứng", data: "Chiều dài VGA, giới hạn case" },
    { id: "R5", name: "Tản nhiệt", cond: "Hỗ trợ socket; chiều cao/radiator vừa case; đủ sức tản cho CPU", lv: "Chặn cứng (socket, kích thước); cảnh báo (công suất tản)", data: "Socket hỗ trợ, chiều cao, radiator, khả năng tản" },
    { id: "R6", name: "Nguồn (PSU)", cond: "Đủ công suất + dự phòng 30%; có đầu cắm cho VGA", lv: "Cảnh báo khi sát ngưỡng; chặn khi thiếu đầu cắm hoặc dưới tải", data: "Công suất, đầu cắm, mức tiêu thụ CPU và VGA" },
    { id: "R7", name: "Lưu trữ", cond: "Mainboard còn khe M.2 / cổng SATA cho ổ", lv: "Chặn cứng", data: "Số khe M.2, cổng SATA" },
    { id: "R8", name: "Linh kiện tùy chọn của combo/nâng cấp", cond: "Còn khe trống (RAM, M.2, PCIe, vị trí quạt); nguồn còn dư", lv: "Chặn khi hết khe; cảnh báo nguồn", data: "Số khe đã dùng, tổng công suất" },
  ];
  const fmtW = (w) => w + " W";
  function evalRules(c) {
    const out = [], main = part(c, "main"), cpu = part(c, "cpu"), ram = part(c, "ram"), vga = part(c, "vga"), ssd = part(c, "ssd"), cool = part(c, "cool"), cs = part(c, "case"), psu = part(c, "psu");
    const add = (r, lv, slots, m) => out.push({ r, lv, slots, m });
    if (cpu && main) add("R1", cpu.socket === main.socket ? "ok" : "bad", ["cpu", "main"], cpu.socket === main.socket ? `CPU và mainboard cùng socket ${cpu.socket}.` : `CPU dùng ${cpu.socket}, mainboard là ${main.socket}.`);
    const n = sticks(c), extraRam = c.extras.filter((e) => byId(e.id).cat === "ram").map((e) => byId(e.id));
    if (main && (ram || extraRam.length)) {
      const types = [ram, ...extraRam].filter(Boolean);
      const wrong = types.find((x) => x.type !== main.ram);
      add("R2", wrong ? "bad" : "ok", ["ram", "main"], wrong ? `Mainboard chỉ nhận ${main.ram}, RAM là ${wrong.type}.` : `Mainboard nhận ${main.ram}.`);
      if (n > main.slots) add("R2", "bad", ["ram", "main"], `Cần ${n} khe RAM, mainboard chỉ có ${main.slots} khe.`);
      if (ramGb(c) > main.maxRam) add("R2", "bad", ["ram", "main"], `Tổng ${ramGb(c)}GB vượt tối đa ${main.maxRam}GB của mainboard.`);
      const fast = types.find((x) => x.bus > main.bus);
      if (fast && !wrong) add("R2", "warn", ["ram", "main"], `RAM bus ${fast.bus} sẽ chạy ở ${main.bus} MHz trên mainboard này.`);
    }
    if (main && cs) add("R3", cs.ff.includes(main.ff) ? "ok" : "bad", ["main", "case"], cs.ff.includes(main.ff) ? `Case nhận mainboard ${main.ff}.` : `Case chỉ nhận ${cs.ff.join("/")}, mainboard là ${main.ff}.`);
    if (vga && cs) add("R4", vga.len <= cs.gpu ? "ok" : "bad", ["vga", "case"], vga.len <= cs.gpu ? `VGA dài ${vga.len} mm, case cho tối đa ${cs.gpu} mm.` : `VGA dài ${vga.len} mm vượt giới hạn ${cs.gpu} mm của case.`);
    if (cool) {
      if (cpu) add("R5", cool.sockets.includes(cpu.socket) ? "ok" : "bad", ["cool", "cpu"], cool.sockets.includes(cpu.socket) ? `Tản hỗ trợ socket ${cpu.socket}.` : `Tản không có ngàm cho socket ${cpu.socket}.`);
      if (cs) {
        if (cool.rad) add("R5", cool.rad <= cs.rad ? "ok" : "bad", ["cool", "case"], cool.rad <= cs.rad ? `Case lắp được radiator ${cool.rad} mm.` : `Case không có chỗ cho radiator ${cool.rad} mm (tối đa ${cs.rad || 0} mm).`);
        else add("R5", cool.h <= cs.cool ? "ok" : "bad", ["cool", "case"], cool.h <= cs.cool ? `Tản cao ${cool.h} mm, case cho tối đa ${cs.cool} mm.` : `Tản cao ${cool.h} mm, case chỉ cho ${cs.cool} mm.`);
      }
      if (cpu && cool.tdp < cpu.w) add("R5", "warn", ["cool", "cpu"], `CPU tối đa ~${cpu.w} W, tản chỉ ~${cool.tdp} W: có thể giảm xung khi tải nặng.`);
    }
    if (psu && (cpu || vga)) {
      const L = load(c), need = Math.round(L * 1.3);
      if (psu.w < L) add("R6", "bad", ["psu"], `Nguồn ${fmtW(psu.w)} không đủ cho tải ~${fmtW(L)}.`);
      else if (psu.w < need) add("R6", "warn", ["psu"], `Nguồn ${fmtW(psu.w)} chạy được nhưng dư tải dưới 30% (nên ≥ ${fmtW(need)}).`);
      else add("R6", "ok", ["psu"], `Tải ước tính ${fmtW(L)}; nguồn ${fmtW(psu.w)} còn dư.`);
      if (vga) { const okc = (vga.p16 && psu.p16) || psu.pin8 >= vga.pin8; add("R6", okc ? "ok" : "bad", ["psu", "vga"], okc ? `Nguồn có đủ đầu cắm cho VGA.` : `VGA cần ${vga.pin8} đầu 8-pin${vga.p16 ? " hoặc 12V-2x6" : ""}, nguồn chỉ có ${psu.pin8}.`); }
    }
    if (main) {
      const m2 = drives(c, "M.2"), sata = drives(c, "2.5");
      if (m2) add("R7", m2 <= main.m2 ? "ok" : "bad", ["ssd", "main"], m2 <= main.m2 ? `Dùng ${m2}/${main.m2} khe M.2.` : `Cần ${m2} khe M.2, mainboard chỉ có ${main.m2}.`);
      if (sata) add("R7", sata <= main.sata ? "ok" : "bad", ["ssd", "main"], sata <= main.sata ? `Dùng ${sata}/${main.sata} cổng SATA.` : `Hết cổng SATA.`);
    }
    c.extras.forEach((e) => {
      const x = byId(e.id);
      if (x.need === "x1" && main) add("R8", main.x1 >= 1 ? "ok" : "bad", ["extras"], main.x1 >= 1 ? `Còn khe PCIe x1 cho ${x.n}.` : `Mainboard không có khe PCIe x1 trống.`);
      if (x.need === "fan3" && cs) add("R8", cs.fans - cs.pre >= 3 ? "ok" : "bad", ["extras"], cs.fans - cs.pre >= 3 ? `Case còn ${cs.fans - cs.pre} vị trí quạt.` : `Case chỉ còn ${cs.fans - cs.pre} vị trí quạt.`);
      if (x.cat === "ram" && main && sticks(c) <= main.slots) add("R8", "ok", ["extras"], `Còn khe RAM: dùng ${sticks(c)}/${main.slots}.`);
    });
    return out;
  }
  const worst = (rs) => (rs.some((x) => x.lv === "bad") ? "bad" : rs.some((x) => x.lv === "warn") ? "warn" : "ok");

  // Kiểm tra một ứng viên cho một ô: chỉ xét các luật liên quan tới ô đó
  function tryPart(c, slot, id) {
    const t = clone(c); t[slot] = { mode: t[slot].mode === "own" ? "own" : "buy", id, qty: t[slot].qty || 1 };
    const rs = evalRules(t).filter((x) => x.slots.includes(slot));
    return { bad: rs.filter((x) => x.lv === "bad"), warn: rs.filter((x) => x.lv === "warn") };
  }
  // Điều kiện lọc đang áp dụng cho một ô (để khách hiểu vì sao danh sách ngắn lại)
  function filterNotes(c, slot) {
    const main = part(c, "main"), cpu = part(c, "cpu"), vga = part(c, "vga"), cs = part(c, "case"), cool = part(c, "cool"), notes = [];
    if (slot === "main") { if (cpu) notes.push(`Socket ${cpu.socket} (theo CPU)`); if (part(c, "ram")) notes.push(`Nhận ${part(c, "ram").type}`); if (cs) notes.push(`Kích thước ${cs.ff.join("/")} (theo case)`); }
    if (slot === "cpu" && main) notes.push(`Socket ${main.socket} (theo mainboard)`);
    if (slot === "ram" && main) notes.push(`${main.ram}, tối đa ${main.slots} thanh / ${main.maxRam}GB`);
    if (slot === "vga" && cs) notes.push(`Dài ≤ ${cs.gpu} mm (theo case)`);
    if (slot === "ssd" && main) notes.push(`${main.m2} khe M.2, ${main.sata} cổng SATA`);
    if (slot === "cool") { if (cpu) notes.push(`Ngàm ${cpu.socket}`); if (cs) notes.push(`Cao ≤ ${cs.cool} mm, radiator ≤ ${cs.rad} mm`); }
    if (slot === "case") { if (main) notes.push(`Nhận board ${main.ff}`); if (vga) notes.push(`VGA dài ${vga.len} mm`); if (cool) notes.push(cool.rad ? `Radiator ${cool.rad} mm` : `Tản cao ${cool.h} mm`); }
    if (slot === "psu") { notes.push(`Tải ~${load(c)} W`); if (vga) notes.push(`${vga.pin8} đầu 8-pin cho VGA`); }
    return notes;
  }
  // Linh kiện bắt buộc bị bỏ trống (v3 bảng cảnh báo khi bỏ trống)
  function missing(c, wantAsm) {
    const cpu = part(c, "cpu"), out = [];
    const isSkip = (s) => !part(c, s);
    if (isSkip("main")) out.push({ s: "main", req: true, m: "Không có mainboard thì không lọc tương thích được." });
    if (isSkip("cpu")) out.push({ s: "cpu", req: true, m: "Máy không khởi động được." });
    if (isSkip("ram")) out.push({ s: "ram", req: true, m: "Máy không qua được bước POST, không lên hình." });
    if (isSkip("ssd")) out.push({ s: "ssd", req: true, m: "Không cài được hệ điều hành." });
    if (isSkip("psu")) out.push({ s: "psu", req: true, m: "Không có điện cho hệ thống." });
    if (isSkip("vga")) out.push(cpu && cpu.igpu ? { s: "vga", req: false, m: "Dùng GPU tích hợp: hiệu năng game và đồ họa thấp." } : { s: "vga", req: true, m: "CPU không có GPU tích hợp: không xuất được hình." });
    if (isSkip("cool")) out.push(cpu && cpu.box ? { s: "cool", req: false, m: "Dùng tản kèm hộp của CPU." } : { s: "cool", req: true, m: "CPU không kèm tản: quá nhiệt, tự tắt hoặc giảm xung." });
    if (isSkip("case")) out.push({ s: "case", req: !!wantAsm, m: wantAsm ? "Không lắp ráp được." : "Linh kiện không được bảo vệ." });
    return out;
  }
  const canAssemble = (c) => missing(c, true).filter((x) => x.req).length === 0;
  const hasOwn = (c) => ORDER.some((s) => c[s].mode === "own");
  const cfgPrice = (c) => ORDER.reduce((t, s) => t + (c[s].mode === "buy" && c[s].id ? byId(c[s].id).price * (c[s].qty || 1) : 0), 0) + c.extras.reduce((t, e) => t + byId(e.id).price * e.qty, 0);
  const cfgCost = (c) => ORDER.reduce((t, s) => t + (c[s].mode === "buy" && c[s].id ? byId(c[s].id).cost * (c[s].qty || 1) : 0), 0) + c.extras.reduce((t, e) => t + byId(e.id).cost * e.qty, 0);
  const cfgNeeds = (c) => { const m = {}; ORDER.forEach((s) => { if (c[s].mode === "buy" && c[s].id) m[c[s].id] = (m[c[s].id] || 0) + (c[s].qty || 1); }); c.extras.forEach((e) => (m[e.id] = (m[e.id] || 0) + e.qty)); return m; };

  // ===================== KHO THEO SERIAL =====================
  const units = [];
  let snSeq = 1000;
  function receive(id, qty, inDate, po) { for (let i = 0; i < qty; i++) units.push({ sn: `${id}-${++snSeq}`, id, inDate: inDate || TODAY, state: "stock", order: null, po: po || null }); }
  P.filter((p) => !p.ref).forEach((p) => receive(p.id, p.stock, new Date(2027, 3, 1 + (p.id.charCodeAt(1) % 10))));
  // vài lô tồn lâu để minh họa cảnh báo > 60 ngày
  units.filter((u) => ["R04", "K03", "T03"].includes(u.id)).forEach((u) => (u.inDate = new Date(2027, 0, 20)));
  const onHand = (id) => units.filter((u) => u.id === id && u.state !== "out").length;
  const held = (id) => units.filter((u) => u.id === id && u.state === "held").length;
  const avail = (id) => units.filter((u) => u.id === id && u.state === "stock").length;

  // ===================== DỮ LIỆU VẬN HÀNH =====================
  const S = {
    user: null,
    guestPhone: "",
    staff: { name: "Nguyễn Thái Bảo", role: "Quản lý" },
    cart: [],
    coupon: null,
    saved: [],
    build: emptyCfg(),
    buildSrc: null,
    buildAsm: "shop",
    need: { budget: 25000000, purpose: "game", apps: ["Valorant", "Black Myth: Wukong"], res: "1080", color: "Không quan trọng" },
    upgrade: { cfg: null, goal: "vga" },
    checkout: null,
    lastOrder: null,
    orders: [],
    pos: { cust: null, lines: [], disc: 0, approved: false, pay: "Tiền mặt", asm: false },
    leads: [
      { id: "L-1031", name: "Trịnh Văn Khoa", phone: "0905 112 233", src: "Zalo OA", need: "Gaming 25 triệu, case trắng", st: "Mới", note: "", ago: "12 phút" },
      { id: "L-1030", name: "Ngô Thị Hà", phone: "0912 448 120", src: "Website – form tư vấn", need: "Đồ họa, 35–40 triệu", st: "Đang tư vấn", note: "Dùng Premiere, After Effects", ago: "1 giờ" },
      { id: "L-1028", name: "Phan Đức Mạnh", phone: "0988 330 771", src: "Facebook", need: "Valorant 240Hz, 20 triệu", st: "Đã gửi báo giá", note: "", ago: "3 giờ", quote: "Q-2207" },
      { id: "L-1025", name: "Lý Minh Tuấn", phone: "0936 552 019", src: "Livestream", need: "Nâng cấp VGA cho máy cũ", st: "Đã chốt", note: "", ago: "Hôm qua" },
      { id: "L-1021", name: "Đặng Hải Yến", phone: "0977 214 556", src: "Website – form tư vấn", need: "PC học lập trình, 15 triệu", st: "Mất", note: "Chọn mua laptop", ago: "2 ngày" },
    ],
    quotes: [],
    suppliers: [
      { id: "NPP01", name: "Nhà phân phối A (Hà Nội)", grp: "CPU, VGA, mainboard", disc: "5–8%", debt: "Thanh toán ngay", lead: "Trong ngày", rma: "1 đổi 1 trong 7 ngày", active: true },
      { id: "NPP02", name: "Nhà phân phối B (Hà Nội)", grp: "RAM, SSD", disc: "7–8%", debt: "Đàm phán 7 ngày", lead: "1 ngày", rma: "1 đổi 1 trong 30 ngày", active: true },
      { id: "NPP03", name: "Nhà phân phối C (Hà Nội)", grp: "Nguồn, case, tản nhiệt, phụ kiện", disc: "12–15%", debt: "15 ngày", lead: "1–2 ngày", rma: "Bảo hành tại hãng", active: true },
      { id: "NPP04", name: "Nguồn dự phòng D (TP.HCM)", grp: "VGA cao cấp", disc: "4–6%", debt: "Không", lead: "2–3 ngày", rma: "1 đổi 1 trong 7 ngày", active: false },
    ],
    pos_: [],
    requests: [],
    rma: [],
    coupons: [
      { code: "MOBAN", desc: "Giảm 2% đơn PC mùa khai trương", type: "pct", val: 2, scope: "pc", from: new Date(2027, 3, 1), to: new Date(2027, 5, 30), min: 0, max: 500, used: 41 },
      { code: "HSSV", desc: "Giảm 300.000đ cho học sinh, sinh viên", type: "amt", val: 300000, scope: "all", from: new Date(2027, 3, 1), to: new Date(2027, 11, 31), min: 15000000, max: 300, used: 9 },
      { code: "TUAN200", desc: "Mã giới thiệu: người mua giảm 100.000đ", type: "amt", val: 100000, scope: "pc", from: new Date(2027, 3, 1), to: new Date(2028, 2, 31), min: 0, max: 50, used: 1 },
    ],
    banners: [
      { id: "B1", title: "Build PC theo ngân sách – tư vấn miễn phí", place: "Trang chủ", sponsor: "", on: true, views: 4210, clicks: 188 },
      { id: "B2", title: "Tản nhiệt Cooler Master – giới thiệu sản phẩm", place: "Trang Build PC", sponsor: "Nhà phân phối C (hỗ trợ hiện vật)", on: true, views: 1530, clicks: 41 },
    ],
    referral: { giver: 200000, receiver: 100000, bonusFrom: 3, list: [{ code: "TUAN200", owner: "Lý Minh Tuấn", invited: 1, paid: 200000 }] },
    staffUsers: [
      { name: "Nguyễn Thái Bảo", email: "bao@buildx.vn", role: "Quản lý", on: true },
      { name: "Trần Đức Huy", email: "huy.tran@buildx.vn", role: "Kỹ thuật viên", on: true },
      { name: "Lê Phương Thảo", email: "thao.le@buildx.vn", role: "Nhân viên tư vấn", on: true },
      { name: "Phạm Quốc Việt", email: "viet.pham@buildx.vn", role: "Nhân viên bán hàng", on: true },
      { name: "Vũ Hồng Nhung", email: "nhung.vu@buildx.vn", role: "Quản trị viên", on: true },
    ],
    bookings: [],
    warranties: [],
    log: [],
    products: P,
  };
  const log = (action, target) => S.log.unshift({ t: new Date(), who: S.staff.name, action, target });

  // ===================== ĐƠN HÀNG =====================
  let orderSeq = 140;
  const lineNeeds = (lines) => { const m = {}; lines.forEach((l) => { if (l.type === "pc") Object.entries(cfgNeeds(l.cfg)).forEach(([k, v]) => (m[k] = (m[k] || 0) + v)); if (l.type === "part") m[l.id] = (m[l.id] || 0) + l.qty; }); return m; };
  const linePrice = (l) => (l.type === "pc" ? cfgPrice(l.cfg) + (l.asm === "shop" ? (hasOwn(l.cfg) ? FEES.asmOwn : FEES.asm) : l.asm === "home" ? FEES.asmOwn + FEES.homeIn : 0) : l.type === "part" ? byId(l.id).price * l.qty : l.price);
  const asmFee = (l) => (l.type === "pc" && l.asm !== "none" ? (l.asm === "home" ? FEES.asmOwn + FEES.homeIn : hasOwn(l.cfg) ? FEES.asmOwn : FEES.asm) : 0);
  const preorderItems = (lines) => Object.entries(lineNeeds(lines)).filter(([id, q]) => avail(id) < q).map(([id, q]) => ({ id, q, short: q - avail(id), grp: byId(id).grp }));
  function couponCheck(code, lines, phone) {
    const cp = S.coupons.find((x) => x.code === (code || "").trim().toUpperCase());
    if (!cp) return { ok: false, m: "Mã không tồn tại." };
    if (TODAY < cp.from || TODAY > cp.to) return { ok: false, m: "Mã ngoài thời gian áp dụng." };
    if (cp.used >= cp.max) return { ok: false, m: "Mã đã hết lượt dùng." };
    const base = lines.reduce((t, l) => t + (cp.scope === "pc" ? (l.type === "pc" ? cfgPrice(l.cfg) : 0) : linePrice(l)), 0);
    const all = lines.reduce((t, l) => t + linePrice(l), 0);
    if (all < cp.min) return { ok: false, m: `Đơn tối thiểu ${cp.min.toLocaleString("vi-VN")}đ.` };
    if (!base) return { ok: false, m: "Mã chỉ áp dụng cho đơn có PC." };
    const amt = cp.type === "pct" ? Math.round((base * cp.val) / 100 / 1000) * 1000 : Math.min(cp.val, base);
    return { ok: true, cp, amt, m: `${cp.desc}: −${amt.toLocaleString("vi-VN")}đ` };
  }
  function riskScore(o) {
    const r = [];
    if (o.total > 30000000) r.push(["Giá trị đơn trên 30 triệu", 30]);
    const prior = S.orders.filter((x) => x.cust.phone === o.cust.phone && x.id !== o.id);
    if (o.pay.method === "COD" && !prior.some((x) => x.status === "Hoàn tất")) r.push(["COD lần đầu", 25]);
    if (o.cust.addr && S.orders.some((x) => x.id !== o.id && x.cust.phone !== o.cust.phone && x.cust.addr === o.cust.addr)) r.push(["Địa chỉ trùng đơn của SĐT khác", 20]);
    if (prior.filter((x) => TODAY - x.date < 864e5).length >= 2) r.push(["Nhiều đơn trong 24 giờ", 25]);
    const score = r.reduce((t, x) => t + x[1], 0);
    return { score, reasons: r.map((x) => x[0]), needVerify: score >= 50, verified: false };
  }
  function createOrder({ cust, lines, ship, coupon, payMethod, channel, date, tierDisc, vatInvoice }) {
    const sub = lines.reduce((t, l) => t + linePrice(l), 0);
    const disc = coupon ? coupon.amt : 0;
    const tDisc = tierDisc || (cust && cust.tierDisc) || 0;
    const shipFee = 0;
    const total = Math.max(0, sub - disc - tDisc + shipFee);
    const pre = channel === "Tại quầy" ? [] : preorderItems(lines);
    const isDebt = payMethod === "Công nợ B2B";
    const needDeposit = isDebt ? false : pre.some((x) => x.grp === "C");
    const o = {
      id: `BX-${String(++orderSeq).padStart(4, "0")}`, date: date || TODAY, channel: channel || "Website", cust, lines, ship: ship || { mode: "in" }, coupon: coupon ? coupon.cp.code : null, disc, tierDisc: tDisc, sub, total,
      pay: { method: payMethod, status: isDebt ? "Công nợ B2B (đối soát 15–30 ngày)" : payMethod === "COD" ? "COD – chưa thu" : "Chưa thanh toán", paid: 0, due: needDeposit && payMethod !== "COD" ? Math.round((total * FEES.depositRate) / 1000) * 1000 : total },
      preorder: pre, needDeposit, status: "Mới", short: [], tech: "", qc: null, waybill: "", asm: lines.some((l) => l.type === "pc" && l.asm !== "none"), log: [], stockOut: false, review: null,
      priority: (cust && cust.tier === "vip") || false,
      vatInvoice: vatInvoice || (cust && cust.company ? cust.company : null),
    };
    o.risk = riskScore(o);
    if (coupon) coupon.cp.used++;
    o.log.push({ t: o.date, who: channel === "Tại quầy" ? S.staff.name : "Hệ thống", msg: `Tạo đơn (${o.channel})${cust && cust.tier === "vip" ? " · [Đặc quyền VIP]" : cust && cust.tier === "b2b" ? " · [Doanh nghiệp B2B]" : ""}` });
    S.orders.unshift(o);
    return o;
  }
  const findOrder = (id) => S.orders.find((o) => o.id === id);
  const olog = (o, msg, who) => { o.log.push({ t: new Date(), who: who || S.staff.name, msg }); log(msg, o.id); };
  function gatewayPaid(o, amount) { o.pay.paid += amount; o.pay.status = o.pay.paid >= o.total ? "Đã thanh toán" : "Đã cọc"; o.log.push({ t: new Date(), who: "Cổng thanh toán", msg: `IPN hợp lệ: nhận ${amount.toLocaleString("vi-VN")}đ (${o.pay.method})` }); }
  function holdFor(o) {
    const need = lineNeeds(o.lines), short = [];
    Object.entries(need).forEach(([id, q]) => {
      const have = units.filter((u) => u.order === o.id && u.id === id).length;
      let left = q - have;
      units.filter((u) => u.id === id && u.state === "stock").slice(0, left).forEach((u) => { u.state = "held"; u.order = o.id; left--; });
      if (left > 0) short.push({ id, q: left });
    });
    o.short = short;
    return short;
  }
  function confirmOrder(o) {
    if (o.status !== "Mới") return "Đơn không ở trạng thái Mới.";
    if (o.risk.needVerify && !o.risk.verified) return "Đơn rủi ro cần xác minh (OTP hoặc gọi điện) trước khi xác nhận.";
    if (o.pay.method !== "COD" && o.pay.status === "Chưa thanh toán") return "Chưa nhận thanh toán hoặc tiền cọc.";
    const short = holdFor(o);
    o.status = short.length ? "Chờ hàng" : "Đã xác nhận";
    olog(o, short.length ? `Xác nhận đơn, giữ hàng có sẵn; thiếu ${short.map((s) => s.id + "×" + s.q).join(", ")} → Chờ hàng` : "Xác nhận đơn, giữ đủ hàng");
    return null;
  }
  function recheck(o) { const short = holdFor(o); if (!short.length && o.status === "Chờ hàng") { o.status = "Đã xác nhận"; olog(o, "Đã đủ hàng sau khi nhập kho"); } return short; }
  function toNext(o) {
    if (o.status !== "Đã xác nhận") return;
    o.status = o.asm ? "Lắp ráp & QC" : "Đóng gói";
    olog(o, o.asm ? "Chuyển xưởng lắp ráp" : "Chuyển đóng gói (không lắp ráp)");
  }
  function qcResult(o, res) {
    o.qc = res;
    if (res.pass) { o.status = "Đóng gói"; olog(o, `QC đạt: CPU ${res.cpu}°C, GPU ${res.gpu}°C, ${res.ram} lỗi RAM`, o.tech || S.staff.name); }
    else { olog(o, `QC không đạt → mở RMA`, o.tech || S.staff.name); S.rma.unshift({ id: "RMA-" + (300 + S.rma.length), sn: (units.find((u) => u.order === o.id) || {}).sn || "", order: o.id, symptom: res.note || "Không đạt ngưỡng QC", diag: "", action: "Khoanh vùng linh kiện lỗi, đổi với NPP", st: "Đang xử lý", hist: [] }); }
  }
  function ship(o, waybill) {
    if (o.status !== "Đóng gói") return "Đơn chưa ở bước Đóng gói.";
    units.filter((u) => u.order === o.id && u.state === "held").forEach((u) => (u.state = "out"));
    o.stockOut = true; o.waybill = waybill; o.status = "Đang giao / Chờ nhận";
    olog(o, `Xuất kho (ghi một lần) và bàn giao: ${waybill}`);
    return null;
  }
  function complete(o) {
    if (o.status !== "Đang giao / Chờ nhận") return "Đơn chưa giao.";
    if (o.pay.method === "COD" && o.pay.paid < o.total) { o.pay.paid = o.total; o.pay.status = "Đã thanh toán"; o.log.push({ t: new Date(), who: S.staff.name, msg: "Đã thu COD đủ" }); }
    if (o.pay.paid < o.total) { o.pay.paid = o.total; o.pay.status = "Đã thanh toán"; }
    o.status = "Hoàn tất";
    units.filter((u) => u.order === o.id).forEach((u) => S.warranties.push({ sn: u.sn, id: u.id, order: o.id, phone: o.cust.phone, from: TODAY, months: 36 }));
    olog(o, "Hoàn tất – kích hoạt bảo hành theo serial");
    return null;
  }
  function cancel(o, who) {
    if (["Đang giao / Chờ nhận", "Hoàn tất", "Đã hủy"].includes(o.status)) return "Chỉ hủy được trước khi xuất kho.";
    units.filter((u) => u.order === o.id && u.state === "held").forEach((u) => { u.state = "stock"; u.order = null; });
    o.status = "Đã hủy";
    olog(o, `Hủy đơn, giải phóng hàng đã giữ${o.pay.paid ? `; hoàn ${o.pay.paid.toLocaleString("vi-VN")}đ theo chính sách` : ""}`, who);
    return null;
  }

  // ===================== ĐƠN NHẬP =====================
  const POS = [];
  let poSeq = 230;
  const supplierFor = (id) => { const c = byId(id).cat; return ["cpu", "vga", "main"].includes(c) ? "NPP01" : ["ram", "ssd"].includes(c) ? "NPP02" : "NPP03"; };
  function poSuggestions() {
    const out = [];
    S.orders.filter((o) => o.status === "Chờ hàng").forEach((o) => o.short.forEach((s) => {
      const inPo = POS.filter((p) => p.forOrder === o.id && p.status !== "Đã nhận").some((p) => p.items.some((i) => i.id === s.id));
      if (!inPo) out.push({ order: o.id, id: s.id, q: s.q, sup: supplierFor(s.id) });
    }));
    return out;
  }
  function createPO(items, sup, forOrder) { const p = { id: "PO-" + ++poSeq, sup, items, forOrder: forOrder || "Bổ sung tồn kho", status: "Chờ duyệt", eta: "", created: TODAY }; POS.unshift(p); log("Tạo đơn nhập", p.id); return p; }
  function receivePO(p) {
    p.items.forEach((i) => receive(i.id, i.q, TODAY, p.id));
    p.status = "Đã nhận"; log("Nhận hàng theo đơn nhập", p.id);
    S.orders.filter((o) => o.status === "Chờ hàng").forEach(recheck);
  }

  // ===================== DỮ LIỆU MẪU =====================
  function seed() {
    const mk = (opts, steps) => {
      const o = createOrder(opts);
      if (steps.paid) gatewayPaid(o, steps.paid === "full" ? o.total : o.pay.due);
      if (steps.verify) o.risk.verified = true;
      if (steps.to >= 1) confirmOrder(o);
      if (steps.to >= 2 && o.status === "Đã xác nhận") toNext(o);
      if (steps.tech) o.tech = steps.tech;
      if (steps.to >= 3 && o.status === "Lắp ráp & QC") qcResult(o, { pass: true, cpu: 71, gpu: 68, ram: 0, cb: 12180, min: 190, photos: 4 });
      if (steps.to >= 4) ship(o, steps.wb || "AHM-77310");
      if (steps.to >= 5) complete(o);
      return o;
    };
    const pc = (key, asm) => ({ type: "pc", title: COMBOS.find((c) => c.key === key).name, src: "combo", cfg: cfgFromCombo(key), asm: asm || "shop" });
    mk({ cust: { name: "Bùi Tiến Dũng", phone: "0934 781 556", addr: "12 Trần Thái Tông, Cầu Giấy" }, lines: [pc("gamer")], payMethod: "VNPAY", date: new Date(2027, 3, 3) }, { paid: "full", to: 5, wb: "AHM-70112" });
    mk({ cust: { name: "Vũ Khánh Linh", phone: "0977 120 334", addr: "45 Lê Lai, TP. Thanh Hóa" }, lines: [{ type: "part", id: "R01", qty: 1 }], payMethod: "MoMo", ship: { mode: "out" }, date: new Date(2027, 3, 14) }, { paid: "full", to: 4, wb: "GHN 5KX9-22Q" });
    mk({ cust: { name: "Phạm Thu Trang", phone: "0903 556 120", addr: "8 Nguyễn Khánh Toàn, Cầu Giấy" }, lines: [pc("esports")], payMethod: "Thẻ", date: new Date(2027, 3, 15) }, { paid: "full", to: 2, tech: "Trần Đức Huy" });
    mk({ cust: { name: "Lê Quang Thắng", phone: "0987 222 019", addr: "22 Lạch Tray, Hải Phòng" }, lines: [pc("creator")], payMethod: "VNPAY", ship: { mode: "out" }, date: new Date(2027, 3, 15) }, { paid: "deposit", verify: true, to: 1 });
    mk({ cust: { name: "Đỗ Hoàng Nam", phone: "0868 441 902", addr: "99 Xuân Thủy, Cầu Giấy" }, lines: [pc("gamer"), { type: "part", id: "D01", qty: 1 }, { type: "part", id: "KB1", qty: 1 }], payMethod: "COD", date: new Date(2027, 3, 16, 9) }, { to: 0 });
    mk({ cust: { name: "Hoàng Bảo Ngọc", phone: "0915 909 221", addr: "3 Duy Tân, Cầu Giấy" }, lines: [pc("esports", "none"), { type: "part", id: "D01", qty: 1 }], payMethod: "MoMo", ship: { mode: "pickup" }, date: new Date(2027, 3, 16, 8) }, { paid: "full", to: 1 });
    // khách demo đăng nhập có một đơn đã giao để xem phiếu bảo hành
    mk({ cust: { name: "Nguyễn Minh Anh", phone: "0912 345 678", addr: "18 Hoàng Quốc Việt, Cầu Giấy", tier: "vip" }, lines: [pc("gamer")], payMethod: "VNPAY", date: new Date(2027, 3, 5) }, { paid: "full", to: 5, wb: "AHM-70140" });
    mk({ cust: { name: "Công ty CP Công Nghệ NextGen", phone: "0988 999 888", addr: "Tầng 8, Keangnam Landmark 72, Nam Từ Liêm", tier: "b2b", company: { name: "Công ty Cổ phần Công Nghệ NextGen Việt Nam", taxId: "0109876543", addr: "Tầng 8, Keangnam Landmark 72, Mễ Trì, Nam Từ Liêm" } }, lines: [pc("creator"), pc("creator")], payMethod: "Công nợ B2B", date: new Date(2027, 3, 12) }, { to: 1 });
    const po = createPO([{ id: "C02", q: 1 }, { id: "G03", q: 1 }], "NPP01", S.orders.find((o) => o.cust.name === "Lê Quang Thắng").id); po.status = "NPP xác nhận"; po.eta = "17/04/2027";
    S.requests.push(
      { id: "YC-501", type: "Đặt lịch", src: "Website", cust: "Trần Minh Khôi", phone: "0904 220 118", what: "Vệ sinh – thay keo tại nhà (nội thành)", when: "18/04 09:00–11:00", tech: "", st: "Mới", code: "DV-8812" },
      { id: "YC-500", type: "Bảo hành", src: "Zalo (nhân viên nhập)", cust: "Bùi Tiến Dũng", phone: "0934 781 556", what: "Máy tự tắt khi chơi game nặng", when: "", tech: "Trần Đức Huy", st: "Đang xử lý", code: "BH-3305" },
      { id: "YC-498", type: "Tư vấn", src: "Facebook (nhân viên nhập)", cust: "Mai Thu Hà", phone: "0913 556 009", what: "Hỏi nâng cấp RAM cho máy cũ", when: "", tech: "", st: "Hoàn tất", code: "TV-1120" },
    );
    const dSn = units.find((u) => u.order === S.orders.find((o) => o.cust.name === "Bùi Tiến Dũng").id && u.id === "P01");
    S.rma.push({ id: "RMA-301", sn: dSn ? dSn.sn : "P01-1001", order: S.orders.find((o) => o.cust.name === "Bùi Tiến Dũng").id, symptom: "Tự tắt khi chơi game nặng", diag: "Nguồn sụt áp ở tải 400 W (thử bằng nguồn dự phòng)", action: "Đổi nguồn với Nhà phân phối C, cho khách mượn nguồn dự phòng", st: "Chờ NPP", hist: ["16/04: tiếp nhận từ Zalo", "16/04: chẩn đoán nguồn", "16/04: gửi NPP C"] });
    S.saved.push({ code: "CFG-7Q2K", title: "BX Gamer – case trắng", cfg: (() => { const c = cfgFromCombo("gamer"); c.case = { mode: "buy", id: "K04", qty: 1 }; return c; })(), date: "10/04/2027" });
    S.log.length = 0;
    log("Đổi giá bán G02: 11.120.000đ → 11.220.000đ", "G02");
    log("Điều chỉnh kho R01: −1 (hàng trưng bày)", "R01");
  }
  seed();

  return { S, P, byId, units, POS, TODAY, days, dstr, tstr, emptyCfg, cfgFromCombo, clone, part, evalRules, worst, tryPart, filterNotes, missing, canAssemble, hasOwn, cfgPrice, cfgCost, cfgNeeds, RULES, onHand, held, avail, receive, lineNeeds, linePrice, asmFee, preorderItems, couponCheck, riskScore, createOrder, findOrder, olog, gatewayPaid, holdFor, confirmOrder, recheck, toNext, qcResult, ship, complete, cancel, poSuggestions, createPO, receivePO, supplierFor, log, sticks, load, STATUSES };
})();
