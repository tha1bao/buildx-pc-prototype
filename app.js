(function () {
"use strict";
const { C, SLOTS, TIERS, APPS, FPS, ORDER_STEPS, ORDERS, LEADS, SUPPLIERS, PLAN, RULES, sell } = window.BX;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n) => Math.round(n).toLocaleString("vi-VN") + "đ";
const tr = (n, d = 1) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const find = (slot, id) => C[slot].find((x) => x.id === id);
const findAny = (id) => { for (const s in C) { const x = C[s].find((y) => y.id === id); if (x) return { ...x, slot: s }; } return null; };
const price = (b) => SLOTS.reduce((s, [k]) => s + sell(find(k, b[k]).mkt), 0);
const uc = (s) => `<span class="uc">${s}</span>`;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2600); }

// ---------------- state ----------------
const S = {
  user: null,
  need: { budget: 25000000, purpose: "game", apps: ["Valorant", "Black Myth: Wukong"], res: "1080", color: "Trắng", upgrade: "Có, sau 1–2 năm" },
  build: { ...TIERS[1].b }, baseTier: TIERS[1],
  cart: [{ type: "pc", title: "BX Gamer", b: { ...TIERS[1].b } }],
  care: true, pay: "dep", ship: "hn",
  saved: [{ code: "CFG-7Q2K", title: "BX Gamer – case trắng", b: { ...TIERS[1].b }, date: "16/02/2027" }],
  myOrder: null,
  receive: [],
};
const cartTotal = () => S.cart.reduce((s, i) => s + (i.type === "pc" ? price(i.b) : sell(findAny(i.id).mkt) * i.qty), 0) + (S.care && S.cart.some((i) => i.type === "pc") ? 490000 : 0);

function checks(b) {
  const g = (s) => find(s, b[s]), out = [];
  const cpu = g("cpu"), mb = g("main"), ram = g("ram"), vga = g("vga"), psu = g("psu"), cs = g("case"), cl = g("cool");
  out.push(cpu.socket === mb.socket ? ["ok", "Socket", `CPU và mainboard cùng ${cpu.socket}.`] : ["bad", "Socket", `CPU dùng ${cpu.socket}, mainboard là ${mb.socket}. Đổi mainboard cùng socket.`]);
  out.push(ram.type === mb.ram ? ["ok", "RAM", `Mainboard nhận ${mb.ram}, RAM là ${ram.type}.`] : ["bad", "RAM", `Mainboard chỉ nhận ${mb.ram}, RAM đang chọn là ${ram.type}.`]);
  out.push(cs.ff.includes(mb.ff) ? ["ok", "Kích thước", `Case nhận mainboard ${mb.ff}.`] : ["bad", "Kích thước", `Case chỉ nhận ${cs.ff.join("/")}, mainboard là ${mb.ff}.`]);
  out.push(vga.len <= cs.gpu ? ["ok", "VGA", `VGA dài ${vga.len} mm, case cho tối đa ${cs.gpu} mm.`] : ["bad", "VGA", `VGA dài ${vga.len} mm vượt giới hạn ${cs.gpu} mm của case.`]);
  out.push(cl.h <= cs.cool ? ["ok", "Tản", `Tản cao ${cl.h} mm, case cho tối đa ${cs.cool} mm.`] : ["bad", "Tản", `Tản cao ${cl.h} mm, case chỉ cho ${cs.cool} mm.`]);
  out.push(cl.tdp >= cpu.w ? ["ok", "Nhiệt", `Tản chịu ~${cl.tdp} W, CPU tối đa ~${cpu.w} W.`] : ["warn", "Nhiệt", `CPU tối đa ~${cpu.w} W, tản chỉ ~${cl.tdp} W: có thể hạ xung khi tải nặng.`]);
  const load = cpu.w + vga.w + 75, need = Math.round(load * 1.3);
  out.push(psu.w >= need ? ["ok", "Nguồn", `Tải ước tính ${load} W; khuyến nghị ≥ ${need} W, nguồn ${psu.w} W.`] : psu.w >= load * 1.1 ? ["warn", "Nguồn", `Nguồn ${psu.w} W chạy được nhưng dư tải dưới 30% (nên ≥ ${need} W).`] : ["bad", "Nguồn", `Nguồn ${psu.w} W không đủ cho tải ~${load} W.`]);
  return out;
}
const checkHtml = (cs) => `<div class="stack" style="gap:6px">${cs.map((c) => `<div class="check ${c[0]}"><b class="t">${c[0] === "ok" ? "ĐẠT" : c[0] === "warn" ? "LƯU Ý" : "LỖI"}</b><span><b>${c[1]}:</b> ${c[2]}</span></div>`).join("")}</div>`;

function recommend() {
  const B = S.need.budget;
  let pool = TIERS.map((t) => ({ ...t, price: price(t.b) }));
  if (S.need.purpose === "creator") pool = pool.filter((t) => t.key !== "esports");
  if (S.need.purpose === "esports" || S.need.purpose === "study") pool = pool.filter((t) => t.key !== "creator");
  pool.sort((a, b) => a.price - b.price);
  const bal = pool.reduce((p, t) => (Math.abs(t.price - B) < Math.abs(p.price - B) ? t : p), pool[0]);
  const lo = pool.filter((t) => t.price < bal.price).pop(), hi = pool.find((t) => t.price > bal.price);
  return [["Tiết kiệm", lo], ["Cân bằng", bal], ["Hiệu năng", hi]].filter((x) => x[1]);
}
function fpsLine(b) {
  const tier = find("vga", b.vga).tier, games = S.need.apps.filter((a) => FPS[a]), k = S.need.res === "1440" ? 0.72 : 1;
  if (!games.length) return S.need.purpose === "creator" ? "Ưu tiên VRAM và RAM cho phần mềm đã chọn" : "Chọn game để xem FPS ước tính";
  return games.slice(0, 3).map((g) => `${g} ~${Math.round(FPS[g][tier - 1] * k)} FPS`).join(" · ");
}

// ---------------- screens ----------------
const SCREENS = [];
const add = (code, path, title, ucs, area, render, mount) => SCREENS.push({ code, path, title, ucs, area, render, mount });

// ===== STORE =====
add("S00", "map", "Sơ đồ màn hình", "—", "store", () => {
  const grp = (a, t) => `<h2 style="margin-top:22px">${t}</h2><div class="map">${SCREENS.filter((s) => a.split(",").includes(s.area) && s.path !== "map").map((s) => `<a href="#/${s.path}"><span class="code">${s.code} · ${s.ucs}</span><b>${s.title}</b></a>`).join("")}</div>`;
  return `<div class="wrap page"><span class="lbl">Prototype ISC301 · ${SCREENS.length - 1} màn hình</span><h1>Sơ đồ màn hình BuildX PC</h1>
  <p class="muted" style="max-width:70ch">Mỗi màn hình gắn với use case trong tài liệu dự án. Giá linh kiện lấy từ bảng giá 20/10/2026 (giá bán = giá thị trường thấp nhất + 6%). Dữ liệu khách hàng, đơn hàng là dữ liệu mẫu. Nút “Màn hình” ở góc dưới bên phải mở danh sách này ở mọi trang.</p>
  ${grp("store", "Website khách hàng")}${grp("admin-bare,admin", "Hệ thống nội bộ (tư vấn, kho, kỹ thuật, quản lý)")}</div>`;
});

add("S01", "home", "Trang chủ", "UC02, UC03", "store", () => `
<div class="wrap page">
  <section class="hero">
    <div>
      <span class="pill acc">Xưởng lắp ráp tại Hà Nội · Giao toàn quốc</span>
      <h1 style="margin-top:12px">Nói nhu cầu. Nhận cấu hình có giải thích. Máy chạy thử 2–4 giờ trước khi giao.</h1>
      <p class="muted" style="font-size:16px;max-width:56ch">Chọn ngân sách và game, phần mềm bạn dùng. BuildX chọn linh kiện tương thích, nói rõ vì sao, lắp ráp, burn-in và gửi báo cáo kiểm thử của chính máy bạn.</p>
      <div class="row" style="margin-top:14px"><a class="btn" href="#/wizard">Tư vấn cấu hình miễn phí</a><a class="btn ghost" href="#/builder">Tự build PC</a></div>
    </div>
    <div class="panel"><span class="lbl">Ví dụ báo cáo burn-in · BX Gamer</span>
      <div class="grid2" style="margin-top:10px">
        <div class="kpi"><div class="lbl">CPU tối đa</div><div class="v">71°C</div></div>
        <div class="kpi"><div class="lbl">GPU tối đa</div><div class="v">68°C</div></div>
        <div class="kpi"><div class="lbl">Cinebench R23</div><div class="v">12.180</div></div>
        <div class="kpi"><div class="lbl">MemTest86</div><div class="v">0 lỗi</div></div>
      </div><p class="xs muted" style="margin-top:8px">Số liệu minh họa</p></div>
  </section>
  <h2 style="margin-top:28px">4 gói PC chuẩn</h2>
  <div class="grid4">${TIERS.map((t) => `<div class="card"><div class="thumb">${t.name}<br>${find("vga", t.b.vga).n.replace("GeForce ", "")}</div><b>${t.name}</b><span class="small muted">${t.use}</span><span class="price big">${fmt(price(t.b))}</span>${t.comp ? `<span class="xs muted">Cấu hình tương đương nơi khác: ${fmt(t.comp)}</span>` : `<span class="xs muted">&nbsp;</span>`}<a class="btn sm plain" href="#/product/${t.key}">Xem chi tiết</a></div>`).join("")}</div>
  <div class="grid3" style="margin-top:28px">
    <div class="panel"><h3>Giá bằng linh kiện lẻ</h3><p class="small muted">Gói PC = tổng giá từng linh kiện tại BuildX. Lắp ráp, burn-in, giao nội thành miễn phí.</p></div>
    <div class="panel"><h3>Kiểm tra tương thích 12 luật</h3><p class="small muted">Socket, chuẩn RAM, kích thước case, chiều dài VGA, chiều cao tản, công suất nguồn…</p></div>
    <div class="panel"><h3>Một đầu mối bảo hành</h3><p class="small muted">BuildX nhận máy, khoanh vùng lỗi và đổi linh kiện với nhà phân phối thay bạn.</p></div>
  </div>
</div>`);

