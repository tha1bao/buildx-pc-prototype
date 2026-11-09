// BuildX PC – kết nối trình duyệt với máy chủ: tải dữ liệu theo quyền, gửi thao tác nghiệp vụ,
// tự làm mới khi có thay đổi từ người khác (khách đặt đơn → nhân viên thấy ngay, và ngược lại).
window.BXAPI = (function () {
  "use strict";
  const E = window.BXE, S = E.S, st = E.st;
  let v = -1, timer = null, onChange = null, notify = null, ready = false, offline = null;

  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const revive = (x) => { if (typeof x === "string") return ISO.test(x) ? new Date(x) : x; if (Array.isArray(x)) return x.map(revive); if (x && typeof x === "object") { for (const k of Object.keys(x)) x[k] = revive(x[k]); } return x; };
  const replace = (arr, items) => arr.splice(0, arr.length, ...(items || []));

  // Lưu tạm trên máy: giỏ hàng, mã giảm giá, cấu hình đã lưu của khách chưa đăng nhập
  const LS = { get(k, d) { try { const s = localStorage.getItem("bx_" + k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }, set(k, val) { try { localStorage.setItem("bx_" + k, JSON.stringify(val)); } catch (e) { /* trình duyệt chặn lưu trữ */ } } };
  S.cart = LS.get("cart", []);
  S.coupon = LS.get("coupon", null);
  let guestSaved = LS.get("saved", []);
  function persist() { LS.set("cart", S.cart); LS.set("coupon", S.coupon); if (!S.user) LS.set("saved", guestSaved); }

  function apply(s) {
    s = revive(s);
    ["orders", "units", "pos", "requests", "rma", "warranties", "coupons", "log", "staffUsers"].forEach((k) => replace(st[k], s[k]));
    st.availMap = s.availMap || null;
    S.staff = s.staff || null;
    S.user = s.user || null;
    S.me = s.me || { phone: "", orderIds: [], verified: false };
    S.saved = S.user ? S.user.saved || (S.user.saved = []) : guestSaved;
    st.ruleCfg = s.ruleCfg || st.ruleCfg;
    if (typeof s.v === "number") v = s.v;
    // lần mở sau: khách vãng lai thấy trang ngay bằng dữ liệu công khai lưu sẵn (tồn khả dụng, luật), rồi mới cập nhật
    LS.set("pub", { guest: !S.user && !S.staff, availMap: st.availMap, ruleCfg: st.ruleCfg, at: Date.now() });
    ready = true; offline = null;
  }

  async function http(url, opt) {
    let r;
    try { r = await fetch(url, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opt)); }
    catch (e) { throw new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."); }
    let j = null; try { j = await r.json(); } catch (e) { /* không phải JSON */ }
    if (!r.ok || (j && j.ok === false)) { const err = new Error((j && j.error) || `Lỗi máy chủ (${r.status}).`); err.status = r.status; throw err; }
    return j || {};
  }

  // Phát hiện thay đổi đáng báo cho người đang xem
  function diff(prevOrders, prevReq) {
    const msgs = [];
    if (S.staff) {
      const seen = new Set(prevOrders.map((o) => o.id));
      st.orders.filter((o) => !seen.has(o.id)).forEach((o) => msgs.push(`Đơn mới ${o.id} · ${o.channel} · ${o.cust.name}`));
      const seenR = new Set(prevReq);
      st.requests.filter((r) => !seenR.has(r.id)).forEach((r) => msgs.push(`Yêu cầu mới ${r.code}: ${r.type} – ${r.cust}`));
    } else {
      const before = new Map(prevOrders.map((o) => [o.id, o.status]));
      st.orders.forEach((o) => { if (before.has(o.id) && before.get(o.id) !== o.status) msgs.push(`Đơn ${o.id}: ${o.status}`); });
    }
    return msgs;
  }

  async function refresh(opts) {
    const prevO = st.orders.map((o) => ({ id: o.id, status: o.status })), prevR = st.requests.map((r) => r.id), had = ready;
    try {
      apply(await http("/api/state"));
    } catch (e) { offline = e.message; if (!had) ready = false; throw e; }
    if (had && !(opts && opts.silent)) { const m = diff(prevO, prevR); if (m.length && notify) notify(m); }
    if (onChange) onChange(opts || {});
  }

  // Phản hồi ngay khi bấm: khóa nút vừa bấm (hiện vòng xoay) và hiện thanh tiến trình nếu máy chủ trả lời chậm
  let pending = 0, barTimer = null;
  function busy(on) {
    const root = document.documentElement;
    if (on) { if (pending++ === 0) barTimer = setTimeout(() => root.classList.add("bx-busy"), 150); return; }
    if (--pending <= 0) { pending = 0; clearTimeout(barTimer); root.classList.remove("bx-busy"); }
  }
  // nút vừa bấm (Safari không đặt focus vào nút khi bấm nên ghi nhận qua sự kiện click)
  let lastBtn = null, lastAt = 0;
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("button"); if (b) { lastBtn = b; lastAt = Date.now(); } }, true);
  function lockButton() {
    let el = lastBtn && Date.now() - lastAt < 1500 && document.contains(lastBtn) ? lastBtn : document.activeElement;
    if (el && el.form && el.tagName !== "BUTTON") el = el.form.querySelector("button[type=submit]");
    if (!el || el.tagName !== "BUTTON" || !el.closest("#app")) return () => {};
    const was = el.disabled; // màn tự khóa nút thì để màn tự mở lại
    el.disabled = true; el.setAttribute("aria-busy", "true");
    return () => { if (!was) el.disabled = false; el.removeAttribute("aria-busy"); };
  }
  async function withBusy(p) { const unlock = lockButton(); busy(true); try { return await p(); } finally { busy(false); unlock(); } }
  async function act(name, payload) {
    const r = await withBusy(() => http("/api/action", { method: "POST", body: JSON.stringify({ name, payload: payload || {} }) }));
    if (r.state) { r.state.v = r.v; apply(r.state); }
    return r.result;
  }
  const auth = (op, data) => withBusy(() => http("/api/auth", { method: "POST", body: JSON.stringify(Object.assign({ op }, data)) }));
  // Dữ liệu công khai lưu từ lần trước (chỉ khi lần trước là khách chưa đăng nhập) → vẽ trang ngay
  function warm() {
    const p = LS.get("pub", null);
    if (!p || !p.guest || !p.availMap || Date.now() - p.at > 7 * 864e5) return false;
    st.availMap = p.availMap; if (p.ruleCfg) st.ruleCfg = p.ruleCfg; return true;
  }

  // Hỏi máy chủ mỗi 4 giây xem dữ liệu có đổi không (rẻ: chỉ đọc số phiên bản)
  async function poll() {
    if (document.hidden) return;
    try { const r = await http("/api/version"); if (r.v !== v) await refresh(); }
    catch (e) { offline = e.message; }
  }
  function start(cb, note) {
    onChange = cb; notify = note;
    if (!timer) timer = setInterval(poll, 4000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  }

  function addGuestSaved(item) { guestSaved.unshift(item); S.saved = guestSaved; persist(); }
  function removeGuestSaved(code) { guestSaved = guestSaved.filter((x) => x.code !== code); S.saved = guestSaved; persist(); }

  return { refresh, act, auth, start, persist, warm, addGuestSaved, removeGuestSaved, isReady: () => ready, offline: () => offline };
})();
