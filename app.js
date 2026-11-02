// BuildX PC – khung trang, router theo hash và các hàm hiển thị dùng chung.
window.BXA = (function () {
  "use strict";
  const { CAT, ROLES } = window.BX;
  const E = window.BXE, S = E.S;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString("vi-VN") + "đ";
  const tr = (n, d = 1) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: d });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2800); }
  const tag = (sc, ucs) => `<span class="uc">${sc}</span> <span class="uc">${ucs}</span>`;
  const stPill = (st) => `<span class="pill ${st === "Hoàn tất" ? "ok" : st === "Đã hủy" ? "bad" : st === "Chờ hàng" ? "warn" : st === "Mới" ? "acc" : "info"}">${st}</span>`;
  const payPill = (p) => `<span class="pill ${p.status === "Đã thanh toán" ? "ok" : p.status === "Đã cọc" ? "info" : "warn"}">${p.status}</span>`;
  const checkHtml = (rs) => rs.length ? `<div class="stack" style="gap:6px">${rs.map((c) => `<div class="check ${c.lv}"><b class="t">${c.lv === "ok" ? "ĐẠT" : c.lv === "warn" ? "LƯU Ý" : "LỖI"}</b><span><b>${c.r}</b> ${esc(c.m)}</span></div>`).join("")}</div>` : `<p class="small muted">Chưa đủ linh kiện để kiểm tra.</p>`;
  const availPill = (p) => { if (p.ref) return `<span class="pill">Model tham chiếu</span>`; const a = E.avail(p.id); return a > 0 ? `<span class="pill ok">Còn ${a}</span>` : `<span class="pill warn">Đặt trước ${p.grp === "C" ? "2–3 ngày · cọc 30%" : "1–2 ngày"}</span>`; };

  const SCREENS = [];
  const LINKS = { item: "item/G02", combo: "combo/gamer" };
  const add = (code, path, title, ucs, area, render, mount) => SCREENS.push({ code, path, title, ucs, area, render, mount, link: LINKS[path] });

  // ---------- quyền theo vai trò (UC22) ----------
  const allowed = (path) => { const r = ROLES[S.staff.role] || []; return r.includes("*") || r.includes(path); };
  const storeNav = [["home", "Trang chủ"], ["need", "Tư vấn"], ["builder", "Build PC"], ["upgrade", "Nâng cấp"], ["catalog", "Linh kiện"], ["service", "Dịch vụ"]];
  const adminNav = [
    ["Bán hàng & tư vấn", [["pos", "Bán tại quầy"], ["leads", "Lead"], ["quote", "Báo giá"], ["orders", "Đơn hàng"]]],
    ["Xưởng", [["workshop", "Điều phối xưởng"], ["ticket", "Phiếu lắp ráp & QC"], ["packing", "Đóng gói & bàn giao"]]],
    ["Kho & mua hàng", [["stock", "Tồn kho"], ["stockdoc", "Phiếu kho"], ["suppliers", "Nhà cung cấp"], ["po", "Đơn nhập"]]],
    ["Quản trị", [["products", "Sản phẩm & giá"], ["rules", "Luật tương thích"], ["combos", "Combo"], ["requests", "Yêu cầu dịch vụ"], ["rma", "Bảo hành / RMA"], ["coupons", "Mã giảm giá"], ["banners", "Banner & giới thiệu"], ["reports", "Báo cáo"], ["users", "Người dùng"]]],
  ];
  const cartCount = () => S.cart.length;
  function shell(scr, body, path) {
    const fab = `<button class="btn fab" type="button" id="fab">Màn hình (${SCREENS.filter((s) => s.code.startsWith("SC")).length})</button>`;
    if (scr.area === "store") return `<header class="store-h"><div class="wrap"><a class="brand" href="#/home">Build<b>X</b> PC</a><nav class="snav">${storeNav.map(([p, l]) => `<a href="#/${p}" class="${path === p ? "on" : ""}">${l}</a>`).join("")}</nav><div class="sright"><a class="btn sm plain cartbtn" href="#/cart">Giỏ hàng<span class="badge" id="cartn">${cartCount()}</span></a>${S.user ? `<a class="btn sm ghost" href="#/orders-me">${esc(S.user.name.split(" ").pop())}</a>` : `<a class="btn sm ghost" href="#/login">Đăng nhập</a>`}<a class="btn sm plain" href="#/orders">Nội bộ</a></div></div></header><main>${body}</main><footer class="store-f"><div class="wrap"><span>BuildX PC · Cửa hàng mặt phố, Hà Nội · Prototype ISC301 theo kế hoạch v3</span><span><a href="#/saved">Cấu hình đã lưu</a> · <a href="#/profile">Hồ sơ</a> · <a href="#/warranty">Bảo hành & Care</a> · <a href="#/map">Sơ đồ màn hình</a></span></div></footer>${fab}`;
    const role = `<label class="row small" style="gap:6px">Vai trò demo <select id="role" style="width:auto;padding:5px 8px">${Object.keys(ROLES).map((r) => `<option ${r === S.staff.role ? "selected" : ""}>${r}</option>`).join("")}</select></label>`;
    const ok = allowed(path);
    return `<div class="admin"><aside class="rail"><a class="brand" href="#/orders">Build<b style="color:var(--accent)">X</b> Nội bộ</a>${adminNav.map(([g, items]) => { const vis = items.filter(([p]) => allowed(p)); return vis.length ? `<div class="grp">${g}</div>${vis.map(([p, l]) => { const sc = SCREENS.find((s) => s.path === p); return `<a href="#/${p}" class="${path === p ? "on" : ""}"><span>${l}</span><span class="n">${sc ? sc.code : ""}</span></a>`; }).join("")}` : ""; }).join("")}<div class="grp">Khác</div><a href="#/home"><span>Website khách</span></a><a href="#/map"><span>Sơ đồ màn hình</span></a></aside><div><div class="atop"><span class="small muted">${scr.code} · ${esc(scr.title)}</span><span class="row small">${role}<span>${esc(S.staff.name)}</span></span></div><div class="amain">${ok ? body : `<div class="empty">Vai trò <b>${esc(S.staff.role)}</b> không có quyền mở màn hình này (UC22: mỗi người chỉ thấy chức năng đúng vai trò). Đổi vai trò ở góc trên.</div>`}</div></div></div>${fab}`;
  }
  function drawer() {
    const d = document.createElement("div"); d.className = "drawer";
    const grp = (a, t) => `<div class="lbl" style="margin:14px 8px 4px">${t}</div>${SCREENS.filter((s) => s.area === a && s.code.startsWith("SC")).map((s) => `<a href="#/${s.link || s.path}"><span>${esc(s.title)}</span><span class="mono xs muted">${s.code}</span></a>`).join("")}`;
    d.innerHTML = `<div class="in" role="dialog" aria-label="Danh sách màn hình"><div class="row between"><b>42 màn hình theo Product Tracking</b><button class="btn sm plain" type="button" id="dx">Đóng</button></div>${grp("store", "Khách hàng (SC01–SC21)")}${grp("admin", "Nhân viên (SC22–SC42)")}</div>`;
    d.onclick = (e) => { if (e.target === d || e.target.id === "dx" || e.target.closest("a")) d.remove(); };
    document.body.appendChild(d);
  }
  let current = null;
  function route() {
    const h = location.hash.replace(/^#\/?/, "") || "map";
    const [p, ...rest] = h.split("/");
    const param = rest.join("/") || undefined;
    const scr = SCREENS.find((s) => s.path === p) || SCREENS.find((s) => s.path === "map");
    current = { scr, param };
    $("#app").innerHTML = shell(scr, scr.render(param), scr.path);
    document.title = `${scr.title} · BuildX PC`;
    if (scr.mount && (scr.area !== "admin" || allowed(scr.path))) scr.mount(param);
    $("#fab").onclick = drawer;
    const r = $("#role"); if (r) r.onchange = () => { S.staff.role = r.value; const u = S.staffUsers.find((x) => x.role === r.value); S.staff.name = u ? u.name : S.staff.name; route(); };
  }
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  function start() {
    add("—", "map", "Sơ đồ màn hình", "—", "store", () => {
      const grp = (a, t) => `<h2 style="margin-top:22px">${t}</h2><div class="map">${SCREENS.filter((s) => s.area === a && s.code.startsWith("SC")).map((s) => `<a href="#/${s.link || s.path}"><span class="code">${s.code} · ${s.ucs}</span><b>${esc(s.title)}</b></a>`).join("")}</div>`;
      return `<div class="wrap page"><span class="lbl">Prototype ISC301 · bám Kế hoạch kinh doanh v3</span><h1>Sơ đồ 42 màn hình BuildX PC</h1>
      <p class="muted" style="max-width:76ch">Mã màn hình (SC01–SC42) và use case (UC01–UC22) khớp sheet "Use Case" và "Product Tracking". Giá bán = giá lẻ thấp nhất thị trường + 8% (bảng giá 20/10/2026). Khách hàng, đơn hàng, nhà phân phối là dữ liệu minh họa; trạng thái chỉ lưu trong bộ nhớ trang, tải lại trang sẽ về dữ liệu mẫu. Luồng demo: <a href="#/builder">Build PC</a> → giỏ → thanh toán → <a href="#/orders">đơn ở trang quản trị</a> → giữ hàng → lắp ráp & QC → xuất kho.</p>
      ${grp("store", "Khách hàng – website (SC01–SC21)")}${grp("admin", "Nhân viên – bán hàng, xưởng, kho, quản trị (SC22–SC42)")}</div>`;
    });
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
    route();
  }
  return { $, $$, fmt, tr, esc, toast, tag, stPill, payPill, checkHtml, availPill, add, route, rerender, start, CAT, SCREENS, current: () => current };
})();
