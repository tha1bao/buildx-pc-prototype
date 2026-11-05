// Dữ liệu mẫu ban đầu (tồn kho, vài đơn ở các trạng thái, tài khoản demo).
// Ngày tháng tính lùi từ thời điểm nạp để dữ liệu luôn "gần đây".
"use strict";
const BX = require("../public/data.js");
const ENG = require("../public/engine.js");
const db = require("./db");
const { hashPassword } = require("./auth");

const DEMO_STAFF_PASSWORD = "BuildX@2026";
const STAFF = [
  { name: "Nguyễn Thái Bảo", email: "bao@buildx.vn", role: "Quản lý" },
  { name: "Trần Đức Huy", email: "huy.tran@buildx.vn", role: "Kỹ thuật viên" },
  { name: "Lê Phương Thảo", email: "thao.le@buildx.vn", role: "Nhân viên tư vấn" },
  { name: "Phạm Quốc Việt", email: "viet.pham@buildx.vn", role: "Nhân viên bán hàng" },
  { name: "Đỗ Minh Khoa", email: "khoa.do@buildx.vn", role: "Thủ kho" },
  { name: "Vũ Hồng Nhung", email: "nhung.vu@buildx.vn", role: "Quản trị viên" },
];

async function seed(c) {
  await c.query("TRUNCATE audit_log, warranties, rma_tickets, service_requests, purchase_orders, stock_units, orders, coupons, customers, staff_users, otp_codes RESTART IDENTITY CASCADE");
  await c.query("DELETE FROM app_meta WHERE key IN ('seq', 'seeded', 'version')");
  const base = Date.now();
  const ago = (d, h = 10) => { const x = new Date(base - d * 864e5); x.setUTCHours(h - 7, 0, 0, 0); return x; };
  let clock = ago(30);
  const st = ENG.emptyState();
  const E = ENG.create(BX, st, { now: () => clock, actor: () => "Nguyễn Thái Bảo" });
  const tick = (min) => (clock = new Date(clock.getTime() + min * 60e3));

  BX.P.filter((p) => !p.ref).forEach((p) => E.receive(p.id, p.stock, ago(8 + (p.id.charCodeAt(1) % 10))));
  st.units.filter((u) => ["R04", "K03", "T03"].includes(u.id)).forEach((u) => (u.inDate = ago(75))); // vài lô tồn lâu: cảnh báo > 60 ngày

  st.coupons.push(
    { code: "MOBAN", desc: "Giảm 2% đơn PC mùa khai trương", type: "pct", val: 2, scope: "pc", from: ago(10), to: ago(-120), min: 0, max: 500, used: 41 },
    { code: "HSSV", desc: "Giảm 300.000đ cho học sinh, sinh viên", type: "amt", val: 300000, scope: "all", from: ago(10), to: ago(-365), min: 15000000, max: 300, used: 9 },
    { code: "TUAN200", desc: "Mã giới thiệu: người mua giảm 100.000đ", type: "amt", val: 100000, scope: "pc", from: ago(10), to: ago(-365), min: 0, max: 50, used: 1 },
  );

  const pc = (key, asm) => ({ type: "pc", title: BX.COMBOS.find((x) => x.key === key).name, src: "combo", cfg: E.cfgFromCombo(key), asm: asm || "shop" });
  const mk = (opts, steps) => {
    clock = opts.date;
    const o = E.createOrder(opts);
    if (steps.paid) { tick(3); E.gatewayPaid(o, steps.paid === "full" ? o.total : o.pay.due); }
    if (steps.verify) o.risk.verified = true;
    if (steps.to >= 1) { tick(40); E.confirmOrder(o); }
    if (steps.to >= 2 && o.status === "Đã xác nhận") { tick(20); E.toNext(o); }
    if (steps.tech) o.tech = steps.tech;
    if (steps.to >= 3 && o.status === "Lắp ráp & QC") { tick(240); E.qcResult(o, { pass: true, cpu: 71, gpu: 68, ram: 0, cb: 12180, min: 190, photos: 4 }); }
    if (steps.to >= 4) { tick(60); E.ship(o, steps.wb || "AHM-77310"); }
    if (steps.to >= 5) { tick(180); E.complete(o); }
    return o;
  };
  mk({ cust: { name: "Bùi Tiến Dũng", phone: "0934 781 556", addr: "12 Trần Thái Tông, Cầu Giấy" }, lines: [pc("gamer")], payMethod: "VNPAY", date: ago(13) }, { paid: "full", to: 5, wb: "AHM-70112" });
  mk({ cust: { name: "Nguyễn Minh Anh", phone: "0912 345 678", addr: "18 Hoàng Quốc Việt, Cầu Giấy", tier: "vip" }, lines: [pc("gamer")], payMethod: "VNPAY", date: ago(11), tierDisc: E.tierDiscount("vip", E.cfgPrice(E.cfgFromCombo("gamer")) + BX.FEES.asm) }, { paid: "full", to: 5, wb: "AHM-70140" });
  const nextgen = BX.PRESET_CUSTOMERS.find((x) => x.tier === "b2b");
  mk({ cust: { name: nextgen.name, phone: nextgen.phone, addr: nextgen.addrs[0].text, tier: "b2b" }, lines: [pc("creator"), pc("creator")], payMethod: "Công nợ B2B", vatInvoice: nextgen.company, date: ago(4), tierDisc: E.tierDiscount("b2b", 2 * (E.cfgPrice(E.cfgFromCombo("creator")) + BX.FEES.asm)) }, { verify: true, to: 1 });
  mk({ cust: { name: "Vũ Khánh Linh", phone: "0977 120 334", addr: "45 Lê Lai, TP. Thanh Hóa" }, lines: [{ type: "part", id: "R01", qty: 1 }], payMethod: "MoMo", ship: { mode: "out" }, date: ago(2) }, { paid: "full", to: 4, wb: "GHN 5KX9-22Q" });
  mk({ cust: { name: "Phạm Thu Trang", phone: "0903 556 120", addr: "8 Nguyễn Khánh Toàn, Cầu Giấy" }, lines: [pc("esports")], payMethod: "Thẻ", date: ago(1) }, { paid: "full", to: 2, tech: "Trần Đức Huy" });
  const lqt = mk({ cust: { name: "Lê Quang Thắng", phone: "0987 222 019", addr: "22 Lạch Tray, Hải Phòng" }, lines: [pc("creator")], payMethod: "VNPAY", ship: { mode: "out" }, date: ago(1, 15) }, { paid: "deposit", verify: true, to: 1 });
  mk({ cust: { name: "Hoàng Bảo Ngọc", phone: "0915 909 221", addr: "3 Duy Tân, Cầu Giấy" }, lines: [pc("esports", "none"), { type: "part", id: "D01", qty: 1 }], payMethod: "MoMo", ship: { mode: "pickup" }, date: ago(0, 8) }, { paid: "full", to: 1 });
  mk({ cust: { name: "Đỗ Hoàng Nam", phone: "0868 441 902", addr: "99 Xuân Thủy, Cầu Giấy" }, lines: [pc("gamer"), { type: "part", id: "D01", qty: 1 }, { type: "part", id: "KB1", qty: 1 }], payMethod: "COD", date: ago(0, 9) }, { to: 0 });

  clock = ago(1, 16);
  const po = E.createPO([{ id: "C02", q: 1 }, { id: "G03", q: 1 }], "NPP01", lqt.id); po.status = "NPP xác nhận"; po.eta = E.dstr(ago(-1));

  const dung = st.orders.find((o) => o.cust.name === "Bùi Tiến Dũng");
  const dSn = st.units.find((u) => u.order === dung.id && u.id === "P01");
  st.requests.push(
    { id: "YC-" + ++st.seq.req, type: "Tư vấn", src: "Facebook (nhân viên nhập)", cust: "Mai Thu Hà", phone: "0913 556 009", what: "Hỏi nâng cấp RAM cho máy cũ", when: "", tech: "", st: "Hoàn tất", code: "TV-" + ++st.seq.tv, created: ago(3) },
    { id: "YC-" + ++st.seq.req, type: "Bảo hành", src: "Zalo (nhân viên nhập)", cust: "Bùi Tiến Dũng", phone: "0934 781 556", what: "Máy tự tắt khi chơi game nặng", when: "", tech: "Trần Đức Huy", st: "Đang xử lý", code: "BH-" + ++st.seq.bh, created: ago(1) },
    { id: "YC-" + ++st.seq.req, type: "Đặt lịch", src: "Website", cust: "Trần Minh Khôi", phone: "0904 220 118", what: "Vệ sinh – thay keo tại nhà (nội thành)", when: E.dstr(ago(-2)).slice(0, 5) + " 09:00–11:00", tech: "", st: "Mới", code: "DV-" + ++st.seq.dv, created: ago(0, 9) },
  );
  st.requests.reverse();
  st.rma.push({ id: "RMA-" + ++st.seq.rma, sn: dSn ? dSn.sn : "", order: dung.id, symptom: "Tự tắt khi chơi game nặng", diag: "Nguồn sụt áp ở tải 400 W (thử bằng nguồn dự phòng)", action: "Đổi nguồn với Nhà phân phối C, cho khách mượn nguồn dự phòng", st: "Chờ NPP", hist: [E.dstr(ago(1)) + ": tiếp nhận từ Zalo", E.dstr(ago(1)) + ": chẩn đoán nguồn", E.dstr(ago(1)) + ": gửi NPP C"] });

  // Không ghi nhật ký giả lập của quá trình nạp; chỉ ghi một dòng đánh dấu
  st.log.length = 0;
  clock = new Date(base);
  E.log("Nạp dữ liệu mẫu ban đầu", "Hệ thống", "Hệ thống");

  const empty = {}; Object.keys(db.TABLES).forEach((k) => (empty[k] = new Map())); empty.seq = "";
  await db.saveState(c, st, empty);

  for (const u of STAFF) await c.query("INSERT INTO staff_users (email, name, role, active, pass_hash) VALUES ($1, $2, $3, true, $4)", [u.email, u.name, u.role, hashPassword(DEMO_STAFF_PASSWORD)]);
  const saved = E.cfgFromCombo("gamer"); saved.case = { mode: "buy", id: "K04", qty: 1 };
  for (const pc0 of BX.PRESET_CUSTOMERS) {
    const doc = JSON.parse(JSON.stringify(pc0));
    doc.saved = pc0.tier === "vip" ? [{ code: "CFG-7Q2K", title: "BX Gamer – case trắng", cfg: saved, date: E.dstr(ago(8)) }] : [];
    await c.query("INSERT INTO customers (phone, name, doc) VALUES ($1, $2, $3)", [db.normPhone(pc0.phone), pc0.name, JSON.stringify(doc)]);
  }
  await db.setMeta(c, "seeded", { at: new Date().toISOString() });
}

module.exports = { seed, DEMO_STAFF_PASSWORD, STAFF };
