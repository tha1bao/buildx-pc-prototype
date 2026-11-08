// Xử lý API: đăng nhập, đọc dữ liệu theo quyền, và các thao tác nghiệp vụ.
// Mọi thao tác ghi chạy trong một giao dịch: đọc dữ liệu → chạy engine → ghi phần thay đổi.
"use strict";
const BX = require("../public/data.js");
const ENG = require("../public/engine.js");
const db = require("./db");
const auth = require("./auth");

const { ORDER, FEES, ROLES, COMBOS } = BX;
const byId = (id) => BX.P.find((p) => p.id === id);

// Chưa nối nhà cung cấp SMS: mã OTP được trả về màn hình (chế độ thử nghiệm). Đặt SMS_PROVIDER để tắt.
const OTP_DEMO = !process.env.SMS_PROVIDER;

class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }
const fail = (msg, status) => { throw new ApiError(msg, status); };
const must = (err) => { if (err) fail(err); };

// ---------- tiện ích ----------
async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; let size = 0;
  for await (const ch of req) { size += ch.length; if (size > 256 * 1024) fail("Dữ liệu gửi lên quá lớn.", 413); chunks.push(ch); }
  const s = Buffer.concat(chunks).toString();
  return s ? JSON.parse(s) : {};
}
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
const normPhone = db.normPhone;
const validPhone = (p) => /^0\d{9}$/.test(normPhone(p));
const str = (v, max, label, required = true) => { const s = String(v == null ? "" : v).trim(); if (required && !s) fail(`Thiếu ${label}.`); if (s.length > max) fail(`${label} quá dài.`); return s; };
const int = (v, lo, hi, label) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < lo || n > hi) fail(`${label} không hợp lệ.`); return n; };
const oneOf = (v, list, label) => { if (!list.includes(v)) fail(`${label} không hợp lệ.`); return v; };
const allowed = (role, path) => { const r = ROLES[role] || []; return r.includes("*") || r.includes(path); };

// Nhân viên: lấy lại vai trò từ CSDL mỗi lần (khóa tài khoản hay đổi vai trò có hiệu lực ngay)
function resolveStaff(st, sess) {
  if (!sess.staff) return null;
  const u = st.staffUsers.find((x) => x.email === sess.staff.email);
  return u && u.on ? { name: u.name, email: u.email, role: u.role } : null;
}
// Đơn khách được xem: đơn đặt trên máy này, hoặc mọi đơn theo SĐT đã xác thực OTP
function custOrderIds(st, cust) {
  const ph = cust.verified ? normPhone(cust.phone) : null;
  return st.orders.filter((o) => (cust.orders || []).includes(o.id) || (ph && (accountOf(o) === ph || normPhone(o.cust.phone) === ph))).map((o) => o.id);
}
const stripPrivate = (o) => { const x = Object.assign({}, o); Object.keys(x).forEach((k) => k.startsWith("_") && delete x[k]); return x; };

async function getCustomer(c, cust) {
  if (!cust.verified || !cust.phone) return null;
  const r = await c.query("SELECT doc FROM customers WHERE phone = $1", [normPhone(cust.phone)]);
  return r.rows.length ? custDefaults(r.rows[0].doc) : null;
}
// Tài khoản mới hoặc dữ liệu cũ thiếu trường: hạng Member, điểm và chi tiêu bằng 0
function custDefaults(d) {
  if (!BX.CUST_TIERS[d.tier]) d.tier = "standard";
  if (typeof d.points !== "number") d.points = 0;
  if (typeof d.spent !== "number") d.spent = 0;
  d.addrs = d.addrs || []; d.saved = d.saved || [];
  return d;
}
const accountOf = (o) => o.cust.account || normPhone(o.cust.phone);
// Cộng điểm (1% giá trị đơn, 1 điểm = 1.000đ) và chi tiêu khi đơn hoàn tất; Member đủ 50 triệu tự lên VIP
const VIP_SPEND = 50000000;
async function creditLoyalty(c, E, o) {
  if (o.status !== "Hoàn tất" || o.loyalty) return;
  const r = await c.query("SELECT doc FROM customers WHERE phone = $1 FOR UPDATE", [accountOf(o)]);
  if (!r.rows.length) return;
  const d = custDefaults(r.rows[0].doc), pts = Math.floor((o.total * 0.01) / 1000);
  d.spent += o.total; d.points += pts;
  o.loyalty = { points: pts, spent: o.total };
  let up = "";
  if (d.tier === "standard" && d.spent >= VIP_SPEND) { d.tier = "vip"; up = " · tự lên hạng VIP (chi tiêu ≥ 50 triệu)"; }
  await c.query("UPDATE customers SET doc = $2, updated_at = now() WHERE phone = $1", [accountOf(o), JSON.stringify(d)]);
  E.olog(o, `Cộng ${pts.toLocaleString("vi-VN")} điểm và ${o.total.toLocaleString("vi-VN")}đ chi tiêu cho tài khoản${up}`, "Hệ thống");
}

// Dữ liệu gửi về trình duyệt theo quyền
function snapshot(st, sess, staff, customer) {
  const ids = custOrderIds(st, sess.cust);
  const out = {
    now: new Date(),
    staff,
    user: customer,
    me: { phone: sess.cust.verified ? sess.cust.phone : sess.cust.guestPhone || "", verified: !!sess.cust.verified, orderIds: ids },
    coupons: st.coupons.map((cp) => ({ code: cp.code, desc: cp.desc, type: cp.type, val: cp.val, scope: cp.scope, from: cp.from, to: cp.to, min: cp.min, max: cp.max, used: cp.used })),
    seq: st.seq,
    ruleCfg: st.ruleCfg,
  };
  if (staff) {
    Object.assign(out, { orders: st.orders.map(stripPrivate), units: st.units, pos: st.pos, requests: st.requests, rma: st.rma, warranties: st.warranties, log: st.log.slice(0, 120), staffUsers: st.staffUsers, availMap: null });
  } else {
    const mine = st.orders.filter((o) => ids.includes(o.id));
    const ph = sess.cust.verified ? normPhone(sess.cust.phone) : null;
    const avail = {}; st.units.forEach((u) => { if (u.state === "stock") avail[u.id] = (avail[u.id] || 0) + 1; });
    Object.assign(out, {
      orders: mine.map(stripPrivate), units: [], pos: [], rma: [], log: [], staffUsers: [], availMap: avail,
      requests: st.requests.filter((r) => (ph && normPhone(r.phone) === ph) || (sess.cust.requests || []).includes(r.id)),
      warranties: st.warranties.filter((w) => ids.includes(w.order)),
    });
  }
  return out;
}