add("S02", "login", "Đăng nhập / Đăng ký bằng OTP", "UC01", "store", () => `
<div class="wrap page" style="max-width:460px">
  <div class="panel"><h1>Đăng nhập</h1><p class="muted small">Nhập số điện thoại để nhận mã OTP. Chưa có tài khoản sẽ được tạo tự động. ${uc("UC01")}</p>
    <form id="f-phone"><div class="field"><label for="ph">Số điện thoại</label><input id="ph" type="tel" value="0912 345 678" required></div><button class="btn" type="submit">Gửi mã OTP</button></form>
    <form id="f-otp" hidden style="margin-top:16px"><p class="small">Mã gồm 6 số đã gửi tới <b>0912 345 678</b>. Demo: nhập bất kỳ.</p>
      <div class="otp">${[1, 2, 3, 4, 5, 6].map((i) => `<input id="o${i}" type="text" inputmode="numeric" maxlength="1" value="${"482915"[i - 1]}" aria-label="Số ${i}">`).join("")}</div>
      <div class="row" style="margin-top:12px"><button class="btn" type="submit">Xác nhận</button><span class="xs muted">Gửi lại sau 45 giây</span></div></form>
  </div>
  <p class="xs muted" style="margin-top:10px">Khách vãng lai vẫn đặt hàng được; đăng nhập để lưu cấu hình, theo dõi đơn và bảo hành.</p>
</div>`, () => {
  $("#f-phone").onsubmit = (e) => { e.preventDefault(); $("#f-otp").hidden = false; toast("Đã gửi mã OTP"); };
  $("#f-otp").onsubmit = (e) => { e.preventDefault(); S.user = { name: "Nguyễn Minh Anh", phone: "0912 345 678" }; toast("Đăng nhập thành công"); location.hash = "#/account"; };
});

add("S03", "catalog", "Danh mục linh kiện", "UC02", "store", () => {
  const cats = [["all", "Tất cả"], ...SLOTS];
  return `<div class="wrap page"><div class="row between"><div><h1>Linh kiện</h1><p class="muted small">Giá đã gồm VAT. Tình trạng kho cập nhật theo thời gian thực. ${uc("UC02")}</p></div><input id="q" type="text" placeholder="Tìm theo tên, socket, VRAM…" style="max-width:320px"></div>
  <div class="side l" style="margin-top:10px">
    <div class="panel"><div class="field"><label for="cat">Nhóm</label><select id="cat">${cats.map((c) => `<option value="${c[0]}">${c[1]}</option>`).join("")}</select></div>
      <div class="field"><label for="pmax">Giá tối đa</label><input id="pmax" type="range" min="500000" max="20000000" step="500000" value="20000000"><span class="mono small" id="pmaxv">20.000.000đ</span></div>
      <div class="field"><label>Tình trạng</label><div class="chips"><button class="chip" type="button" id="instock" aria-pressed="false">Chỉ hàng có sẵn</button></div></div>
      <p class="xs muted">Hàng “Đặt trước 2–3 ngày” được nhập theo đơn từ nhà phân phối.</p></div>
    <div class="grid3" id="plist"></div></div></div>`;
}, () => {
  const draw = () => {
    const cat = $("#cat").value, q = $("#q").value.toLowerCase(), max = +$("#pmax").value, only = $("#instock").getAttribute("aria-pressed") === "true";
    $("#pmaxv").textContent = fmt(max);
    const items = []; for (const s in C) if (cat === "all" || cat === s) C[s].forEach((x) => items.push({ ...x, slot: s }));
    const list = items.filter((x) => !x.n.includes("*") && sell(x.mkt) <= max && (!only || x.stock > 0) && (x.n + JSON.stringify(x.spec)).toLowerCase().includes(q));
    $("#plist").innerHTML = list.length ? list.map((x) => `<div class="card"><div class="thumb">${esc(x.brand)}</div><span class="xs muted">${SLOTS.find((s) => s[0] === x.slot)[1]}</span><b class="small">${esc(x.n)}</b><span class="price">${fmt(sell(x.mkt))}</span>${x.stock ? `<span class="pill ok">Còn ${x.stock} chiếc</span>` : `<span class="pill warn">Đặt trước 2–3 ngày</span>`}<div class="row"><a class="btn sm plain" href="#/item/${x.id}">Chi tiết</a><button class="btn sm" type="button" data-add="${x.id}">Thêm</button></div></div>`).join("") : `<div class="empty" style="grid-column:1/-1">Không có linh kiện khớp bộ lọc. Thử bỏ bớt điều kiện.</div>`;
    $$("[data-add]").forEach((b) => (b.onclick = () => { S.cart.push({ type: "part", id: b.dataset.add, qty: 1 }); toast("Đã thêm vào giỏ hàng"); renderHeader(); }));
  };
  ["#cat", "#q", "#pmax"].forEach((s) => ($(s).oninput = draw));
  $("#instock").onclick = (e) => { e.target.setAttribute("aria-pressed", e.target.getAttribute("aria-pressed") !== "true"); draw(); };
  draw();
});

add("S04", "item/C01", "Chi tiết linh kiện", "UC02", "store", (p) => {
  const x = findAny(p || "C01");
  return `<div class="wrap page"><a href="#/catalog" class="small">← Danh mục</a><div class="side" style="margin-top:12px">
   <div class="panel"><div class="grid2"><div class="thumb" style="aspect-ratio:1">${esc(x.brand)}<br>${esc(x.n)}</div><div class="stack"><h1 style="font-size:24px">${esc(x.n)}</h1><span class="price big">${fmt(sell(x.mkt))}</span>${x.stock ? `<span class="pill ok">Còn ${x.stock} chiếc tại kho Hà Nội</span>` : `<span class="pill warn">Đặt trước – nhập từ nhà phân phối 2–3 ngày</span>`}<dl class="spec">${Object.entries(x.spec).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl><p class="small muted">${esc(x.why)}</p></div></div></div>
   <div class="panel stack"><h3>Mua hàng</h3><div class="row"><label for="qty" class="small">Số lượng</label><input id="qty" type="number" min="1" value="1" style="width:80px"></div><button class="btn" type="button" id="buy">Thêm vào giỏ hàng</button><a class="btn ghost" href="#/builder">Dùng trong cấu hình</a><p class="xs muted">Bảo hành chính hãng 36 tháng qua BuildX · Lắp đặt miễn phí tại xưởng nếu mua kèm PC ${uc("UC02")}</p></div></div></div>`;
}, (p) => { $("#buy").onclick = () => { S.cart.push({ type: "part", id: p || "C01", qty: +$("#qty").value || 1 }); toast("Đã thêm vào giỏ hàng"); renderHeader(); }; });

add("S05", "product/gamer", "Chi tiết gói PC", "UC02, UC04", "store", (p) => {
  const t = TIERS.find((x) => x.key === (p || "gamer")) || TIERS[1];
  return `<div class="wrap page"><a href="#/home" class="small">← Trang chủ</a><div class="side" style="margin-top:12px">
   <div class="panel"><h1>${t.name}</h1><p class="muted">${t.use}</p><div class="tbl"><table><thead><tr><th>Thành phần</th><th>Linh kiện & lý do chọn</th><th class="num">Giá</th></tr></thead><tbody>${SLOTS.map(([k, l]) => { const x = find(k, t.b[k]); return `<tr><td><b>${l}</b></td><td>${esc(x.n)}<div class="xs muted">${esc(x.why)}</div></td><td class="num">${fmt(sell(x.mkt))}</td></tr>`; }).join("")}</tbody></table></div>
   <h3 style="margin-top:16px">FPS ước tính 1080p</h3><p class="mono small">${Object.keys(FPS).slice(0, 5).map((g) => `${g}: ~${FPS[g][find("vga", t.b.vga).tier - 1]}`).join(" · ")}</p></div>
   <div class="panel stack"><span class="lbl">Giá trọn bộ</span><span class="price big">${fmt(price(t.b))}</span><span class="small muted">Gồm lắp ráp, burn-in 2–4 giờ, giao nội thành Hà Nội.</span>${t.comp ? `<span class="notice ok small">Rẻ hơn ${Math.round((1 - price(t.b) / t.comp) * 100)}% so với cấu hình tương đương ${fmt(t.comp)} (10/2026).</span>` : ""}
   <button class="btn" type="button" id="addpc">Thêm vào giỏ hàng</button><button class="btn ghost" type="button" id="custom">Tùy chỉnh cấu hình này</button>${checkHtml(checks(t.b)).replace('class="stack"', 'class="stack small"')}</div></div></div>`;
}, (p) => {
  const t = TIERS.find((x) => x.key === (p || "gamer")) || TIERS[1];
  $("#addpc").onclick = () => { S.cart.push({ type: "pc", title: t.name, b: { ...t.b } }); toast("Đã thêm " + t.name); renderHeader(); };
  $("#custom").onclick = () => { S.build = { ...t.b }; S.baseTier = t; location.hash = "#/builder"; };
});

