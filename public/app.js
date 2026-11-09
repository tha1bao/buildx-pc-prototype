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
  const tag = () => ""; // nhãn mã màn hình đã bỏ khỏi giao diện
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

  // ---------- Hàng đợi nhiệm vụ liên kết theo vai trò ----------
  function roleTasks() {
    if (!S.staff) return [];
    const role = S.staff.role;
    const tasks = [];
    if (role === "Quản lý" || role === "Nhân viên bán hàng" || role === "Nhân viên tư vấn") {
      const risky = S.orders.filter((o) => o.status === "Mới" && o.risk && o.risk.needVerify && !o.risk.verified);
      if (risky.length) tasks.push({ title: `${risky.length} đơn rủi ro cần gọi xác minh`, path: `order/${risky[0].id}`, tag: "Bán hàng", lv: "warn" });
      const newOrders = S.orders.filter((o) => o.status === "Mới" && (!o.risk || !o.risk.needVerify || o.risk.verified));
      if (newOrders.length) tasks.push({ title: `${newOrders.length} đơn mới cần xác nhận & giữ hàng`, path: `order/${newOrders[0].id}`, tag: "Đơn hàng", lv: "acc" });
      const newLeads = (S.leads || []).filter((l) => l.st === "Mới" || l.st === "Đang tư vấn");
      if (newLeads.length) tasks.push({ title: `${newLeads.length} Lead cần tư vấn & gửi báo giá`, path: `quote/${newLeads[0].id}`, tag: "Lead", lv: "info" });
    }
    if (role === "Quản lý") {
      const poToApprove = (E.POS || S.pos || []).filter((p) => p.status === "Chờ duyệt");
      if (poToApprove.length) tasks.push({ title: `${poToApprove.length} đơn nhập PO chờ Quản lý duyệt gửi NPP`, path: "po", tag: "Duyệt PO", lv: "warn" });
    }
    if (role === "Kỹ thuật viên" || role === "Quản lý") {
      const asmOrders = S.orders.filter((o) => o.status === "Lắp ráp & QC");
      if (asmOrders.length) tasks.push({ title: `${asmOrders.length} bộ máy PC đang chờ Lắp ráp & Burn-in test`, path: `ticket/${asmOrders[0].id}`, tag: "Xưởng QC", lv: "acc" });
      const rmaOpen = (S.rma || []).filter((r) => r.st === "Đang xử lý");
      if (rmaOpen.length) tasks.push({ title: `${rmaOpen.length} phiếu bảo hành RMA cần chẩn đoán / xử lý`, path: "rma", tag: "Bảo hành", lv: "warn" });
    }
    if (role === "Thủ kho" || role === "Quản lý") {
      const shortOrders = S.orders.filter((o) => o.status === "Chờ hàng");
      if (shortOrders.length) tasks.push({ title: `${shortOrders.length} đơn đang thiếu hàng (cần tạo đơn nhập PO)`, path: "po", tag: "Thiếu hàng", lv: "warn" });
      const poToReceive = (E.POS || S.pos || []).filter((p) => p.status === "NPP xác nhận");
      if (poToReceive.length) tasks.push({ title: `${poToReceive.length} lô hàng từ NPP đã về, chờ nhận & nhập serial`, path: "po", tag: "Nhập kho", lv: "acc" });
      const readyPacking = S.orders.filter((o) => o.status === "Đóng gói");
      if (readyPacking.length) tasks.push({ title: `${readyPacking.length} đơn đã hoàn tất QC, chờ đóng gói & xuất kho`, path: "packing", tag: "Xuất kho", lv: "ok" });
    }
    return tasks;
  }

  function shell(scr, body, path) {
    const fab = "";
    if (scr.area === "store") {
      const u = S.user;
      const tInfo = u && CUST_TIERS ? CUST_TIERS[u.tier] : null;
      const userBtn = u ? `<a class="btn sm ghost" href="#/profile" style="display:inline-flex;align-items:center;gap:6px"><span class="pill ${tInfo ? tInfo.color : 'info'} xs">${tInfo ? tInfo.badge : 'Member'}</span><span>${esc(u.name.split(" ").slice(-2).join(" "))}</span></a>` : `<a class="btn sm ghost" href="#/login">Đăng nhập</a>`;
      return `<header class="store-h"><div class="wrap"><a class="brand" href="#/home">Build<b>X</b> PC</a><nav class="snav">${storeNav.map(([p, l]) => `<a href="#/${p}" class="${path === p ? "on" : ""}">${l}</a>`).join("")}</nav><div class="sright"><a class="btn sm plain cartbtn" href="#/cart">Giỏ hàng<span class="badge" id="cartn">${cartCount()}</span></a>${userBtn}</div></div></header><main>${body}</main><footer class="store-f"><div class="wrap"><span>BuildX PC · Cửa hàng mặt phố, Hà Nội · Dự án ISC301 theo kế hoạch v3</span><span><a href="#/saved">Cấu hình đã lưu</a> · <a href="#/profile">Hồ sơ thành viên</a> · <a href="#/warranty">Bảo hành & Care</a> · <a href="#/login" class="muted xs" style="opacity:0.6" title="Nhân viên đăng nhập bằng email công ty">Cổng nhân viên</a></span></div></footer>${fab}`;
    }
    if (!S.staff) return `<header class="store-h"><div class="wrap"><a class="brand" href="#/home">Build<b>X</b> PC</a></div></header><main>${window.BXS.loginPage({ staffGate: true })}</main>`;
    const role = `<span class="pill info">${esc(S.staff.role)}</span><span>${esc(S.staff.name)}</span><button class="btn sm plain" type="button" id="slo">Đăng xuất</button>`;
    const badge = (p) => { const n = p === "orders" ? S.orders.filter((o) => o.status === "Mới").length : p === "requests" ? S.requests.filter((r) => r.st === "Mới").length : p === "po" ? E.poSuggestions().length : 0; return n ? `<span class="badge" title="Cần xử lý">${n}</span>` : ""; };
    const ok = allowed(path);
    const tasks = roleTasks();
    const taskBanner = tasks.length
      ? `<div class="panel stack" style="margin-bottom:12px;background:var(--card);border-left:4px solid var(--accent);padding:10px 14px">
          <div class="row between"><span class="lbl" style="color:var(--accent)">Nhiệm vụ cần xử lý theo vai trò [${esc(S.staff.role)}] (${tasks.length})</span><span class="xs muted">Luồng nghiệp vụ liên kết</span></div>
          <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:4px">
            ${tasks.map((t) => `<a href="#/${t.path}" class="btn sm ghost row" style="font-size:12px;padding:4px 10px"><span class="pill ${t.lv} xs">${t.tag}</span><span>${esc(t.title)}</span> →</a>`).join("")}
          </div>
        </div>`
      : "";
    return `<div class="admin"><aside class="rail"><a class="brand" href="${roleHome(S.staff.role)}">Build<b style="color:var(--accent)">X</b> Nội bộ</a>${adminNav.map(([g, items]) => { const vis = items.filter(([p]) => allowed(p)); return vis.length ? `<div class="grp">${g}</div>${vis.map(([p, l]) => { return `<a href="#/${p}" class="${path === p ? "on" : ""}"><span>${l} ${badge(p)}</span></a>`; }).join("")}` : ""; }).join("")}<div class="grp">Khác</div><a href="#/home"><span>Website khách</span></a></aside><div><div class="atop"><span class="small muted">${esc(scr.title)}</span><span class="row small">${role}</span></div><div class="amain">${taskBanner}${ok ? body : `<div class="empty">Vai trò <b>${esc(S.staff.role)}</b> không có quyền mở màn hình này (mỗi người chỉ thấy chức năng đúng vai trò). Máy chủ cũng từ chối thao tác ngoài quyền.</div>`}</div></div></div>${fab}`;
  }
  // Màn làm việc chính của từng vai trò nhân viên (khớp ROLE_HOME ở máy chủ)
  const ROLE_HOME = { "Quản lý": "reports", "Nhân viên bán hàng": "pos", "Nhân viên tư vấn": "leads", "Kỹ thuật viên": "workshop", "Thủ kho": "stock", "Quản trị viên": "users" };
  const roleHome = (role) => "#/" + (ROLE_HOME[role] || "orders");
  // ---------- gọi thao tác nghiệp vụ trên máy chủ ----------
  async function run(name, payload, okMsg) {
    try { const r = await window.BXAPI.act(name, payload); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); rerender(); return r; }
    catch (e) { toast(e.message); if (e.status === 401 || e.status === 403) window.BXAPI.refresh({ silent: true }).then(rerender, () => {}); throw e; }
  }
  const quiet = (p) => p.catch(() => {}); // lỗi đã báo bằng toast
  let dirty = false;
  function showUpdate() { let b = $("#upd"); if (!b) { b = document.createElement("button"); b.id = "upd"; b.type = "button"; b.className = "btn sm updbar"; b.textContent = "Có dữ liệu mới · Cập nhật"; b.onclick = () => rerender(); document.body.appendChild(b); } }
  function hideUpdate() { const b = $("#upd"); if (b) b.remove(); }

  let current = null, routing = false;
  function route() {
    // ô đang sửa có thể bắn sự kiện change/blur khi bị thay; xử lý xong rồi mới vẽ lại, không vẽ lồng nhau
    if (routing) { setTimeout(route, 0); return; }
    routing = true;
    try { const a = document.activeElement; if (a && a !== document.body && a.closest && a.closest("#app") && a.blur) a.blur(); drawRoute(); } finally { routing = false; }
  }
  function drawRoute() {
    const h = location.hash.replace(/^#\/?/, "") || "home";
    const [p, ...rest] = h.split("/");
    const param = rest.join("/") || undefined;
    const scr = SCREENS.find((s) => s.path === p) || SCREENS.find((s) => s.path === "home");
    current = { scr, param };
    const gate = scr.area === "admin" && !S.staff;
    let body;
    try { body = gate ? "" : scr.render(param); }
    catch (e) { console.error(e); body = `<div class="wrap page"><div class="empty">Không mở được trang này. <a href="#/home">Về trang chủ</a></div></div>`; }
    $("#app").innerHTML = (window.BXAPI.offline() ? `<div class="netbar">${esc(window.BXAPI.offline())}</div>` : "") + shell(scr, body, scr.path);
    document.title = `${scr.title} · BuildX PC`;
    dirty = false; hideUpdate(); window.BXAPI.persist();
    try {
      if (gate) window.BXS.mountLogin({ staffGate: true });
      else if (scr.mount && (scr.area !== "admin" || allowed(scr.path))) scr.mount(param);
    } catch (e) { console.error(e); }
    const lo = $("#slo"); if (lo) lo.onclick = async () => { try { await window.BXAPI.auth("staffLogout"); await window.BXAPI.refresh({ silent: true }); toast("Đã đăng xuất trang nội bộ"); } catch (e) { toast(e.message); } route(); };
  }
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  function start() {
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
    document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest("#app")) dirty = true; });
    // Có thay đổi từ người khác: vẽ lại ngay nếu không ai đang gõ, nếu đang gõ thì hiện nút cập nhật
    const onChange = () => { const a = document.activeElement; const typing = a && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); if (dirty || typing) showUpdate(); else rerender(); };
    // Trang công khai của khách vãng lai vẽ ngay bằng dữ liệu lưu sẵn, không chờ máy chủ
    const p = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "home";
    const scr = SCREENS.find((x) => x.path === p);
    const instant = (!scr || scr.area !== "admin") && window.BXAPI.warm();
    if (instant) { try { route(); } catch (e) { console.error(e); } }
    else $("#app").innerHTML = '<div class="wrap page"><div class="loading" role="status"><span class="spin" aria-hidden="true"></span>Đang tải dữ liệu…</div></div>';
    window.BXAPI.refresh({ silent: true }).catch((e) => toast(e.message)).finally(() => {
      if (instant) onChange(); else { try { route(); } catch (e) { console.error(e); } }
      window.BXAPI.start(onChange, (msgs) => toast(msgs.slice(0, 2).join(" · ") + (msgs.length > 2 ? ` (+${msgs.length - 2})` : "")));
    });
  }
  return { $, $$, fmt, tr, esc, toast, tag, roleHome, stPill, payPill, checkHtml, availPill, add, route, rerender, start, run, quiet, allowed, CAT, SCREENS, current: () => current };
})();