// ---------- kiểm tra dữ liệu giỏ hàng gửi lên (không tin giá từ trình duyệt) ----------
function cleanCfg(E, cfg) {
  if (!cfg || typeof cfg !== "object") fail("Cấu hình không hợp lệ.");
  const c = E.emptyCfg();
  ORDER.forEach((s) => {
    const x = cfg[s];
    if (!x || !x.mode) return;
    oneOf(x.mode, ["buy", "own", "skip"], "Trạng thái linh kiện");
    if (x.mode === "skip") { c[s] = { mode: "skip", id: null, qty: 1 }; return; }
    const p = byId(x.id);
    if (!p || p.cat !== s) fail(`Linh kiện ${x.id} không thuộc nhóm ${s}.`);
    if (x.mode === "buy" && p.ref) fail(`${p.n} đã ngừng bán.`);
    c[s] = { mode: x.mode, id: p.id, qty: s === "ram" ? int(x.qty || 1, 1, 4, "Số thanh RAM") : 1 };
  });
  c.extras = (Array.isArray(cfg.extras) ? cfg.extras : []).slice(0, 8).map((e) => {
    const p = byId(e && e.id);
    if (!p || p.ref || !["opt", "ram", "ssd"].includes(p.cat)) fail("Linh kiện tùy chọn không hợp lệ.");
    return { id: p.id, qty: int(e.qty || 1, 1, 4, "Số lượng linh kiện tùy chọn") };
  });
  return c;
}
function cleanLines(E, lines) {
  if (!Array.isArray(lines) || !lines.length) fail("Giỏ hàng trống.");
  if (lines.length > 20) fail("Giỏ hàng quá nhiều dòng.");
  return lines.map((l) => {
    if (!l || typeof l !== "object") fail("Dòng hàng không hợp lệ.");
    if (l.type === "pc") {
      const cfg = cleanCfg(E, l.cfg), src = oneOf(l.src || "build", ["combo", "build", "upgrade", "quote"], "Nguồn cấu hình");
      const asm = oneOf(l.asm || "none", ["none", "shop", "home"], "Lựa chọn lắp ráp");
      const title = str(l.title || "PC tự build", 100, "Tên cấu hình");
      if (E.worst(E.evalRules(cfg)) === "bad") fail(`"${title}" có linh kiện không tương thích; vui lòng kiểm tra lại cấu hình.`);
      if (asm === "home" && src !== "upgrade") fail("Lắp tận nhà chỉ áp dụng cho nâng cấp PC đang dùng.");
      if (asm !== "none" && src !== "upgrade" && !E.canAssemble(cfg)) fail(`"${title}" chưa đủ linh kiện bắt buộc để lắp ráp.`);
      if (!E.cfgPrice(cfg) && asm === "none") fail(`"${title}" không có linh kiện nào cần mua.`);
      return { type: "pc", title, src, cfg, asm };
    }
    if (l.type === "part") {
      const p = byId(l.id);
      if (!p || p.ref) fail("Sản phẩm không còn bán.");
      return { type: "part", id: p.id, qty: int(l.qty, 1, 10, "Số lượng") };
    }
    if (l.type === "svc" && l.code === "care") return { type: "svc", code: "care", title: "Gói BuildX Care 12 tháng", price: FEES.care };
    return fail("Dòng hàng không hợp lệ.");
  });
}
function cleanCust(c) {
  if (!c || typeof c !== "object") fail("Thiếu thông tin khách hàng.");
  const phone = str(c.phone, 20, "số điện thoại");
  if (!validPhone(phone)) fail("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
  return { name: str(c.name, 80, "họ tên"), phone, addr: str(c.addr || "", 200, "địa chỉ", false) };
}
const findOrderOr404 = (E, id) => E.findOrder(id) || fail("Không tìm thấy đơn hàng.", 404);
const mineOr403 = (E, st, sess, id) => { const o = findOrderOr404(E, id); if (!custOrderIds(st, sess.cust).includes(o.id)) fail("Bạn không có quyền với đơn này.", 403); return o; };

// ---------- các thao tác ----------
// path: màn hình nhân viên cần quyền (theo ROLES); cust: khách (kể cả khách vãng lai) được gọi
const A = {};
const act = (name, opt, run) => (A[name] = Object.assign({ run }, opt));

// ===== Khách hàng =====
act("order.create", { cust: true }, async ({ E, st, c, p, sess }) => {
  // Bắt buộc đăng nhập (SĐT + OTP) mới được đặt hàng; đơn gắn với tài khoản, SĐT người nhận có thể khác
  const acc = await getCustomer(c, sess.cust);
  if (!acc) fail("Vui lòng đăng nhập hoặc đăng ký tài khoản để đặt hàng.", 401);
  const lines = cleanLines(E, p.lines), cust = cleanCust(p.cust);
  const tier = acc.tier;
  cust.account = normPhone(acc.phone);
  if (tier !== "standard") cust.tier = tier;
  const ship = { mode: oneOf((p.ship && p.ship.mode) || "in", ["in", "out", "pickup"], "Cách nhận hàng") };
  if (ship.mode === "pickup") cust.addr = "Nhận tại cửa hàng"; else if (!cust.addr) fail("Thiếu địa chỉ giao hàng.");
  const payMethod = oneOf(p.payMethod, ["COD", "MoMo", "VNPAY", "Thẻ", "Công nợ B2B"], "Phương thức thanh toán");
  if (payMethod === "Công nợ B2B" && tier !== "b2b") fail("Thanh toán công nợ chỉ dành cho tài khoản doanh nghiệp B2B.", 403);
  let vatInvoice = null;
  if (p.vatInvoice) {
    vatInvoice = { name: str(p.vatInvoice.name, 150, "tên công ty"), taxId: str(p.vatInvoice.taxId, 20, "mã số thuế"), addr: str(p.vatInvoice.addr, 250, "địa chỉ công ty") };
    if (!/^\d{10}(-\d{3})?$/.test(vatInvoice.taxId)) fail("Mã số thuế gồm 10 chữ số (hoặc 10 số + '-' + 3 số với chi nhánh).");
  }
  const pre = E.preorderItems(lines);
  if (pre.length && !p.agreePreorder) fail("Đơn có hàng phải đặt trước: cần đồng ý chờ thời gian nhập hàng.");
  if (pre.some((x) => x.grp === "C") && payMethod === "COD") fail("Đơn có hàng nhóm C cần đặt cọc 30% online, không áp dụng COD.");
  let coupon = null;
  if (p.coupon) { coupon = E.couponCheck(p.coupon, lines); if (!coupon.ok) fail("Mã giảm giá: " + coupon.m); }
  const sub = lines.reduce((t, l) => t + E.linePrice(l), 0);
  const o = E.createOrder({ cust, lines, ship, coupon, payMethod, channel: "Website", who: "Khách hàng", tierDisc: E.tierDiscount(tier, sub), vatInvoice });
  if (payMethod === "Công nợ B2B") o.risk = { score: o.risk.score, reasons: o.risk.reasons, needVerify: false, verified: true }; // đã có hợp đồng B2B
  let devOtp = null;
  if (o.risk.needVerify && payMethod !== "COD") { devOtp = auth.randomCode(); o._otp = auth.hashOtp(o.id, devOtp); o._otpTries = 0; if (!OTP_DEMO) devOtp = null; }
  const needOtp = !!o._otp;
  E.log(`Khách đặt đơn ${o.channel} ${o.total.toLocaleString("vi-VN")}đ`, o.id, cust.name);
  sess.cust.orders = (sess.cust.orders || []).concat(o.id);
  if (!sess.cust.verified) sess.cust.guestPhone = cust.phone;
  sess.dirtyCust = true;
  return { id: o.id, needOtp, devOtp };
});
act("order.otp", { cust: true }, ({ E, st, p, sess }) => {
  const o = mineOr403(E, st, sess, p.id);
  if (!o._otp) fail("Đơn này không cần xác minh OTP.");
  if (o._otpTries >= 5) fail("Nhập sai quá 5 lần. Nhân viên sẽ gọi điện xác minh.");
  if (auth.hashOtp(o.id, String(p.code || "")) !== o._otp) { o._otpTries++; fail("Mã OTP không đúng."); }
  o.risk.verified = true; delete o._otp; delete o._otpTries;
  E.olog(o, "Khách xác minh OTP thành công", "Khách hàng");
  return { id: o.id };
});
act("order.otpResend", { cust: true }, ({ E, st, p, sess }) => {
  const o = mineOr403(E, st, sess, p.id);
  if (!o.risk.needVerify || o.risk.verified || o.pay.method === "COD" || o.pay.method === "Công nợ B2B") fail("Đơn này không cần xác minh OTP.");
  const devOtp = auth.randomCode(); o._otp = auth.hashOtp(o.id, devOtp); o._otpTries = 0;
  return { devOtp: OTP_DEMO ? devOtp : undefined };
});
// Mô phỏng cổng thanh toán: trong thực tế bước này là IPN do cổng gọi tới máy chủ (có chữ ký).
act("order.pay", { cust: true }, ({ E, st, p, sess }) => {
  const o = mineOr403(E, st, sess, p.id);
  if (o.pay.method === "COD" || o.pay.method === "Công nợ B2B") fail("Đơn này không thanh toán qua cổng.");
  if (o.status !== "Mới" || o.pay.status !== "Chưa thanh toán") fail("Đơn không ở trạng thái chờ thanh toán.");
  if (o.risk.needVerify && !o.risk.verified) fail("Cần xác minh OTP trước khi thanh toán.");
  if (p.result === "ok") E.gatewayPaid(o, o.pay.due, "Cổng thanh toán", `IPN hợp lệ (mô phỏng sandbox): nhận ${o.pay.due.toLocaleString("vi-VN")}đ qua ${o.pay.method}`);
  else E.olog(o, "Khách hủy thanh toán tại cổng", "Cổng thanh toán");
  return { id: o.id, paid: p.result === "ok" };
});
act("order.cancelMine", { cust: true }, ({ E, st, p, sess }) => { const o = mineOr403(E, st, sess, p.id); must(E.cancel(o, "Khách hàng")); return { id: o.id }; });
act("service.book", { cust: true }, ({ E, st, p, sess }) => {
  const svc = { clean: ["Vệ sinh, thay keo tản nhiệt", FEES.clean], own: ["Lắp ráp có linh kiện khách mang tới / nâng cấp", FEES.asmOwn], asm: ["Lắp ráp linh kiện mua tại BuildX", FEES.asm] }[p.svc] || fail("Dịch vụ không hợp lệ.");
  const loc = { shop: ["Tại cửa hàng", 0], in: ["Tận nhà nội thành", FEES.homeIn], out: ["Tận nhà ngoại thành", FEES.homeOut] }[p.loc] || fail("Địa điểm không hợp lệ.");
  const date = str(p.date, 10, "ngày hẹn"); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Ngày hẹn không hợp lệ.");
  if (new Date(date + "T23:59:59+07:00") < E.now()) fail("Ngày hẹn đã qua.");
  const slot = oneOf(p.slot, ["09:00–11:00", "14:00–16:00", "18:00–20:00"], "Khung giờ");
  const cust = cleanCust({ name: p.name, phone: p.phone });
  const code = "DV-" + ++st.seq.dv, id = "YC-" + ++st.seq.req;
  st.requests.unshift({ id, type: "Đặt lịch", src: "Website", cust: cust.name, phone: cust.phone, what: `${svc[0]} · ${loc[0]} · tạm tính ${(svc[1] + loc[1]).toLocaleString("vi-VN")}đ`, when: date.split("-").reverse().slice(0, 2).join("/") + " " + slot, tech: "", st: "Mới", code, note: str(p.note || "", 500, "tình trạng máy", false), remind: !!p.remind, created: E.now() });
  E.log("Khách đặt lịch dịch vụ", id, cust.name);
  sess.cust.requests = (sess.cust.requests || []).concat(id).slice(-20); sess.dirtyCust = true;
  return { id, code };
});
act("warranty.request", { cust: true }, ({ E, st, p, sess }) => {
  const sn = str(p.sn, 40, "serial"), desc = str(p.desc, 500, "mô tả lỗi");
  const ids = custOrderIds(st, sess.cust), w = st.warranties.find((x) => x.sn === sn);
  const known = w && ids.includes(w.order);
  const code = "BH-" + ++st.seq.bh, id = "YC-" + ++st.seq.req;
  const name = (p.name && String(p.name).slice(0, 80)) || (known ? st.orders.find((o) => o.id === w.order).cust.name : "Khách");
  st.requests.unshift({ id, type: "Bảo hành", src: "Website", cust: name, phone: known ? w.phone : sess.cust.phone || sess.cust.guestPhone || "", what: `${sn}: ${desc}`, when: "", tech: "", st: "Mới", code, sn, order: known ? w.order : "", verifiedSn: !!known, created: E.now() });
  E.log("Khách gửi yêu cầu bảo hành", id, name);
  sess.cust.requests = (sess.cust.requests || []).concat(id).slice(-20); sess.dirtyCust = true;
  return { id, code, verifiedSn: !!known };
});
// Hồ sơ, sổ địa chỉ, cấu hình đã lưu: chỉ khi đã đăng nhập bằng OTP
async function custDoc(c, sess) {
  if (!sess.cust.verified) fail("Cần đăng nhập bằng SĐT + OTP.", 401);
  const r = await c.query("SELECT doc FROM customers WHERE phone = $1 FOR UPDATE", [normPhone(sess.cust.phone)]);
  if (!r.rows.length) fail("Không tìm thấy tài khoản.", 404);
  return r.rows[0].doc;
}
const saveCust = (c, doc) => c.query("UPDATE customers SET doc = $2, name = $3, updated_at = now() WHERE phone = $1", [normPhone(doc.phone), JSON.stringify(doc), doc.name]);
act("profile.save", { cust: true }, async ({ c, p, sess }) => {
  const d = await custDoc(c, sess);
  d.name = str(p.name, 80, "họ tên"); d.email = str(p.email || "", 120, "email", false);
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) fail("Email không hợp lệ.");
  d.consent = { zalo: !!(p.consent && p.consent.zalo), email: !!(p.consent && p.consent.email) };
  if (p.company && d.tier === "b2b") d.company = { name: str(p.company.name, 150, "tên công ty"), taxId: str(p.company.taxId, 20, "mã số thuế"), addr: str(p.company.addr, 250, "địa chỉ công ty") };
  await saveCust(c, d);
});
act("addr.add", { cust: true }, async ({ c, p, sess }) => { const d = await custDoc(c, sess); if (d.addrs.length >= 10) fail("Tối đa 10 địa chỉ."); d.addrs.push({ label: str(p.label, 40, "tên gợi nhớ"), text: str(p.text, 200, "địa chỉ"), def: !d.addrs.length }); await saveCust(c, d); });
act("addr.del", { cust: true }, async ({ c, p, sess }) => { const d = await custDoc(c, sess); d.addrs.splice(int(p.i, 0, d.addrs.length - 1, "Địa chỉ"), 1); if (d.addrs.length && !d.addrs.some((a) => a.def)) d.addrs[0].def = true; await saveCust(c, d); });
act("addr.def", { cust: true }, async ({ c, p, sess }) => { const d = await custDoc(c, sess); const i = int(p.i, 0, d.addrs.length - 1, "Địa chỉ"); d.addrs.forEach((a, k) => (a.def = k === i)); await saveCust(c, d); });
act("saved.add", { cust: true }, async ({ E, c, p, sess }) => {
  const d = await custDoc(c, sess); d.saved = d.saved || [];
  if (d.saved.length >= 30) fail("Tối đa 30 cấu hình đã lưu.");
  const code = "CFG-" + require("crypto").randomBytes(3).toString("hex").toUpperCase();
  d.saved.unshift({ code, title: str(p.title, 100, "tên cấu hình"), cfg: cleanCfg(E, p.cfg), date: E.dstr(E.now()), kind: p.kind === "upgrade" ? "upgrade" : undefined });
  await saveCust(c, d); return { code };
});
act("saved.remove", { cust: true }, async ({ c, p, sess }) => { const d = await custDoc(c, sess); d.saved = (d.saved || []).filter((s) => s.code !== p.code); await saveCust(c, d); });

