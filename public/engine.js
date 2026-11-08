// BuildX PC – engine nghiệp vụ dùng chung cho trình duyệt và máy chủ:
// luật tương thích (v3 mục 14.3), tồn kho theo serial, đơn hàng theo bảng trạng thái (v3 mục 14.6).
//
// Máy chủ (server/) là nơi quyết định: mọi thao tác ghi (đặt hàng, giữ hàng, chuyển trạng thái,
// nhập/xuất kho…) chạy hàm của engine này trên dữ liệu đọc từ PostgreSQL rồi ghi lại.
// Trình duyệt dùng cùng engine để hiển thị (lọc tương thích, tính giá tạm) trên bản sao dữ liệu
// nhận từ /api/state; trình duyệt không tự đổi trạng thái đơn hay tồn kho.
(function (root, factory) {
  const lib = factory();
  if (typeof module === "object" && module.exports) module.exports = lib;
  else root.BXE = lib.create(root.BX, lib.emptyState(), { client: true });
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Dữ liệu vận hành (lưu trong CSDL). Trình duyệt giữ một bản sao theo quyền của người xem.
  // Cấu hình luật tương thích mặc định. Quản lý chỉnh ở màn SC35; máy chủ lưu trong CSDL (app_meta.rules).
  // level: "block" = như thiết kế (chặn cứng / cảnh báo theo bảng), "warn" = mọi lỗi của luật chỉ còn cảnh báo, "off" = tắt luật.
  const DEFAULT_RULE_CFG = {
    levels: { R1: "block", R2: "block", R3: "block", R4: "block", R5: "block", R6: "block", R7: "block", R8: "block" },
    params: { psuReserve: 30, baseLoad: 75, ramBusWarn: true, coolTdpWarn: true, caseGpuMargin: 0 },
  };
  const PARAM_LIMITS = { psuReserve: [0, 100], baseLoad: [0, 300], caseGpuMargin: [0, 50] };
  function normRuleCfg(x) {
    const out = JSON.parse(JSON.stringify(DEFAULT_RULE_CFG));
    if (!x || typeof x !== "object") return out;
    Object.keys(out.levels).forEach((k) => { if (x.levels && ["block", "warn", "off"].includes(x.levels[k])) out.levels[k] = x.levels[k]; });
    Object.keys(PARAM_LIMITS).forEach((k) => { const v = Number(x.params && x.params[k]); if (Number.isFinite(v) && v >= PARAM_LIMITS[k][0] && v <= PARAM_LIMITS[k][1]) out.params[k] = Math.round(v); });
    ["ramBusWarn", "coolTdpWarn"].forEach((k) => { if (x.params && typeof x.params[k] === "boolean") out.params[k] = x.params[k]; });
    return out;
  }

  function emptyState() {
    return {
      ruleCfg: JSON.parse(JSON.stringify(DEFAULT_RULE_CFG)),
      orders: [], units: [], pos: [], requests: [], rma: [], warranties: [], coupons: [], log: [], staffUsers: [],
      availMap: null, // khách hàng không thấy serial, chỉ nhận số lượng khả dụng theo mã
      seq: { order: 140, po: 230, sn: 1000, rma: 300, req: 500, dv: 8811, bh: 3304, tv: 1119, wb: 77300 },
    };
  }

  function create(BX, st, ctx) {
    ctx = ctx || {};
    const { P, ORDER, COMBOS, FEES, STATUSES } = BX;
    const now = ctx.now || (() => new Date());
    const actor = ctx.actor || (() => "Hệ thống");
    const byId = (id) => P.find((p) => p.id === id);
    const days = (d) => Math.floor((now() - new Date(d)) / 864e5);
    const dstr = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
    const tstr = (d) => new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

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
    const RC = () => (st.ruleCfg = st.ruleCfg && st.ruleCfg.levels ? st.ruleCfg : normRuleCfg(st.ruleCfg));
    const load = (c) => { const cpu = part(c, "cpu"), vga = part(c, "vga"); return (cpu ? cpu.w : 0) + (vga ? vga.w : 0) + RC().params.baseLoad; };

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
      const cfg = RC(), out = [];
      rawRules(c, cfg.params).forEach((x) => {
        const lv = cfg.levels[x.r] || "block";
        if (lv === "off") return;
        out.push(lv === "warn" && x.lv === "bad" ? Object.assign({}, x, { lv: "warn", m: x.m + " (quản lý đặt luật này ở mức chỉ cảnh báo)" }) : x);
      });
      return out;
    }
    function rawRules(c, prm) {
      const out = [], main = part(c, "main"), cpu = part(c, "cpu"), ram = part(c, "ram"), vga = part(c, "vga"), cool = part(c, "cool"), cs = part(c, "case"), psu = part(c, "psu");
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
        if (fast && !wrong && prm.ramBusWarn) add("R2", "warn", ["ram", "main"], `RAM bus ${fast.bus} sẽ chạy ở ${main.bus} MHz trên mainboard này.`);
      }
      if (main && cs) add("R3", cs.ff.includes(main.ff) ? "ok" : "bad", ["main", "case"], cs.ff.includes(main.ff) ? `Case nhận mainboard ${main.ff}.` : `Case chỉ nhận ${cs.ff.join("/")}, mainboard là ${main.ff}.`);
      if (vga && cs) { const lim = cs.gpu - prm.caseGpuMargin; add("R4", vga.len <= lim ? "ok" : "bad", ["vga", "case"], vga.len <= lim ? `VGA dài ${vga.len} mm, case cho tối đa ${cs.gpu} mm${prm.caseGpuMargin ? ` (chừa ${prm.caseGpuMargin} mm đi dây)` : ""}.` : `VGA dài ${vga.len} mm vượt giới hạn ${lim} mm của case${prm.caseGpuMargin ? ` (${cs.gpu} mm trừ ${prm.caseGpuMargin} mm đi dây)` : ""}.`); }
      if (cool) {
        if (cpu) add("R5", cool.sockets.includes(cpu.socket) ? "ok" : "bad", ["cool", "cpu"], cool.sockets.includes(cpu.socket) ? `Tản hỗ trợ socket ${cpu.socket}.` : `Tản không có ngàm cho socket ${cpu.socket}.`);
        if (cs) {
          if (cool.rad) add("R5", cool.rad <= cs.rad ? "ok" : "bad", ["cool", "case"], cool.rad <= cs.rad ? `Case lắp được radiator ${cool.rad} mm.` : `Case không có chỗ cho radiator ${cool.rad} mm (tối đa ${cs.rad || 0} mm).`);
          else add("R5", cool.h <= cs.cool ? "ok" : "bad", ["cool", "case"], cool.h <= cs.cool ? `Tản cao ${cool.h} mm, case cho tối đa ${cs.cool} mm.` : `Tản cao ${cool.h} mm, case chỉ cho ${cs.cool} mm.`);
        }
        if (cpu && cool.tdp < cpu.w && prm.coolTdpWarn) add("R5", "warn", ["cool", "cpu"], `CPU tối đa ~${cpu.w} W, tản chỉ ~${cool.tdp} W: có thể giảm xung khi tải nặng.`);
      }
      if (psu && (cpu || vga)) {
        const L = load(c), need = Math.round(L * (1 + prm.psuReserve / 100));
        if (psu.w < L) add("R6", "bad", ["psu"], `Nguồn ${fmtW(psu.w)} không đủ cho tải ~${fmtW(L)}.`);
        else if (psu.w < need) add("R6", "warn", ["psu"], `Nguồn ${fmtW(psu.w)} chạy được nhưng dư tải dưới ${prm.psuReserve}% (nên ≥ ${fmtW(need)}).`);
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
    const units = st.units;
    function receive(id, qty, inDate, po, sns) { for (let i = 0; i < qty; i++) units.push({ sn: sns && sns[i] ? sns[i] : `${id}-${++st.seq.sn}`, id, inDate: inDate || now(), state: "stock", order: null, po: po || null }); }
    const onHand = (id) => (st.availMap ? st.availMap[id] || 0 : units.filter((u) => u.id === id && (u.state === "stock" || u.state === "held")).length);
    const held = (id) => (st.availMap ? 0 : units.filter((u) => u.id === id && u.state === "held").length);
    const avail = (id) => (st.availMap ? st.availMap[id] || 0 : units.filter((u) => u.id === id && u.state === "stock").length);

    // ===================== TRẠNG THÁI GIAO DIỆN (chỉ trên trình duyệt) =====================
    const S = {
      user: null, // tài khoản khách đang đăng nhập (từ máy chủ)
      me: { phone: "", orderIds: [] }, // đơn khách này được xem (đã xác thực SĐT hoặc vừa đặt trên máy này)
      staff: null, // { name, email, role } từ phiên đăng nhập nhân viên
      guestPhone: "",
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
      pos: { cust: null, lines: [], disc: 0, approved: false, approver: null, pay: "Tiền mặt", asm: false },
      // Giai đoạn 2: lead, báo giá, nhà cung cấp, banner chưa lưu máy chủ (giữ như prototype)
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
      banners: [
        { id: "B1", title: "Build PC theo ngân sách – tư vấn miễn phí", place: "Trang chủ", sponsor: "", on: true, views: 4210, clicks: 188 },
        { id: "B2", title: "Tản nhiệt Cooler Master – giới thiệu sản phẩm", place: "Trang Build PC", sponsor: "Nhà phân phối C (hỗ trợ hiện vật)", on: true, views: 1530, clicks: 41 },
      ],
      referral: { giver: 200000, receiver: 100000, bonusFrom: 3, list: [{ code: "TUAN200", owner: "Lý Minh Tuấn", invited: 1, paid: 200000 }] },
      // Dữ liệu dùng chung, đồng bộ từ máy chủ (cùng tham chiếu với st)
      orders: st.orders,
      requests: st.requests,
      rma: st.rma,
      warranties: st.warranties,
      coupons: st.coupons,
      log: st.log,
      staffUsers: st.staffUsers,
      products: P,
    };
    const log = (action, target, who) => st.log.unshift({ t: now(), who: who || actor(), action, target: target || "" });

    // ===================== ĐƠN HÀNG =====================
    const lineNeeds = (lines) => { const m = {}; lines.forEach((l) => { if (l.type === "pc") Object.entries(cfgNeeds(l.cfg)).forEach(([k, v]) => (m[k] = (m[k] || 0) + v)); if (l.type === "part") m[l.id] = (m[l.id] || 0) + l.qty; }); return m; };
    const linePrice = (l) => (l.type === "pc" ? cfgPrice(l.cfg) + asmFee(l) : l.type === "part" ? byId(l.id).price * l.qty : l.price);
    const asmFee = (l) => (l.type === "pc" && l.asm && l.asm !== "none" ? (l.asm === "home" ? FEES.asmOwn + FEES.homeIn : hasOwn(l.cfg) ? FEES.asmOwn : FEES.asm) : 0);
    const preorderItems = (lines) => Object.entries(lineNeeds(lines)).filter(([id, q]) => avail(id) < q).map(([id, q]) => ({ id, q, short: q - avail(id), grp: byId(id).grp }));
    function couponCheck(code, lines) {
      const cp = st.coupons.find((x) => x.code === (code || "").trim().toUpperCase());
      if (!cp) return { ok: false, m: "Mã không tồn tại." };
      const t = now();
      if (t < new Date(cp.from) || t > new Date(cp.to)) return { ok: false, m: "Mã ngoài thời gian áp dụng." };
      if (cp.used >= cp.max) return { ok: false, m: "Mã đã hết lượt dùng." };
      const base = lines.reduce((s, l) => s + (cp.scope === "pc" ? (l.type === "pc" ? cfgPrice(l.cfg) : 0) : linePrice(l)), 0);
      const all = lines.reduce((s, l) => s + linePrice(l), 0);
      if (all < cp.min) return { ok: false, m: `Đơn tối thiểu ${cp.min.toLocaleString("vi-VN")}đ.` };
      if (!base) return { ok: false, m: "Mã chỉ áp dụng cho đơn có PC." };
      const amt = cp.type === "pct" ? Math.round((base * cp.val) / 100 / 1000) * 1000 : Math.min(cp.val, base);
      return { ok: true, cp, amt, m: `${cp.desc}: −${amt.toLocaleString("vi-VN")}đ` };
    }
    const normPhone = (p) => String(p || "").replace(/[^\d+]/g, "");
    function riskScore(o) {
      const r = [];
      if (o.total > 30000000) r.push(["Giá trị đơn trên 30 triệu", 30]);
      const prior = st.orders.filter((x) => normPhone(x.cust.phone) === normPhone(o.cust.phone) && x.id !== o.id);
      if (o.pay.method === "COD" && !prior.some((x) => x.status === "Hoàn tất")) r.push(["COD lần đầu", 25]);
      if (o.cust.addr && o.ship.mode !== "pickup" && st.orders.some((x) => x.id !== o.id && normPhone(x.cust.phone) !== normPhone(o.cust.phone) && x.cust.addr === o.cust.addr)) r.push(["Địa chỉ trùng đơn của SĐT khác", 20]);
      if (prior.filter((x) => now() - new Date(x.date) < 864e5).length >= 2) r.push(["Nhiều đơn trong 24 giờ", 25]);
      const score = r.reduce((t, x) => t + x[1], 0);
      return { score, reasons: r.map((x) => x[0]), needVerify: score >= 50, verified: false };
    }
    // Chiết khấu theo hạng khách (VIP 2%, B2B 5%) tính trên tạm tính, làm tròn 1.000đ
    const tierDiscount = (tier, sub) => { const t = BX.CUST_TIERS && BX.CUST_TIERS[tier]; return t && t.discRate ? Math.round((sub * t.discRate) / 1000) * 1000 : 0; };
    function createOrder({ cust, lines, ship, coupon, payMethod, channel, date, who, tierDisc, vatInvoice }) {
      const sub = lines.reduce((t, l) => t + linePrice(l), 0);
      const disc = coupon ? coupon.amt : 0;
      const tDisc = tierDisc || 0;
      const total = Math.max(0, sub - disc - tDisc);
      const pre = channel === "Tại quầy" ? [] : preorderItems(lines);
      const isDebt = payMethod === "Công nợ B2B";
      const needDeposit = !isDebt && pre.some((x) => x.grp === "C");
      const o = {
        id: `BX-${String(++st.seq.order).padStart(4, "0")}`, date: date || now(), channel: channel || "Website", cust, lines, ship: ship || { mode: "in" }, coupon: coupon ? coupon.cp.code : null, disc, tierDisc: tDisc, sub, total,
        pay: { method: payMethod, status: isDebt ? "Công nợ B2B (đối soát 15–30 ngày)" : payMethod === "COD" ? "COD – chưa thu" : "Chưa thanh toán", paid: 0, due: needDeposit && payMethod !== "COD" ? Math.round((total * FEES.depositRate) / 1000) * 1000 : total },
        preorder: pre, needDeposit, status: "Mới", short: [], tech: "", qc: null, waybill: "", asm: lines.some((l) => l.type === "pc" && l.asm && l.asm !== "none"), log: [], stockOut: false, review: null,
        priority: !!(cust && (cust.tier === "vip" || cust.tier === "b2b")), vatInvoice: vatInvoice || null,
      };
      o.risk = riskScore(o);
      if (coupon && coupon.cp.used != null) coupon.cp.used++;
      o.log.push({ t: o.date, who: who || "Hệ thống", msg: `Tạo đơn (${o.channel})${cust && cust.tier === "vip" ? " · [Đặc quyền VIP]" : cust && cust.tier === "b2b" ? " · [Doanh nghiệp B2B]" : ""}` });
      st.orders.unshift(o);
      return o;
    }
    const findOrder = (id) => st.orders.find((o) => o.id === id);
    const olog = (o, msg, who) => { o.log.push({ t: now(), who: who || actor(), msg }); log(msg, o.id, who); };
    function gatewayPaid(o, amount, who, note) { o.pay.paid += amount; o.pay.status = o.pay.paid >= o.total ? "Đã thanh toán" : "Đã cọc"; o.log.push({ t: now(), who: who || "Cổng thanh toán", msg: note || `IPN hợp lệ: nhận ${amount.toLocaleString("vi-VN")}đ (${o.pay.method})` }); }
    function holdFor(o) {
      const need = lineNeeds(o.lines), short = [];
      Object.entries(need).forEach(([id, q]) => {
        const have = units.filter((u) => u.order === o.id && u.id === id).length;
        let left = q - have;
        // giữ serial nhập sớm nhất trước (xuất trước – nhập trước)
        units.filter((u) => u.id === id && u.state === "stock").sort((a, b) => new Date(a.inDate) - new Date(b.inDate)).slice(0, Math.max(0, left)).forEach((u) => { u.state = "held"; u.order = o.id; left--; });
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
    // Đơn chờ hàng theo thứ tự đặt sớm nhất trước (FIFO): hàng về giữ cho người chờ lâu nhất
    const waitingFifo = () => st.orders.filter((o) => o.status === "Chờ hàng").sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id)));
    function recheck(o) { const short = holdFor(o); if (!short.length && o.status === "Chờ hàng") { o.status = "Đã xác nhận"; olog(o, "Đã đủ hàng sau khi nhập kho"); } return short; }
    function toNext(o) {
      if (o.status !== "Đã xác nhận") return "Đơn chưa ở trạng thái Đã xác nhận.";
      o.status = o.asm ? "Lắp ráp & QC" : "Đóng gói";
      olog(o, o.asm ? "Chuyển xưởng lắp ráp" : "Chuyển đóng gói (không lắp ráp)");
      return null;
    }
    function qcResult(o, res) {
      if (o.status !== "Lắp ráp & QC") return "Đơn không ở bước Lắp ráp & QC.";
      o.qc = res;
      if (res.pass) {
        o.status = "Đóng gói"; olog(o, `QC đạt: CPU ${res.cpu}°C, GPU ${res.gpu}°C, ${res.ram} lỗi RAM`);
        // phiếu RMA mở từ lần QC không đạt trước đó được đóng theo
        st.rma.filter((r) => r.order === o.id && r.fromQc && !["Đã đổi", "Đã trả máy"].includes(r.st)).forEach((r) => { r.st = "Đã đổi"; r.hist.push(dstr(now()) + ": QC lại đạt, đóng phiếu"); });
      }
      else { olog(o, `QC không đạt → mở RMA`); st.rma.unshift({ id: "RMA-" + ++st.seq.rma, fromQc: true, sn: (units.find((u) => u.order === o.id) || {}).sn || "", order: o.id, symptom: res.note || "Không đạt ngưỡng QC", diag: "", action: "Khoanh vùng linh kiện lỗi, đổi với NPP", st: "Đang xử lý", hist: [dstr(now()) + ": mở từ QC không đạt"] }); }
      return null;
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
      if (o.pay.method === "Công nợ B2B" && o.pay.paid < o.total) { o.pay.status = "Công nợ B2B – chờ đối soát"; o.log.push({ t: now(), who: actor(), msg: `Ghi nhận công nợ ${(o.total - o.pay.paid).toLocaleString("vi-VN")}đ theo hợp đồng` }); }
      else if (o.pay.paid < o.total) { const rest = o.total - o.pay.paid; o.pay.paid = o.total; o.pay.status = "Đã thanh toán"; o.log.push({ t: now(), who: actor(), msg: `${o.pay.method === "COD" ? "Đã thu COD" : "Thu phần còn lại"} ${rest.toLocaleString("vi-VN")}đ` }); }
      o.status = "Hoàn tất";
      units.filter((u) => u.order === o.id).forEach((u) => { if (!st.warranties.some((w) => w.sn === u.sn)) st.warranties.push({ sn: u.sn, id: u.id, order: o.id, phone: o.cust.phone, from: now(), months: 36 }); });
      olog(o, "Hoàn tất – kích hoạt bảo hành theo serial");
      return null;
    }
    function cancel(o, who) {
      if (["Đang giao / Chờ nhận", "Hoàn tất", "Đã hủy"].includes(o.status)) return "Chỉ hủy được trước khi xuất kho.";
      units.filter((u) => u.order === o.id && u.state === "held").forEach((u) => { u.state = "stock"; u.order = null; });
      o.status = "Đã hủy";
      if (o.pay.paid) { o.pay.refunded = o.pay.paid; o.pay.status = "Đã hoàn tiền"; }
      olog(o, `Hủy đơn, giải phóng hàng đã giữ${o.pay.paid ? `; hoàn ${o.pay.paid.toLocaleString("vi-VN")}đ theo chính sách` : ""}`, who);
      return null;
    }

    // ===================== ĐƠN NHẬP =====================
    const supplierFor = (id) => { const c = byId(id).cat; return ["cpu", "vga", "main"].includes(c) ? "NPP01" : ["ram", "ssd"].includes(c) ? "NPP02" : "NPP03"; };
    function poSuggestions() {
      const out = [];
      st.orders.filter((o) => o.status === "Chờ hàng").forEach((o) => o.short.forEach((s) => {
        const inPo = st.pos.filter((p) => p.forOrder === o.id && p.status !== "Đã nhận").some((p) => p.items.some((i) => i.id === s.id));
        if (!inPo) out.push({ order: o.id, id: s.id, q: s.q, sup: supplierFor(s.id) });
      }));
      return out;
    }
    function createPO(items, sup, forOrder) { const p = { id: "PO-" + ++st.seq.po, sup, items, forOrder: forOrder || "Bổ sung tồn kho", status: "Chờ duyệt", eta: "", created: now() }; st.pos.unshift(p); log("Tạo đơn nhập", p.id); return p; }
    function receivePO(p) {
      if (p.status === "Đã nhận") return "Đơn nhập đã nhận.";
      p.items.forEach((i) => receive(i.id, i.q, now(), p.id));
      p.status = "Đã nhận"; log("Nhận hàng theo đơn nhập", p.id);
      waitingFifo().forEach(recheck);
      return null;
    }

    return {
      S, st, P, byId, ruleCfg: () => RC(), DEFAULT_RULE_CFG, normRuleCfg, units, POS: st.pos, get TODAY() { return now(); }, now, days, dstr, tstr, emptyCfg, cfgFromCombo, clone, part, evalRules, worst, tryPart, filterNotes, missing, canAssemble, hasOwn,
      cfgPrice, cfgCost, cfgNeeds, RULES, waitingFifo, onHand, held, avail, receive, lineNeeds, linePrice, asmFee, preorderItems, couponCheck, riskScore, tierDiscount, createOrder, findOrder, olog,
      gatewayPaid, holdFor, confirmOrder, recheck, toNext, qcResult, ship, complete, cancel, poSuggestions, createPO, receivePO, supplierFor, log, sticks, load, STATUSES, normPhone,
    };
  }

  return { create, emptyState, DEFAULT_RULE_CFG, normRuleCfg };
});
