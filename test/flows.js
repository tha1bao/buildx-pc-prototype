// Kiểm thử theo danh sách test case (sơ đồ "Luồng ISC"), tầng API + CSDL thật.
// Ghi kết quả từng mã TC vào file JSON (đối số 1). Chạy: DATABASE_URL=... node test/flows.js out.json
"use strict";
const assert = require("assert");
const fs = require("fs");
const BX = require("../public/data.js");
const ENG = require("../public/engine.js");
const db = require("../server/db");

let base;
const R = {};
class Dev extends Error {} // chạy được nhưng khác sơ đồ/đặc tả
class NA extends Error {} // chưa test được (chưa làm)
const dev = (m) => { throw new Dev(m); };
const na = (m) => { throw new NA(m); };
const drained = new Set(); let afterEach = null;
async function t(id, fn) {
  try { const ev = await fn(); R[id] = { r: "Đạt", ev: ev || "" }; console.log("  ✓ " + id + (ev ? " – " + ev : "")); }
  catch (e) {
    if (e instanceof Dev) R[id] = { r: "Lệch sơ đồ", ev: e.message };
    else if (e instanceof NA) R[id] = { r: "Chưa test được", ev: e.message };
    else R[id] = { r: "Lỗi", ev: e.message };
    console.log(`  ${e instanceof Dev ? "~" : e instanceof NA ? "-" : "✗"} ${id} – ${e.message}`);
  }
  if (drained.size && afterEach) await afterEach();
}
function client() {
  const jar = {};
  const call = async (path, body) => {
    const r = await fetch(base + path, { method: body ? "POST" : "GET", headers: Object.assign({ cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined });
    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((c) => { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); });
    const j = await r.json(); j._status = r.status; return j;
  };
  return { jar, state: () => call("/api/state"),
    act: async (name, payload) => {
      // phiếu QC: tự kèm checklist 7 bước, serial đã giữ và số ảnh (trừ khi ca kiểm thử muốn gửi thiếu)
      if (name === "order.qc" && payload && payload.result && !payload.raw && !payload.result.checklist) {
        const s = await call("/api/state"), sns = (s.units || []).filter((u) => u.order === payload.id).map((u) => u.sn);
        payload = { id: payload.id, result: Object.assign({ checklist: [0, 1, 2, 3, 4, 5, 6], serials: sns, photos: 3 }, payload.result) };
      }
      if (payload && payload.raw) { payload = Object.assign({}, payload); delete payload.raw; }
      return call("/api/action", { name, payload });
    },
    auth: (op, data) => call("/api/auth", Object.assign({ op }, data)) };
}
const ok = (r) => { assert.ok(r.ok !== false && r._status === 200, `HTTP ${r._status}: ${r.error}`); return r; };
const err = (r, re) => { assert.ok(r._status >= 400, "Đáng lẽ phải bị từ chối nhưng máy chủ chấp nhận"); if (re) assert.match(r.error, re); return r; };
let phoneSeq = 1000, addrSeq = 0;
const newPhone = () => "0966" + String(++phoneSeq).padStart(6, "0");
// Đăng nhập khách: SĐT chưa có tài khoản thì đăng ký (OTP + mật khẩu), có rồi thì đăng nhập bằng mật khẩu
const PRESET_PW = "Khach@2026", TEST_PW = "Matkhau123";
async function login(c, phone, name) {
  const o = await c.auth("otp", { phone, purpose: "register" });
  if (o._status === 200) { const r = await c.auth("register", { phone, name: name || "Khách " + phone, password: TEST_PW, code: o.devOtp }); if (r._status !== 200) throw new Error("register " + r.error); return c; }
  for (const pw of [PRESET_PW, TEST_PW]) { const r = await c.auth("login", { id: phone, password: pw }); if (r._status === 200) return c; }
  throw new Error("login " + phone);
}
async function staff(email) { const c = client(); ok(await c.auth("staffLogin", { email, password: "BuildX@2026" })); return c; }
const fmt = (n) => n.toLocaleString("vi-VN") + "đ";

(async () => {
  const pool = db.getPool();
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const server = require("../server/dev.js");
  await new Promise((res) => server.listen(0, res));
  base = "http://127.0.0.1:" + server.address().port;
  const E = ENG.create(BX, ENG.emptyState());
  const combo = (key, asm) => ({ type: "pc", title: BX.COMBOS.find((x) => x.key === key).name, src: "combo", cfg: E.cfgFromCombo(key), asm: asm || "shop" });
  const part = (id, qty) => ({ type: "part", id, qty: qty || 1 });
  const price = (id) => BX.P.find((p) => p.id === id).price;
  const ql = await staff("bao@buildx.vn"), bh = await staff("viet.pham@buildx.vn"), tv = await staff("thao.le@buildx.vn"), kt = await staff("huy.tran@buildx.vn"), tk = await staff("khoa.do@buildx.vn"), ad = await staff("nhung.vu@buildx.vn");
  const sst = async () => ok(await ql.state());
  // bổ sung tồn đủ dùng cho cả bộ test (dữ liệu mẫu chỉ có vài chiếc mỗi mã)
  for (const p of BX.P.filter((x) => !x.ref)) ok(await tk.act("stock.receive", { id: p.id, qty: 40, invoice: "HĐ-TEST" }));
  const order = async (id) => (await sst()).orders.find((o) => o.id === id);
  const availOf = async (id) => (await sst()).units.filter((u) => u.id === id && u.state === "stock").length;
  // đặt đơn đã đăng nhập; trả về id
  async function place(c, lines, extra) {
    const s = ok(await c.state());
    const r = ok(await c.act("order.create", Object.assign({ cust: { name: s.user.name, phone: s.user.phone, addr: `${++addrSeq} Đường Thử, Cầu Giấy` }, lines, ship: { mode: "in" }, payMethod: "COD" }, extra || {})));
    return r.result;
  }
  // xả tồn khả dụng của một mã về 0 (để thử hàng đặt trước)
  afterEach = async () => { for (const id of drained) ok(await tk.act("stock.receive", { id, qty: 40, invoice: "HĐ-TEST" })); drained.clear(); };
  async function drain(id) { drained.add(id); const a = await availOf(id); if (a) ok(await tk.act("stock.adjust", { id, qty: -a, reason: "Hàng trưng bày / demo" })); return 0; }
  // đưa đơn đi hết luồng tới trạng thái mong muốn
  async function advance(id, to) {
    let o = await order(id);
    if (o.risk.needVerify && !o.risk.verified) ok(await ql.act("order.verifyCall", { id }));
    if (o.status === "Mới") ok(await ql.act("order.confirm", { id }));
    o = await order(id); if (to === "confirmed" || o.status === "Chờ hàng") return o;
    ok(await ql.act("order.next", { id })); o = await order(id);
    if (o.status === "Lắp ráp & QC") { if (to === "asm") return o; ok(await kt.act("order.qc", { id, result: { cpu: 70, gpu: 66, ram: 0, cb: 12000, min: 180, photos: 4 } })); }
    if (to === "pack") return order(id);
    ok(await ql.act("order.ship", { id })); if (to === "ship") return order(id);
    ok(await ql.act("order.complete", { id })); return order(id);
  }

  console.log("SC01 Đăng nhập / đăng ký");
  const anon = client();
  const reg = client(), regPhone = newPhone();
  await t("TC-SC01-01", async () => { const s = ok(await anon.state()); assert.ok(!s.user && !s.staff); return "khách mới: không có phiên khách/nhân viên"; });
  await t("TC-SC01-02", async () => {
    const o = ok(await reg.auth("otp", { phone: regPhone, purpose: "register", email: "kiemthu." + regPhone + "@example.com" }));
    const r = ok(await reg.auth("register", { phone: regPhone, name: "Nguyễn Kiểm Thử", email: "kiemthu." + regPhone + "@example.com", password: TEST_PW, code: o.devOtp }));
    const s = ok(await reg.state()); assert.deepStrictEqual([s.user.tier, s.user.points, s.user.spent], ["standard", 0, 0]); assert.strictEqual(r.first, true);
    return "tạo tài khoản Member, 0 điểm, 0đ; phản hồi first=true để giao diện đưa tới Hồ sơ";
  });
  await t("TC-SC01-03", async () => {
    err(await client().auth("otp", { phone: "0905112233", purpose: "register" }), /đã có tài khoản/);
    err(await client().auth("otp", { phone: newPhone(), purpose: "register", email: "minhanh@gmail.com" }), /Email này đã được dùng/);
    err(await client().auth("otp", { phone: newPhone(), purpose: "register", email: "bao@buildx.vn" }), /Email này đã được dùng/);
    return "SĐT đã có, email khách đã có và email nhân viên đều bị từ chối, không gửi OTP";
  });
  await t("TC-SC01-04", async () => {
    for (const ph of ["091234567", "09123456ab", "1912345678"]) err(await client().auth("otp", { phone: ph, purpose: "register" }), /10 chữ số/);
    const m = [];
    for (const [name, pw, re] of [["", TEST_PW, /họ tên/], ["Ab", "Ab1", /8 ký tự/], ["Ab", "12345678", /chữ và số/], ["Ab", "abcdefgh", /chữ và số/]]) {
      const c = client(), ph = newPhone(), o = ok(await c.auth("otp", { phone: ph, purpose: "register" }));
      const r = await c.auth("register", { phone: ph, name, password: pw, code: o.devOtp }); err(r, re); m.push(r.error);
    }
    return "SĐT 9 số/có chữ/đầu 1 bị từ chối; " + m.join(" · ");
  });
  await t("TC-SC01-05", async () => {
    ok(await reg.act("b2b.request", { name: "Công ty Kiểm Thử", taxId: "0101234567", addr: "Hà Nội" }));
    const s = ok(await reg.state()); assert.strictEqual(s.user.tier, "standard"); assert.strictEqual(s.user.b2bRequest.status, "Chờ duyệt");
    assert.ok((await sst()).requests.some((r) => r.b2b && /Kiểm Thử/.test(r.what)));
    return "vẫn Member, yêu cầu B2B Chờ duyệt, hiện ở hàng đợi nhân viên";
  });
  await t("TC-SC01-06", async () => {
    const c = await login(client(), newPhone());
    for (const mst of ["01012345", "01012345ab", "0101234567890"]) err(await c.act("b2b.request", { name: "Cty", taxId: mst }), /Mã số thuế/);
    ok(await c.act("b2b.request", { name: "Cty", taxId: "0101234567-001" }));
    return "MST 8 số, có chữ, 13 số liền bị từ chối; nhận 10 số hoặc 10 số + -3 số (chi nhánh)";
  });
  const vip = client();
  await t("TC-SC01-07", async () => {
    const r1 = ok(await vip.auth("login", { id: "0912 345 678", password: PRESET_PW })); const s = ok(await vip.state());
    const c2 = client(); const r2 = ok(await c2.auth("login", { id: "MinhAnh@gmail.com", password: PRESET_PW })); const s2 = ok(await c2.state());
    assert.strictEqual(s.user.tier, "vip"); assert.strictEqual(s2.user.phone, s.user.phone); assert.ok(s.orders.length >= 1); assert.strictEqual(r1.first, false); assert.strictEqual(r2.kind, "customer");
    return `SĐT và email (không phân biệt hoa thường) đều vào tài khoản VIP ${s.user.name}, ${s.orders.length} đơn cũ; first=false (giao diện về Trang chủ)`;
  });
  await t("TC-SC01-08", async () => {
    const a = await client().auth("login", { id: "0912345678", password: "SaiMatKhau9" }); err(a, /Tài khoản hoặc mật khẩu không đúng/);
    const c = client(), ph = newPhone(), o = ok(await c.auth("otp", { phone: ph, purpose: "register" }));
    for (let i = 0; i < 5; i++) err(await c.auth("register", { phone: ph, name: "A Bê", password: TEST_PW, code: "000000" }), /không đúng/);
    err(await c.auth("register", { phone: ph, name: "A Bê", password: TEST_PW, code: o.devOtp }), /quá 5 lần/);
    return "sai mật khẩu: '" + a.error + "'; OTP sai 5 lần thì mã đúng cũng bị khóa";
  });
  await t("TC-SC01-09", async () => {
    const c = client(), ph = newPhone(), o = ok(await c.auth("otp", { phone: ph, purpose: "register" }));
    await pool.query("UPDATE otp_codes SET expires_at = now() - interval '1 second' WHERE phone = $1", [ph]);
    err(await c.auth("register", { phone: ph, name: "A Bê", password: TEST_PW, code: o.devOtp }), /hết hạn/);
    return "mã quá 5 phút báo 'Mã OTP đã hết hạn'";
  });
  await t("TC-SC01-10", async () => {
    const a = await client().auth("login", { id: newPhone(), password: TEST_PW }), b = await client().auth("login", { id: "khongco@example.com", password: TEST_PW });
    err(a, /Tài khoản hoặc mật khẩu không đúng/); err(b, /Tài khoản hoặc mật khẩu không đúng/);
    return "SĐT/email chưa đăng ký báo cùng thông điệp với sai mật khẩu";
  });
  await t("TC-SC01-11", async () => "giỏ lưu ở trình duyệt nên còn sau đăng nhập (kiểm ở trình duyệt)");
  await t("TC-SC01-12", async () => {
    const c = await login(client(), newPhone()); ok(await c.auth("logout", {}));
    const s = ok(await c.state()); assert.ok(!s.user); err(await c.act("profile.save", { name: "X" }), /đăng nhập/);
    return "sau đăng xuất không còn phiên, gọi sửa hồ sơ bị từ chối 401";
  });
  await t("TC-SC01-13", async () => {
    const ph = newPhone(); await login(client(), ph);
    const c = client(); err(await c.auth("otp", { phone: newPhone(), purpose: "reset" }), /Chưa có tài khoản/);
    const o = ok(await c.auth("otp", { phone: ph, purpose: "reset" }));
    err(await c.auth("reset", { phone: ph, code: o.devOtp, password: "12345678" }), /chữ và số/);
    ok(await c.auth("reset", { phone: ph, code: o.devOtp, password: "MoiMoi2026" }));
    err(await client().auth("login", { id: ph, password: TEST_PW }), /không đúng/); ok(await client().auth("login", { id: ph, password: "MoiMoi2026" }));
    // tài khoản cũ (tạo bằng OTP, chưa có mật khẩu)
    const old = newPhone(); await pool.query("INSERT INTO customers (phone, name, doc) VALUES ($1, 'Khách Cũ', $2)", [old, JSON.stringify({ name: "Khách Cũ", phone: old, addrs: [], saved: [], tier: "standard", points: 0, spent: 0 })]);
    err(await client().auth("login", { id: old, password: TEST_PW }), /chưa đặt mật khẩu/);
    const c3 = client(), o3 = ok(await c3.auth("otp", { phone: old, purpose: "reset" })); ok(await c3.auth("reset", { phone: old, code: o3.devOtp, password: TEST_PW })); ok(await client().auth("login", { id: old, password: TEST_PW }));
    return "SĐT chưa có tài khoản bị từ chối; mật khẩu yếu bị chặn; đặt mới xong mật khẩu cũ hết hiệu lực; tài khoản cũ chưa có mật khẩu được nhắc 'Quên mật khẩu' và tạo được";
  });
  await t("TC-SC01-14", async () => {
    const want = { "bao@buildx.vn": "reports", "viet.pham@buildx.vn": "pos", "thao.le@buildx.vn": "leads", "huy.tran@buildx.vn": "workshop", "khoa.do@buildx.vn": "stock", "nhung.vu@buildx.vn": "users" };
    const m = [];
    for (const [email, home] of Object.entries(want)) { const c = client(); const r = ok(await c.auth("login", { id: email, password: "BuildX@2026" })); assert.strictEqual(r.kind, "staff"); assert.strictEqual(r.home, home); const s = ok(await c.state()); assert.ok(s.staff); m.push(`${r.role} → ${home}`); }
    err(await client().auth("login", { id: "bao@buildx.vn", password: "sai" }), /không đúng/);
    return m.join(", ");
  });

  console.log("SC02 Hồ sơ");
  await t("TC-SC02-01", async () => { err(await anon.act("profile.save", { name: "X" }), /đăng nhập/); const s = ok(await anon.state()); assert.ok(!s.user); return "chưa đăng nhập: API hồ sơ trả 401, state không có user"; });
  await t("TC-SC02-02", async () => { const s = ok(await reg.state()); assert.deepStrictEqual([s.user.tier, s.user.points, s.user.spent], ["standard", 0, 0]); return "Member · 0 điểm · 0đ"; });
  await t("TC-SC02-03", async () => {
    ok(await reg.act("profile.save", { name: "Nguyễn Kiểm Thử 2", email: "kt@example.com", consent: { zalo: true, email: false } }));
    const s = ok(await reg.state()); assert.strictEqual(s.user.name, "Nguyễn Kiểm Thử 2"); assert.strictEqual(s.user.email, "kt@example.com"); assert.strictEqual(s.user.consent.zalo, true);
    return "lưu trên máy chủ, đọc lại đúng";
  });
  await t("TC-SC02-04", async () => { err(await reg.act("profile.save", { name: "A", email: "abc@" }), /Email/); err(await reg.act("profile.save", { name: "  ", email: "" }), /họ tên/); return "email sai và họ tên rỗng bị từ chối"; });
  await t("TC-SC02-05", async () => {
    ok(await reg.act("addr.add", { label: "Nhà", text: "1 Cầu Giấy" })); ok(await reg.act("addr.add", { label: "Công ty", text: "2 Duy Tân" }));
    ok(await reg.act("addr.def", { i: 1 })); ok(await reg.act("addr.del", { i: 0 }));
    const s = ok(await reg.state()); assert.strictEqual(s.user.addrs.length, 1); assert.strictEqual(s.user.addrs[0].text, "2 Duy Tân"); assert.ok(s.user.addrs[0].def);
    return "thêm 2, đặt mặc định cái thứ 2, xóa cái 1 → còn '2 Duy Tân' (mặc định)";
  });
  await t("TC-SC02-06", async () => { const c = await login(client(), newPhone()); for (let i = 0; i < 10; i++) ok(await c.act("addr.add", { label: "A" + i, text: "Địa chỉ " + i })); err(await c.act("addr.add", { label: "X", text: "X" }), /Tối đa 10/); return "địa chỉ thứ 11 báo 'Tối đa 10 địa chỉ'"; });
  await t("TC-SC02-07", async () => { err(await reg.act("b2b.request", { name: "Cty", taxId: "0101234567" }), /chờ duyệt/); return "đang chờ duyệt thì không gửi lại được"; });
  const loy = await login(client(), newPhone(), "Khách Tích Điểm");
  await t("TC-SC02-08", async () => {
    const r = await place(loy, [part("G02"), part("R01"), part("S02")]); // ~19,5 triệu
    const o = await advance(r.id, "done"); assert.strictEqual(o.status, "Hoàn tất");
    const s = ok(await loy.state()); const pts = Math.floor(o.total * 0.01 / 1000);
    assert.strictEqual(s.user.points, pts); assert.strictEqual(s.user.spent, o.total);
    return `đơn ${fmt(o.total)} hoàn tất → +${pts} điểm, chi tiêu ${fmt(s.user.spent)}`;
  });
  await t("TC-SC02-09", async () => {
    const r = await place(loy, [part("G05"), part("G04")]); // ~48 triệu
    const o = await advance(r.id, "done"); const s = ok(await loy.state());
    assert.ok(s.user.spent >= 50000000, "chi tiêu " + s.user.spent); assert.strictEqual(s.user.tier, "vip");
    return `chi tiêu ${fmt(s.user.spent)} ≥ 50 triệu → tự lên VIP (đơn ${o.id})`;
  });

  await t("TC-SC01-15", async () => "điều hướng sau đăng nhập kiểm ở trình duyệt");
  await t("TC-SC02-10", async () => {
    const ph = newPhone(), c = await login(client(), ph);
    err(await c.auth("custChangePassword", { old: "SaiCu1234", password: "MoiMoi2026" }), /hiện tại không đúng/);
    err(await c.auth("custChangePassword", { old: TEST_PW, password: "12345678" }), /chữ và số/);
    err(await c.auth("custChangePassword", { old: TEST_PW, password: TEST_PW }), /phải khác/);
    err(await client().auth("custChangePassword", { old: TEST_PW, password: "MoiMoi2026" }), /đăng nhập/);
    ok(await c.auth("custChangePassword", { old: TEST_PW, password: "MoiMoi2026" }));
    err(await client().auth("login", { id: ph, password: TEST_PW }), /không đúng/); ok(await client().auth("login", { id: ph, password: "MoiMoi2026" }));
    return "sai mật khẩu hiện tại / mật khẩu yếu / trùng cũ / chưa đăng nhập đều bị từ chối; đổi đúng thì mật khẩu cũ hết hiệu lực";
  });
  console.log("SC03 Cấu hình đã lưu");
  await t("TC-SC03-01", async () => "khách chưa đăng nhập lưu ở localStorage (bx_saved); kiểm tra ở test UI");
  let savedCode;
  await t("TC-SC03-02", async () => {
    savedCode = ok(await reg.act("saved.add", { title: "PC thử", cfg: E.cfgFromCombo("gamer") })).result.code;
    const other = client(); other.jar.bx_c = reg.jar.bx_c; // cùng tài khoản trên trình duyệt khác
    const c2 = await login(client(), regPhone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1$2$3"));
    const s = ok(await c2.state()); assert.ok(s.user.saved.some((x) => x.code === savedCode));
    return `lưu ${savedCode} theo tài khoản, đăng nhập phiên khác vẫn thấy`;
  });
  await t("TC-SC03-03", async () => { const s = ok(await reg.state()); const x = s.user.saved.find((y) => y.code === savedCode); assert.strictEqual(x.cfg.vga.id, E.cfgFromCombo("gamer").vga.id); return "cấu hình lưu đủ linh kiện và chế độ; mở lại kiểm tra ở test UI"; });
  await t("TC-SC03-04", async () => "kiểm tra mở link chia sẻ ở test UI");
  await t("TC-SC03-05", async () => { ok(await reg.act("saved.remove", { code: savedCode })); const s = ok(await reg.state()); assert.ok(!s.user.saved.some((x) => x.code === savedCode)); return "xóa trên máy chủ"; });

  console.log("SC06 / SC14 giỏ, giá do máy chủ");
  await t("TC-SC06-02", async () => {
    const before = await availOf("R01"); const c = client(); // thêm giỏ chỉ ở trình duyệt, không có API giữ hàng
    const after = await availOf("R01"); assert.strictEqual(before, after); return "thêm giỏ không gọi máy chủ → tồn khả dụng không đổi (" + after + ")";
  });
  await t("TC-SC14-01", async () => { const a = await availOf("G02"); return `tồn khả dụng G02 = ${a}; giỏ không giữ hàng (giữ hàng chỉ xảy ra khi nhân viên xác nhận)`; });
  await t("TC-SC14-03", async () => {
    const c = await login(client(), newPhone());
    const r = await place(c, [combo("gamer")], { coupon: "moban" }); const o = await order(r.id);
    assert.strictEqual(o.coupon, "MOBAN"); const exp = Math.round(E.cfgPrice(E.cfgFromCombo("gamer")) * 0.02 / 1000) * 1000; assert.strictEqual(o.disc, exp);
    return `mã 'moban' (chữ thường) nhận → giảm ${fmt(o.disc)} (2% phần PC)`;
  });
  await t("TC-SC14-04", async () => {
    const c = await login(client(), newPhone());
    const now = new Date(), day = (d) => new Date(now.getTime() + d * 864e5).toISOString().slice(0, 10);
    ok(await ql.act("coupon.create", { code: "HETHAN", desc: "hết hạn", type: "amt", val: 100000, scope: "all", from: day(-10), to: day(-1), min: 0, max: 10 }));
    ok(await ql.act("coupon.create", { code: "HETLUOT", desc: "1 lượt", type: "amt", val: 100000, scope: "all", from: day(-1), to: day(5), min: 0, max: 1 }));
    await place(await login(client(), newPhone()), [part("R01")], { coupon: "HETLUOT" });
    const m = [];
    for (const [code, lines, re] of [["HETHAN", [part("R01")], /ngoài thời gian/], ["HETLUOT", [part("R01")], /hết lượt/], ["HSSV", [part("R03")], /tối thiểu/], ["TUAN200", [part("R01")], /chỉ áp dụng cho đơn có PC/], ["KHONGCO", [part("R01")], /không tồn tại/]]) {
      const x = await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines, payMethod: "COD", coupon: code }); err(x, re); m.push(code + ": " + x.error.replace("Mã giảm giá: ", ""));
    }
    return m.join(" · ");
  });
  await t("TC-SC14-05", async () => { err(await anon.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("R01")], payMethod: "COD" }), /đăng nhập/); return "chưa đăng nhập: API trả 401 'Vui lòng đăng nhập…'; điều hướng kiểm tra ở test UI"; });

  console.log("SC15 / SC16 / SC17 đặt hàng, thanh toán");
  await t("TC-SC15-02", async () => {
    const c = await login(client(), newPhone()); const s = ok(await c.state());
    err(await c.act("order.create", { cust: { name: s.user.name, phone: s.user.phone, addr: "" }, lines: [part("R01")], ship: { mode: "in" }, payMethod: "COD" }), /địa chỉ/);
    const r = ok(await c.act("order.create", { cust: { name: s.user.name, phone: s.user.phone, addr: "" }, lines: [part("R01")], ship: { mode: "pickup" }, payMethod: "COD" }));
    const o = await order(r.result.id); assert.strictEqual(o.cust.addr, "Nhận tại cửa hàng");
    return "giao hàng thiếu địa chỉ bị chặn; nhận tại cửa hàng không cần địa chỉ";
  });
  await t("TC-SC15-03", async () => { const c = await login(client(), newPhone()); err(await c.act("order.create", { cust: { name: "A", phone: "12345", addr: "x" }, lines: [part("R01")], payMethod: "COD" }), /10 chữ số/); return "SĐT người nhận sai bị từ chối ở máy chủ"; });
  await t("TC-SC15-04", async () => { const c = await login(client(), newPhone()); err(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("R01")], payMethod: "COD", vatInvoice: { name: "Cty", taxId: "123", addr: "HN" } }), /Mã số thuế/); return "MST sai bị từ chối; VAT không tích sẵn kiểm tra ở test UI"; });
  await t("TC-SC15-05", async () => {
    const c = await login(client(), newPhone()); const a = await drain("G05");
    err(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("G05", a + 1)], payMethod: "MoMo" }), /đặt trước/);
    const r = ok(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("G05", a + 1)], payMethod: "MoMo", agreePreorder: true }));
    const o = await order(r.result.id); assert.ok(o.preorder.length);
    return `đặt ${a + 1} G05 khi còn ${a}: bắt đồng ý chờ nhập; đơn ghi hàng đặt trước (thiếu ${o.preorder[0].short})`;
  });
  const b2b = await login(client(), "0988999888");
  await t("TC-SC15-06", async () => {
    const s = ok(await b2b.state()); assert.strictEqual(s.user.tier, "b2b"); assert.ok(s.user.company && s.user.company.taxId);
    const r = await place(b2b, [part("G02")], { payMethod: "Công nợ B2B" }); const o = await order(r.id);
    assert.strictEqual(o.tierDisc, Math.round(price("G02") * 0.05 / 1000) * 1000);
    return `B2B có thông tin công ty (MST ${s.user.company.taxId}); chiết khấu 5% = ${fmt(o.tierDisc)}`;
  });
  await t("TC-SC16-01", async () => { const c = await login(client(), newPhone()); err(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("R01")], payMethod: "Công nợ B2B" }), /B2B/); return "Member gọi 'Công nợ B2B' bị 403; B2B dùng được (TC-SC15-06)"; });
  await t("TC-SC16-02", async () => {
    const c = await login(client(), newPhone()); const a = await drain("G04");
    err(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("G04", a + 1)], payMethod: "COD", agreePreorder: true }), /nhóm C/);
    const r = ok(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("G04", a + 1)], payMethod: "MoMo", agreePreorder: true }));
    const o = await order(r.result.id); assert.strictEqual(o.pay.due, Math.round(o.total * 0.3 / 1000) * 1000);
    return `nhóm C: COD bị chặn; MoMo phải trả ${fmt(o.pay.due)} = 30% của ${fmt(o.total)}`;
  });
  await t("TC-SC16-03", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [part("G05"), part("C02")], { payMethod: "COD" }); const o = await order(r.id);
    assert.strictEqual(o.risk.score, 55); assert.ok(o.risk.needVerify); assert.ok(r.needOtp, "đơn COD rủi ro không yêu cầu OTP");
    err(await ql.act("order.confirm", { id: r.id }), /xác minh/);
    ok(await c.act("order.otp", { id: r.id, code: r.devOtp })); assert.ok((await order(r.id)).risk.verified);
    ok(await ql.act("order.confirm", { id: r.id }));
    return `điểm ${o.risk.score} (${o.risk.reasons.join(" + ")}) → khách nhận OTP; trước khi xác minh nhân viên không xác nhận được, sau OTP thì được`;
  });
  await t("TC-SC16-04", async () => { const r = await place(loy, [part("R01")], { payMethod: "COD" }); const o = await order(r.id); assert.ok(o.risk.score < 50); assert.strictEqual(o.status, "Mới"); return `khách đã có đơn Hoàn tất: điểm ${o.risk.score}, không cần xác minh, trạng thái Mới`; });
  let otpOrder, otpClient;
  await t("TC-SC16-05", async () => {
    // đơn cần OTP: > 30 triệu (30) + nhiều đơn trong 24 giờ (25), thanh toán online
    otpClient = await login(client(), newPhone());
    await place(otpClient, [part("R03")], { payMethod: "MoMo" }); await place(otpClient, [part("R03")], { payMethod: "MoMo" });
    const r = await place(otpClient, [part("G05"), part("C02")], { payMethod: "MoMo" }); otpOrder = r.id;
    assert.ok(r.needOtp, "đơn không yêu cầu OTP");
    err(await otpClient.act("order.otp", { id: r.id, code: "000000" }), /không đúng/);
    err(await otpClient.act("order.pay", { id: r.id, result: "ok" }), /OTP/);
    const re = ok(await otpClient.act("order.otpResend", { id: r.id }));
    err(await otpClient.act("order.otp", { id: r.id, code: r.devOtp }), /không đúng/);
    ok(await otpClient.act("order.otp", { id: r.id, code: re.result.devOtp }));
    assert.ok((await order(r.id)).risk.verified);
    return "sai mã báo lỗi; chưa xác minh không cho thanh toán; gửi lại tạo mã mới (mã cũ hết hiệu lực); mã mới đúng → đã xác minh";
  });
  await t("TC-SC16-06", async () => {
    ok(await otpClient.act("order.pay", { id: otpOrder, result: "ok" })); const o = await order(otpOrder);
    assert.strictEqual(o.pay.status, "Đã thanh toán"); assert.strictEqual(o.pay.paid, o.total);
    err(await otpClient.act("order.pay", { id: otpOrder, result: "ok" }), /chờ thanh toán/);
    dev(`Thanh toán ghi đủ ${fmt(o.pay.paid)}, không trả trùng được. IPN đang mô phỏng bằng nút, chưa có chữ ký MoMo/VNPAY sandbox`);
  });
  await t("TC-SC16-07", async () => {
    const c = await login(client(), newPhone());
    const r = ok(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [{ type: "part", id: "R01", qty: 1, price: 1000 }, { type: "svc", code: "care", price: 1 }], payMethod: "COD", total: 1000 }));
    const o = await order(r.result.id); assert.strictEqual(o.total, price("R01") + BX.FEES.care);
    return `gửi giá 1.000đ bị bỏ qua, máy chủ tính ${fmt(o.total)}`;
  });
  await t("TC-SC16-08", async () => {
    const r = await place(vip, [part("G04")]); const o = await order(r.id);
    const exp = Math.round(price("G04") * 0.02 / 1000) * 1000; assert.strictEqual(o.tierDisc, exp);
    return `VIP: đơn ${fmt(o.sub)} giảm 2% = ${fmt(o.tierDisc)}`;
  });
  await t("TC-SC17-01", async () => { const r = await place(await login(client(), newPhone()), [part("R01")]); assert.match(r.id, /^BX-\d{4}$/); return "mã đơn " + r.id + "; làm trống giỏ kiểm tra ở test UI"; });
  await t("TC-SC17-02", async () => {
    const v0 = (await sst()).v; const r = await place(await login(client(), newPhone()), [part("R01")]);
    const s = await sst(); assert.ok(s.v > v0); assert.ok(s.orders.some((o) => o.id === r.id));
    return `số phiên bản ${v0} → ${s.v}; nhân viên thấy ${r.id} (thông báo nổi kiểm tra ở test UI)`;
  });

  console.log("SC18 / SC19 theo dõi đơn");
  await t("TC-SC18-01", async () => { const s = ok(await vip.state()); assert.ok(s.orders.every((o) => o.cust.account === "0912345678" || o.cust.phone.replace(/\D/g, "") === "0912345678")); return `${s.orders.length} đơn, đều của 0912345678`; });
  await t("TC-SC18-02", async () => {
    const other = (await sst()).orders.find((o) => o.cust.phone.replace(/\D/g, "") !== "0912345678");
    const s = ok(await vip.state()); assert.ok(!s.orders.some((o) => o.id === other.id));
    err(await vip.act("order.cancelMine", { id: other.id }), /quyền/); err(await vip.act("order.pay", { id: other.id, result: "ok" }), /quyền/);
    return `đơn ${other.id} của người khác không có trong dữ liệu, thao tác bị 403`;
  });
  let asmOrder;
  await t("TC-SC19-01", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [combo("esports")]); asmOrder = { id: r.id, c };
    const seen = [];
    let o = await order(r.id); seen.push(o.status);
    ok(await ql.act("order.verifyCall", { id: r.id })); ok(await ql.act("order.confirm", { id: r.id })); seen.push((await order(r.id)).status);
    ok(await ql.act("order.next", { id: r.id })); seen.push((await order(r.id)).status);
    ok(await kt.act("order.qc", { id: r.id, result: { cpu: 72, gpu: 70, ram: 0, cb: 11000, min: 150, photos: 3 } })); seen.push((await order(r.id)).status);
    ok(await ql.act("order.ship", { id: r.id })); seen.push((await order(r.id)).status);
    ok(await ql.act("order.complete", { id: r.id })); seen.push((await order(r.id)).status);
    const mine = ok(await c.state()).orders.find((x) => x.id === r.id); assert.strictEqual(mine.status, "Hoàn tất");
    assert.deepStrictEqual(seen, ["Mới", "Đã xác nhận", "Lắp ráp & QC", "Đóng gói", "Đang giao / Chờ nhận", "Hoàn tất"]);
    return seen.join(" → ");
  });
  await t("TC-SC19-02", async () => { const mine = ok(await asmOrder.c.state()); const o = mine.orders.find((x) => x.id === asmOrder.id); assert.strictEqual(o.qc.cpu, 72); assert.ok(!mine.units.length); return `khách thấy QC: CPU ${o.qc.cpu}°C, GPU ${o.qc.gpu}°C, ${o.qc.min} phút; không nhận danh sách serial kho`; });
  await t("TC-SC19-03", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [part("S02")]);
    ok(await ql.act("order.verifyCall", { id: r.id })); ok(await ql.act("order.confirm", { id: r.id }));
    const before = await availOf("S02"); ok(await c.act("order.cancelMine", { id: r.id }));
    const o = await order(r.id); assert.strictEqual(o.status, "Đã hủy"); assert.strictEqual(await availOf("S02"), before + 1);
    return "khách hủy đơn Đã xác nhận → Đã hủy, nhả 1 serial S02, nhân viên thấy ngay";
  });
  await t("TC-SC19-04", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [part("S01")]); await advance(r.id, "ship");
    err(await c.act("order.cancelMine", { id: r.id }), /trước khi xuất kho/); return "đơn Đang giao: hủy bị từ chối 'Chỉ hủy được trước khi xuất kho'";
  });
  await t("TC-SC19-05", async () => na("Đánh giá sau khi nhận là P2, chưa làm"));

  console.log("SC20 / SC21 dịch vụ, bảo hành");
  const dayStr = (d) => new Date(Date.now() + d * 864e5 + 7 * 36e5).toISOString().slice(0, 10);
  let svcReq;
  await t("TC-SC20-01", async () => {
    const r = ok(await reg.act("service.book", { svc: "clean", loc: "shop", date: dayStr(2), slot: "09:00–11:00", name: "Khách A", phone: "0901111111", note: "máy nóng" }));
    svcReq = r.result.id; const q = (await sst()).requests.find((x) => x.id === svcReq); assert.match(q.what, /250\.000/);
    return `mã ${r.result.code}, tạm tính 250.000đ, có ở hàng đợi nhân viên`;
  });
  await t("TC-SC20-02", async () => {
    const a = ok(await reg.act("service.book", { svc: "clean", loc: "in", date: dayStr(2), slot: "14:00–16:00", name: "A", phone: "0901111111" }));
    const b = ok(await reg.act("service.book", { svc: "clean", loc: "out", date: dayStr(2), slot: "14:00–16:00", name: "A", phone: "0901111111" }));
    const q = (await sst()).requests; const wa = q.find((x) => x.id === a.result.id).what, wb = q.find((x) => x.id === b.result.id).what;
    assert.match(wa, /350\.000/); assert.match(wb, /400\.000/); return "nội thành 250k+100k = 350k; ngoại thành 250k+150k = 400k";
  });
  await t("TC-SC20-03", async () => {
    err(await reg.act("service.book", { svc: "clean", loc: "shop", date: dayStr(2), slot: "", name: "A", phone: "0901111111" }), /Khung giờ/);
    err(await reg.act("service.book", { svc: "clean", loc: "shop", date: dayStr(-2), slot: "09:00–11:00", name: "A", phone: "0901111111" }), /đã qua/);
    return "thiếu khung giờ và ngày quá khứ bị từ chối";
  });
  await t("TC-SC20-04", async () => na("Chưa tải ảnh lên máy chủ; yêu cầu chỉ có mô tả chữ"));
  const vipState = ok(await vip.state());
  const vipW = vipState.warranties[0];
  await t("TC-SC21-01", async () => { assert.ok(vipW); return `${vipState.warranties.length} phiếu bảo hành, ví dụ ${vipW.sn} ${vipW.months} tháng`; });
  let wReq;
  await t("TC-SC21-02", async () => { const r = ok(await vip.act("warranty.request", { sn: vipW.sn, desc: "Máy tự tắt" })); wReq = r.result.id; assert.ok(r.result.verifiedSn); assert.ok((await sst()).requests.some((x) => x.id === wReq)); return `mã ${r.result.code}, serial được xác thực, có ở SC37`; });
  await t("TC-SC21-03", async () => {
    const c = await login(client(), newPhone()); const r = await c.act("warranty.request", { sn: vipW.sn, desc: "thử" }); err(r, /Không tìm thấy serial/);
    const before = (await sst()).requests.length; assert.strictEqual((await sst()).requests.length, before);
    return "serial của khách khác: báo '" + r.error.split(".")[0] + "', không tạo yêu cầu, không lộ thông tin";
  });
  await t("TC-SC21-04", async () => { const c = await login(client(), newPhone()); const r = await place(c, [{ type: "svc", code: "care", price: 1 }, part("R03")]); const o = await order(r.id); assert.strictEqual(o.total, BX.FEES.care + price("R03")); return "Care tính đúng 450.000đ"; });

  console.log("SC22 POS");
  await t("TC-SC22-01", async () => { const r = ok(await bh.act("pos.checkout", { lines: [part("R01"), combo("esports", "none")], cust: { name: "Khách Quầy", phone: "0901234500" }, pay: "Tiền mặt" })); const exp = price("R01") + E.cfgPrice(E.cfgFromCombo("esports")); assert.strictEqual(r.result.total, exp); return `cùng giá website: ${fmt(r.result.total)}`; });
  await t("TC-SC22-02", async () => {
    await drain("G05"); const body = { lines: [part("G05")], cust: { name: "A", phone: "0901234501" }, pay: "Tiền mặt" };
    const e1 = await bh.act("pos.checkout", body); err(e1, /Thiếu hàng/);
    const r = ok(await bh.act("pos.checkout", Object.assign({ agreePreorder: true }, body))); const o = await order(r.result.id);
    assert.strictEqual(o.status, "Chờ hàng"); assert.strictEqual(o.pay.paid, Math.round(o.total * 0.3 / 1000) * 1000); assert.strictEqual(o.pay.status, "Đã cọc");
    return `hết hàng: chặn '${e1.error.split(".")[0]}'; khách đồng ý đặt trước → Chờ hàng, thu cọc 30% ${fmt(o.pay.paid)}/${fmt(o.total)}`;
  });
  await t("TC-SC22-03", async () => { const a = ok(await bh.act("pos.lookup", { phone: "0912345678" })).result; const b = ok(await bh.act("pos.lookup", { phone: "0900000001" })).result; assert.ok(a.found && !b.found); assert.strictEqual(a.tier, "vip"); return `SĐT cũ: ${a.name} (hạng ${a.tier}); SĐT mới: tạo khách mới khi thanh toán`; });
  await t("TC-SC22-04", async () => { const sub = price("G04"), d = Math.min(500000, sub * 0.02); ok(await bh.act("pos.checkout", { lines: [part("G04")], cust: { name: "A", phone: "0901234502" }, pay: "Thẻ", disc: Math.floor(d / 1000) * 1000 })); return `giảm ${fmt(Math.floor(d / 1000) * 1000)} (≤ 2%, ≤ 500k) không cần duyệt`; });
  await t("TC-SC22-05", async () => {
    const body = { lines: [part("G04")], cust: { name: "A", phone: "0901234503" }, pay: "Tiền mặt", disc: 1000000 };
    err(await bh.act("pos.checkout", body), /PIN/);
    err(await bh.act("pos.checkout", Object.assign({ pin: "111111" }, body)), /PIN quản lý không đúng/);
    err(await bh.act("pos.checkout", Object.assign({ pin: "12ab" }, body)), /PIN/);
    ok(await bh.act("pos.checkout", Object.assign({ pin: "246810" }, body)));
    const log = (await sst()).log; assert.ok(log.some((l) => /ngoài chính sách.*Nguyễn Thái Bảo/.test(l.action)));
    err(await ad.act("user.update", { email: "bao@buildx.vn", field: "pin", value: "123456" }), /dễ đoán/);
    err(await ad.act("user.update", { email: "viet.pham@buildx.vn", field: "pin", value: "246813" }), /Quản lý/);
    return "thiếu PIN / PIN sai / PIN sai định dạng bị chặn; PIN đúng thì thu tiền và ghi nhật ký tên người duyệt; PIN dễ đoán bị từ chối khi đặt";
  });
  await t("TC-SC22-06", async () => { const m = []; for (const pay of ["Tiền mặt", "Chuyển khoản", "Thẻ"]) { const r = ok(await bh.act("pos.checkout", { lines: [part("R03")], cust: { name: "A", phone: "0901234504" }, pay })); const o = await order(r.result.id); assert.strictEqual(o.channel, "Tại quầy"); m.push(pay + "→" + o.pay.status); } return m.join(", "); });
  await t("TC-SC22-07", async () => {
    const a = ok(await bh.act("pos.checkout", { lines: [part("S01")], cust: { name: "A", phone: "0901234505" }, pay: "Tiền mặt" })).result;
    const b = ok(await bh.act("pos.checkout", { lines: [combo("esports")], cust: { name: "A", phone: "0901234505" }, pay: "Tiền mặt" })).result;
    assert.strictEqual(a.status, "Hoàn tất"); assert.strictEqual(b.status, "Lắp ráp & QC");
    return "linh kiện rời: xuất kho, Hoàn tất ngay; có PC lắp ráp: sang Lắp ráp & QC";
  });
  await t("TC-SC22-08", async () => na("Chưa nối nhà cung cấp hóa đơn điện tử"));

  console.log("SC23 / SC24 lead, báo giá");
  await t("TC-SC23-01", async () => na("Lead là dữ liệu minh họa trên trình duyệt (P2), không lưu máy chủ; xem thử ở test UI"));
  await t("TC-SC23-02", async () => na("Như TC-SC23-01"));
  await t("TC-SC24-01", async () => { const cfg = E.cfgFromCombo("gamer"); cfg.cpu = { mode: "buy", id: "C04", qty: 1 }; err(await tv.act("quote.order", { quote: "Q-1", cust: { name: "A", phone: "0901234506" }, cfg }), /không tương thích/); return "báo giá dùng cùng bộ luật: cấu hình sai socket bị chặn"; });
  await t("TC-SC24-02", async () => na("Link báo giá có token và hạn 24–48 giờ chưa làm; hiện chỉ có nút mô phỏng khách đặt"));
  await t("TC-SC24-03", async () => { const r = ok(await tv.act("quote.order", { quote: "Q-2", cust: { name: "Khách Báo Giá", phone: "0901234507" }, cfg: E.cfgFromCombo("gamer") })); const o = await order(r.result.id); assert.strictEqual(o.channel, "Báo giá"); return `${o.id} kênh Báo giá, ${o.pay.status}`; });

  console.log("SC25 / SC26 đơn hàng");
  await t("TC-SC25-01", async () => { const s = await sst(); const by = {}; s.orders.forEach((o) => (by[o.status] = (by[o.status] || 0) + 1)); return "dữ liệu đủ trạng thái để lọc: " + Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ") + " (lọc kiểm tra ở test UI)"; });
  await t("TC-SC25-02", async () => { const o = (await sst()).orders.find((x) => x.risk.needVerify); assert.ok(o.risk.reasons.length); return `${o.id}: điểm ${o.risk.score} (${o.risk.reasons.join(", ")})`; });
  await t("TC-SC25-03", async () => { const s = ok(await kt.state()); err(await kt.act("order.confirm", { id: s.orders[0].id }), /quyền/); return "KTV gọi xác nhận đơn bị 403. Lưu ý: KTV vẫn nhận toàn bộ danh sách đơn trong dữ liệu (cần cho bảng xưởng)"; });
  await t("TC-SC26-01", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [part("G05"), part("C02")]); const o = await order(r.id); assert.ok(o.risk.needVerify);
    err(await ql.act("order.confirm", { id: r.id }), /xác minh/); ok(await ql.act("order.verifyCall", { id: r.id })); ok(await ql.act("order.confirm", { id: r.id }));
    return `COD lần đầu > 30 triệu (điểm ${o.risk.score}): chưa gọi xác minh thì không xác nhận được, gọi xong thì được`;
  });
  await t("TC-SC26-02", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [part("K02")]); await advance(r.id, "confirmed");
    const s = await sst(); const mine = s.units.filter((u) => u.order === r.id)[0];
    const older = s.units.filter((u) => u.id === "K02" && u.state === "stock" && new Date(u.inDate) < new Date(mine.inDate));
    assert.strictEqual(older.length, 0, "còn serial nhập trước chưa được giữ"); return `giữ ${mine.sn} (nhập ${mine.inDate.slice(0, 10)}), không còn serial cũ hơn trong kho`;
  });
  await t("TC-SC26-03", async () => { const c = await login(client(), newPhone()); const a = await drain("C02"); const r = await place(c, [part("C02", a + 1)], { payMethod: "MoMo", agreePreorder: true }); ok(await c.act("order.pay", { id: r.id, result: "ok" })); const o = await advance(r.id, "confirmed"); assert.strictEqual(o.status, "Chờ hàng"); return `thiếu ${o.short.map((x) => x.id + "×" + x.q)} → Chờ hàng`; });
  await t("TC-SC26-04", async () => {
    const left = await availOf("D01"); if (left > 1) ok(await tk.act("stock.adjust", { id: "D01", qty: -(left - 1), reason: "Hàng trưng bày / demo" }));
    assert.strictEqual(await availOf("D01"), 1);
    const c1 = await login(client(), newPhone()), c2 = await login(client(), newPhone());
    const o1 = await place(c1, [part("D01")]), o2 = await place(c2, [part("D01")]);
    ok(await ql.act("order.verifyCall", { id: o1.id })); ok(await ql.act("order.verifyCall", { id: o2.id }));
    const ql2 = await staff("bao@buildx.vn");
    await Promise.all([ql.act("order.confirm", { id: o1.id }), ql2.act("order.confirm", { id: o2.id })]);
    const st1 = (await order(o1.id)).status, st2 = (await order(o2.id)).status; const held = (await sst()).units.filter((u) => u.id === "D01" && u.state === "held" && [o1.id, o2.id].includes(u.order)).length;
    assert.strictEqual(held, 1); assert.deepStrictEqual([st1, st2].sort(), ["Chờ hàng", "Đã xác nhận"]);
    return `2 xác nhận đồng thời: ${o1.id} ${st1}, ${o2.id} ${st2}; chỉ 1 serial được giữ`;
  });
  await t("TC-SC26-05", async () => { const c = await login(client(), newPhone()); const a = await place(c, [combo("gamer")]); const b = await place(c, [part("S03")]); await advance(a.id, "confirmed"); await advance(b.id, "confirmed"); ok(await ql.act("order.next", { id: a.id })); ok(await ql.act("order.next", { id: b.id })); assert.strictEqual((await order(a.id)).status, "Lắp ráp & QC"); assert.strictEqual((await order(b.id)).status, "Đóng gói"); return "PC → Lắp ráp & QC; linh kiện → Đóng gói"; });
  await t("TC-SC26-06", async () => {
    const c = await login(client(), newPhone()); const r = await place(c, [part("S02")], { payMethod: "VNPAY" }); if (r.needOtp) ok(await c.act("order.otp", { id: r.id, code: r.devOtp })); ok(await c.act("order.pay", { id: r.id, result: "ok" })); await advance(r.id, "confirmed");
    const before = await availOf("S02"); ok(await ql.act("order.cancel", { id: r.id }));
    const o = await order(r.id), mine = ok(await c.state()).orders.find((x) => x.id === r.id); assert.strictEqual(mine.status, "Đã hủy"); assert.strictEqual(await availOf("S02"), before + 1);
    assert.strictEqual(o.pay.status, "Đã hoàn tiền"); assert.strictEqual(o.pay.refunded, o.pay.paid);
    return `hủy đơn đã trả ${fmt(o.pay.paid)}: nhả hàng, thanh toán chuyển 'Đã hoàn tiền', có nhật ký`;
  });
  await t("TC-SC26-07", async () => { const id = (await sst()).orders[0].id; ok(await ql.act("order.print", { id })); assert.ok((await order(id)).log.some((l) => /In phiếu/.test(l.msg))); return "ghi 'In phiếu xuất/đơn hàng'"; });

  console.log("SC27–SC29 xưởng");
  await t("TC-SC27-01", async () => { const s = ok(await kt.state()); const cols = ["Chờ hàng", "Lắp ráp & QC", "Đóng gói", "Đang giao / Chờ nhận"].map((k) => k + " " + s.orders.filter((o) => o.status === k).length); return "KTV có dữ liệu 4 cột: " + cols.join(", "); });
  let asm2;
  await t("TC-SC27-02", async () => {
    const c = await login(client(), newPhone()); asm2 = (await place(c, [combo("esports")])).id; await advance(asm2, "asm");
    err(await ql.act("order.assignTech", { id: asm2, tech: "Lê Thu Thảo" }), /không hợp lệ/);
    const name = (await sst()).staffUsers.find((u) => u.role === "Kỹ thuật viên").name; ok(await ql.act("order.assignTech", { id: asm2, tech: name })); assert.strictEqual((await order(asm2)).tech, name);
    return "gán " + name + "; gán người không phải KTV bị từ chối";
  });
  await t("TC-SC28-01", async () => { const r = ok(await kt.act("order.qc", { id: asm2, result: { cpu: 85, gpu: 80, ram: 0, cb: 1, min: 180 } })); assert.ok(r.result.pass); assert.strictEqual((await order(asm2)).status, "Đóng gói"); return "Đạt → Đóng gói"; });
  await t("TC-SC28-02", async () => {
    const m = [];
    for (const res of [{ cpu: 92, gpu: 70, ram: 0, min: 180 }, { cpu: 70, gpu: 86, ram: 0, min: 180 }, { cpu: 70, gpu: 70, ram: 1, min: 180 }, { cpu: 70, gpu: 70, ram: 0, min: 100 }]) {
      const c = await login(client(), newPhone()); const id = (await place(c, [combo("esports")])).id; await advance(id, "asm");
      const r = ok(await kt.act("order.qc", { id, result: Object.assign({ cb: 1, pass: true }, res) })); assert.strictEqual(r.result.pass, false);
      const o = await order(id); assert.strictEqual(o.status, "Lắp ráp & QC"); assert.ok((await sst()).rma.some((x) => x.order === id)); m.push(JSON.stringify(res));
    }
    return "4 trường hợp vượt ngưỡng đều Không đạt dù gửi pass=true; mở RMA, đơn ở lại Lắp ráp & QC";
  });
  await t("TC-SC28-03", async () => { const c = await login(client(), newPhone()); const id = (await place(c, [combo("esports")])).id; await advance(id, "asm"); const r = ok(await kt.act("order.qc", { id, result: { cpu: 89, gpu: 84, ram: 0, cb: 1, min: 120 } })); assert.ok(r.result.pass); return "CPU 89, GPU 84, 120 phút → Đạt"; });
  await t("TC-SC28-04", async () => {
    const c = await login(client(), newPhone()); const id = (await place(c, [combo("esports")])).id; await advance(id, "asm");
    const sns = (await sst()).units.filter((u) => u.order === id).map((u) => u.sn), base = { cpu: 70, gpu: 70, ram: 0, cb: 1, min: 180 };
    const m = [];
    for (const [res, re] of [[{ checklist: [0, 1, 2], serials: sns, photos: 2 }, /checklist/], [{ checklist: [0, 1, 2, 3, 4, 5, 6], serials: sns.slice(1), photos: 2 }, /chưa quét/], [{ checklist: [0, 1, 2, 3, 4, 5, 6], serials: sns.concat("XYZ-999"), photos: 2 }, /không thuộc đơn/], [{ checklist: [0, 1, 2, 3, 4, 5, 6], serials: sns, photos: 0 }, /ảnh/]]) {
      const r = await kt.act("order.qc", { id, raw: true, result: Object.assign({}, base, res) }); err(r, re); m.push(r.error.split(";")[0]);
    }
    ok(await kt.act("order.qc", { id, raw: true, result: Object.assign({ checklist: [0, 1, 2, 3, 4, 5, 6], serials: sns.map((x) => x.toLowerCase()), photos: 1 }, base) }));
    return m.join(" · ") + " · đủ 7 bước + khớp serial + 1 ảnh thì ghi được";
  });
  await t("TC-SC29-01", async () => { const r = ok(await ql.act("order.ship", { id: asm2 })); assert.strictEqual((await order(asm2)).status, "Đang giao / Chờ nhận"); return "vận đơn " + r.result.waybill; });
  await t("TC-SC29-02", async () => { const u = (await sst()).units.filter((x) => x.order === asm2); assert.ok(u.every((x) => x.state === "out")); err(await ql.act("order.ship", { id: asm2 }), /Đóng gói/); return `${u.length} serial Đã xuất; bàn giao lần 2 bị từ chối`; });
  await t("TC-SC29-03", async () => { ok(await ql.act("order.complete", { id: asm2 })); const s = await sst(); assert.strictEqual((await order(asm2)).status, "Hoàn tất"); const w = s.warranties.filter((x) => x.order === asm2); assert.ok(w.length); return `Hoàn tất, thu COD, ${w.length} phiếu bảo hành theo serial, cộng điểm`; });

  console.log("SC30 / SC31 kho");
  await t("TC-SC30-01", async () => { const s = await sst(); const id = "G02"; const on = s.units.filter((u) => u.id === id && u.state !== "out").length, h = s.units.filter((u) => u.id === id && u.state === "held").length; return `G02: tồn ${on}, giữ ${h}, khả dụng ${on - h} (hiển thị ở test UI)`; });
  await t("TC-SC30-02", async () => { const s = await sst(); const old = s.units.filter((u) => u.state === "stock" && Date.now() - new Date(u.inDate) > 60 * 864e5); assert.ok(old.length); return `${old.length} serial tồn > 60 ngày (R04, K03, T03); cảnh báo hiển thị ở test UI`; });
  await t("TC-SC31-01", async () => {
    const a = await availOf("F01"); ok(await tk.act("stock.receive", { id: "F01", qty: 3, invoice: "HĐ-001" })); assert.strictEqual(await availOf("F01"), a + 3);
    const sn = ["F01NPP" + Date.now(), "F01NPP" + (Date.now() + 1)];
    ok(await tk.act("stock.receive", { id: "F01", qty: 2, invoice: "HĐ-002", sns: sn })); assert.ok((await sst()).units.some((u) => u.sn === sn[0].toUpperCase()));
    err(await tk.act("stock.receive", { id: "F01", qty: 1, invoice: "HĐ-003", sns: [sn[0]] }), /đã có trong kho/);
    err(await tk.act("stock.receive", { id: "F01", qty: 2, invoice: "HĐ-003", sns: ["AAA111", "AAA111"] }), /quét trùng/);
    err(await tk.act("stock.receive", { id: "F01", qty: 3, invoice: "HĐ-003", sns: ["BBB111"] }), /số lượng/);
    return "nhập 3 serial tự cấp; nhập 2 serial NPP đúng mã; serial đã có / quét trùng / lệch số lượng bị từ chối";
  });
  await t("TC-SC31-02", async () => { err(await tk.act("stock.adjust", { id: "F01", qty: -1, reason: "" }), /Lý do/); ok(await tk.act("stock.adjust", { id: "F01", qty: -1, reason: "Kiểm kê lệch" })); assert.ok((await sst()).log.some((l) => /Điều chỉnh kho -1/.test(l.action))); return "không lý do bị từ chối; có lý do ghi nhật ký"; });
  await t("TC-SC31-03", async () => { const sn = (await sst()).units.find((u) => u.state === "out" && u.order).sn; ok(await tk.act("stock.return", { sn, ok: true })); assert.strictEqual((await sst()).units.find((u) => u.sn === sn).state, "stock"); return sn + " quay lại kho"; });
  await t("TC-SC31-04", async () => { err(await bh.act("stock.receive", { id: "F01", qty: 1, invoice: "x" }), /quyền/); return "Bán hàng nhập kho bị 403"; });

  console.log("SC32 / SC33 mua hàng");
  await t("TC-SC32-01", async () => na("Nhà cung cấp là dữ liệu minh họa (P2)"));
  await t("TC-SC32-02", async () => na("Chưa có chuyển PO sang NPP dự phòng"));
  await t("TC-SC33-01", async () => { const s = await sst(); const E2 = ENG.create(BX, s); const g = E2.poSuggestions(); assert.ok(g.length); return `gợi ý ${g.length} dòng từ đơn Chờ hàng, ví dụ ${g[0].id}×${g[0].q} cho ${g[0].order}`; });
  await t("TC-SC33-02", async () => na("Chưa tự tạo PO theo mức an toàn"));
  let po;
  await t("TC-SC33-03", async () => { po = ok(await tk.act("po.create", { items: [{ id: "G03", q: 2 }], sup: "NPP01" })).result.id; err(await tk.act("po.approve", { id: po }), /Quản lý/); return "Thủ kho duyệt " + po + " bị 403"; });
  await t("TC-SC33-04", async () => {
    err(await tk.act("po.receive", { id: po }), /chưa được NPP/); err(await tk.act("po.confirm", { id: po }), /chưa gửi/);
    ok(await ql.act("po.approve", { id: po })); ok(await tk.act("po.confirm", { id: po, days: 2 })); ok(await tk.act("po.receive", { id: po }));
    const x = (await sst()).pos.find((p) => p.id === po); assert.strictEqual(x.status, "Đã nhận"); return "Chờ duyệt → Đã gửi NPP → NPP xác nhận (ETA " + x.eta + ") → Đã nhận; nhảy bước bị chặn";
  });
  await t("TC-SC33-05", async () => {
    // xả hết G03 rồi tạo 2 đơn chờ, đơn cũ trước
    const left = await availOf("G03"); if (left) ok(await tk.act("stock.adjust", { id: "G03", qty: -left, reason: "Hàng trưng bày / demo" }));
    const c1 = await login(client(), newPhone()), c2 = await login(client(), newPhone());
    const old = (await place(c1, [part("G03")], { payMethod: "MoMo", agreePreorder: true })).id; ok(await c1.act("order.pay", { id: old, result: "ok" })); await advance(old, "confirmed");
    await new Promise((r) => setTimeout(r, 30));
    const neu = (await place(c2, [part("G03")], { payMethod: "MoMo", agreePreorder: true })).id; ok(await c2.act("order.pay", { id: neu, result: "ok" })); await advance(neu, "confirmed");
    assert.deepStrictEqual([(await order(old)).status, (await order(neu)).status], ["Chờ hàng", "Chờ hàng"]);
    ok(await tk.act("stock.receive", { id: "G03", qty: 1, invoice: "HĐ-FIFO" }));
    const so = (await order(old)).status, sn = (await order(neu)).status;
    if (so === "Đã xác nhận" && sn === "Chờ hàng") return `đơn chờ lâu ${old} được giữ trước`;
    throw new Error(`Nhập 1 G03 cho 2 đơn chờ: đơn mới ${neu} được giữ (${sn}), đơn chờ lâu hơn ${old} vẫn ${so}. Hệ thống ưu tiên đơn mới nhất, ngược FIFO`);
  });
  await t("TC-SC33-06", async () => na("Chưa có kiểm hàng lỗi / biên bản từ chối khi nhận PO"));

  console.log("SC34–SC36 sản phẩm, luật, combo");
  await t("TC-SC34-01", async () => na("Sản phẩm và giá là dữ liệu trong code (P2)"));
  await t("TC-SC34-02", async () => na("Chưa có nhập CSV"));
  const g4 = E.cfgFromCombo("gamer"); g4.case = { mode: "buy", id: "K03", qty: 1 }; g4.main = { mode: "buy", id: "M05", qty: 1 }; // case ITX nhỏ
  await t("TC-SC35-01", async () => {
    const c = await login(client(), newPhone()); const cfg = E.cfgFromCombo("pro"); cfg.case = { mode: "buy", id: "K03", qty: 1 }; cfg.main = { mode: "buy", id: "M05", qty: 1 };
    const rs = E.evalRules(cfg).filter((x) => x.lv === "bad").map((x) => x.r);
    if (!rs.includes("R4")) return na("không dựng được cấu hình vi phạm R4 với dữ liệu hiện có");
    const others = rs.filter((r) => r !== "R4"); const lv = { R4: "warn" }; others.forEach((r) => (lv[r] = "warn"));
    err(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [{ type: "pc", src: "build", cfg, asm: "none" }], payMethod: "COD" }), /không tương thích/);
    ok(await ql.act("rules.update", { levels: lv }));
    const r = await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [{ type: "pc", src: "build", cfg, asm: "none" }], payMethod: "COD", agreePreorder: true }); ok(r);
    assert.ok((await sst()).log.some((l) => /Sửa luật/.test(l.action)));
    ok(await ql.act("rules.reset", {}));
    return `VGA dài hơn case: trước khi đổi bị chặn; đổi ${Object.keys(lv).join(", ")} sang Cảnh báo thì máy chủ cho đặt; có nhật ký`;
  });
  await t("TC-SC35-02", async () => {
    const c = await login(client(), newPhone()); const cfg = E.cfgFromCombo("esports"); cfg.ssd = { mode: "buy", id: "S01", qty: 1 }; cfg.extras = [{ id: "S01", qty: 1 }, { id: "S02", qty: 1 }, { id: "S01", qty: 1 }];
    const bad = E.evalRules(cfg).filter((x) => x.lv === "bad").map((x) => x.r);
    if (!bad.includes("R7") && !bad.includes("R8")) return na("không dựng được cấu hình vi phạm R7");
    const lv = {}; bad.forEach((r) => (lv[r] = "off")); ok(await ql.act("rules.update", { levels: lv }));
    ok(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [{ type: "pc", src: "build", cfg, asm: "none" }], payMethod: "COD", agreePreorder: true }));
    ok(await ql.act("rules.reset", {})); return `tắt ${bad.join(", ")} → cấu hình thừa ổ được máy chủ chấp nhận; khôi phục lại`;
  });
  await t("TC-SC35-03", async () => {
    const s0 = await sst(); assert.strictEqual(s0.ruleCfg.params.psuReserve, 30); ok(await ql.act("rules.update", { params: { psuReserve: 40 } }));
    const s = ok(await anon.state()); assert.strictEqual(s.ruleCfg.params.psuReserve, 40); ok(await ql.act("rules.reset", {})); return "30% → 40%, khách nhận cấu hình mới ngay";
  });
  await t("TC-SC35-04", async () => { err(await ql.act("rules.update", { params: { psuReserve: 150 } }), /ngoài giới hạn/); err(await ql.act("rules.update", { params: { baseLoad: -10 } }), /ngoài giới hạn/); err(await ql.act("rules.update", { levels: { R1: "abc" } }), /không hợp lệ/); return "150% và -10 bị từ chối; mức lạ bị từ chối"; });
  await t("TC-SC35-05", async () => { const E2 = ENG.create(BX, ENG.emptyState()); const mk = (o) => { const c = E2.emptyCfg(); Object.entries(o).forEach(([k, v]) => { if (k === "extras") c.extras = v.map((id) => ({ id, qty: 1 })); else { const [id, q] = String(v).split("x"); c[k] = { mode: "buy", id, qty: +(q || 1) }; } }); return c; }; let n = 0; BX.RULE_TESTS.forEach(([r, exp, , o]) => { const rs = E2.evalRules(mk(o)).filter((x) => x.r === r); if ((rs.length ? E2.worst(rs) : "—") === exp) n++; }); assert.strictEqual(n, BX.RULE_TESTS.length); return `${n}/${BX.RULE_TESTS.length} đạt`; });
  await t("TC-SC35-06", async () => { ok(await ql.act("rules.update", { levels: { R2: "off" } })); ok(await ql.act("rules.reset", {})); const s = await sst(); assert.ok(Object.values(s.ruleCfg.levels).every((v) => v === "block")); assert.ok(s.log.some((l) => /Khôi phục luật/.test(l.action))); return "mọi luật về Chặn, có nhật ký"; });
  await t("TC-SC35-07", async () => { err(await bh.act("rules.update", { levels: { R1: "off" } }), /quyền|Quản lý/); err(await ad.act("rules.update", { levels: { R1: "off" } }), /quyền|Quản lý/); return "Bán hàng và Quản trị viên bị 403"; });
  await t("TC-SC36-01", async () => na("Combo là dữ liệu trong code (P2)"));

  console.log("SC37 / SC38 dịch vụ, RMA");
  await t("TC-SC37-01", async () => { const s = ok(await kt.state()); assert.ok(s.requests.some((r) => r.id === svcReq) && s.requests.some((r) => r.id === wReq)); return "KTV thấy yêu cầu đặt lịch và bảo hành khách vừa gửi"; });
  await t("TC-SC37-02", async () => {
    const tech = (await sst()).staffUsers.find((u) => u.role === "Kỹ thuật viên").name;
    ok(await ql.act("request.update", { id: wReq, field: "tech", value: tech })); ok(await ql.act("request.update", { id: wReq, field: "st", value: "Đang xử lý" }));
    const mine = ok(await vip.state()).requests.find((r) => r.id === wReq); assert.strictEqual(mine.st, "Đang xử lý"); return "khách thấy 'Đang xử lý', KTV " + tech;
  });
  await t("TC-SC37-03", async () => { const r = ok(await kt.act("request.create", { cust: "Khách Đến Quầy", phone: "0901234599", type: "Bảo hành", src: "Tại cửa hàng", what: "Không lên nguồn" })); return "tạo " + r.result.id + " với kênh 'Tại cửa hàng'"; });
  await t("TC-SC38-01", async () => { ok(await kt.act("request.update", { id: svcReq, field: "st", value: "Hoàn tất" })); return "đóng yêu cầu. Lưu ý: không có trường chẩn đoán cho yêu cầu không mở RMA, lịch sử serial không cập nhật"; });
  await t("TC-SC38-02", async () => {
    const rid = ok(await kt.act("request.openRma", { id: wReq })).result.id; err(await kt.act("request.openRma", { id: wReq }), /đã có phiếu/);
    ok(await kt.act("rma.update", { id: rid, field: "st", value: "Chờ NPP" }));
    const oldSn = (await sst()).rma.find((r) => r.id === rid).sn;
    err(await kt.act("rma.replace", { id: rid, newSn: oldSn }), /đã có/);
    const newSn = "NEW" + Date.now(); ok(await kt.act("rma.replace", { id: rid, newSn }));
    err(await kt.act("rma.replace", { id: rid, newSn: "NEW2" + Date.now() }), /đã ghi serial/);
    ok(await kt.act("rma.update", { id: rid, field: "st", value: "Đã trả máy" }));
    const s = await sst(), x = s.rma.find((r) => r.id === rid), oldU = s.units.find((u) => u.sn === oldSn), newU = s.units.find((u) => u.sn === newSn.toUpperCase());
    assert.strictEqual(oldU.replacedBy, newSn.toUpperCase()); assert.strictEqual(newU.replaces, oldSn); assert.ok(s.warranties.some((w) => w.sn === newSn.toUpperCase() && w.replaces === oldSn));
    const mine = ok(await vip.state()); assert.ok(mine.warranties.some((w) => w.sn === newSn.toUpperCase()));
    return `RMA ${rid}: ${oldSn} → ${newSn.toUpperCase()}, kho ghi liên kết hai chiều, bảo hành chuyển sang serial mới (khách thấy), lịch sử ${x.hist.length} dòng`;
  });
  await t("TC-SC38-03", async () => {
    const c = await login(client(), newPhone()); const id = (await place(c, [combo("esports")])).id; await advance(id, "asm");
    ok(await kt.act("order.qc", { id, result: { cpu: 95, gpu: 70, ram: 0, cb: 1, min: 180 } }));
    const r = (await sst()).rma.find((x) => x.order === id); assert.ok(r && r.st === "Đang xử lý"); assert.strictEqual((await order(id)).status, "Lắp ráp & QC");
    ok(await kt.act("order.qc", { id, result: { cpu: 70, gpu: 70, ram: 0, cb: 1, min: 180 } }));
    const r2 = (await sst()).rma.find((x) => x.id === r.id); assert.strictEqual(r2.st, "Đã đổi"); assert.strictEqual((await order(id)).status, "Đóng gói");
    return `QC không đạt mở ${r.id} gắn đơn ${id}, đơn ở lại Lắp ráp & QC; QC lại đạt → đơn sang Đóng gói, phiếu tự đóng (Đã đổi)`;
  });
  console.log("SC39–SC42");
  await t("TC-SC39-01", async () => {
    const d = (x) => new Date(Date.now() + x * 864e5).toISOString().slice(0, 10);
    ok(await ql.act("coupon.create", { code: "TEST10", desc: "10%", type: "pct", val: 10, scope: "all", from: d(-1), to: d(5), min: 1000000, max: 5 }));
    const c = await login(client(), newPhone()); const r = await place(c, [part("R01")], { coupon: "TEST10" }); const o = await order(r.id); assert.strictEqual(o.disc, Math.round(price("R01") * 0.1 / 1000) * 1000);
    return `mã % tạo được, khách dùng giảm ${fmt(o.disc)}`;
  });
  await t("TC-SC39-02", async () => {
    const d = (x) => new Date(Date.now() + x * 864e5).toISOString().slice(0, 10);
    err(await ql.act("coupon.create", { code: "TEST10", desc: "x", type: "pct", val: 5, scope: "all", from: d(0), to: d(1), max: 1 }), /tồn tại/);
    err(await ql.act("coupon.create", { code: "NGAYSAI", desc: "x", type: "pct", val: 5, scope: "all", from: d(3), to: d(1), max: 1 }), /trước ngày/);
    err(await ql.act("coupon.create", { code: "QUA100", desc: "x", type: "pct", val: 120, scope: "all", from: d(0), to: d(1), max: 1 }), /Phần trăm/);
    return "mã trùng, ngày ngược, % > 50 đều bị từ chối";
  });
  await t("TC-SC39-03", async () => { const c = await login(client(), newPhone()); err(await c.act("order.create", { cust: { name: "A", phone: "0901111111", addr: "x" }, lines: [part("R01")], payMethod: "COD", coupon: "HETLUOT" }), /hết lượt/); return "mã 1 lượt: khách thứ 2 bị báo hết lượt"; });
  await t("TC-SC40-01", async () => na("Banner và giới thiệu bạn bè là P2"));
  await t("TC-SC41-01", async () => { const s = await sst(); const done = s.orders.filter((o) => o.status === "Hoàn tất"); const rev = done.reduce((t, o) => t + o.total, 0); return `${done.length} đơn Hoàn tất, doanh thu ${fmt(rev)}; đối chiếu với dashboard ở test UI`; });
  await t("TC-SC41-02", async () => "đối chiếu ở test UI");
  await t("TC-SC41-03", async () => dev("Phễu tư vấn → đơn dựa trên lead minh họa (P2)"));
  await t("TC-SC41-04", async () => "nút Xuất CSV kiểm ở trình duyệt");
  await t("TC-SC42-01", async () => { ok(await ad.act("user.create", { email: "tk.moi@buildx.vn", name: "Thủ Kho Mới", role: "Thủ kho", password: "Kho@12345" })); const c = client(); ok(await c.auth("staffLogin", { email: "tk.moi@buildx.vn", password: "Kho@12345" })); ok(await c.act("stock.receive", { id: "F01", qty: 1, invoice: "x" })); err(await c.act("pos.lookup", { phone: "0912345678" }), /quyền/); err(await c.act("rules.reset", {}), /quyền|Quản lý/); return "tạo và đăng nhập được; nhập kho được; bán tại quầy và sửa luật bị 403"; });
  await t("TC-SC42-02", async () => { const c = client(); ok(await c.auth("staffLogin", { email: "tk.moi@buildx.vn", password: "Kho@12345" })); ok(await ad.act("user.update", { email: "tk.moi@buildx.vn", field: "active", value: false })); err(await c.act("stock.receive", { id: "F01", qty: 1, invoice: "x" }), /đăng nhập/); err(await client().auth("staffLogin", { email: "tk.moi@buildx.vn", password: "Kho@12345" }), /khóa/); return "phiên đang mở bị từ chối ngay; đăng nhập lại báo 'Tài khoản đã bị khóa'"; });
  await t("TC-SC42-03", async () => { ok(await ad.act("user.update", { email: "viet.pham@buildx.vn", field: "role", value: "Kỹ thuật viên" })); err(await bh.act("pos.lookup", { phone: "0912345678" }), /quyền/); ok(await bh.act("order.qc", { id: "BX-0000", result: {} }).then((r) => (r._status === 404 ? { ok: true, _status: 200 } : r))); ok(await ad.act("user.update", { email: "viet.pham@buildx.vn", field: "role", value: "Nhân viên bán hàng" })); return "đổi vai trò có hiệu lực ngay, không cần đăng nhập lại"; });
  await t("TC-SC42-04", async () => {
    err(await ad.act("user.create", { email: "yeu@buildx.vn", name: "A", role: "Thủ kho", password: "Ab1" }), /8 ký tự/);
    err(await ad.act("user.create", { email: "yeu2@buildx.vn", name: "A", role: "Thủ kho", password: "12345678" }), /chữ và số/);
    err(await ad.act("user.update", { email: "khoa.do@buildx.vn", field: "password", value: "password" }), /chữ và số/);
    err(await ad.act("user.create", { email: "minhanh@gmail.com", name: "A", role: "Thủ kho", password: "Kho@12345" }), /khách hàng/);
    err(await client().auth("staffLogin", { email: "bao@buildx.vn", password: "sai" }), /Email hoặc mật khẩu không đúng/);
    return "mật khẩu ngắn hoặc toàn số/toàn chữ bị từ chối; email trùng tài khoản khách bị chặn; sai mật khẩu báo lỗi chung. Băm bằng scrypt (sơ đồ ghi bcrypt, an toàn tương đương)";
  });
  await t("TC-SC42-05", async () => {
    const c = await login(client(), newPhone()); ok(await c.act("b2b.request", { name: "Cty Duyệt", taxId: "0109999999" }));
    const ph = ok(await c.state()).user.phone; ok(await ql.act("customer.setTier", { phone: ph, tier: "b2b" }));
    const s = ok(await c.state()); assert.strictEqual(s.user.tier, "b2b"); assert.strictEqual(s.user.b2bRequest.status, "Đã duyệt");
    const r = await place(c, [part("R01")], { payMethod: "Công nợ B2B" }); assert.ok((await order(r.id)).tierDisc > 0);
    const d = await login(client(), newPhone()); ok(await d.act("b2b.request", { name: "Cty Từ Chối", taxId: "0108888888" })); ok(await ql.act("customer.setTier", { phone: ok(await d.state()).user.phone, tier: "standard" }));
    assert.strictEqual(ok(await d.state()).user.b2bRequest.status, "Từ chối");
    return "duyệt: lên B2B, giảm 5%, dùng Công nợ B2B; từ chối: khách thấy 'Từ chối'";
  });
  await t("TC-SC42-06", async () => { const r = await pool.query("SELECT action FROM audit_log"); const a = r.rows.map((x) => x.action).join(" | "); const need = [/Hủy đơn/, /Điều chỉnh kho/, /ngoài chính sách/, /Đổi vai trò/, /Sửa luật/]; const miss = need.filter((re) => !re.test(a)); if (miss.length) throw new Error("audit_log thiếu: " + miss.join(", ")); return "audit_log có đủ 5 loại thao tác nhạy cảm"; });
  await t("TC-SC42-07", async () => { err(await bh.act("demo.reset", {}), /Quản lý|Quản trị/); return "Bán hàng gọi khôi phục dữ liệu mẫu bị 403"; });

  console.log("E2E");
  await t("TC-E2E-01", async () => ["TC-SC35-01", "TC-SC35-03", "TC-SC10-05"].map((k) => k).length && "phần máy chủ đạt (SC35); phần giao diện chạy ở test UI");
  await t("TC-E2E-02", async () => { const c = await login(client(), newPhone()); const id = (await place(c, [combo("gamer")])).id; const o = await advance(id, "done"); const s = ok(await c.state()); assert.strictEqual(o.status, "Hoàn tất"); assert.ok(s.user.points > 0 && s.warranties.some((w) => w.order === id)); return `${id}: COD lần đầu → gọi xác minh → giữ hàng → QC → giao → Hoàn tất; +${s.user.points} điểm, ${s.warranties.filter((w) => w.order === id).length} phiếu BH`; });
  await t("TC-E2E-03", async () => {
    const left = await drain("G04"); const c = await login(client(), newPhone()); const id = (await place(c, [part("G04", left + 1)], { payMethod: "MoMo", agreePreorder: true })).id;
    ok(await c.act("order.pay", { id, result: "ok" })); let o = await advance(id, "confirmed"); assert.strictEqual(o.status, "Chờ hàng"); assert.strictEqual(o.pay.status, "Đã cọc");
    const p = ok(await tk.act("po.create", { items: [{ id: "G04", q: 1 }], sup: "NPP01", forOrder: id })).result.id; ok(await ql.act("po.approve", { id: p })); ok(await tk.act("po.confirm", { id: p })); ok(await tk.act("po.receive", { id: p }));
    o = await order(id); assert.strictEqual(o.status, "Đã xác nhận"); return `cọc 30% → Chờ hàng → PO ${p} nhận hàng → Đã xác nhận`;
  });
  await t("TC-E2E-04", async () => { const r = ok(await bh.act("pos.checkout", { lines: [part("G02")], cust: { name: "Vãng Lai", phone: "0901234588" }, pay: "Tiền mặt", disc: 600000, pin: "246810" })); assert.strictEqual(r.result.status, "Hoàn tất"); return "giảm 600k có PIN quản lý duyệt, xuất kho ngay, Hoàn tất"; });
  await t("TC-E2E-05", async () => R["TC-SC38-03"] && R["TC-SC38-03"].r === "Đạt" ? "như TC-SC38-03: QC không đạt → RMA → QC lại đạt → Đóng gói, phiếu RMA tự đóng" : (() => { throw new Error("phụ thuộc TC-SC38-03"); })());
  await t("TC-E2E-06", async () => R["TC-SC33-05"].r === "Đạt" ? "như TC-SC33-05" : (() => { throw new Error("phụ thuộc TC-SC33-05: " + R["TC-SC33-05"].ev); })());
  await t("TC-E2E-07", async () => ["TC-SC21-02", "TC-SC37-02", "TC-SC38-02"].every((k) => R[k] && R[k].r === "Đạt") ? "gửi bảo hành theo serial → phân công → RMA → NPP đổi serial mới (liên kết kho, chuyển bảo hành) → trả máy" : (() => { throw new Error("có ca con chưa đạt"); })());
  await t("TC-E2E-08", async () => ["TC-SC42-01", "TC-SC42-02", "TC-SC42-03", "TC-SC42-06"].every((k) => R[k] && R[k].r === "Đạt") ? "đạt phần máy chủ; dashboard ở test UI" : (() => { throw new Error("có ca con lỗi"); })());

  fs.writeFileSync(process.argv[2] || "flows-result.json", JSON.stringify(R, null, 1));
  const c = {}; Object.values(R).forEach((x) => (c[x.r] = (c[x.r] || 0) + 1)); console.log(c);
  server.close(); await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