// ===== Nhân viên: đơn hàng =====
act("order.verifyCall", { path: "order" }, ({ E, p }) => { const o = findOrderOr404(E, p.id); if (o.status !== "Mới") fail("Đơn không ở trạng thái Mới."); o.risk.verified = true; delete o._otp; E.olog(o, "Gọi điện xác minh đơn rủi ro: khách xác nhận"); });
act("order.confirm", { path: "order" }, ({ E, p }) => { const o = findOrderOr404(E, p.id); must(E.confirmOrder(o)); return { status: o.status }; });
act("order.next", { path: "order" }, ({ E, p }) => { const o = findOrderOr404(E, p.id); must(E.toNext(o)); return { status: o.status }; });
act("order.recheck", { path: "order" }, ({ E, p }) => { const o = findOrderOr404(E, p.id); if (o.status !== "Chờ hàng") fail("Đơn không ở trạng thái Chờ hàng."); return { short: E.recheck(o).length }; });
act("order.cancel", { path: "order" }, ({ E, p }) => { const o = findOrderOr404(E, p.id); must(E.cancel(o)); });
act("order.print", { path: "order" }, ({ E, p }) => { E.olog(findOrderOr404(E, p.id), "In phiếu xuất/đơn hàng"); });
act("order.assignTech", { path: "workshop" }, ({ E, st, p }) => {
  const o = findOrderOr404(E, p.id), tech = String(p.tech || "");
  if (tech && !st.staffUsers.some((u) => u.name === tech && u.role === "Kỹ thuật viên" && u.on)) fail("Kỹ thuật viên không hợp lệ.");
  o.tech = tech; E.olog(o, tech ? "Phân công kỹ thuật viên: " + tech : "Bỏ phân công kỹ thuật viên");
});
act("order.qc", { path: "ticket" }, ({ E, p, staff }) => {
  const o = findOrderOr404(E, p.id), r = p.result || {};
  const res = { cpu: int(r.cpu, 0, 150, "Nhiệt độ CPU"), gpu: int(r.gpu, 0, 150, "Nhiệt độ GPU"), ram: int(r.ram, 0, 99999, "Số lỗi RAM"), cb: int(r.cb, 0, 200000, "Điểm Cinebench"), min: int(r.min, 0, 1440, "Thời gian burn-in"), photos: int(r.photos || 0, 0, 50, "Số ảnh"), note: str(r.note || "", 300, "ghi chú", false), by: staff.name };
  res.pass = res.cpu < 90 && res.gpu < 85 && res.ram === 0 && res.min >= 120; // ngưỡng QC tính ở máy chủ
  if (!o.tech) o.tech = staff.name;
  must(E.qcResult(o, res)); return { pass: res.pass };
});
act("order.ship", { path: "packing" }, ({ E, st, p }) => {
  const o = findOrderOr404(E, p.id);
  const wb = o.ship.mode === "pickup" ? "Chờ khách nhận tại cửa hàng" : o.ship.mode === "out" ? "GHN " + require("crypto").randomBytes(3).toString("hex").toUpperCase() : "AHM-" + ++st.seq.wb;
  must(E.ship(o, wb)); return { waybill: wb };
});
act("order.complete", { path: "packing" }, async ({ E, c, p }) => { const o = findOrderOr404(E, p.id); must(E.complete(o)); await creditLoyalty(c, E, o); });