add("S06", "wizard", "Khai báo nhu cầu (4 bước)", "UC03", "store", () => `<div class="wrap page" style="max-width:760px"><h1>Bạn cần PC để làm gì?</h1><p class="muted small">4 câu hỏi, khoảng 1 phút. ${uc("UC03")}</p><div class="wz" id="wz"></div><div class="panel" id="wzbody"></div></div>`, () => {
  let step = 0;
  const steps = [
    () => `<h2>1. Ngân sách</h2><div class="price big" id="bv">${fmt(S.need.budget)}</div><input type="range" id="bud" min="18000000" max="50000000" step="1000000" value="${S.need.budget}" aria-label="Ngân sách"><p class="xs muted">Giá năm 2026: PC chơi game AAA mượt ở 1080p bắt đầu khoảng 25 triệu.</p>`,
    () => `<h2>2. Mục đích chính</h2><div class="chips">${[["game", "Chơi game"], ["esports", "Game eSports, FPS cao"], ["creator", "Đồ họa, video, AI"], ["study", "Học tập, lập trình"]].map(([v, l]) => `<button class="chip" type="button" data-p="${v}" aria-pressed="${S.need.purpose === v}">${l}</button>`).join("")}</div>`,
    () => `<h2>3. Game / phần mềm sẽ dùng</h2><div class="chips">${APPS[S.need.purpose].map((a) => `<button class="chip" type="button" data-a="${a}" aria-pressed="${S.need.apps.includes(a)}">${a}</button>`).join("")}</div><div class="field" style="margin-top:14px"><label for="res">Màn hình</label><select id="res"><option value="1080">1080p</option><option value="1440" ${S.need.res === "1440" ? "selected" : ""}>1440p (2K)</option></select></div>`,
    () => `<h2>4. Thẩm mỹ & nâng cấp</h2><div class="field"><label for="col">Màu case</label><select id="col">${["Trắng", "Đen", "Không quan trọng"].map((c) => `<option ${S.need.color === c ? "selected" : ""}>${c}</option>`).join("")}</select></div><div class="field"><label for="upg">Dự định nâng cấp</label><select id="upg">${["Có, sau 1–2 năm", "Không"].map((c) => `<option ${S.need.upgrade === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>`,
  ];
  const draw = () => {
    $("#wz").innerHTML = steps.map((_, i) => `<span class="${i <= step ? "on" : ""}"></span>`).join("");
    $("#wzbody").innerHTML = steps[step]() + `<div class="row between" style="margin-top:18px"><button class="btn plain" type="button" id="back" ${step ? "" : "disabled"}>Quay lại</button><button class="btn" type="button" id="next">${step < 3 ? "Tiếp tục" : "Xem 3 phương án"}</button></div>`;
    const bud = $("#bud"); if (bud) bud.oninput = () => { S.need.budget = +bud.value; $("#bv").textContent = fmt(S.need.budget); };
    $$("[data-p]").forEach((b) => (b.onclick = () => { S.need.purpose = b.dataset.p; S.need.apps = APPS[S.need.purpose].slice(0, 2); draw(); }));
    $$("[data-a]").forEach((b) => (b.onclick = () => { const a = b.dataset.a; S.need.apps = S.need.apps.includes(a) ? S.need.apps.filter((x) => x !== a) : [...S.need.apps, a]; draw(); }));
    if ($("#res")) $("#res").onchange = (e) => (S.need.res = e.target.value);
    if ($("#col")) $("#col").onchange = (e) => (S.need.color = e.target.value);
    if ($("#upg")) $("#upg").onchange = (e) => (S.need.upgrade = e.target.value);
    $("#back").onclick = () => { step--; draw(); };
    $("#next").onclick = () => { if (step < 3) { step++; draw(); } else location.hash = "#/results"; };
  };
  draw();
});

add("S07", "results", "3 phương án đề xuất", "UC04", "store", () => {
  const opts = recommend();
  return `<div class="wrap page"><div class="row between"><div><h1>3 phương án cho bạn</h1><p class="muted small">Ngân sách ${fmt(S.need.budget)} · ${S.need.apps.join(", ") || "chưa chọn game"} · ${S.need.res}p · case ${S.need.color.toLowerCase()} ${uc("UC04")}</p></div><a class="btn plain sm" href="#/wizard">Sửa nhu cầu</a></div>
  <div class="grid3" style="margin-top:14px">${opts.map(([lab, t]) => { const d = t.price - S.need.budget; return `<div class="card ${lab === "Cân bằng" ? "sel" : ""}"><span class="lbl" style="color:var(--accent)">${lab}${lab === "Cân bằng" ? " · đề xuất" : ""}</span><b style="font-size:18px">${t.name}</b><span class="small muted">${t.use}</span><span class="price big">${fmt(t.price)}</span><span class="xs ${d > 0 ? "" : "muted"}">${d > 0 ? "Vượt ngân sách " + fmt(d) : "Dưới ngân sách " + fmt(-d)}</span><span class="mono xs muted">${fpsLine(t.b)}</span>
    <ul class="small" style="margin:4px 0 0;padding-left:18px">${["cpu", "vga", "ram"].map((k) => `<li><b>${find(k, t.b[k]).n}</b> – ${find(k, t.b[k]).why}</li>`).join("")}</ul>
    <div class="row" style="margin-top:auto"><button class="btn sm" type="button" data-pick="${t.key}">Chọn & tùy chỉnh</button><button class="btn sm plain" type="button" data-cart="${t.key}">Thêm vào giỏ</button></div></div>`; }).join("")}</div>
  <p class="xs muted" style="margin-top:12px">FPS là ước tính minh họa; bản thật lấy từ dữ liệu benchmark (UC29). Không tìm thấy phương án ưng ý? <a href="#/consult">Gửi yêu cầu tư vấn</a>.</p></div>`;
}, () => {
  $$("[data-pick]").forEach((b) => (b.onclick = () => { const t = TIERS.find((x) => x.key === b.dataset.pick); S.build = { ...t.b }; S.baseTier = t; location.hash = "#/builder"; }));
  $$("[data-cart]").forEach((b) => (b.onclick = () => { const t = TIERS.find((x) => x.key === b.dataset.cart); S.cart.push({ type: "pc", title: t.name, b: { ...t.b } }); renderHeader(); toast("Đã thêm " + t.name); }));
});

add("S08", "builder", "Tự build / tùy chỉnh cấu hình", "UC05", "store", () => `<div class="wrap page"><h1>Tùy chỉnh cấu hình</h1><p class="muted small">Đổi linh kiện bất kỳ, hệ thống kiểm tra tương thích ngay. Linh kiện có dấu * dùng để thử luật tương thích. ${uc("UC05")}</p><div class="side" style="margin-top:12px"><div class="tbl"><table><thead><tr><th>Thành phần</th><th>Linh kiện</th><th class="num">Giá</th></tr></thead><tbody id="bom"></tbody></table></div><div class="panel stack" id="bside"></div></div></div>`, () => {
  const draw = () => {
    $("#bom").innerHTML = SLOTS.map(([k, l]) => { const x = find(k, S.build[k]); return `<tr><td><b>${l}</b></td><td><select data-slot="${k}" aria-label="${l}">${C[k].map((o) => `<option value="${o.id}" ${o.id === x.id ? "selected" : ""}>${esc(o.n)}${o.stock ? "" : " (đặt trước)"}</option>`).join("")}</select><div class="xs muted" style="margin-top:3px">${esc(x.why)}</div></td><td class="num">${fmt(sell(x.mkt))}</td></tr>`; }).join("");
    const cs = checks(S.build), bad = cs.some((c) => c[0] === "bad");
    $("#bside").innerHTML = `<span class="lbl">Tổng cấu hình</span><span class="price big">${fmt(price(S.build))}</span><span class="mono xs muted">${fpsLine(S.build)}</span>${checkHtml(cs)}<button class="btn" type="button" id="bc" ${bad ? "disabled" : ""}>${bad ? "Sửa lỗi để đặt hàng" : "Thêm vào giỏ hàng"}</button><div class="row"><button class="btn sm plain" type="button" id="bs">Lưu cấu hình</button><a class="btn sm ghost" href="#/consult">Hỏi chuyên viên</a></div>`;
    $$("[data-slot]").forEach((s) => (s.onchange = () => { S.build[s.dataset.slot] = s.value; draw(); }));
    $("#bc").onclick = () => { S.cart.push({ type: "pc", title: "Cấu hình tùy chỉnh", b: { ...S.build } }); renderHeader(); location.hash = "#/cart"; };
    $("#bs").onclick = () => { S.saved.unshift({ code: "CFG-" + Math.random().toString(36).slice(2, 6).toUpperCase(), title: "Cấu hình tùy chỉnh", b: { ...S.build }, date: "Hôm nay" }); toast("Đã lưu cấu hình"); location.hash = "#/saved"; };
  };
  draw();
});

add("S09", "saved", "Cấu hình đã lưu & chia sẻ", "UC06", "store", () => `<div class="wrap page"><h1>Cấu hình đã lưu</h1><p class="muted small">Chia sẻ link cho bạn bè hoặc gửi cho chuyên viên. ${uc("UC06")}</p><div class="stack" style="margin-top:12px">${S.saved.map((s) => `<div class="panel row between"><div><span class="mono xs muted">${s.code} · ${s.date}</span><br><b>${esc(s.title)}</b><div class="small muted">${find("cpu", s.b.cpu).n} · ${find("vga", s.b.vga).n} · ${find("ram", s.b.ram).n}</div></div><div class="row"><span class="price">${fmt(price(s.b))}</span><input type="text" readonly value="buildx.vn/c/${s.code}" style="width:190px" aria-label="Link chia sẻ"><button class="btn sm plain" type="button" data-copy="buildx.vn/c/${s.code}">Sao chép link</button><button class="btn sm" type="button" data-open="${s.code}">Mở</button></div></div>`).join("")}</div></div>`, () => {
  $$("[data-copy]").forEach((b) => (b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy).then(() => toast("Đã sao chép link"), () => toast("Hãy chọn và sao chép link thủ công")); }));
  $$("[data-open]").forEach((b) => (b.onclick = () => { S.build = { ...S.saved.find((s) => s.code === b.dataset.open).b }; location.hash = "#/builder"; }));
});

add("S10", "consult", "Yêu cầu tư vấn", "UC07", "store", () => `<div class="wrap page" style="max-width:720px"><h1>Nói chuyện với chuyên viên</h1><p class="muted small">Chuyên viên phản hồi trong 15 phút (8:00–21:00). Cấu hình bạn đang xem sẽ được gửi kèm. ${uc("UC07")}</p>
<form class="panel" id="fc"><div class="grid2"><div class="field"><label for="cn">Họ tên</label><input id="cn" type="text" value="Nguyễn Minh Anh"></div><div class="field"><label for="cp">Số điện thoại / Zalo</label><input id="cp" type="tel" value="0912 345 678"></div></div>
<div class="field"><label for="ch">Kênh liên hệ</label><select id="ch"><option>Zalo</option><option>Gọi điện</option><option>Messenger</option><option>Đến xưởng (đặt lịch)</option></select></div>
<div class="field"><label for="cm">Câu hỏi</label><textarea id="cm">Mình muốn case trắng, sau này có nâng lên RTX 5070 được không?</textarea></div>
<div class="notice small">Đính kèm: ${find("cpu", S.build.cpu).n} · ${find("vga", S.build.vga).n} · ${fmt(price(S.build))}</div><div style="margin-top:12px"><button class="btn" type="submit">Gửi yêu cầu</button></div></form></div>`, () => {
  $("#fc").onsubmit = (e) => { e.preventDefault(); toast("Đã gửi. Chuyên viên sẽ liên hệ qua " + $("#ch").value); };
});

add("S11", "cart", "Giỏ hàng", "UC08, UC13", "store", () => {
  if (!S.cart.length) return `<div class="wrap page"><h1>Giỏ hàng</h1><div class="empty">Giỏ hàng trống. <a href="#/wizard">Tư vấn cấu hình</a> hoặc <a href="#/catalog">xem linh kiện</a>.</div></div>`;
  const hasPC = S.cart.some((i) => i.type === "pc");
  return `<div class="wrap page"><h1>Giỏ hàng</h1><p class="muted small">${uc("UC08")} ${uc("UC13")}</p><div class="side" style="margin-top:12px"><div class="stack">${S.cart.map((i, idx) => i.type === "pc" ? `<div class="panel"><div class="row between"><b>${esc(i.title)}</b><span class="price">${fmt(price(i.b))}</span></div><div class="small muted">${SLOTS.map(([k]) => find(k, i.b[k]).n).join(" · ")}</div><div class="row" style="margin-top:8px"><span class="pill acc">Lắp ráp + burn-in miễn phí</span><button class="btn sm plain" type="button" data-rm="${idx}">Xóa</button></div></div>` : `<div class="panel row between"><div><b>${esc(findAny(i.id).n)}</b><div class="xs muted">Số lượng ${i.qty}</div></div><div class="row"><span class="price">${fmt(sell(findAny(i.id).mkt) * i.qty)}</span><button class="btn sm plain" type="button" data-rm="${idx}">Xóa</button></div></div>`).join("")}
  ${hasPC ? `<label class="panel row" for="care" style="cursor:pointer"><input type="checkbox" id="care" ${S.care ? "checked" : ""}><span><b>BuildX Care 12 tháng – 490.000đ</b><br><span class="small muted">2 lần vệ sinh – thay keo, hỗ trợ từ xa ưu tiên 24/7, nhắc bảo dưỡng</span></span></label>` : ""}</div>
  <div class="panel stack"><span class="lbl">Tạm tính</span><span class="price big">${fmt(cartTotal())}</span><div class="field"><label for="vc">Mã giảm giá / giới thiệu</label><div class="row"><input id="vc" type="text" placeholder="VD: TUAN200" style="flex:1"><button class="btn sm plain" type="button" id="av">Áp dụng</button></div></div><a class="btn" href="#/checkout">Tiến hành đặt hàng</a></div></div></div>`;
}, () => {
  $$("[data-rm]").forEach((b) => (b.onclick = () => { S.cart.splice(+b.dataset.rm, 1); renderHeader(); route(); }));
  const c = $("#care"); if (c) c.onchange = () => { S.care = c.checked; route(); };
  const av = $("#av"); if (av) av.onclick = () => toast($("#vc").value ? "Mã hợp lệ: giảm 100.000đ khi đơn hoàn tất" : "Nhập mã trước khi áp dụng");
});

add("S12", "checkout", "Thông tin đặt hàng", "UC08", "store", () => `<div class="wrap page"><h1>Đặt hàng</h1><p class="muted small">${uc("UC08")}</p><form id="fco" class="side" style="margin-top:12px"><div class="panel">
<div class="grid2"><div class="field"><label for="n">Họ tên</label><input id="n" type="text" value="Nguyễn Minh Anh" required></div><div class="field"><label for="p">Điện thoại</label><input id="p" type="tel" value="0912 345 678" required></div></div>
<div class="field"><label for="a">Địa chỉ</label><input id="a" type="text" value="Số 12 ngõ 165 Cầu Giấy, Hà Nội"></div>
<div class="field"><label for="sh">Giao hàng</label><select id="sh"><option value="hn">Nội thành Hà Nội – miễn phí, trong ngày sau QC</option><option value="tinh">Liên tỉnh – kiện gỗ + khai giá (phí báo khi xác nhận)</option><option value="shop">Nhận tại xưởng</option></select></div>
<span class="lbl">Thanh toán</span><div class="stack" style="gap:8px;margin-top:6px"><label class="panel row" for="pd" style="padding:10px"><input type="radio" name="pay" id="pd" value="dep" ${S.pay === "dep" ? "checked" : ""}><span><b>Đặt cọc 30% qua VietQR</b><br><span class="small muted">Bắt buộc với đơn có CPU/VGA nhập theo đơn</span></span></label><label class="panel row" for="pf" style="padding:10px"><input type="radio" name="pay" id="pf" value="full" ${S.pay === "full" ? "checked" : ""}><span><b>Thanh toán đủ</b><br><span class="small muted">VietQR, thẻ hoặc ví qua cổng thanh toán</span></span></label><label class="panel row" for="pi" style="padding:10px"><input type="radio" name="pay" id="pi" value="inst"><span><b>Trả góp qua công ty tài chính</b><br><span class="small muted">Duyệt hồ sơ trực tuyến</span></span></label></div>
<div class="field" style="margin-top:12px"><label for="no">Ghi chú</label><textarea id="no">Đi dây gọn, bật LED màu trắng.</textarea></div></div>
<div class="panel stack"><span class="lbl">Tổng đơn</span><span class="price big">${fmt(cartTotal())}</span><span class="small muted">Lắp ráp, burn-in 2–4 giờ: 0đ</span><button class="btn" type="submit">Đặt hàng & thanh toán</button><span class="xs muted">Bấm đặt hàng là đồng ý điều khoản bán hàng và chính sách bảo mật.</span></div></form></div>`, () => {
  $("#fco").onsubmit = (e) => { e.preventDefault(); S.pay = ($("input[name=pay]:checked") || {}).value || "dep"; const t = cartTotal(); S.myOrder = { id: "BX-2702-0119", total: t, need: S.pay === "full" ? t : Math.round(t * 0.3 / 1000) * 1000, step: 0, items: [...S.cart] }; location.hash = "#/pay"; };
});

add("S13", "pay", "Thanh toán VietQR / đặt cọc", "UC09", "store", () => {
  const o = S.myOrder || { id: "BX-2702-0119", total: 25830000, need: 7749000 };
  const qr = Array.from({ length: 441 }, (_, i) => { const x = i % 21, y = (i / 21) | 0, f = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13); const ring = f && !(((x % 14) > 0 && (x % 14) < 6 && (y % 14) > 0 && (y % 14) < 6) && !((x % 14) > 1 && (x % 14) < 5 && (y % 14) > 1 && (y % 14) < 5)); return `<i class="${(f ? ring : ((x * 7 + y * 13 + x * y) % 3 === 0)) ? "" : "w"}"></i>`; }).join("");
  return `<div class="wrap page" style="max-width:760px"><h1>Quét mã để ${S.pay === "full" ? "thanh toán" : "đặt cọc"}</h1><p class="muted small">Đơn ${o.id}. Hệ thống tự xác nhận khi nhận được tiền. ${uc("UC09")}</p><div class="panel grid2" style="margin-top:12px"><div class="qr" aria-label="Mã VietQR minh họa">${qr}</div><dl class="spec"><dt>Số tiền</dt><dd class="price">${fmt(o.need)}</dd><dt>Nội dung</dt><dd>${o.id}</dd><dt>Tài khoản</dt><dd>CÔNG TY TNHH BUILDX</dd><dt>Tổng đơn</dt><dd>${fmt(o.total)}</dd><dt>Giữ hàng đến</dt><dd>30 phút</dd></dl></div><div class="row" style="margin-top:14px"><button class="btn" type="button" id="paid">Mô phỏng: ngân hàng báo đã nhận tiền</button><span class="xs muted">Bản thật nhận thông báo IPN từ cổng thanh toán.</span></div></div>`;
}, () => { $("#paid").onclick = () => { if (!S.myOrder) S.myOrder = { id: "BX-2702-0119", total: 25830000, need: 7749000, items: [...S.cart] }; S.myOrder.step = 1; S.cart = []; renderHeader(); toast("Đã nhận tiền cọc. Đơn đang chờ xác nhận"); location.hash = "#/order"; }; });

add("S14", "account", "Tài khoản & đơn của tôi", "UC01, UC10", "store", () => {
  const mine = [S.myOrder && { id: S.myOrder.id, item: "Đơn vừa đặt", total: S.myOrder.total, step: S.myOrder.step }, ...ORDERS.filter((o) => o.cust === "Nguyễn Minh Anh")].filter(Boolean);
  return `<div class="wrap page"><h1>Xin chào, Minh Anh</h1><p class="muted small">0912 345 678 · Thành viên từ 02/2027 ${uc("UC10")}</p>
  <div class="grid4" style="margin:14px 0"><a class="kpi" href="#/saved" style="text-decoration:none;color:inherit"><div class="lbl">Cấu hình đã lưu</div><div class="v">${S.saved.length}</div></a><a class="kpi" href="#/care" style="text-decoration:none;color:inherit"><div class="lbl">BuildX Care</div><div class="v">Còn 11 tháng</div></a><a class="kpi" href="#/referral" style="text-decoration:none;color:inherit"><div class="lbl">Voucher giới thiệu</div><div class="v">200.000đ</div></a><a class="kpi" href="#/warranty" style="text-decoration:none;color:inherit"><div class="lbl">Yêu cầu bảo hành</div><div class="v">0 đang mở</div></a></div>
  <div class="tbl"><table><thead><tr><th>Mã đơn</th><th>Sản phẩm</th><th>Trạng thái</th><th class="num">Tổng</th><th></th></tr></thead><tbody>${mine.map((o) => `<tr><td class="mono">${o.id}</td><td>${esc(o.item)}</td><td><span class="pill ${o.step >= 7 ? "ok" : "info"}">${ORDER_STEPS[o.step][0]}</span></td><td class="num">${fmt(o.total)}</td><td><a href="#/order">Theo dõi</a></td></tr>`).join("")}</tbody></table></div></div>`;
});

add("S15", "order", "Theo dõi đơn & báo cáo QC", "UC10", "store", () => {
  const o = S.myOrder || { id: ORDERS[0].id, total: ORDERS[0].total, step: ORDERS[0].step };
  const s = o.step;
  return `<div class="wrap page"><div class="row between"><div><h1>Đơn ${o.id}</h1><p class="muted small">Tổng ${fmt(o.total)} · Nội thành Hà Nội ${uc("UC10")}</p></div><span class="pill ${s >= 7 ? "ok" : "info"}">${ORDER_STEPS[s][0]}</span></div>
  <div class="side l" style="margin-top:12px"><div class="panel"><ol class="steps">${ORDER_STEPS.map((x, i) => `<li class="${i < s ? "done" : i === s ? "now" : ""}"><span class="dot">${i < s ? "✓" : ""}</span><span><b>${x[0]}</b><br><span class="xs muted">${x[1]}</span></span></li>`).join("")}</ol><button class="btn ghost sm" type="button" id="adv" ${s >= 7 ? "disabled" : ""} style="margin-top:8px">Mô phỏng bước tiếp theo</button></div>
  <div class="stack">${s >= 5 ? `<div class="panel"><h2>Báo cáo burn-in</h2><p class="small">Chạy 3 giờ 10 phút · Kỹ thuật viên Trần Đức Huy · Kết quả <b style="color:var(--ok)">ĐẠT</b></p><div class="grid4"><div class="kpi"><div class="lbl">CPU tối đa</div><div class="v">71°C</div><div class="d">Ngưỡng &lt; 90°C</div></div><div class="kpi"><div class="lbl">GPU tối đa</div><div class="v">68°C</div><div class="d">Ngưỡng &lt; 85°C</div></div><div class="kpi"><div class="lbl">Cinebench R23</div><div class="v">12.180</div><div class="d">Multi-core</div></div><div class="kpi"><div class="lbl">MemTest86</div><div class="v">0 lỗi</div><div class="d">1 lượt đầy đủ</div></div></div><p class="xs muted" style="margin-top:8px">Ảnh đi dây: 4 ảnh · Serial linh kiện: 8 · Số liệu minh họa</p></div>` : `<div class="empty">Báo cáo burn-in sẽ hiện ở bước “Burn-in & QC”.</div>`}
  ${s >= 7 ? `<div class="panel row between"><span>Máy đã giao. Bạn hài lòng chứ?</span><div class="row"><a class="btn sm" href="#/review">Đánh giá</a><a class="btn sm plain" href="#/warranty">Báo lỗi</a></div></div>` : ""}</div></div></div>`;
}, () => { $("#adv").onclick = () => { if (!S.myOrder) S.myOrder = { id: ORDERS[0].id, total: ORDERS[0].total, step: ORDERS[0].step }; S.myOrder.step++; route(); }; });

add("S16", "service", "Đặt lịch dịch vụ hậu mãi", "UC11", "store", () => `<div class="wrap page" style="max-width:760px"><h1>Đặt lịch dịch vụ</h1><p class="muted small">${uc("UC11")}</p><form class="panel" id="fs"><div class="field"><label for="sv">Dịch vụ</label><select id="sv"><option>Vệ sinh – thay keo tản nhiệt (250.000đ, miễn phí với BuildX Care)</option><option>Nâng cấp linh kiện tận nơi nội thành (200.000đ + linh kiện)</option><option>Lắp ráp hộ – khách tự mang linh kiện (300.000đ)</option><option>Kiểm tra máy chậm, quá nhiệt (miễn phí kiểm tra)</option></select></div>
<div class="grid2"><div class="field"><label for="dd">Ngày</label><input id="dd" type="date" value="2027-03-06"></div><div class="field"><label for="tt">Khung giờ</label><select id="tt"><option>9:00 – 11:00</option><option>14:00 – 16:00</option><option>18:00 – 20:00</option></select></div></div>
<div class="field"><label for="pl">Địa điểm</label><select id="pl"><option>Tại xưởng BuildX</option><option>Tận nhà (nội thành Hà Nội)</option></select></div><button class="btn" type="submit">Xác nhận lịch</button></form></div>`, () => { $("#fs").onsubmit = (e) => { e.preventDefault(); toast("Đã đặt lịch " + $("#dd").value + " " + $("#tt").value); }; });

add("S17", "warranty", "Yêu cầu bảo hành / hỗ trợ", "UC12", "store", () => `<div class="wrap page" style="max-width:760px"><h1>Báo lỗi & bảo hành</h1><p class="muted small">Chọn máy theo serial; BuildX khoanh vùng lỗi và làm việc với nhà phân phối thay bạn. ${uc("UC12")}</p><form class="panel" id="fw"><div class="field"><label for="m">Máy</label><select id="m"><option>BX Gamer · SN BX27-0112 · mua 15/02/2027</option></select></div>
<div class="field"><label for="sy">Triệu chứng</label><select id="sy"><option>Màn hình xanh / tự khởi động lại</option><option>Không lên hình</option><option>Quá nhiệt, quạt kêu to</option><option>Khác</option></select></div>
<div class="field"><label for="ds">Mô tả</label><textarea id="ds">Khi chơi Black Myth khoảng 30 phút thì máy tự tắt.</textarea></div>
<div class="field"><label for="fl">Ảnh / video</label><input id="fl" type="file" accept="image/*,video/*" multiple></div>
<div class="notice small">Gợi ý: mở UltraViewer và gửi ID để kỹ thuật viên hỗ trợ từ xa trước khi mang máy đến.</div><div style="margin-top:12px"><button class="btn" type="submit">Gửi yêu cầu</button></div></form></div>`, () => { $("#fw").onsubmit = (e) => { e.preventDefault(); toast("Đã tạo ticket TK-0451. KTV liên hệ trong 2 giờ làm việc"); }; });

add("S18", "care", "Gói BuildX Care", "UC13", "store", () => `<div class="wrap page" style="max-width:860px"><h1>BuildX Care 12 tháng</h1><p class="muted">490.000đ · mua kèm PC hoặc trong 30 ngày sau khi nhận máy ${uc("UC13")}</p><div class="grid3" style="margin-top:14px"><div class="panel"><h3>2 lần vệ sinh</h3><p class="small muted">Vệ sinh bụi, thay keo tản nhiệt, kiểm tra nhiệt độ (giá lẻ 250.000đ/lần).</p></div><div class="panel"><h3>Hỗ trợ từ xa ưu tiên</h3><p class="small muted">UltraViewer 24/7, phản hồi trong 30 phút.</p></div><div class="panel"><h3>Nhắc bảo dưỡng</h3><p class="small muted">Zalo nhắc lịch mỗi 6 tháng; ưu đãi 5% khi nâng cấp.</p></div></div><div class="panel row between" style="margin-top:14px"><div><b>BX Gamer · SN BX27-0112</b><div class="small muted">Hiệu lực 15/02/2027 – 15/02/2028 · Đã dùng 0/2 lần vệ sinh</div></div><span class="pill ok">Đang hiệu lực</span></div></div>`);

add("S19", "referral", "Giới thiệu bạn bè", "UC14", "store", () => `<div class="wrap page" style="max-width:760px"><h1>Giới thiệu bạn – cùng nhận voucher</h1><p class="muted">Bạn nhận 200.000đ, bạn của bạn nhận 100.000đ khi họ mua PC. Từ 3 người được giới thiệu: thêm ưu đãi nâng cấp linh kiện. ${uc("UC14")}</p><div class="panel row between" style="margin-top:12px"><div><span class="lbl">Mã của bạn</span><div class="mono" style="font-size:26px;font-weight:600">MINHANH200</div></div><button class="btn plain" type="button" id="cp">Sao chép mã</button></div><div class="tbl" style="margin-top:14px"><table><thead><tr><th>Người được giới thiệu</th><th>Trạng thái</th><th class="num">Voucher</th></tr></thead><tbody><tr><td>Lý Minh Tuấn</td><td><span class="pill ok">Đã mua BX Esports</span></td><td class="num">200.000đ</td></tr><tr><td>Trần Hoài Nam</td><td><span class="pill info">Đang tư vấn</span></td><td class="num">–</td></tr></tbody></table></div></div>`, () => { $("#cp").onclick = () => navigator.clipboard?.writeText("MINHANH200").then(() => toast("Đã sao chép mã"), () => toast("Hãy sao chép mã thủ công")); });

add("S20", "review", "Đánh giá sản phẩm & dịch vụ", "UC15", "store", () => `<div class="wrap page" style="max-width:720px"><h1>Đánh giá đơn BX-2702-0112</h1><p class="muted small">${uc("UC15")}</p><form class="panel" id="fr"><div class="field"><label>Chất lượng máy</label><div class="chips" id="stars">${[1, 2, 3, 4, 5].map((i) => `<button class="chip" type="button" data-s="${i}" aria-pressed="${i <= 5}">${i}★</button>`).join("")}</div></div><div class="field"><label for="rv">Nhận xét</label><textarea id="rv">Đi dây rất gọn, nhiệt độ đúng như báo cáo. Giao nhanh.</textarea></div><div class="field"><label for="ri">Ảnh</label><input id="ri" type="file" accept="image/*"></div><button class="btn" type="submit">Gửi đánh giá</button><p class="xs muted" style="margin-top:8px">Đánh giá hiển thị sau khi kiểm duyệt.</p></form></div>`, () => {
  $$("[data-s]").forEach((b) => (b.onclick = () => $$("[data-s]").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.s <= +b.dataset.s))));
  $("#fr").onsubmit = (e) => { e.preventDefault(); toast("Cảm ơn bạn đã đánh giá"); };
});

// ===== ADMIN =====
add("A01", "staff-login", "Đăng nhập nhân viên", "UC31", "admin-bare", () => `<div class="wrap page" style="max-width:420px;padding-top:60px"><div class="panel"><div class="brand">Build<b>X</b> Workshop</div><p class="muted small">Hệ thống nội bộ cho tư vấn, kho, kỹ thuật viên và quản lý. ${uc("UC31")}</p><form id="fl"><div class="field"><label for="u">Email</label><input id="u" type="email" value="huy.tran@buildx.vn"></div><div class="field"><label for="pw">Mật khẩu</label><input id="pw" type="password" value="demo-password"></div><div class="field"><label for="rl">Vai trò (demo)</label><select id="rl"><option>Quản lý</option><option>Tư vấn bán hàng</option><option>Thủ kho</option><option>Kỹ thuật viên</option></select></div><button class="btn" type="submit" style="width:100%">Đăng nhập</button></form></div></div>`, () => { $("#fl").onsubmit = (e) => { e.preventDefault(); location.hash = "#/dashboard"; }; });

add("A02", "dashboard", "Tổng quan kinh doanh", "UC30", "admin", () => {
  const max = Math.max(...PLAN.net) * 1.05, act = PLAN.net.map((v, i) => (i < 2 ? v * (i ? 1.04 : 0.93) : null));
  return `<h1>Tổng quan kinh doanh</h1><p class="muted small">Kế hoạch năm 2027 theo mô hình tài chính; số “thực tế” T1–T2 là dữ liệu mẫu. ${uc("UC30")}</p>
  <div class="grid4" style="margin:14px 0"><div class="kpi"><div class="lbl">Đơn PC tháng 2</div><div class="v">13</div><div class="d">Kế hoạch 12</div></div><div class="kpi"><div class="lbl">DT thuần tháng 2</div><div class="v">363 tr</div><div class="d">Kế hoạch 349 tr</div></div><div class="kpi"><div class="lbl">Biên lãi gộp</div><div class="v">11,4%</div><div class="d">Kế hoạch 11,6%</div></div><div class="kpi"><div class="lbl">CAC</div><div class="v">2,6 tr</div><div class="d">Kế hoạch năm 1,0 tr/đơn PC</div></div></div>
  <div class="grid2"><div class="panel"><div class="row between"><h2>Doanh thu thuần theo tháng (triệu đồng)</h2><div class="legend"><span><i style="background:var(--line)"></i>Kế hoạch</span><span><i style="background:var(--accent)"></i>Thực tế</span></div></div><div class="bar">${PLAN.net.map((v, i) => `<div title="${PLAN.months[i]}: ${v}"><b class="${act[i] ? "" : "plan"}" style="height:${((act[i] || v) / max) * 100}%"></b><span>${PLAN.months[i]}</span></div>`).join("")}</div></div>
  <div class="panel"><h2>Lợi nhuận trước thuế kế hoạch</h2><div class="tbl"><table><thead><tr><th>Tháng</th>${PLAN.months.map((m) => `<th class="num">${m}</th>`).join("")}</tr></thead><tbody><tr><td>Đơn PC</td>${PLAN.pc.map((v) => `<td class="num">${v}</td>`).join("")}</tr><tr><td>EBT (tr)</td>${PLAN.ebt.map((v) => `<td class="num" style="color:${v < 0 ? "var(--bad)" : "var(--ok)"}">${v.toLocaleString("vi-VN")}</td>`).join("")}</tr></tbody></table></div><p class="xs muted" style="margin-top:8px">Hòa vốn ≈ 65 bộ PC/tháng · Có lãi từ T11/2027</p></div></div>
  <div class="grid3" style="margin-top:16px"><div class="panel"><h3>Cần xử lý</h3><ul class="small" style="padding-left:18px;margin:0"><li><a href="#/confirm">2 đơn chờ xác nhận</a> (1 rủi ro cao)</li><li><a href="#/po">2 PO chờ NPP giao</a></li><li><a href="#/qc">1 máy đang burn-in</a></li><li><a href="#/inventory">RAM 16GB dưới mức tối thiểu</a></li></ul></div><div class="panel"><h3>Bán chạy tháng 2</h3><ol class="small" style="padding-left:18px;margin:0"><li>BX Gamer – 6 bộ</li><li>BX Esports – 4 bộ</li><li>BX Creator – 2 bộ</li><li>RAM DDR4 16GB – 9 chiếc</li></ol></div><div class="panel"><h3>Kênh tạo lead</h3><ol class="small" style="padding-left:18px;margin:0"><li>TikTok – 41%</li><li>Google Search – 22%</li><li>Booth/offline – 18%</li><li>Giới thiệu – 11%</li></ol></div></div>`;
});

add("A03", "leads", "Quản lý lead (CRM)", "UC16", "admin", () => `<div class="row between"><div><h1>Lead & tư vấn</h1><p class="muted small">Tỷ lệ chốt tháng này 22% (giả định mô hình 20%) ${uc("UC16")}</p></div><button class="btn" type="button" onclick="location.hash='#/quote'">Tạo báo giá</button></div>
<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã</th><th>Khách</th><th>Nguồn</th><th>Nhu cầu</th><th>Trạng thái</th><th>Tạo</th><th></th></tr></thead><tbody>${LEADS.map((l) => `<tr><td class="mono">${l.id}</td><td>${l.name}</td><td class="small">${l.src}</td><td class="small">${l.need}</td><td><select aria-label="Trạng thái ${l.id}">${["Mới", "Đang tư vấn", "Đã gửi báo giá", "Đã chốt", "Mất"].map((s) => `<option ${s === l.st ? "selected" : ""}>${s}</option>`).join("")}</select></td><td class="small muted">${l.ago}</td><td><a href="#/quote">Báo giá</a></td></tr>`).join("")}</tbody></table></div>`);

add("A04", "quote", "Tạo cấu hình hộ khách & báo giá", "UC17", "admin", () => `<h1>Báo giá cho Phan Đức Mạnh (L-0928)</h1><p class="muted small">Nhu cầu: Valorant 240Hz, ngân sách 20 triệu. Dùng chung engine tương thích với website. ${uc("UC17")}</p><div class="side" style="margin-top:12px"><div class="tbl"><table><tbody>${SLOTS.map(([k, l]) => `<tr><td><b>${l}</b></td><td>${find(k, TIERS[0].b[k]).n}</td><td class="num">${fmt(sell(find(k, TIERS[0].b[k]).mkt))}</td></tr>`).join("")}</tbody></table></div><div class="panel stack"><span class="lbl">Tổng báo giá</span><span class="price big">${fmt(price(TIERS[0].b))}</span><span class="mono xs muted">Valorant ~260 FPS · CS2 ~170 FPS</span>${checkHtml(checks(TIERS[0].b).slice(0, 3))}<div class="field"><label for="gc">Lời nhắn</label><textarea id="gc">Cấu hình này đạt trên 240 FPS Valorant ở 1080p, còn dư nguồn để lên RTX 5060.</textarea></div><button class="btn" type="button" id="sq">Gửi link báo giá (hạn 48 giờ)</button></div></div>`, () => { $("#sq").onclick = () => toast("Đã gửi link buildx.vn/q/Q-2207 qua Zalo"); });

add("A05", "confirm", "Xác nhận đơn & đối soát", "UC18, UC33", "admin", () => `<h1>Đơn chờ xác nhận</h1><p class="muted small">Đối soát thanh toán tự động; tư vấn gọi xác nhận đơn &gt; 30 triệu hoặc điểm rủi ro ≥ 50. ${uc("UC18")} ${uc("UC33")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã đơn</th><th>Khách</th><th>Sản phẩm</th><th class="num">Tổng</th><th class="num">Đã nhận</th><th>Rủi ro</th><th></th></tr></thead><tbody>${ORDERS.filter((o) => o.step <= 3).map((o) => `<tr><td class="mono">${o.id}</td><td>${o.cust}<div class="xs muted">${o.phone}</div></td><td>${o.item}</td><td class="num">${fmt(o.total)}</td><td class="num">${fmt(o.paid)}</td><td><span class="pill ${o.risk >= 50 ? "bad" : o.risk >= 30 ? "warn" : "ok"}">${o.risk}/100</span></td><td class="row"><button class="btn sm" type="button" data-ok="${o.id}">Xác nhận</button><button class="btn sm plain" type="button" data-no="${o.id}">Hủy</button></td></tr>`).join("")}</tbody></table></div><div class="notice warn small" style="margin-top:12px">BX-2702-0115: SĐT mới, đơn 43,8 triệu, địa chỉ giao khác địa chỉ đăng ký → gọi xác nhận trước khi tạo PO cho CPU/VGA.</div>`, () => { $$("[data-ok]").forEach((b) => (b.onclick = () => { b.closest("tr").style.opacity = .45; toast(b.dataset.ok + " đã xác nhận, chuyển sang giữ hàng"); })); $$("[data-no]").forEach((b) => (b.onclick = () => toast("Mở form lý do hủy và hoàn cọc"))); });

add("A06", "receive", "Nhập kho theo serial", "UC19", "admin", () => `<h1>Nhập kho – PO-0231 (Nhà phân phối A)</h1><p class="muted small">Quét serial từng linh kiện, in tem QR nội bộ. ${uc("UC19")}</p><div class="side" style="margin-top:12px"><div class="tbl"><table><thead><tr><th>Mã</th><th>Linh kiện</th><th class="num">Đặt</th><th class="num">Đã quét</th><th class="num">Giá vốn</th></tr></thead><tbody><tr><td class="mono">C02</td><td>Intel Core i5-14600KF</td><td class="num">2</td><td class="num" id="sc1">${S.receive.length ? 1 : 0}</td><td class="num">${fmt(5690000 * .95)}</td></tr><tr><td class="mono">G03</td><td>GeForce RTX 5060 Ti 16GB</td><td class="num">1</td><td class="num">0</td><td class="num">${fmt(14390000 * .95)}</td></tr></tbody></table></div>
<form class="panel" id="fs"><div class="field"><label for="sn">Serial (quét hoặc gõ)</label><input id="sn" type="text" value="X3A7-14600KF-0092"></div><div class="field"><label for="cd">Ngoại quan</label><select id="cd"><option>Nguyên seal, đủ phụ kiện</option><option>Hộp móp – vẫn nhận</option><option>Lỗi – trả NPP</option></select></div><button class="btn" type="submit">Nhập & in tem</button><ul class="small mono" id="rl" style="padding-left:18px">${S.receive.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></form></div>`, () => { $("#fs").onsubmit = (e) => { e.preventDefault(); S.receive.push($("#sn").value); toast("Đã nhập kho, in tem QR"); route(); }; });

add("A07", "inventory", "Tồn kho & giữ hàng", "UC20, UC22", "admin", () => {
  const all = []; for (const s in C) C[s].forEach((x) => !x.n.includes("*") && all.push({ ...x, slot: s }));
  const minQ = { ram: 12, ssd: 8, psu: 6, case: 5, cool: 6 };
  return `<h1>Tồn kho</h1><p class="muted small">Linh kiện vòng quay nhanh giữ khoảng 2 tuần bán hàng; CPU/VGA nhập theo đơn. ${uc("UC20")} ${uc("UC22")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã</th><th>Linh kiện</th><th>Chiến lược</th><th class="num">Sẵn bán</th><th class="num">Đã giữ</th><th class="num">Tối thiểu</th><th>Cảnh báo</th></tr></thead><tbody>${all.map((x) => { const jit = ["cpu", "vga", "main"].includes(x.slot), held = x.stock ? Math.min(2, x.stock) : 0, min = minQ[x.slot] || 0, low = !jit && x.stock < min; return `<tr><td class="mono">${x.id}</td><td>${esc(x.n)}</td><td><span class="pill ${jit ? "warn" : "info"}">${jit ? "JIT" : "MTS"}</span></td><td class="num">${x.stock - held}</td><td class="num">${held}</td><td class="num">${jit ? "–" : min}</td><td>${low ? '<span class="pill bad">Dưới mức tối thiểu</span>' : ""}</td></tr>`; }).join("")}</tbody></table></div><div class="row" style="margin-top:12px"><button class="btn" type="button" onclick="location.hash='#/po'">Tạo PO bổ sung</button><span class="xs muted">Hàng tồn quá 60 ngày sẽ được đánh dấu để xả hàng trước khi trượt giá.</span></div>`;
});

add("A08", "po", "Đơn mua JIT gửi nhà phân phối", "UC21", "admin", () => `<h1>Đơn mua (PO)</h1><p class="muted small">Hệ thống gợi ý PO khi đơn khách thiếu hàng; quản lý duyệt rồi gửi NPP. ${uc("UC21")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>PO</th><th>Nhà phân phối</th><th>Hàng</th><th>Cho đơn</th><th>Dự kiến về</th><th>Trạng thái</th></tr></thead><tbody><tr><td class="mono">PO-0233</td><td>NPP A</td><td>i5-14600KF ×1, RTX 5070 ×1</td><td class="mono">BX-2702-0115</td><td>20/02</td><td><span class="pill warn">Chờ duyệt</span> <button class="btn sm" type="button" id="ap">Duyệt & gửi</button></td></tr><tr><td class="mono">PO-0232</td><td>NPP A</td><td>i5-14600KF ×1, RTX 5060 Ti ×1</td><td class="mono">BX-2702-0117</td><td>19/02</td><td><span class="pill info">NPP đã xác nhận</span></td></tr><tr><td class="mono">PO-0231</td><td>NPP A</td><td>i5-14600KF ×2, RTX 5060 Ti ×1</td><td class="mono">Bổ sung</td><td>18/02</td><td><span class="pill acc">Đang nhập kho</span></td></tr><tr><td class="mono">PO-0230</td><td>NPP B</td><td>RAM DDR4 16GB ×10, SSD 512GB ×6</td><td class="mono">MTS</td><td>17/02</td><td><span class="pill ok">Hoàn tất</span></td></tr></tbody></table></div>`, () => { $("#ap").onclick = (e) => { e.target.closest("td").innerHTML = '<span class="pill info">Đã gửi NPP</span>'; toast("Đã gửi PO-0233 cho NPP A"); }; });

add("A09", "suppliers", "Nhà cung cấp & bảng giá nhập", "UC23", "admin", () => `<h1>Nhà cung cấp</h1><p class="muted small">Mỗi nhóm hàng có ít nhất 2 NPP; đánh giá theo quý. Tên NPP là minh họa. ${uc("UC23")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã</th><th>Tên</th><th>Nhóm hàng</th><th>Chiết khấu</th><th>Công nợ</th><th>Giao hàng</th><th>Bảo hành</th><th class="num">Điểm</th></tr></thead><tbody>${SUPPLIERS.map((s) => `<tr><td class="mono">${s.id}</td><td>${s.name}</td><td>${s.grp}</td><td>${s.disc}</td><td class="small">${s.debt}</td><td>${s.lead}</td><td class="small">${s.rma}</td><td class="num">${s.score}</td></tr>`).join("")}</tbody></table></div><h2 style="margin-top:20px">Bảng giá nhập tuần 08/2027</h2><div class="tbl"><table><thead><tr><th>Mã</th><th>Linh kiện</th><th class="num">Giá thị trường</th><th class="num">Giá nhập</th><th class="num">Giá bán gợi ý (+6%)</th></tr></thead><tbody>${["C01", "G02", "R01", "S01", "P01"].map((id) => { const x = findAny(id); return `<tr><td class="mono">${id}</td><td>${x.n}</td><td class="num">${fmt(x.mkt)}</td><td class="num"><input type="number" value="${Math.round(x.mkt * .94 / 1000) * 1000}" style="width:130px;text-align:right" aria-label="Giá nhập ${id}"></td><td class="num">${fmt(sell(x.mkt))}</td></tr>`; }).join("")}</tbody></table></div>`);

add("A10", "assembly", "Phiếu lắp ráp & bảng điều phối", "UC24", "admin", () => {
  const cols = [[3, "Chờ hàng / giữ"], [4, "Đang lắp ráp"], [5, "Burn-in & QC"], [6, "Đang giao"], [7, "Hoàn tất"]];
  return `<h1>Bảng điều phối xưởng</h1><p class="muted small">Công suất: 1 kỹ thuật viên ≈ 3 bộ/ngày. ${uc("UC24")}</p><div class="board" style="margin-top:12px">${cols.map(([st, t]) => { const its = ORDERS.filter((o) => o.step === st); return `<div class="col"><h3><span>${t}</span><span>${its.length}</span></h3>${its.map((o) => `<div class="tk"><div class="id">${o.id}</div><b>${o.item}</b><div class="xs muted">${o.tech || "Chưa phân công"}</div>${o.jit.length && st === 3 ? '<span class="pill warn">Chờ NPP</span>' : ""}</div>`).join("")}</div>`; }).join("")}</div>
  <div class="panel" style="margin-top:16px"><h2>Phiếu lắp ráp BX-2702-0116 · BX Esports</h2><div class="grid2"><ul class="small" style="list-style:none;padding:0;margin:0" id="cl">${["Đối chiếu 8 serial đã giữ", "Lắp CPU, tra keo, lắp tản Hyper 212", "Lắp RAM kênh A2, SSD khe M.2_1", "Đi dây nguồn sau khay main, buộc dây", "Lắp VGA, cắm 8-pin", "Cập nhật BIOS bản mới nhất", "Chụp 4 ảnh đi dây"].map((s, i) => `<li style="padding:4px 0"><label><input type="checkbox" ${i < 4 ? "checked" : ""}> ${s}</label></li>`).join("")}</ul><dl class="spec">${SLOTS.map(([k, l]) => `<dt>${l}</dt><dd>${find(k, TIERS[0].b[k]).id}-SN${(1234 + k.length * 37) % 9999}</dd>`).join("")}</dl></div><button class="btn" type="button" id="done" style="margin-top:10px">Hoàn tất lắp ráp → chuyển QC</button></div>`;
}, () => { $("#done").onclick = () => { const all = $$("#cl input").every((c) => c.checked); toast(all ? "Đã chuyển BX-2702-0116 sang burn-in" : "Còn bước chưa tích trong checklist"); }; });

add("A11", "qc", "Ghi kết quả QC / burn-in", "UC25", "admin", () => `<h1>QC – BX-2702-0118 · BX Gamer</h1><p class="muted small">Ngưỡng đạt: CPU &lt; 90°C, GPU &lt; 85°C, 0 lỗi RAM, không treo/khởi động lại. ${uc("UC25")}</p><form class="panel" id="fq" style="margin-top:12px"><div class="grid4"><div class="field"><label for="tc">CPU tối đa (°C)</label><input id="tc" type="number" value="71"></div><div class="field"><label for="tg">GPU tối đa (°C)</label><input id="tg" type="number" value="68"></div><div class="field"><label for="cb">Cinebench R23</label><input id="cb" type="number" value="12180"></div><div class="field"><label for="me">Lỗi MemTest86</label><input id="me" type="number" value="0"></div></div><div class="grid2"><div class="field"><label for="du">Thời gian burn-in (phút)</label><input id="du" type="number" value="190"></div><div class="field"><label for="ph">Ảnh hoàn thiện</label><input id="ph" type="file" accept="image/*" multiple></div></div><div id="qres"></div><button class="btn" type="submit">Lưu kết quả</button></form>`, () => {
  const ev = () => { const ok = +$("#tc").value < 90 && +$("#tg").value < 85 && +$("#me").value === 0 && +$("#du").value >= 120; $("#qres").innerHTML = `<div class="check ${ok ? "ok" : "bad"}" style="margin-bottom:12px"><b class="t">${ok ? "ĐẠT" : "LỖI"}</b><span>${ok ? "Đủ điều kiện đóng gói. Báo cáo sẽ hiện trên trang theo dõi đơn của khách." : "Không đạt ngưỡng → mở RMA, khoanh vùng linh kiện."}</span></div>`; return ok; };
  $$("#fq input[type=number]").forEach((i) => (i.oninput = ev)); ev();
  $("#fq").onsubmit = (e) => { e.preventDefault(); const ok = ev(); toast(ok ? "Đã lưu, chuyển đóng gói" : "Đã mở phiếu RMA"); if (!ok) location.hash = "#/rma"; };
});

add("A12", "shipping", "Đóng gói & tạo vận đơn", "UC26", "admin", () => `<h1>Đóng gói & giao hàng</h1><p class="muted small">Kết nối API đơn vị vận chuyển để tạo vận đơn. ${uc("UC26")}</p><div class="side" style="margin-top:12px"><div class="tbl"><table><thead><tr><th>Đơn</th><th>Giao tới</th><th>Kiện</th><th>Vận đơn</th></tr></thead><tbody><tr><td class="mono">BX-2702-0118</td><td>Cầu Giấy, Hà Nội</td><td>Thùng 5 lớp, 15 kg</td><td><button class="btn sm" type="button" id="mk">Tạo vận đơn</button></td></tr><tr><td class="mono">BX-2702-0114</td><td>TP. Thanh Hóa</td><td>Hộp nhỏ, 0,3 kg</td><td class="mono">GHN 5KX9-22Q</td></tr></tbody></table></div><div class="panel"><h3>Checklist đóng gói PC</h3><ul class="small" style="padding-left:18px;margin:0"><li>Bơm bọt khí nở cố định VGA và tản nhiệt</li><li>Thùng 5 lớp, dán tem “Hàng dễ vỡ”</li><li>Liên tỉnh: đóng kiện gỗ, khai giá trị</li><li>Chụp ảnh trước khi đóng thùng</li><li>Kèm phiếu bảo hành + báo cáo burn-in in</li></ul></div></div>`, () => { $("#mk").onclick = (e) => { e.target.closest("td").innerHTML = '<span class="mono">AHM-77310</span>'; toast("Đã tạo vận đơn, gửi mã cho khách qua Zalo"); }; });

add("A13", "rma", "Bảo hành / RMA", "UC27", "admin", () => `<h1>Bảo hành & RMA</h1><p class="muted small">Một đầu mối cho khách; BuildX làm việc với NPP theo chính sách 1 đổi 1. ${uc("UC27")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Ticket</th><th>Máy / serial</th><th>Triệu chứng</th><th>Chẩn đoán</th><th>Hướng xử lý</th><th>Trạng thái</th></tr></thead><tbody><tr><td class="mono">TK-0451</td><td>BX Gamer · BX27-0112</td><td>Tự tắt khi chơi game nặng</td><td>Nguồn sụt áp ở tải 400 W (thử bằng nguồn dự phòng)</td><td>RMA nguồn với NPP C, đổi nguồn dự phòng cho khách dùng tạm</td><td><span class="pill warn">Chờ NPP</span></td></tr><tr><td class="mono">TK-0448</td><td>BX Esports · BX27-0098</td><td>Không lên hình</td><td>RAM lỏng sau vận chuyển</td><td>Lắp lại, burn-in 2 giờ</td><td><span class="pill ok">Đã trả máy</span></td></tr><tr><td class="mono">QC-0118</td><td>BX Creator (QC)</td><td>MemTest86 báo lỗi</td><td>Thanh RAM số 2 lỗi</td><td>Đổi RAM tại NPP B, chạy lại QC</td><td><span class="pill info">Đang xử lý</span></td></tr></tbody></table></div>`);

add("A14", "products", "Sản phẩm, giá & khuyến mãi", "UC28", "admin", () => {
  const all = []; for (const s in C) C[s].forEach((x) => !x.n.includes("*") && all.push(x));
  return `<h1>Sản phẩm & giá bán</h1><p class="muted small">Giá bán gợi ý = giá thị trường thấp nhất × 1,06 làm tròn 10.000đ. Cập nhật khi giá nhập thay đổi &gt; 5%. ${uc("UC28")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã</th><th>Sản phẩm</th><th class="num">Giá thị trường</th><th class="num">Giá bán</th><th>Hiển thị</th></tr></thead><tbody>${all.map((x) => `<tr><td class="mono">${x.id}</td><td>${esc(x.n)}</td><td class="num">${fmt(x.mkt)}</td><td class="num">${fmt(sell(x.mkt))}</td><td><span class="pill ok">Đang bán</span></td></tr>`).join("")}</tbody></table></div>
  <h2 style="margin-top:20px">Khuyến mãi</h2><div class="tbl"><table><thead><tr><th>Mã</th><th>Mô tả</th><th>Thời gian</th><th>Đã dùng</th></tr></thead><tbody><tr><td class="mono">MOBAN2027</td><td>Giảm 2% đơn PC mùa mở bán</td><td>T1–T3/2027</td><td>23</td></tr><tr><td class="mono">HSSV</td><td>Giảm 300.000đ cho học sinh, sinh viên</td><td>Cả năm</td><td>9</td></tr></tbody></table></div>`;
});

add("A15", "rules", "Luật tương thích & benchmark", "UC29", "admin", () => `<h1>Luật tương thích</h1><p class="muted small">Engine chạy toàn bộ luật cho mỗi cấu hình ở website, báo giá và phiếu lắp ráp. ${uc("UC29")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã</th><th>Luật</th><th>Mức</th><th>Biểu thức</th><th>Bật</th></tr></thead><tbody>${RULES.map((r) => `<tr><td class="mono">${r[0]}</td><td>${r[1]}</td><td><span class="pill ${r[2] === "Chặn" ? "bad" : r[2] === "Gợi ý" ? "info" : "warn"}">${r[2]}</span></td><td class="mono small">${esc(r[3])}</td><td><input type="checkbox" checked aria-label="Bật ${r[0]}"></td></tr>`).join("")}</tbody></table></div>
<h2 style="margin-top:20px">Dữ liệu FPS (1080p, ước tính minh họa)</h2><div class="tbl"><table><thead><tr><th>Game</th>${C.vga.map((v) => `<th class="num">${v.n.replace("GeForce ", "")}</th>`).join("")}</tr></thead><tbody>${Object.entries(FPS).map(([g, a]) => `<tr><td>${g}</td>${a.map((v) => `<td class="num">${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);

add("A16", "users", "Người dùng & phân quyền", "UC31", "admin", () => `<h1>Người dùng & phân quyền</h1><p class="muted small">${uc("UC31")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Quyền chính</th><th>Trạng thái</th></tr></thead><tbody>${[["Nguyễn Thái Bảo", "bao@buildx.vn", "Quản lý", "Toàn bộ, duyệt PO, giá"], ["Trần Đức Huy", "huy.tran@buildx.vn", "Kỹ thuật viên", "Phiếu lắp ráp, QC, RMA"], ["Ngô Văn Long", "long.ngo@buildx.vn", "Kỹ thuật viên", "Phiếu lắp ráp, QC, RMA"], ["Lê Phương Thảo", "thao.le@buildx.vn", "Tư vấn", "Lead, báo giá, xác nhận đơn"], ["Phạm Quốc Việt", "viet.pham@buildx.vn", "Thủ kho", "Nhập kho, giữ hàng, đóng gói"]].map((u) => `<tr><td>${u[0]}</td><td class="mono small">${u[1]}</td><td><select aria-label="Vai trò ${u[0]}">${["Quản lý", "Tư vấn", "Thủ kho", "Kỹ thuật viên", "Admin"].map((r) => `<option ${r === u[2] ? "selected" : ""}>${r}</option>`).join("")}</select></td><td class="small">${u[3]}</td><td><span class="pill ok">Hoạt động</span></td></tr>`).join("")}</tbody></table></div><p class="xs muted" style="margin-top:8px">Mọi thao tác với giá, kho, hoàn tiền được ghi nhật ký.</p>`);

add("A17", "ads", "Chiến dịch quảng cáo thương hiệu", "UC32", "admin", () => `<h1>Quảng cáo & hợp tác thương hiệu</h1><p class="muted small">Nguồn thu từ T7/2027: 5 triệu/chiến dịch. ${uc("UC32")}</p><div class="grid3" style="margin:12px 0"><div class="kpi"><div class="lbl">Chiến dịch đang chạy</div><div class="v">1</div></div><div class="kpi"><div class="lbl">Lượt hiển thị</div><div class="v">18.420</div></div><div class="kpi"><div class="lbl">Lượt nhấp</div><div class="v">612</div><div class="d">CTR 3,3%</div></div></div><div class="tbl"><table><thead><tr><th>Đối tác</th><th>Vị trí</th><th>Thời gian</th><th class="num">Phí</th><th>Trạng thái</th></tr></thead><tbody><tr><td>Hãng tản nhiệt (minh họa)</td><td>Sản phẩm nổi bật – trang build PC</td><td>07/2027</td><td class="num">5.000.000đ</td><td><span class="pill ok">Đang chạy</span></td></tr><tr><td>Nhà phân phối A</td><td>Banner trang chủ</td><td>08/2027</td><td class="num">5.000.000đ</td><td><span class="pill info">Đã ký</span></td></tr></tbody></table></div>`);

add("A18", "fraud", "Cảnh báo gian lận", "UC33", "admin", () => `<h1>Cảnh báo gian lận</h1><p class="muted small">Chấm điểm rủi ro khi đặt hàng và thanh toán. ${uc("UC33")}</p><div class="tbl" style="margin-top:12px"><table><thead><tr><th>Thời điểm</th><th>Đối tượng</th><th>Dấu hiệu</th><th>Điểm</th><th>Xử lý</th></tr></thead><tbody><tr><td>18/02 14:02</td><td class="mono">BX-2702-0115</td><td>SĐT mới, đơn 43,8 tr, địa chỉ giao khác đăng ký</td><td><span class="pill bad">64</span></td><td>Giữ đơn, tư vấn gọi xác nhận</td></tr><tr><td>17/02 21:40</td><td class="mono">0389 xxx 112</td><td>3 đơn COD bị từ chối nhận trong 60 ngày</td><td><span class="pill bad">81</span></td><td>Bắt buộc đặt cọc 100%</td></tr><tr><td>16/02 10:15</td><td class="mono">Mã TUAN200</td><td>Dùng 4 lần từ cùng thiết bị</td><td><span class="pill warn">45</span></td><td>Khóa mã, xác minh</td></tr></tbody></table></div>`);

// ---------------- shell & router ----------------
const storeNav = [["home", "Trang chủ"], ["wizard", "Tư vấn cấu hình"], ["builder", "Tự build"], ["catalog", "Linh kiện"], ["account", "Tài khoản"]];
const adminNav = [["Kinh doanh", [["dashboard", "Tổng quan"], ["leads", "Lead & tư vấn"], ["quote", "Báo giá"], ["confirm", "Xác nhận đơn"], ["fraud", "Gian lận"]]], ["Kho & mua hàng", [["inventory", "Tồn kho"], ["receive", "Nhập kho"], ["po", "Đơn mua JIT"], ["suppliers", "Nhà cung cấp"]]], ["Xưởng", [["assembly", "Điều phối & lắp ráp"], ["qc", "QC / burn-in"], ["shipping", "Đóng gói & giao"], ["rma", "Bảo hành RMA"]]], ["Quản trị", [["products", "Sản phẩm & giá"], ["rules", "Luật tương thích"], ["ads", "Quảng cáo"], ["users", "Phân quyền"]]]];
function renderHeader() { const b = $("#cartn"); if (b) b.textContent = S.cart.length; }
function shell(scr, body, path) {
  const fab = `<button class="btn fab" type="button" id="fab">Màn hình (${SCREENS.length - 1})</button>`;
  if (scr.area === "store") return `<header class="store-h"><div class="wrap"><a class="brand" href="#/home">Build<b>X</b> PC</a><nav class="snav">${storeNav.map(([p, l]) => `<a href="#/${p}" class="${path === p ? "on" : ""}">${l}</a>`).join("")}</nav><div class="sright"><a class="btn sm plain cartbtn" href="#/cart">Giỏ hàng<span class="badge" id="cartn">${S.cart.length}</span></a>${S.user ? `<a class="btn sm ghost" href="#/account">${S.user.name.split(" ").pop()}</a>` : `<a class="btn sm ghost" href="#/login">Đăng nhập</a>`}<a class="btn sm plain" href="#/staff-login">Nội bộ</a></div></div></header><main>${body}</main><footer class="store-f"><div class="wrap"><span>BuildX PC · Xưởng lắp ráp Cầu Giấy, Hà Nội · Prototype ISC301</span><span><a href="#/service">Đặt lịch dịch vụ</a> · <a href="#/warranty">Bảo hành</a> · <a href="#/care">BuildX Care</a> · <a href="#/referral">Giới thiệu bạn bè</a> · <a href="#/map">Sơ đồ màn hình</a></span></div></footer>${fab}`;
  if (scr.area === "admin-bare") return body + fab;
  return `<div class="admin"><aside class="rail"><a class="brand" href="#/dashboard">Build<b style="color:var(--accent)">X</b> Workshop</a>${adminNav.map(([g, items]) => `<div class="grp">${g}</div>${items.map(([p, l]) => { const sc = SCREENS.find((s) => s.path.split("/")[0] === p); return `<a href="#/${p}" class="${path === p ? "on" : ""}"><span>${l}</span><span class="n">${sc.code}</span></a>`; }).join("")}`).join("")}<div class="grp">Khác</div><a href="#/home"><span>Về website khách</span></a></aside><div><div class="atop"><span class="small muted">${scr.code} · ${scr.title}</span><span class="small">Nguyễn Thái Bảo · Quản lý</span></div><div class="amain">${body}</div></div></div>${fab}`;
}
function drawer() {
  const d = document.createElement("div"); d.className = "drawer";
  const grp = (a, t) => `<div class="lbl" style="margin:14px 8px 4px">${t}</div>${SCREENS.filter((s) => a.includes(s.area)).map((s) => `<a href="#/${s.path}"><span>${s.title}</span><span class="mono xs muted">${s.code}</span></a>`).join("")}`;
  d.innerHTML = `<div class="in" role="dialog" aria-label="Danh sách màn hình"><div class="row between"><b>Tất cả màn hình</b><button class="btn sm plain" type="button" id="dx">Đóng</button></div>${grp(["store"], "Website khách hàng")}${grp(["admin", "admin-bare"], "Hệ thống nội bộ")}</div>`;
  d.onclick = (e) => { if (e.target === d || e.target.id === "dx" || e.target.closest("a")) d.remove(); };
  document.body.appendChild(d);
}
function route() {
  const h = location.hash.replace(/^#\/?/, "") || "map";
  const [p, param] = h.split("/");
  const scr = SCREENS.find((s) => s.path.split("/")[0] === p) || SCREENS[0];
  $("#app").innerHTML = shell(scr, scr.render(param), p);
  document.title = `${scr.title} · BuildX PC Prototype`;
  if (scr.mount) scr.mount(param);
  $("#fab").onclick = drawer;
}
window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
route();
})();
