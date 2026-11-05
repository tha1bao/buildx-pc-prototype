// BuildX PC – khung trang, router theo hash và các hàm hiển thị dùng chung.
window.BXA = (function () {
  "use strict";
  const { CAT, ROLES, CUST_TIERS } = window.BX;
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
  const allowed = (path) => { if (!S.staff) return false; const r = ROLES[S.staff.role] || []; return r.includes("*") || r.includes(path); };
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
    if (scr.area === "store") {
      const u = S.user;
      const tInfo = u && CUST_TIERS ? CUST_TIERS[u.tier] : null;
      const userBtn = u ? `<a class="btn sm ghost" href="#/profile" style="display:inline-flex;align-items:center;gap:6px"><span class="pill ${tInfo ? tInfo.color : 'info'} xs">${tInfo ? tInfo.badge : 'Member'}</span><span>${esc(u.name.split(" ").slice(-2).join(" "))}</span></a>` : `<a class="btn sm ghost" href="#/login">Đăng nhập</a>`;
      return `<header class="store-h"><div class="wrap"><a class="brand" href="#/home">Build<b>X</b> PC</a><nav class="snav">${storeNav.map(([p, l]) => `<a href="#/${p}" class="${path === p ? "on" : ""}">${l}</a>`).join("")}</nav><div class="sright"><a class="btn sm plain cartbtn" href="#/cart">Giỏ hàng<span class="badge" id="cartn">${cartCount()}</span></a>${userBtn}</div></div></header><main>${body}</main><footer class="store-f"><div class="wrap"><span>BuildX PC · Cửa hàng mặt phố, Hà Nội · Dự án ISC301 theo kế hoạch v3</span><span><a href="#/saved">Cấu hình đã lưu</a> · <a href="#/profile">Hồ sơ thành viên</a> · <a href="#/warranty">Bảo hành & Care</a> · <a href="#/orders" class="muted xs" style="opacity:0.6" title="Khu vực dành cho nhân viên cửa hàng">Cổng nhân viên</a></span></div></footer>${fab}`;
    }
    if (!S.staff) return `<div class="admin"><aside class="rail"><a class="brand" href="#/orders">Build<b style="color:var(--accent)">X</b> Nội bộ</a><div class="grp">Khác</div><a href="#/home"><span>Website khách</span></a></aside><div><div class="atop"><span class="small muted">Trang nội bộ · cần đăng nhập</span></div><div class="amain">${staffLogin()}</div></div></div>${fab}`;
    const role = `<span class="pill info">${esc(S.staff.role)}</span><span>${esc(S.staff.name)}</span><button class="btn sm plain" type="button" id="slo">Đăng xuất</button>`;
    const badge = (p) => { const n = p === "orders" ? S.orders.filter((o) => o.status === "Mới").length : p === "requests" ? S.requests.filter((r) => r.st === "Mới").length : p === "po" ? E.poSuggestions().length : 0; return n ? `<span class="badge" title="Cần xử lý">${n}</span>` : ""; };
    const ok = allowed(path);
    return `<div class="admin"><aside class="rail"><a class="brand" href="#/orders">Build<b style="color:var(--accent)">X</b> Nội bộ</a>${adminNav.map(([g, items]) => { const vis = items.filter(([p]) => allowed(p)); return vis.length ? `<div class="grp">${g}</div>${vis.map(([p, l]) => { const sc = SCREENS.find((s) => s.path === p); return `<a href="#/${p}" class="${path === p ? "on" : ""}"><span>${l} ${badge(p)}</span><span class="n">${sc ? sc.code : ""}</span></a>`; }).join("")}` : ""; }).join("")}<div class="grp">Khác</div><a href="#/home"><span>Website khách</span></a><a href="#/map"><span>Sơ đồ màn hình</span></a></aside><div><div class="atop"><span class="small muted">${scr.code} · ${esc(scr.title)}</span><span class="row small">${role}</span></div><div class="amain">${ok ? body : `<div class="empty">Vai trò <b>${esc(S.staff.role)}</b> không có quyền mở màn hình này (UC22: mỗi người chỉ thấy chức năng đúng vai trò). Máy chủ cũng từ chối thao tác ngoài quyền.</div>`}</div></div></div>${fab}`;
  }
  function drawer() {
    const d = document.createElement("div"); d.className = "drawer";
    const grp = (a, t) => `<div class="lbl" style="margin:14px 8px 4px">${t}</div>${SCREENS.filter((s) => s.area === a && s.code.startsWith("SC")).map((s) => `<a href="#/${s.link || s.path}"><span>${esc(s.title)}</span><span class="mono xs muted">${s.code}</span></a>`).join("")}`;
    d.innerHTML = `<div class="in" role="dialog" aria-label="Danh sách màn hình"><div class="row between"><b>42 màn hình theo Product Tracking</b><button class="btn sm plain" type="button" id="dx">Đóng</button></div>${grp("store", "Khách hàng (SC01–SC21)")}${grp("admin", "Nhân viên (SC22–SC42)")}</div>`;
    d.onclick = (e) => { if (e.target === d || e.target.id === "dx" || e.target.closest("a")) d.remove(); };
    document.body.appendChild(d);
  }
  // ---------- đăng nhập nhân viên ----------
  function staffLogin() {
    return `<div class="panel" style="max-width:460px"><h1>Đăng nhập nội bộ</h1><p class="muted small">Tài khoản nhân viên do quản trị viên cấp (UC22). Mật khẩu lưu bằng hàm băm scrypt trên máy chủ; phiên hết hạn sau 12 giờ.</p>
      <form id="sl"><div class="field"><label for="se">Email</label><input id="se" type="email" autocomplete="username" required></div><div class="field"><label for="sp">Mật khẩu</label><input id="sp" type="password" autocomplete="current-password" required></div><button class="btn" type="submit">Đăng nhập</button></form>
      <details style="margin-top:14px"><summary class="small">Tài khoản demo (ISC301)</summary><p class="xs muted">Mật khẩu chung: <span class="mono">BuildX@2026</span> · đổi mật khẩu ở màn Người dùng trước khi dùng thật.</p><div class="stack" style="gap:4px">${[["bao@buildx.vn", "Quản lý"], ["viet.pham@buildx.vn", "Nhân viên bán hàng"], ["thao.le@buildx.vn", "Nhân viên tư vấn"], ["huy.tran@buildx.vn", "Kỹ thuật viên"], ["khoa.do@buildx.vn", "Thủ kho"], ["nhung.vu@buildx.vn", "Quản trị viên"]].map(([e, r]) => `<button type="button" class="btn sm plain" data-demo="${e}" style="justify-content:space-between"><span class="mono xs">${e}</span><span class="xs">${r}</span></button>`).join("")}</div></details></div>`;
  }
  function mountStaffLogin() {
    $$("[data-demo]").forEach((b) => (b.onclick = () => { $("#se").value = b.dataset.demo; $("#sp").focus(); }));
    $("#sl").onsubmit = async (e) => {
      e.preventDefault(); const btn = $("#sl button[type=submit]"); btn.disabled = true;
      try { const r = await window.BXAPI.auth("staffLogin", { email: $("#se").value, password: $("#sp").value }); await window.BXAPI.refresh({ silent: true }); toast(`Xin chào ${r.name} (${r.role})`); route(); }
      catch (err) { toast(err.message); btn.disabled = false; }
    };
  }
  // ---------- gọi thao tác nghiệp vụ trên máy chủ ----------
  async function run(name, payload, okMsg) {
    try { const r = await window.BXAPI.act(name, payload); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); rerender(); return r; }
    catch (e) { toast(e.message); if (e.status === 401 || e.status === 403) window.BXAPI.refresh({ silent: true }).then(rerender, () => {}); throw e; }
  }
  const quiet = (p) => p.catch(() => {}); // lỗi đã báo bằng toast
  let dirty = false;
  function showUpdate() { let b = $("#upd"); if (!b) { b = document.createElement("button"); b.id = "upd"; b.type = "button"; b.className = "btn sm updbar"; b.textContent = "Có dữ liệu mới · Cập nhật"; b.onclick = () => rerender(); document.body.appendChild(b); } }
  function hideUpdate() { const b = $("#upd"); if (b) b.remove(); }

  let current = null;
  function route() {
    const h = location.hash.replace(/^#\/?/, "") || "map";
    const [p, ...rest] = h.split("/");
    const param = rest.join("/") || undefined;
    const scr = SCREENS.find((s) => s.path === p) || SCREENS.find((s) => s.path === "map");
    current = { scr, param };
    const gate = scr.area === "admin" && !S.staff;
    $("#app").innerHTML = (window.BXAPI.offline() ? `<div class="netbar">${esc(window.BXAPI.offline())}</div>` : "") + shell(scr, gate ? "" : scr.render(param), scr.path);
    document.title = `${scr.title} · BuildX PC`;
    dirty = false; hideUpdate(); window.BXAPI.persist();
    if (gate) mountStaffLogin();
    else if (scr.mount && (scr.area !== "admin" || allowed(scr.path))) scr.mount(param);
    const fab = $("#fab"); if (fab) fab.onclick = drawer;
    const lo = $("#slo"); if (lo) lo.onclick = async () => { try { await window.BXAPI.auth("staffLogout"); await window.BXAPI.refresh({ silent: true }); toast("Đã đăng xuất trang nội bộ"); } catch (e) { toast(e.message); } route(); };
  }
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  function start() {
    add("—", "map", "Sơ đồ màn hình", "—", "store", () => {
      const grp = (a, t) => `<h2 style="margin-top:22px">${t}</h2><div class="map">${SCREENS.filter((s) => s.area === a && s.code.startsWith("SC")).map((s) => `<a href="#/${s.link || s.path}"><span class="code">${s.code} · ${s.ucs}</span><b>${esc(s.title)}</b></a>`).join("")}</div>`;
      return `<div class="wrap page"><span class="lbl">Dự án ISC301 · bám Kế hoạch kinh doanh v3</span><h1>Sơ đồ 42 màn hình BuildX PC</h1>
      <p class="muted" style="max-width:76ch">Mã màn hình (SC01–SC42) và use case (UC01–UC22) khớp sheet "Use Case" và "Product Tracking". Giá bán = giá lẻ thấp nhất thị trường + 8% (bảng giá 20/10/2026). Đơn hàng, tồn kho theo serial, đơn nhập, yêu cầu dịch vụ, bảo hành và tài khoản được lưu trên máy chủ (PostgreSQL): khách đặt hàng ở website thì nhân viên thấy ngay ở trang nội bộ, nhân viên xử lý thì khách thấy tiến trình cập nhật. Lead, báo giá, nhà cung cấp, sản phẩm và banner vẫn là dữ liệu minh họa trên trình duyệt (giai đoạn 2). Luồng demo: <a href="#/builder">Build PC</a> → giỏ → thanh toán → <a href="#/orders">đơn ở trang quản trị</a> → giữ hàng → lắp ráp & QC → xuất kho.</p>
      ${grp("store", "Khách hàng – website (SC01–SC21)")}${grp("admin", "Nhân viên – bán hàng, xưởng, kho, quản trị (SC22–SC42)")}</div>`;
    });
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
    document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest("#app")) dirty = true; });
    $("#app").innerHTML = '<div class="wrap page"><p class="muted">Đang tải dữ liệu…</p></div>';
    window.BXAPI.refresh({ silent: true }).catch((e) => toast(e.message)).finally(() => {
      try { route(); } catch (e) { console.error(e); }
      // Có thay đổi từ người khác: vẽ lại ngay nếu không ai đang gõ, nếu đang gõ thì hiện nút cập nhật
      window.BXAPI.start(() => { const a = document.activeElement; const typing = a && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); if (dirty || typing) showUpdate(); else rerender(); }, (msgs) => toast(msgs.slice(0, 2).join(" · ") + (msgs.length > 2 ? ` (+${msgs.length - 2})` : "")));
    });
  }
  return { $, $$, fmt, tr, esc, toast, tag, stPill, payPill, checkHtml, availPill, add, route, rerender, start, run, quiet, allowed, CAT, SCREENS, current: () => current };
})();