// ===== Nhân viên: bán tại quầy =====
act("pos.lookup", { path: "pos" }, async ({ st, c, p }) => {
  const ph = normPhone(p.phone); if (!validPhone(ph)) fail("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
  const r = await c.query("SELECT doc FROM customers WHERE phone = $1", [ph]);
  if (r.rows.length) { const d = r.rows[0].doc; return { found: true, name: d.name, phone: d.phone, addr: (d.addrs.find((a) => a.def) || {}).text || "" }; }
  const prev = st.orders.find((o) => normPhone(o.cust.phone) === ph);
  return prev ? { found: true, name: prev.cust.name, phone: prev.cust.phone, addr: prev.cust.addr } : { found: false, phone: p.phone };
});
act("pos.checkout", { path: "pos" }, async ({ E, st, c, p, staff }) => {
  const lines = cleanLines(E, p.lines), cust = cleanCust(p.cust);
  cust.addr = "Mua tại cửa hàng";
  const pay = oneOf(p.pay, ["Tiền mặt", "Chuyển khoản", "Thẻ"], "Hình thức thu tiền");
  const sub = lines.reduce((t, l) => t + E.linePrice(l), 0), disc = int(p.disc || 0, 0, sub, "Giảm giá");
  const limit = Math.min(500000, sub * 0.02);
  let approver = null;
  if (disc > limit) {
    if (staff.role === "Quản lý") approver = staff.name;
    else {
      const ap = p.approver || {};
      const r = await c.query("SELECT name, pass_hash FROM staff_users WHERE email = $1 AND role = 'Quản lý' AND active", [String(ap.email || "").toLowerCase()]);
      if (!r.rows.length || !auth.checkPassword(ap.password, r.rows[0].pass_hash)) fail("Giảm giá vượt chính sách: cần quản lý duyệt (email và mật khẩu quản lý không đúng).", 403);
      approver = r.rows[0].name;
    }
    E.log(`Duyệt giảm giá ngoài chính sách ${disc.toLocaleString("vi-VN")}đ tại quầy (người duyệt: ${approver})`, "POS", staff.name);
  }
  const o = E.createOrder({ cust, lines, ship: { mode: "pickup" }, coupon: disc ? { cp: { code: "GIẢM TẠI QUẦY" }, amt: disc } : null, payMethod: pay, channel: "Tại quầy", who: staff.name });
  o.risk = { score: 0, reasons: [], needVerify: false, verified: true };
  E.gatewayPaid(o, o.total, staff.name, `Thu ${o.total.toLocaleString("vi-VN")}đ tại quầy (${pay})`);
  must(E.confirmOrder(o));
  if (o.status === "Đã xác nhận") { E.toNext(o); if (o.status === "Đóng gói") { must(E.ship(o, "Giao tại quầy")); must(E.complete(o)); } }
  o.cust.account = normPhone(cust.phone);
  await c.query("INSERT INTO customers (phone, name, doc) VALUES ($1, $2, $3) ON CONFLICT (phone) DO NOTHING", [normPhone(cust.phone), cust.name, JSON.stringify({ name: cust.name, phone: cust.phone, email: "", addrs: [], consent: { zalo: false, email: false }, saved: [], tier: "standard", points: 0, spent: 0 })]);
  await creditLoyalty(c, E, o);
  return { id: o.id, status: o.status, total: o.total };
});
act("quote.order", { path: "quote" }, ({ E, p, staff }) => {
  const cust = cleanCust(p.cust);
  const lines = cleanLines(E, [{ type: "pc", title: "Cấu hình theo báo giá " + str(p.quote, 20, "mã báo giá"), src: "quote", cfg: p.cfg, asm: "shop" }]);
  const o = E.createOrder({ cust: Object.assign(cust, { addr: cust.addr || "Theo báo giá" }), lines, payMethod: "VNPAY", channel: "Báo giá", who: staff.name });
  o.risk.verified = true;
  E.gatewayPaid(o, o.pay.due, "Cổng thanh toán", `IPN hợp lệ (mô phỏng): khách thanh toán từ link báo giá ${o.pay.due.toLocaleString("vi-VN")}đ`);
  return { id: o.id };
});

// ===== Nhân viên: kho và đơn nhập =====
const sellableId = (id) => { const x = byId(id); if (!x || x.ref) fail("Sản phẩm không hợp lệ."); return x.id; };
act("stock.receive", { path: "stockdoc" }, ({ E, st, p }) => {
  const id = sellableId(p.id), qty = int(p.qty, 1, 200, "Số lượng"), inv = str(p.invoice, 60, "số hóa đơn NPP");
  E.receive(id, qty, E.now(), null);
  st.units.slice(-qty).forEach((u) => (u.invoice = inv));
  E.log(`Nhập kho ${qty} serial theo ${inv}`, id);
  st.orders.filter((o) => o.status === "Chờ hàng").forEach(E.recheck);
});
act("stock.adjust", { path: "stockdoc" }, ({ E, st, p }) => {
  const id = sellableId(p.id), qty = int(p.qty, -200, 200, "Số lượng"), reason = oneOf(p.reason, ["Kiểm kê lệch", "Hàng trưng bày / demo", "Hàng lỗi gửi NPP", "Xuất dùng nội bộ"], "Lý do");
  if (!qty) fail("Số lượng phải khác 0.");
  if (qty > 0) E.receive(id, qty);
  else {
    const us = st.units.filter((u) => u.id === id && u.state === "stock").slice(0, -qty);
    if (us.length < -qty) fail("Không đủ hàng khả dụng (hàng đã giữ cho đơn không được điều chỉnh).");
    us.forEach((u) => { u.state = "out"; u.order = null; u.note = "Điều chỉnh: " + reason; });
  }
  E.log(`Điều chỉnh kho ${qty > 0 ? "+" : ""}${qty} (${reason})`, id);
});
act("stock.return", { path: "stockdoc" }, ({ E, st, p }) => {
  const sn = str(p.sn, 40, "serial"), u = st.units.find((x) => x.sn === sn);
  if (!u || u.state !== "out") fail("Không tìm thấy serial đã xuất.");
  if (p.ok) { u.state = "stock"; u.returnedFrom = u.order; u.order = null; E.log("Nhập lại hàng khách trả sau kiểm tra", sn); }
  else { st.rma.unshift({ id: "RMA-" + ++st.seq.rma, sn, order: u.order || "", symptom: "Hàng khách trả bị lỗi", diag: "", action: "Gửi NPP", st: "Đang xử lý", hist: [E.dstr(E.now()) + ": tiếp nhận hàng trả"] }); E.log("Hàng trả lỗi → RMA", sn); }
});
act("po.create", { path: "po" }, ({ E, p }) => {
  const items = (Array.isArray(p.items) ? p.items : []).slice(0, 20).map((i) => ({ id: sellableId(i.id), q: int(i.q, 1, 100, "Số lượng") }));
  if (!items.length) fail("Đơn nhập trống.");
  const sup = oneOf(p.sup, ["NPP01", "NPP02", "NPP03", "NPP04"], "Nhà phân phối");
  if (p.forOrder) findOrderOr404(E, p.forOrder);
  return { id: E.createPO(items, sup, p.forOrder || null).id };
});
const poOr404 = (st, id) => st.pos.find((x) => x.id === id) || fail("Không tìm thấy đơn nhập.", 404);
act("po.approve", { path: "po", roles: ["Quản lý"] }, ({ E, st, p }) => { const x = poOr404(st, p.id); if (x.status !== "Chờ duyệt") fail("Đơn nhập không ở trạng thái Chờ duyệt."); x.status = "Đã gửi NPP"; E.log("Duyệt và gửi đơn nhập", x.id); });
act("po.confirm", { path: "po" }, ({ E, st, p }) => {
  const x = poOr404(st, p.id); if (x.status !== "Đã gửi NPP") fail("Đơn nhập chưa gửi NPP.");
  const eta = new Date(E.now().getTime() + int(p.days || 2, 0, 30, "Số ngày") * 864e5);
  x.status = "NPP xác nhận"; x.eta = E.dstr(eta); E.log("NPP xác nhận đơn nhập, dự kiến về " + x.eta, x.id);
  const o = x.forOrder && E.findOrder(x.forOrder); if (o) E.olog(o, `NPP xác nhận, dự kiến hàng về ${x.eta}`);
});
act("po.receive", { path: "po" }, ({ E, st, p }) => { const x = poOr404(st, p.id); if (x.status !== "NPP xác nhận") fail("Đơn nhập chưa được NPP xác nhận."); must(E.receivePO(x)); });

// ===== Nhân viên: yêu cầu dịch vụ, RMA, mã giảm giá =====
const reqOr404 = (st, id) => st.requests.find((x) => x.id === id) || fail("Không tìm thấy yêu cầu.", 404);
act("request.update", { path: "requests" }, ({ E, st, p }) => {
  const r = reqOr404(st, p.id);
  const f = oneOf(p.field, ["type", "tech", "st"], "Trường");
  const v = String(p.value || "");
  if (f === "type") oneOf(v, ["Tư vấn", "Đặt lịch", "Bảo hành", "Khiếu nại"], "Loại");
  if (f === "st") oneOf(v, ["Mới", "Đang xử lý", "Hoàn tất", "Đã hủy"], "Trạng thái");
  if (f === "tech" && v && !st.staffUsers.some((u) => u.name === v && u.role === "Kỹ thuật viên" && u.on)) fail("Kỹ thuật viên không hợp lệ.");
  r[f] = v; E.log(`Cập nhật yêu cầu (${f}) → ${v || "—"}`, r.id);
});
act("request.create", { path: "requests" }, ({ E, st, p }) => {
  const cust = cleanCust({ name: p.cust, phone: p.phone });
  const type = oneOf(p.type, ["Tư vấn", "Đặt lịch", "Bảo hành", "Khiếu nại"], "Loại");
  const src = oneOf(p.src, ["Zalo (nhân viên nhập)", "Facebook (nhân viên nhập)", "Gọi điện"], "Kênh");
  const prefix = type === "Bảo hành" ? "BH-" + ++st.seq.bh : type === "Đặt lịch" ? "DV-" + ++st.seq.dv : "TV-" + ++st.seq.tv;
  const id = "YC-" + ++st.seq.req;
  st.requests.unshift({ id, type, src, cust: cust.name, phone: cust.phone, what: str(p.what, 500, "nội dung"), when: "", tech: "", st: "Mới", code: prefix, created: E.now() });
  E.log("Nhập yêu cầu từ " + src, id); return { id };
});
act("request.openRma", { path: "requests" }, ({ E, st, p }) => {
  const r = reqOr404(st, p.id);
  if (r.type !== "Bảo hành") fail("Chỉ mở RMA từ yêu cầu bảo hành.");
  if (r.rma) fail("Yêu cầu này đã có phiếu " + r.rma + ".");
  const sn = r.sn || (r.what.match(/[A-Z]\w{1,2}-\d+/) || [""])[0];
  const w = st.warranties.find((x) => x.sn === sn);
  const id = "RMA-" + ++st.seq.rma;
  st.rma.unshift({ id, sn: sn || "(chưa xác định)", order: w ? w.order : r.order || "", symptom: r.what, diag: "", action: "", st: "Đang xử lý", hist: [E.dstr(E.now()) + ": mở từ yêu cầu " + r.id] });
  r.rma = id; r.st = "Đang xử lý"; E.log("Mở phiếu RMA từ yêu cầu " + r.id, id); return { id };
});
act("rma.update", { path: "rma" }, ({ E, st, p }) => {
  const r = st.rma.find((x) => x.id === p.id) || fail("Không tìm thấy phiếu RMA.", 404);
  const f = oneOf(p.field, ["st", "diag", "action"], "Trường"), v = str(p.value, 300, "nội dung", f === "st");
  if (f === "st") oneOf(v, ["Đang xử lý", "Chờ NPP", "Đã đổi", "Đã trả máy"], "Trạng thái");
  r[f] = v; r.hist.push(E.dstr(E.now()) + ": " + (f === "st" ? v : f === "diag" ? "Chẩn đoán: " + v : "Xử lý: " + v));
  E.log(`RMA (${f}) → ${v}`, r.id);
});
act("coupon.create", { path: "coupons" }, ({ E, st, p }) => {
  const code = str(p.code, 20, "mã").toUpperCase(); if (!/^[A-Z0-9]{3,20}$/.test(code)) fail("Mã chỉ gồm chữ không dấu và số (3–20 ký tự).");
  if (st.coupons.some((x) => x.code === code)) fail("Mã đã tồn tại.");
  const type = oneOf(p.type, ["pct", "amt"], "Loại"), val = type === "pct" ? int(p.val, 1, 50, "Phần trăm") : int(p.val, 1000, 50000000, "Số tiền");
  const d = (v, end) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) fail("Ngày không hợp lệ."); return new Date(v + (end ? "T23:59:59+07:00" : "T00:00:00+07:00")); };
  const from = d(p.from), to = d(p.to, true); if (to < from) fail("Ngày kết thúc trước ngày bắt đầu.");
  st.coupons.push({ code, desc: str(p.desc, 120, "mô tả"), type, val, scope: oneOf(p.scope, ["pc", "all"], "Phạm vi"), from, to, min: int(p.min || 0, 0, 1e9, "Đơn tối thiểu"), max: int(p.max, 1, 100000, "Số lượt"), used: 0 });
  E.log("Tạo mã giảm giá", code);
});

