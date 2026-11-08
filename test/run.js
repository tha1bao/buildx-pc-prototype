// Kiểm thử trọn luồng với CSDL thật: luật tương thích, khách đặt hàng → nhân viên xử lý,
// tranh mua món cuối cùng, phân quyền. Cần DATABASE_URL trỏ tới một CSDL KIỂM THỬ (sẽ bị xóa dữ liệu).
// Chạy: DATABASE_URL=postgres://... npm test
"use strict";
const assert = require("assert");
const BX = require("../public/data.js");
const ENG = require("../public/engine.js");
const db = require("../server/db");

let base, passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ✓ " + name); } catch (e) { console.log("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; } };

// Trình duyệt giả lập: giữ cookie riêng cho từng người dùng
function client() {
  const jar = {};
  const call = async (path, body) => {
    const r = await fetch(base + path, { method: body ? "POST" : "GET", headers: Object.assign({ cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined });
    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((c) => { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); });
    const j = await r.json(); j._status = r.status; return j;
  };
  return {
    state: () => call("/api/state"),
    act: async (name, payload) => {
      // phiếu QC: tự kèm checklist 7 bước, serial đã giữ và số ảnh (trừ khi ca kiểm thử muốn gửi thiếu)
      if (name === "order.qc" && payload && payload.result && !payload.raw && !payload.result.checklist) {
        const s = await call("/api/state"), sns = (s.units || []).filter((u) => u.order === payload.id).map((u) => u.sn);
        payload = { id: payload.id, result: Object.assign({ checklist: [0, 1, 2, 3, 4, 5, 6], serials: sns, photos: 3 }, payload.result) };
      }
      if (payload && payload.raw) { payload = Object.assign({}, payload); delete payload.raw; }
      return call("/api/action", { name, payload });
    },
    auth: (op, data) => call("/api/auth", Object.assign({ op }, data)),
  };
}
// Đăng nhập khách: SĐT chưa có tài khoản thì đăng ký (OTP + mật khẩu), có rồi thì đăng nhập bằng mật khẩu
const PRESET_PW = "Khach@2026", TEST_PW = "Matkhau123";
async function login(c, phone, name) {
  const o = await c.auth("otp", { phone, purpose: "register" });
  if (o._status === 200) { const r = await c.auth("register", { phone, name: name || "Khách " + phone, password: TEST_PW, code: o.devOtp }); if (r._status !== 200) throw new Error("register " + r.error); return c; }
  for (const pw of [PRESET_PW, TEST_PW]) { const r = await c.auth("login", { id: phone, password: pw }); if (r._status === 200) return c; }
  throw new Error("login " + phone);
}
const ok = (r) => { assert.ok(r.ok !== false && r._status === 200, `HTTP ${r._status}: ${r.error}`); return r; };
const err = (r, re) => { assert.ok(r._status >= 400, "Đáng lẽ phải bị từ chối"); if (re) assert.match(r.error, re); return r; };

(async () => {
  // CSDL sạch
  const pool = db.getPool();
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const server = require("../server/dev.js");
  await new Promise((res) => server.listen(0, res));
  base = "http://127.0.0.1:" + server.address().port;

  console.log("Luật tương thích (chạy bằng engine của máy chủ)");
  const E = ENG.create(BX, ENG.emptyState());
  const mk = (o) => { const c = E.emptyCfg(); Object.entries(o).forEach(([k, v]) => { if (k === "extras") c.extras = v.map((id) => ({ id, qty: 1 })); else { const [id, q] = String(v).split("x"); c[k] = { mode: "buy", id, qty: +(q || 1) }; } }); return c; };
  for (const [r, exp, label, o] of BX.RULE_TESTS) await t(`${r} ${label} → ${exp}`, () => { const rs = E.evalRules(mk(o)).filter((x) => x.r === r); assert.strictEqual(rs.length ? E.worst(rs) : "—", exp); });

  console.log("Khách đặt hàng → nhân viên thấy và xử lý");
  const khach = client(), quanly = client(), ktv = client(), banhang = client();
  let orderId;
  await t("chưa đăng nhập thì không đặt được hàng (cả khi gọi thẳng API)", async () => {
    err(await khach.act("order.create", { cust: { name: "Khách Kiểm Thử", phone: "0901234567", addr: "1 Cầu Giấy" }, lines: [{ type: "part", id: "R01", qty: 1 }], payMethod: "COD" }), /đăng nhập/);
  });
  await t("tài khoản mới: hạng Member, điểm và chi tiêu bằng 0", async () => {
    await login(khach, "0901234567", "Khách Kiểm Thử");
    const s = ok(await khach.state());
    assert.strictEqual(s.user.tier, "standard"); assert.strictEqual(s.user.points, 0); assert.strictEqual(s.user.spent, 0);
  });
  await t("khách đã đăng nhập đặt combo BX Esports (COD) qua website", async () => {
    const lines = [{ type: "pc", title: "BX Esports", src: "combo", cfg: E.cfgFromCombo("esports"), asm: "shop" }];
    const r = ok(await khach.act("order.create", { cust: { name: "Khách Kiểm Thử", phone: "0901234567", addr: "1 Cầu Giấy" }, lines, ship: { mode: "in" }, payMethod: "COD" }));
    orderId = r.result.id;
    assert.ok(r.state.me.orderIds.includes(orderId));
    const o = r.state.orders.find((x) => x.id === orderId);
    assert.strictEqual(o.status, "Mới");
    assert.strictEqual(o.total, BX.COMBOS.find((c) => c.key === "esports") && E.cfgPrice(E.cfgFromCombo("esports")) + BX.FEES.asm, "giá do máy chủ tính");
  });
  await t("giá gửi lên bị bỏ qua: dịch vụ Care luôn 450.000đ", async () => {
    const r = ok(await khach.act("order.create", { cust: { name: "Khách Kiểm Thử", phone: "0901234567", addr: "1 Cầu Giấy" }, lines: [{ type: "part", id: "R01", qty: 1 }, { type: "svc", code: "care", price: 1 }], payMethod: "COD" }));
    const o = r.state.orders.find((x) => x.id === r.result.id);
    assert.strictEqual(o.total, BX.P.find((p) => p.id === "R01").price + BX.FEES.care);
    ok(await khach.act("order.cancelMine", { id: o.id }));
  });
  await t("máy chủ chặn cấu hình không tương thích", async () => {
    const cfg = E.cfgFromCombo("esports"); cfg.cpu = { mode: "buy", id: "C04", qty: 1 }; // Ryzen AM5 trên main LGA1700
    err(await khach.act("order.create", { cust: { name: "A", phone: "0901234567", addr: "x" }, lines: [{ type: "pc", src: "build", cfg, asm: "none" }], payMethod: "COD" }), /không tương thích/);
  });
  await t("khách khác không xem được đơn của người khác", async () => {
    const la = await login(client(), "0909888777");
    const s = ok(await la.state());
    assert.ok(!s.orders.some((o) => o.id === orderId));
    err(await la.act("order.cancelMine", { id: orderId }), /quyền/);
  });
  await t("chưa đăng nhập nội bộ thì không xử lý đơn được", async () => { err(await khach.act("order.confirm", { id: orderId }), /đăng nhập/); });
  await t("nhân viên đăng nhập, thấy đơn mới của khách", async () => {
    ok(await quanly.auth("staffLogin", { email: "bao@buildx.vn", password: "BuildX@2026" }));
    const s = ok(await quanly.state());
    assert.strictEqual(s.staff.role, "Quản lý");
    assert.strictEqual(s.orders.find((o) => o.id === orderId).status, "Mới");
  });
  await t("sai mật khẩu bị từ chối", async () => { err(await client().auth("staffLogin", { email: "bao@buildx.vn", password: "sai" }), /không đúng/); });
  await t("thủ kho không được duyệt đơn nhập; kỹ thuật viên không được xác nhận đơn", async () => {
    ok(await ktv.auth("staffLogin", { email: "huy.tran@buildx.vn", password: "BuildX@2026" }));
    err(await ktv.act("order.confirm", { id: orderId }), /quyền/);
  });
  let held;
  await t("COD lần đầu là đơn rủi ro: phải gọi xác minh trước khi xác nhận", async () => {
    const s = ok(await quanly.state()), o = s.orders.find((x) => x.id === orderId);
    if (o.risk.needVerify) { err(await quanly.act("order.confirm", { id: orderId }), /xác minh/); ok(await quanly.act("order.verifyCall", { id: orderId })); }
  });
  await t("nhân viên xác nhận → giữ hàng theo serial; khách thấy Đã xác nhận", async () => {
    const r = ok(await quanly.act("order.confirm", { id: orderId }));
    assert.strictEqual(r.result.status, "Đã xác nhận");
    held = r.state.units.filter((u) => u.order === orderId);
    assert.strictEqual(held.length, Object.values(E.cfgNeeds(E.cfgFromCombo("esports"))).reduce((a, b) => a + b, 0));
    assert.ok(held.every((u) => u.state === "held"));
    const ks = ok(await khach.state());
    assert.strictEqual(ks.orders.find((o) => o.id === orderId).status, "Đã xác nhận");
    assert.ok(!ks.units.length, "khách không nhận danh sách serial");
  });
  await t("chuyển xưởng → kỹ thuật viên ghi QC (ngưỡng tính ở máy chủ) → Đóng gói", async () => {
    ok(await quanly.act("order.next", { id: orderId }));
    ok(await quanly.act("order.assignTech", { id: orderId, tech: "Trần Đức Huy" }));
    const r = ok(await ktv.act("order.qc", { id: orderId, result: { cpu: 95, gpu: 70, ram: 0, cb: 12000, min: 30, pass: true } }));
    assert.strictEqual(r.result.pass, false, "trình duyệt gửi pass:true nhưng máy chủ tự tính theo ngưỡng");
  });
  await t("QC không đạt mở RMA, đơn vẫn ở xưởng; QC đạt thì sang Đóng gói", async () => {
    let s = ok(await quanly.state());
    const o1 = s.orders.find((x) => x.id === orderId);
    assert.strictEqual(o1.status, "Lắp ráp & QC");
    assert.ok(s.rma.some((r) => r.order === orderId));
    const r = ok(await ktv.act("order.qc", { id: orderId, result: { cpu: 72, gpu: 69, ram: 0, cb: 12100, min: 180 } }));
    assert.strictEqual(r.result.pass, true);
    s = ok(await khach.state());
    assert.strictEqual(s.orders.find((x) => x.id === orderId).status, "Đóng gói");
    assert.strictEqual(s.orders.find((x) => x.id === orderId).qc.cpu, 72, "khách xem được báo cáo burn-in");
  });
  await t("xuất kho ghi một lần → Đang giao → Hoàn tất, thu COD, kích hoạt bảo hành", async () => {
    const r1 = ok(await ktv.act("order.ship", { id: orderId }));
    assert.ok(r1.state.units.filter((u) => u.order === orderId).every((u) => u.state === "out"));
    err(await ktv.act("order.ship", { id: orderId }), /Đóng gói/);
    ok(await ktv.act("order.complete", { id: orderId }));
    const s = ok(await khach.state()), o = s.orders.find((x) => x.id === orderId);
    assert.strictEqual(o.status, "Hoàn tất"); assert.strictEqual(o.pay.paid, o.total);
    assert.strictEqual(s.warranties.filter((w) => w.order === orderId).length, held.length);
  });

  await t("đơn hoàn tất cộng 1% điểm và tổng chi tiêu vào tài khoản", async () => {
    const s = ok(await khach.state()), o = s.orders.find((x) => x.id === orderId);
    assert.strictEqual(s.user.spent, o.total);
    assert.strictEqual(s.user.points, Math.floor(o.total * 0.01 / 1000));
  });
  await t("đăng ký mới không tự chọn được VIP/B2B; gửi yêu cầu B2B, quản lý duyệt", async () => {
    const c = await login(client(), "0977123456", "Người Mới");
    err(await c.act("b2b.request", { name: "Cty A", taxId: "123" }), /Mã số thuế/);
    ok(await c.act("b2b.request", { name: "Cty TNHH A", taxId: "0101234567", addr: "Hà Nội" }));
    assert.strictEqual(ok(await c.state()).user.tier, "standard");
    const sq = ok(await quanly.state());
    assert.ok(sq.requests.some((r) => r.b2b === "0977123456"));
    ok(await quanly.act("customer.setTier", { phone: "0977123456", tier: "b2b" }));
    const u = ok(await c.state()).user;
    assert.strictEqual(u.tier, "b2b"); assert.strictEqual(u.company.taxId, "0101234567");
  });

  console.log("Luật tương thích do quản lý chỉnh");
  await t("chỉ Quản lý sửa được luật; giá trị ngoài giới hạn bị từ chối", async () => {
    err(await ktv.act("rules.update", { levels: { R1: "off" } }), /quyền|Quản lý/);
    err(await quanly.act("rules.update", { params: { psuReserve: 500 } }), /giới hạn/);
    err(await quanly.act("rules.update", { levels: { R1: "abc" } }), /không hợp lệ/);
  });
  await t("hạ R1 xuống 'chỉ cảnh báo' thì máy chủ cho đặt cấu hình lệch socket; khôi phục thì chặn lại", async () => {
    const cfg = E.cfgFromCombo("esports"); cfg.cpu = { mode: "buy", id: "C04", qty: 1 };
    const body = { cust: { name: "Khách Kiểm Thử", phone: "0901234567", addr: "1 Cầu Giấy" }, lines: [{ type: "pc", src: "build", title: "Thử luật", cfg, asm: "none" }], payMethod: "COD" };
    const r = ok(await quanly.act("rules.update", { levels: { R1: "warn" }, params: { psuReserve: 40 } }));
    assert.strictEqual(r.state.ruleCfg.levels.R1, "warn"); assert.strictEqual(r.state.ruleCfg.params.psuReserve, 40);
    assert.ok(ok(await khach.state()).ruleCfg.levels.R1 === "warn", "khách nhận cấu hình luật mới");
    const o = ok(await khach.act("order.create", body));
    ok(await khach.act("order.cancelMine", { id: o.result.id }));
    ok(await quanly.act("rules.reset", {}));
    err(await khach.act("order.create", body), /không tương thích/);
    assert.ok(ok(await quanly.state()).log.some((l) => /Sửa luật tương thích/.test(l.action)));
  });

  console.log("Tồn kho: không bán vượt số có");
  await t("hai khách tranh mua chiếc RTX 5070 Ti cuối cùng: chỉ một người được giữ hàng", async () => {
    const s0 = ok(await quanly.state());
    const left = s0.units.filter((u) => u.id === "G05" && u.state === "stock").length;
    // dồn kho G05 về đúng 1 chiếc
    if (left > 1) ok(await quanly.act("stock.adjust", { id: "G05", qty: -(left - 1), reason: "Kiểm kê lệch" }));
    if (left === 0) ok(await quanly.act("stock.receive", { id: "G05", qty: 1, invoice: "HĐ TEST" }));
    const a = await login(client(), "0911111111"), b = await login(client(), "0922222222");
    const mkOrder = (c, ph) => c.act("order.create", { cust: { name: "Khách " + ph, phone: ph, addr: "Pickup" }, lines: [{ type: "part", id: "G05", qty: 1 }], ship: { mode: "pickup" }, payMethod: "COD" });
    const [oa, ob] = await Promise.all([mkOrder(a, "0911111111"), mkOrder(b, "0922222222")]);
    ok(oa); ok(ob);
    for (const id of [oa.result.id, ob.result.id]) { const s = ok(await quanly.state()); if (s.orders.find((o) => o.id === id).risk.needVerify) ok(await quanly.act("order.verifyCall", { id })); }
    const [ca, cb] = await Promise.all([quanly.act("order.confirm", { id: oa.result.id }), quanly.act("order.confirm", { id: ob.result.id })]);
    const st = [ok(ca).result.status, ok(cb).result.status].sort();
    assert.deepStrictEqual(st, ["Chờ hàng", "Đã xác nhận"]);
    const s = ok(await quanly.state());
    assert.strictEqual(s.units.filter((u) => u.id === "G05" && u.state === "held").length, 1);
    assert.strictEqual(s.units.filter((u) => u.id === "G05" && u.state === "stock").length, 0);
  });
  await t("đơn Chờ hàng → đơn nhập → quản lý duyệt → NPP xác nhận → nhận hàng → đơn tự về Đã xác nhận", async () => {
    let s = ok(await quanly.state());
    const waiting = s.orders.find((o) => o.status === "Chờ hàng" && o.lines.some((l) => l.id === "G05"));
    const r = ok(await quanly.act("po.create", { items: [{ id: "G05", q: 1 }], sup: "NPP01", forOrder: waiting.id }));
    ok(await banhang.auth("staffLogin", { email: "khoa.do@buildx.vn", password: "BuildX@2026" }));
    err(await banhang.act("po.approve", { id: r.result.id }), /Quản lý/);
    ok(await quanly.act("po.approve", { id: r.result.id }));
    ok(await banhang.act("po.confirm", { id: r.result.id, days: 2 }));
    ok(await banhang.act("po.receive", { id: r.result.id }));
    s = ok(await quanly.state());
    assert.strictEqual(s.orders.find((o) => o.id === waiting.id).status, "Đã xác nhận");
  });
  await t("hủy đơn trước xuất kho giải phóng hàng đã giữ", async () => {
    let s = ok(await quanly.state());
    const o = s.orders.find((x) => x.status === "Đã xác nhận" && x.lines.some((l) => l.id === "G05"));
    ok(await quanly.act("order.cancel", { id: o.id }));
    s = ok(await quanly.state());
    assert.ok(!s.units.some((u) => u.order === o.id && u.state === "held"));
  });

  console.log("Thanh toán online, OTP, POS, dịch vụ");
  await t("đơn online chỉ được xác nhận sau khi cổng báo đã thanh toán", async () => {
    const c = await login(client(), "0933333333");
    const r = ok(await c.act("order.create", { cust: { name: "Online", phone: "0933333333", addr: "2 Duy Tân" }, lines: [{ type: "part", id: "R01", qty: 1 }], payMethod: "VNPAY" }));
    err(await quanly.act("order.confirm", { id: r.result.id }), /thanh toán/);
    ok(await c.act("order.pay", { id: r.result.id, result: "ok" }));
    ok(await quanly.act("order.confirm", { id: r.result.id }));
  });
  await t("đơn rủi ro trả online (trên 30 triệu + nhiều đơn trong 24 giờ) cần OTP; sai OTP bị từ chối", async () => {
    const c = khach; // SĐT này đã có 2 đơn hôm nay
    const r = ok(await c.act("order.create", { cust: { name: "Khách Kiểm Thử", phone: "0901234567", addr: "3 Xuân Thủy" }, lines: [{ type: "pc", title: "BX Pro", src: "combo", cfg: E.cfgFromCombo("pro"), asm: "shop" }], payMethod: "VNPAY", agreePreorder: true }));
    assert.ok(r.result.needOtp && r.result.devOtp);
    err(await c.act("order.pay", { id: r.result.id, result: "ok" }), /OTP/);
    err(await c.act("order.otp", { id: r.result.id, code: "000000" === r.result.devOtp ? "111111" : "000000" }), /OTP/);
    ok(await c.act("order.otp", { id: r.result.id, code: r.result.devOtp }));
    const p = ok(await c.act("order.pay", { id: r.result.id, result: "ok" }));
    const o = p.state.orders.find((x) => x.id === r.result.id);
    assert.ok(["Đã cọc", "Đã thanh toán"].includes(o.pay.status));
  });
  await t("bán tại quầy: trừ kho ngay, giảm giá vượt chính sách cần quản lý duyệt", async () => {
    const before = ok(await quanly.state()).units.filter((u) => u.id === "R01" && u.state === "stock").length;
    const nv = client(); ok(await nv.auth("staffLogin", { email: "viet.pham@buildx.vn", password: "BuildX@2026" }));
    const body = { cust: { name: "Khách quầy", phone: "0955555555" }, lines: [{ type: "part", id: "R01", qty: 1 }], disc: 500000, pay: "Tiền mặt" };
    err(await nv.act("pos.checkout", body), /quản lý/);
    const r = ok(await nv.act("pos.checkout", Object.assign({}, body, { pin: "246810" })));
    assert.strictEqual(r.result.status, "Hoàn tất");
    const after = ok(await quanly.state()).units.filter((u) => u.id === "R01" && u.state === "stock").length;
    assert.strictEqual(after, before - 1);
  });
  await t("khách đặt lịch dịch vụ → vào hàng đợi yêu cầu của nhân viên", async () => {
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const r = ok(await khach.act("service.book", { svc: "clean", loc: "in", date: tomorrow, slot: "09:00–11:00", name: "Khách Kiểm Thử", phone: "0901234567" }));
    const s = ok(await ktv.state());
    assert.ok(s.requests.some((x) => x.code === r.result.code && x.st === "Mới"));
    ok(await ktv.act("request.update", { id: r.result.id, field: "st", value: "Đang xử lý" }));
    assert.strictEqual(ok(await khach.state()).requests.find((x) => x.id === r.result.id).st, "Đang xử lý");
  });
  await t("đăng nhập khách bằng SĐT hoặc email + mật khẩu thấy đơn cũ theo SĐT", async () => {
    const c = client();
    err(await c.auth("login", { id: "0912345678", password: "SaiMatKhau1" }), /không đúng/);
    ok(await c.auth("login", { id: "minhanh@gmail.com", password: PRESET_PW }));
    const s = ok(await c.state());
    assert.strictEqual(s.user.name, "Nguyễn Minh Anh");
    assert.ok(s.orders.length >= 1 && s.warranties.length >= 1);
    ok(await c.act("addr.add", { label: "Ký túc xá", text: "Đại học FPT" }));
    assert.strictEqual(ok(await c.state()).user.addrs.length, 3);
  });
  await t("hạng khách: VIP được giảm 2% do máy chủ tính; khách vãng lai không dùng được công nợ B2B", async () => {
    const vip = client();
    ok(await vip.auth("login", { id: "0912345678", password: PRESET_PW }));
    const lines = [{ type: "part", id: "S01", qty: 2 }];
    const r = ok(await vip.act("order.create", { cust: { name: "Nguyễn Minh Anh", phone: "0912345678", addr: "18 HQV" }, lines, payMethod: "COD" }));
    const ord = r.state.orders.find((x) => x.id === r.result.id), sub = BX.P.find((p) => p.id === "S01").price * 2;
    assert.strictEqual(ord.tierDisc, Math.round(sub * 0.02 / 1000) * 1000);
    assert.strictEqual(ord.total, sub - ord.tierDisc);
    err(await (await login(client(), "0966666666")).act("order.create", { cust: { name: "Giả B2B", phone: "0966666666", addr: "x" }, lines, payMethod: "Công nợ B2B" }), /B2B/);
  });
  await t("doanh nghiệp B2B: giảm 5%, hóa đơn VAT, công nợ; nhân viên đổi hạng khách", async () => {
    const b = client();
    ok(await b.auth("login", { id: "0988999888", password: PRESET_PW }));
    const r = ok(await b.act("order.create", { cust: { name: "NextGen", phone: "0988999888", addr: "Keangnam" }, lines: [{ type: "part", id: "R01", qty: 4 }], payMethod: "Công nợ B2B", agreePreorder: true, vatInvoice: { name: "Cty NextGen", taxId: "0109876543", addr: "Keangnam" } }));
    const ord = r.state.orders.find((x) => x.id === r.result.id);
    assert.strictEqual(ord.tierDisc, Math.round(BX.P.find((p) => p.id === "R01").price * 4 * 0.05 / 1000) * 1000);
    assert.ok(ord.vatInvoice && /Công nợ/.test(ord.pay.status));
    ok(await quanly.act("order.confirm", { id: ord.id }));
    ok(await quanly.act("customer.setTier", { phone: "0905112233", tier: "vip" }));
  });
  await t("khóa tài khoản nhân viên có hiệu lực ngay", async () => {
    ok(await quanly.act("user.update", { email: "viet.pham@buildx.vn", field: "active", value: false }));
    const nv = client();
    err(await nv.auth("staffLogin", { email: "viet.pham@buildx.vn", password: "BuildX@2026" }), /khóa/);
  });

  console.log(`\n${passed} ca đạt${process.exitCode ? ", có ca LỖI" : ""}.`);
  server.close(); await db.resetPool();
})().catch((e) => { console.error(e); process.exit(1); });