// ===== Quản trị: tài khoản nhân viên =====
act("user.create", { path: "users" }, async ({ E, st, c, p }) => {
  const email = str(p.email, 120, "email").toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Email không hợp lệ.");
  const role = oneOf(p.role, Object.keys(ROLES), "Vai trò"), pw = String(p.password || "");
  if (pw.length < 8) fail("Mật khẩu tạm cần ít nhất 8 ký tự.");
  const r = await c.query("INSERT INTO staff_users (email, name, role, active, pass_hash) VALUES ($1, $2, $3, true, $4) ON CONFLICT (email) DO NOTHING RETURNING email", [email, str(p.name, 80, "tên"), role, auth.hashPassword(pw)]);
  if (!r.rows.length) fail("Email đã có tài khoản.");
  st.staffUsers.push({ name: p.name, email, role, on: true });
  E.log("Tạo tài khoản nhân viên", email);
});
act("user.update", { path: "users" }, async ({ E, st, c, p, staff }) => {
  const email = String(p.email || "").toLowerCase(), u = st.staffUsers.find((x) => x.email === email) || fail("Không tìm thấy tài khoản.", 404);
  if (p.field === "role") {
    const role = oneOf(p.value, Object.keys(ROLES), "Vai trò");
    if (email === staff.email) fail("Không tự đổi vai trò của chính mình.");
    await c.query("UPDATE staff_users SET role = $2 WHERE email = $1", [email, role]); u.role = role; E.log(`Đổi vai trò ${u.name} → ${role}`, email);
  } else if (p.field === "active") {
    if (email === staff.email) fail("Không tự khóa tài khoản của chính mình.");
    const on = !!p.value; await c.query("UPDATE staff_users SET active = $2 WHERE email = $1", [email, on]); u.on = on; E.log((on ? "Mở khóa " : "Khóa ") + u.name, email);
  } else if (p.field === "password") {
    const pw = String(p.value || ""); if (pw.length < 8) fail("Mật khẩu cần ít nhất 8 ký tự.");
    await c.query("UPDATE staff_users SET pass_hash = $2 WHERE email = $1", [email, auth.hashPassword(pw)]); E.log("Đặt lại mật khẩu " + u.name, email);
  } else fail("Trường không hợp lệ.");
});
act("customer.setTier", { path: "users" }, async ({ E, st, c, p }) => {
  const tier = oneOf(p.tier, Object.keys(BX.CUST_TIERS), "Hạng khách");
  const ph = normPhone(p.phone); if (!validPhone(ph)) fail("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
  const r = await c.query("SELECT doc FROM customers WHERE phone = $1 FOR UPDATE", [ph]);
  if (!r.rows.length) fail("Chưa có tài khoản khách với SĐT này.", 404);
  const d = r.rows[0].doc; const old = d.tier || "standard"; d.tier = tier;
  if (tier === "b2b") { d.company = (d.b2bRequest && d.b2bRequest.company) || d.company || { name: d.name, taxId: "", addr: (d.addrs[0] || {}).text || "" }; }
  if (d.b2bRequest && d.b2bRequest.status === "Chờ duyệt") d.b2bRequest.status = tier === "b2b" ? "Đã duyệt" : "Từ chối";
  st.requests.filter((r) => r.b2b === ph && !["Hoàn tất", "Đã hủy"].includes(r.st)).forEach((r) => (r.st = tier === "b2b" ? "Hoàn tất" : "Đã hủy"));
  await saveCust(c, d); E.log(`Đổi hạng khách ${d.name}: ${old} → ${tier}`, ph); return { name: d.name };
});
// ===== Quản lý: luật tương thích (SC35) =====
const LV_NAME = { block: "Chặn theo thiết kế", warn: "Chỉ cảnh báo", off: "Tắt" };
act("rules.update", { path: "rules", roles: ["Quản lý"] }, ({ E, st, p }) => {
  const before = ENG.normRuleCfg(st.ruleCfg), next = ENG.normRuleCfg({ levels: Object.assign({}, before.levels, p.levels || {}), params: Object.assign({}, before.params, p.params || {}) });
  // giá trị gửi lên ngoài giới hạn bị normRuleCfg bỏ qua: báo lỗi thay vì lặng lẽ giữ giá trị cũ
  Object.entries(p.params || {}).forEach(([k, v]) => { if (typeof before.params[k] === "number" && Number(v) !== next.params[k]) fail(`Thông số ${k} ngoài giới hạn cho phép.`); });
  Object.entries(p.levels || {}).forEach(([k, v]) => { if (!(k in before.levels) || next.levels[k] !== v) fail(`Mức xử lý của ${k} không hợp lệ.`); });
  const diffs = [];
  Object.keys(next.levels).forEach((k) => { if (next.levels[k] !== before.levels[k]) diffs.push(`${k}: ${LV_NAME[before.levels[k]]} → ${LV_NAME[next.levels[k]]}`); });
  Object.keys(next.params).forEach((k) => { if (next.params[k] !== before.params[k]) diffs.push(`${k}: ${before.params[k]} → ${next.params[k]}`); });
  if (!diffs.length) fail("Không có thay đổi.");
  st.ruleCfg = next;
  E.log("Sửa luật tương thích: " + diffs.join("; "), "SC35");
  return { changes: diffs.length };
});
act("rules.reset", { path: "rules", roles: ["Quản lý"] }, ({ E, st }) => { st.ruleCfg = ENG.normRuleCfg(null); E.log("Khôi phục luật tương thích mặc định", "SC35"); });

// ===== Khách: yêu cầu nâng cấp tài khoản doanh nghiệp (B2B) =====
act("b2b.request", { cust: true }, async ({ E, st, c, p, sess }) => {
  const d = await custDoc(c, sess);
  custDefaults(d);
  if (d.tier === "b2b") fail("Tài khoản đã là doanh nghiệp B2B.");
  if (d.b2bRequest && d.b2bRequest.status === "Chờ duyệt") fail("Đã có yêu cầu đang chờ duyệt.");
  const company = { name: str(p.name, 150, "tên công ty"), taxId: str(p.taxId, 20, "mã số thuế"), addr: str(p.addr || "", 250, "địa chỉ công ty", false) };
  if (!/^\d{10}(-\d{3})?$/.test(company.taxId)) fail("Mã số thuế gồm 10 chữ số (hoặc 10 số + '-' + 3 số với chi nhánh).");
  d.b2bRequest = { status: "Chờ duyệt", company, at: E.now() };
  await saveCust(c, d);
  const id = "YC-" + ++st.seq.req;
  st.requests.unshift({ id, type: "Tư vấn", src: "Website", cust: d.name, phone: d.phone, what: `Đăng ký tài khoản doanh nghiệp B2B: ${company.name} · MST ${company.taxId}`, when: "", tech: "", st: "Mới", code: "TV-" + ++st.seq.tv, created: E.now(), b2b: normPhone(d.phone) });
  E.log("Khách gửi yêu cầu tài khoản B2B", id, d.name);
  return { id };
});

act("demo.reset", { roles: ["Quản lý", "Quản trị viên"] }, async ({ c }) => { await require("./seed").seed(c); return { reset: true }; });

// ---------- điểm vào HTTP ----------
async function handle(route, req, res) {
  try {
    await db.ensureReady();
    if (route === "version") {
      if (req.method !== "GET") fail("Phương thức không hợp lệ.", 405);
      return send(res, 200, { v: await db.version() });
    }
    const sess = await auth.sessions(req);
    if (route === "state") {
      if (req.method !== "GET") fail("Phương thức không hợp lệ.", 405);
      const out = await db.tx(async (c) => {
        const { st } = await db.loadState(c);
        const staff = resolveStaff(st, sess);
        return snapshot(st, sess, staff, await getCustomer(c, sess.cust));
      }, { lock: false });
      return send(res, 200, Object.assign({ v: await db.version() }, out));
    }
    if (req.method !== "POST") fail("Phương thức không hợp lệ.", 405);
    if (!/application\/json/.test(req.headers["content-type"] || "")) fail("Cần gửi JSON.", 415); // chặn form chéo trang (CSRF)
    const body = await readBody(req);
    if (route === "auth") return await handleAuth(body, req, res, sess);
    if (route === "action") {
      const def = A[body.name];
      if (!def) fail("Thao tác không tồn tại.", 404);
      let state;
      const result = await db.tx(async (c) => {
        const { st, snap } = await db.loadState(c);
        const staff = resolveStaff(st, sess);
        if (!def.cust) {
          if (!staff) fail("Cần đăng nhập tài khoản nhân viên.", 401);
          if (def.path && !allowed(staff.role, def.path)) fail(`Vai trò ${staff.role} không có quyền thực hiện thao tác này.`, 403);
          if (def.roles && !def.roles.includes(staff.role)) fail(`Chỉ ${def.roles.join(" hoặc ")} được thực hiện thao tác này.`, 403);
        }
        const E = ENG.create(BX, st, { now: () => new Date(), actor: () => (staff ? staff.name : "Khách hàng") });
        const r = await def.run({ E, st, c, p: body.payload || {}, sess, staff, req });
        if (body.name === "demo.reset") { const fresh = await db.loadState(c); state = snapshot(fresh.st, sess, resolveStaff(fresh.st, sess), await getCustomer(c, sess.cust)); return r; }
        await db.saveState(c, st, snap);
        state = snapshot(st, sess, staff, await getCustomer(c, sess.cust));
        return r;
      });
      if (sess.dirtyCust) { delete sess.dirtyCust; await auth.setCust(res, req, sess.cust); }
      return send(res, 200, { ok: true, result: result || null, state, v: await db.version() });
    }
    fail("Không tìm thấy.", 404);
  } catch (e) {
    if (e instanceof ApiError) return send(res, e.status, { ok: false, error: e.message });
    if (e instanceof SyntaxError) return send(res, 400, { ok: false, error: "Dữ liệu gửi lên không đúng định dạng." });
    if (e.status === 503) return send(res, 503, { ok: false, error: e.message });
    console.error(e);
    return send(res, 500, { ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." });
  }
}

// ---------- đăng nhập ----------
async function handleAuth(body, req, res, sess) {
  const op = body.op;
  if (op === "otp") {
    const phone = normPhone(body.phone); if (!validPhone(phone)) fail("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
    const code = auth.randomCode();
    await db.tx(async (c) => {
      const r = await c.query("SELECT expires_at FROM otp_codes WHERE phone = $1", [phone]);
      if (r.rows.length && new Date(r.rows[0].expires_at) - Date.now() > 270e3) fail("Vừa gửi mã, vui lòng chờ 30 giây.", 429);
      await c.query("INSERT INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES ($1, $2, now() + interval '5 minutes', 0) ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0", [phone, auth.hashOtp(phone, code)]);
    }, { lock: false });
    const exists = (await db.q("SELECT 1 FROM customers WHERE phone = $1", [phone])).rows.length > 0;
    return send(res, 200, { ok: true, isNew: !exists, devOtp: OTP_DEMO ? code : undefined });
  }
  if (op === "verify") {
    const phone = normPhone(body.phone);
    const doc = await db.tx(async (c) => {
      const r = await c.query("SELECT code_hash, expires_at, attempts FROM otp_codes WHERE phone = $1 FOR UPDATE", [phone]);
      if (!r.rows.length || new Date(r.rows[0].expires_at) < new Date()) fail("Mã OTP đã hết hạn, vui lòng gửi lại.");
      if (r.rows[0].attempts >= 5) fail("Nhập sai quá 5 lần, vui lòng gửi mã mới.");
      if (auth.hashOtp(phone, String(body.code || "")) !== r.rows[0].code_hash) { await c.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1", [phone]); return null; }
      await c.query("DELETE FROM otp_codes WHERE phone = $1", [phone]);
      const ex = await c.query("SELECT doc FROM customers WHERE phone = $1", [phone]);
      if (ex.rows.length) return ex.rows[0].doc;
      const d = { name: str(body.name, 80, "họ tên"), phone: phone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3"), email: "", addrs: [], consent: { zalo: false, email: false }, saved: [], tier: "standard", points: 0, spent: 0 };
      await c.query("INSERT INTO customers (phone, name, doc) VALUES ($1, $2, $3)", [phone, d.name, JSON.stringify(d)]);
      return d;
    }, { lock: false });
    if (!doc) fail("Mã OTP không đúng.");
    await auth.setCust(res, req, Object.assign(sess.cust, { phone: doc.phone, verified: true }));
    return send(res, 200, { ok: true, name: doc.name });
  }
  if (op === "logout") { auth.clear(res, req, auth.C_COOKIE); return send(res, 200, { ok: true }); }
  if (op === "staffLogin") {
    const email = String(body.email || "").trim().toLowerCase();
    const r = await db.q("SELECT name, role, active, pass_hash FROM staff_users WHERE email = $1", [email]);
    const u = r.rows[0];
    if (!u || !auth.checkPassword(body.password, u.pass_hash)) fail("Email hoặc mật khẩu không đúng.", 401);
    if (!u.active) fail("Tài khoản đã bị khóa.", 403);
    await auth.setStaff(res, req, { email, name: u.name, role: u.role });
    await db.tx(async (c) => { await c.query("INSERT INTO audit_log (who, action, target) VALUES ($1, 'Đăng nhập trang nội bộ', $2)", [u.name, email]); }, { lock: false });
    return send(res, 200, { ok: true, name: u.name, role: u.role });
  }
  if (op === "staffLogout") { auth.clear(res, req, auth.S_COOKIE); return send(res, 200, { ok: true }); }
  if (op === "changePassword") {
    if (!sess.staff) fail("Cần đăng nhập.", 401);
    const r = await db.q("SELECT pass_hash FROM staff_users WHERE email = $1 AND active", [sess.staff.email]);
    if (!r.rows.length || !auth.checkPassword(body.old, r.rows[0].pass_hash)) fail("Mật khẩu hiện tại không đúng.", 401);
    if (String(body.password || "").length < 8) fail("Mật khẩu mới cần ít nhất 8 ký tự.");
    await db.q("UPDATE staff_users SET pass_hash = $2 WHERE email = $1", [sess.staff.email, auth.hashPassword(body.password)]);
    return send(res, 200, { ok: true });
  }
  fail("Thao tác đăng nhập không hợp lệ.");
}

module.exports = { handle, ACTIONS: A, snapshot, cleanLines };
void COMBOS;
