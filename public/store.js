// BuildX PC – 21 màn hình phía khách hàng (SC01–SC21, UC01–UC11)
(function () {
  "use strict";
  const { COMBOS, COMBO_OPTS, FEES, APPS, FPS, ORDER, CAT, STATUSES, CUST_TIERS, PRESET_CUSTOMERS } = window.BX;
  const E = window.BXE, S = E.S, A = window.BXA;
  const { $, $$, fmt, esc, toast, tag, stPill, payPill, checkHtml, availPill, add, rerender, run, quiet } = A;
  const API = window.BXAPI;
  const byId = E.byId;
  const sellable = (cat) => E.P.filter((p) => p.cat === cat && !p.ref);
  const go = (h) => (location.hash = h);
  const fpsLine = (cfg, apps, res) => { const v = E.part(cfg, "vga"); if (!v) return "Không có VGA rời"; const games = (apps || S.need.apps).filter((a) => FPS[a]); const k = (res || S.need.res) === "1440" ? 0.72 : 1; if (!games.length) return "Ưu tiên VRAM và RAM cho phần mềm đã chọn"; return games.slice(0, 3).map((g) => `${g} ~${Math.round(FPS[g][v.tier - 1] * k)} FPS`).join(" · "); };
  const partsList = (cfg) => ORDER.filter((s) => cfg[s].mode && cfg[s].mode !== "skip" && cfg[s].id).map((s) => `${byId(cfg[s].id).n}${s === "ram" && cfg.ram.qty > 1 ? " ×" + cfg.ram.qty : ""}${cfg[s].mode === "own" ? " (đã có)" : ""}`).concat(cfg.extras.map((e) => byId(e.id).n + (e.qty > 1 ? " ×" + e.qty : ""))).join(" · ");
  const custPhone = () => (S.user ? S.user.phone : S.me.phone || S.guestPhone);
  const myOrders = () => S.orders.filter((o) => S.me.orderIds.includes(o.id)); // máy chủ chỉ trả đơn khách này được xem
  const needLogin = (sc, ucs) => `<div class="wrap page" style="max-width:520px"><div class="panel"><h1>Cần đăng nhập</h1><p class="muted">Màn hình này cần tài khoản. ${tag(sc, ucs)}</p><a class="btn" href="#/login">Đăng nhập bằng SĐT + OTP</a></div></div>`;

  // ================= SC01 – Đăng nhập / đăng ký =================
  add("SC01", "login", "Đăng nhập / đăng ký", "UC01", "store", () => S.user ? `<div class="wrap page" style="max-width:480px"><div class="panel"><h1>Đã đăng nhập</h1><p>${esc(S.user.name)} · ${esc(S.user.phone)}</p><a class="btn" href="#/profile">Hồ sơ của tôi</a></div></div>` : `
  <div class="wrap page" style="max-width:540px"><div class="panel" id="lg">
    <div class="row between"><h1>Đăng nhập khách hàng</h1>${tag("SC01", "UC01")}</div>
    <p class="muted small">Đăng nhập bằng số điện thoại + mã OTP (không cần mật khẩu). Cần đăng nhập để đặt hàng và theo dõi đơn.</p>
    
    <div class="tabs" style="margin-top:12px">
      <button class="tab" id="tab-login" aria-pressed="true" type="button">Đăng nhập</button>
      <button class="tab" id="tab-reg" aria-pressed="false" type="button">Đăng ký tài khoản</button>
    </div>

    <!-- KHỐI ĐĂNG NHẬP -->
    <div id="login-box" style="margin-top:12px">
      <div class="panel stack" style="background:var(--bg);border:1px dashed var(--accent);margin-bottom:14px;padding:12px">
        <span class="lbl" style="color:var(--accent)">★ Tài khoản mẫu để thử phân hạng (vẫn xác thực bằng OTP)</span>
        <div class="stack" style="gap:8px">
          <button type="button" class="btn sm plain row between" style="text-align:left;padding:8px 10px;border:1px solid var(--line);border-radius:6px" data-quick="0912 345 678">
            <div><b style="color:var(--accent)">Nguyễn Minh Anh</b> · <span class="pill acc xs">VIP −2%</span><br><span class="xs muted">Chiết khấu tự động 2%, ưu tiên xưởng QC hỏa tốc, tích 1.250 điểm</span></div>
            <span class="btn sm">Gửi OTP →</span>
          </button>
          <button type="button" class="btn sm plain row between" style="text-align:left;padding:8px 10px;border:1px solid var(--line);border-radius:6px" data-quick="0988 999 888">
            <div><b style="color:var(--ok)">Cty CP Công Nghệ NextGen</b> · <span class="pill ok xs">B2B −5%</span><br><span class="xs muted">Bảng giá sỉ −5%, xuất HĐ GTGT (VAT), thanh toán công nợ 30 ngày</span></div>
            <span class="btn sm">Gửi OTP →</span>
          </button>
          <button type="button" class="btn sm plain row between" style="text-align:left;padding:8px 10px;border:1px solid var(--line);border-radius:6px" data-quick="0905 112 233">
            <div><b>Trịnh Văn Khoa</b> · <span class="pill info xs">Member</span><br><span class="xs muted">Thành viên Tiêu chuẩn, tích lũy 1%, lưu cấu hình PC</span></div>
            <span class="btn sm">Gửi OTP →</span>
          </button>
        </div>
      </div>

      <details style="margin-top:10px">
        <summary class="small">Hoặc đăng nhập bằng số điện thoại bất kỳ (gửi OTP)</summary>
        <form id="f1" style="margin-top:10px"><div class="field"><label for="ph">Số điện thoại</label><input id="ph" type="tel" inputmode="tel" placeholder="VD: 0912 345 678" required></div><button class="btn" type="submit">Gửi mã OTP</button></form>
      </details>
      <p class="small muted" style="margin-top:14px">Chưa có tài khoản? Chọn tab <b>Đăng ký tài khoản</b>. Khách chưa đăng nhập vẫn xem sản phẩm, build PC và thêm vào giỏ; khi đặt hàng sẽ được yêu cầu đăng nhập.</p>
    </div>

    <!-- KHỐI ĐĂNG KÝ MỚI -->
    <div id="reg-box" style="display:none;margin-top:12px">
      <form id="f-reg" class="stack" style="gap:10px">
        <p class="small muted" style="margin:0">Tài khoản mới là <b>Thành viên tiêu chuẩn (Member)</b>: tích điểm 1% giá trị đơn, điểm và chi tiêu bắt đầu từ 0. Chi tiêu từ 50 triệu tự lên VIP; tài khoản doanh nghiệp B2B do cửa hàng duyệt.</p>
        <div class="field">
          <label for="reg-name">Họ và tên / Người đại diện</label>
          <input id="reg-name" type="text" placeholder="VD: Trần Văn Nam" maxlength="80" required>
        </div>
        <div class="field">
          <label for="reg-phone">Số điện thoại (nhận mã OTP kích hoạt)</label>
          <input id="reg-phone" type="tel" inputmode="tel" placeholder="VD: 0934 567 890" required>
        </div>
        <div class="field">
          <label for="reg-email">Email nhận hóa đơn & bảo hành</label>
          <input id="reg-email" type="email" placeholder="nam.tran@company.com" maxlength="120">
        </div>
        <label class="row small"><input type="checkbox" id="reg-b2b"> Tôi đăng ký cho doanh nghiệp (gửi yêu cầu tài khoản B2B: giảm 5%, hóa đơn VAT, công nợ – cửa hàng duyệt trong 1 ngày làm việc)</label>
        <div id="b2b-reg-extra" style="display:none;border-left:3px solid var(--ok);padding-left:10px;margin-top:4px" class="stack">
          <div class="field">
            <label for="reg-company">Tên công ty / Tổ chức</label>
            <input id="reg-company" type="text" placeholder="VD: Công ty TNHH Công Nghệ BuildX" maxlength="150">
          </div>
          <div class="field" style="margin-top:8px">
            <label for="reg-tax">Mã số thuế (MST xuất HĐ GTGT)</label>
            <input id="reg-tax" type="text" inputmode="numeric" placeholder="10 chữ số, VD: 0109876543" maxlength="14">
          </div>
          <div class="field" style="margin-top:8px">
            <label for="reg-caddr">Địa chỉ công ty</label>
            <input id="reg-caddr" type="text" maxlength="250">
          </div>
        </div>
        <p class="xs muted" id="reg-err" role="alert" style="color:var(--bad);margin:0"></p>
        <button class="btn ok" type="submit" style="margin-top:8px">Đăng ký & Nhận mã OTP</button>
      </form>
    </div>
  </div></div>`, () => {
    if (S.user) return;

    // Chuyển tab Đăng nhập / Đăng ký
    const tLog = $("#tab-login"), tReg = $("#tab-reg"), lBox = $("#login-box"), rBox = $("#reg-box");
    if (tLog && tReg) {
      tLog.onclick = () => { tLog.setAttribute("aria-pressed", "true"); tReg.setAttribute("aria-pressed", "false"); lBox.style.display = "block"; rBox.style.display = "none"; };
      tReg.onclick = () => { tReg.setAttribute("aria-pressed", "true"); tLog.setAttribute("aria-pressed", "false"); rBox.style.display = "block"; lBox.style.display = "none"; };
    }

    // Bật tắt trường công ty khi đăng ký doanh nghiệp
    const rB2b = $("#reg-b2b"), bExtra = $("#b2b-reg-extra");
    if (rB2b && bExtra) rB2b.onchange = () => { bExtra.style.display = rB2b.checked ? "block" : "none"; };

    // Xử lý submit form đăng ký
    const fReg = $("#f-reg");
    if (fReg) fReg.onsubmit = async (e) => {
      e.preventDefault();
      const ph = $("#reg-phone").value.trim(), name = $("#reg-name").value.trim(), email = $("#reg-email").value.trim();
      const isB2b = $("#reg-b2b").checked;
      const company = isB2b ? { name: $("#reg-company").value.trim(), taxId: $("#reg-tax").value.trim(), addr: $("#reg-caddr").value.trim() } : null;
      const errs = [];
      if (name.length < 2) errs.push("Họ tên cần ít nhất 2 ký tự.");
      if (!/^0\d{9}$/.test(ph.replace(/[\s.-]/g, ""))) errs.push("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push("Email không hợp lệ.");
      if (isB2b && company.name.length < 2) errs.push("Nhập tên công ty.");
      if (isB2b && !/^\d{10}(-\d{3})?$/.test(company.taxId)) errs.push("Mã số thuế gồm 10 chữ số (chi nhánh thêm -xxx).");
      $("#reg-err").textContent = errs.join(" ");
      if (errs.length) return;
      const btn = $("#f-reg button[type=submit]");
      btn.disabled = true;
      try {
        await sendOtp(ph, btn, { name, email, company });
      } catch (err) {
        btn.disabled = false;
        toast(err.message);
      }
    };

    const sendOtp = async (ph, btn, regData) => {
      if (btn) btn.disabled = true;
      let r; try { r = await API.auth("otp", { phone: ph }); } catch (err) { if (btn) btn.disabled = false; return toast(err.message); }
      if (regData && !r.isNew) { if (btn) btn.disabled = false; return toast("Số điện thoại này đã có tài khoản. Vui lòng dùng tab Đăng nhập."); }
      const displayName = (regData && regData.name) || "";
      $("#lg").innerHTML = `<h1>Nhập mã OTP</h1><p class="muted small">Đã gửi mã 6 số tới ${esc(ph)}, hiệu lực 5 phút.</p>${r.devOtp ? `<div class="notice small">Chưa nối nhà cung cấp SMS – mã thử nghiệm: <b class="mono">${r.devOtp}</b></div>` : ""}<form id="f2"><div class="otp">${[1, 2, 3, 4, 5, 6].map((i) => `<input inputmode="numeric" maxlength="1" aria-label="Số ${i}">`).join("")}</div>${r.isNew && !displayName ? `<div class="field" style="margin-top:12px"><label for="nm">Họ tên (tài khoản mới)</label><input id="nm" type="text" required></div>` : ""}<button class="btn" type="submit" style="margin-top:12px">Xác thực tài khoản</button></form>`;
      const ins = $$(".otp input");
      ins.forEach((i, k) => { i.oninput = () => { i.value = i.value.replace(/\D/g, "").slice(-1); if (i.value && ins[k + 1]) ins[k + 1].focus(); }; i.onpaste = (ev) => { const d = (ev.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (d.length === 6) { ev.preventDefault(); ins.forEach((x, j) => (x.value = d[j])); } }; });
      ins[0].focus();
      $("#f2").onsubmit = async (ev) => {
        ev.preventDefault(); const b2 = $("#f2 button"); b2.disabled = true;
        try {
          const finalName = displayName || ($("#nm") ? $("#nm").value : "");
          await API.auth("verify", { phone: ph, code: ins.map((i) => i.value).join(""), name: finalName });
          let msg = "Đăng nhập thành công";
          if (regData) {
            msg = "Đăng ký thành công – tài khoản Member";
            if (regData.email) { try { await API.act("profile.save", { name: finalName, email: regData.email, consent: { zalo: false, email: true } }); } catch (e) { toast(e.message); } }
            if (regData.company) { try { await API.act("b2b.request", regData.company); msg += "; đã gửi yêu cầu tài khoản B2B, chờ cửa hàng duyệt"; } catch (e) { toast(e.message); } }
          }
          await API.refresh({ silent: true });
          toast(msg);
          go(S.cart.length ? "#/checkout" : "#/profile");
        }
        catch (err) { b2.disabled = false; toast(err.message); }
      };
    };
    $$("[data-quick]").forEach((b) => (b.onclick = () => sendOtp(b.dataset.quick, b)));
    const f1 = $("#f1"); if (f1) f1.onsubmit = (e) => { e.preventDefault(); sendOtp($("#ph").value.trim(), $("#f1 button")); };
  });

  // ================= SC02 – Hồ sơ & sổ địa chỉ =================
  add("SC02", "profile", "Hồ sơ & sổ địa chỉ", "UC01", "store", () => {
    if (!S.user) return needLogin("SC02", "UC01");
    const u = S.user, t = CUST_TIERS[u.tier] || CUST_TIERS.standard;
    const spentNum = typeof u.spent === "number" ? u.spent : 0;
    const vipGoal = 50000000;
    const progressPct = Math.min(100, Math.round((spentNum / vipGoal) * 100));
    return `<div class="wrap page" style="max-width:880px"><div class="row between"><h1>Hồ sơ thành viên</h1>${tag("SC02", "UC01")}</div>
    <div class="panel stack" style="margin-top:10px;background:var(--card);border-left:4px solid var(--${t.color})">
      <div class="row between">
        <div>
          <span class="lbl">Hạng tài khoản khách hàng</span>
          <h2 style="margin:2px 0;display:flex;align-items:center;gap:8px">
            ${esc(t.name)} <span class="pill ${t.color}">${t.badge}</span>
          </h2>
        </div>
        <div class="row small">
          <span class="pill ${t.color}">Trạng thái: Hoạt động</span>
        </div>
      </div>

      <div class="grid3" style="margin-top:4px">
        <div class="kpi"><div class="lbl">Điểm tích lũy</div><div class="v">${(u.points || 0).toLocaleString("vi-VN")} điểm</div></div>
        <div class="kpi"><div class="lbl">Tổng chi tiêu tích lũy</div><div class="v">${fmt(spentNum)}</div></div>
        <div class="kpi"><div class="lbl">Chiết khấu đặc quyền</div><div class="v" style="color:var(--${t.color})">${t.discRate ? (t.discRate * 100) + "%" : "0%"}</div></div>
      </div>

      ${u.tier === "standard" ? `
      <div class="panel" style="background:var(--bg);padding:10px 14px">
        <div class="row between small"><span><b>Tiến độ thăng hạng VIP Gamer Pro (mốc 50 triệu)</b></span><span>${fmt(spentNum)} / ${fmt(vipGoal)} (${progressPct}%)</span></div>
        <div style="background:var(--line);height:8px;border-radius:4px;overflow:hidden;margin-top:6px"><div style="background:var(--accent);width:${progressPct}%;height:100%"></div></div>
        <p class="xs muted" style="margin:6px 0 0">Chi tiêu thêm ${fmt(Math.max(0, vipGoal - spentNum))} để tự động được nâng cấp lên hạng VIP (hưởng chiết khấu tự động 2% và ưu tiên xưởng). Điểm và chi tiêu được cộng khi đơn ở trạng thái Hoàn tất.</p>
      </div>
      ${u.b2bRequest && u.b2bRequest.status === "Chờ duyệt" ? `<div class="notice small">🏢 Yêu cầu tài khoản doanh nghiệp B2B cho <b>${esc(u.b2bRequest.company.name)}</b> (MST ${esc(u.b2bRequest.company.taxId)}) đang <b>chờ cửa hàng duyệt</b>.</div>` : u.b2bRequest && u.b2bRequest.status === "Từ chối" ? `<div class="notice warn small">Yêu cầu tài khoản B2B chưa được duyệt. Liên hệ cửa hàng để bổ sung giấy tờ.</div>` : `<details class="small"><summary>Đăng ký tài khoản doanh nghiệp B2B</summary><form id="fb2b" class="grid2" style="margin-top:8px"><div class="field"><label for="bq-n">Tên công ty</label><input id="bq-n" maxlength="150" required></div><div class="field"><label for="bq-t">Mã số thuế</label><input id="bq-t" inputmode="numeric" maxlength="14" required></div><div class="field" style="grid-column:1/-1"><label for="bq-a">Địa chỉ công ty</label><input id="bq-a" maxlength="250"></div><button class="btn sm" type="submit">Gửi yêu cầu duyệt</button></form></details>`}` : u.tier === "vip" ? `
      <div class="notice ok small" style="margin:4px 0">🌟 <b>Tài khoản VIP cao cấp:</b> Bạn đang hưởng mức ưu đãi đặc quyền tối đa dành cho khách hàng cá nhân (giảm trực tiếp 2% toàn bộ đơn hàng và ưu tiên lắp ráp hỏa tốc).</div>` : `
      <div class="notice ok small" style="margin:4px 0">🏢 <b>Tài khoản Doanh nghiệp B2B:</b> Được cấp quyền bởi phòng Kinh doanh BuildX với bảng giá sỉ chiết khấu 5%, xuất hóa đơn VAT và hạn mức công nợ theo hợp đồng.</div>`}

      <div>
        <b class="small">Quyền lợi dành cho hạng tài khoản của bạn:</b>
        <ul class="small" style="margin:4px 0 0;padding-left:18px">
          ${t.perks.map((p) => `<li>${esc(p)}</li>`).join("")}
        </ul>
      </div>
    </div>

    ${u.tier === "b2b" ? `
    <div class="panel stack" style="margin-top:12px;border:1px solid var(--ok)">
      <div class="row between"><h3 style="margin:0;color:var(--ok)">Thông tin Xuất hóa đơn GTGT (VAT) & Doanh nghiệp</h3><span class="pill ok">Đã xác thực B2B</span></div>
      <div class="grid2">
        <div class="field"><label>Tên công ty / Tổ chức</label><input type="text" id="b2b-comp" value="${esc((u.company && u.company.name) || u.name)}"></div>
        <div class="field"><label>Mã số thuế (MST)</label><input type="text" id="b2b-tax" value="${esc((u.company && u.company.taxId) || "")}"></div>
      </div>
      <div class="field"><label>Địa chỉ xuất hóa đơn</label><input type="text" id="b2b-addr" value="${esc((u.company && u.company.addr) || (u.addrs[0] ? u.addrs[0].text : ''))}"></div>
      <p class="xs muted">Đơn hàng của tài khoản B2B sẽ tự động đính kèm hóa đơn VAT và mở quyền thanh toán công nợ 15–30 ngày.</p>
    </div>` : ""}

    <div class="grid2" style="margin-top:12px"><div class="panel"><h2>Thông tin tài khoản</h2>
      <div class="field"><label for="pn">Họ tên / Đại diện</label><input id="pn" type="text" value="${esc(u.name)}"></div>
      <div class="field"><label>Số điện thoại</label><input type="tel" value="${esc(u.phone)}" disabled></div>
      <div class="field"><label for="pe">Email</label><input id="pe" type="email" value="${esc(u.email)}"></div>
      <h3 style="margin-top:6px">Nhận thông báo</h3>
      <label class="row small"><input type="checkbox" id="cz" ${u.consent && u.consent.zalo ? "checked" : ""}> Nhắc vệ sinh, bảo hành qua Zalo</label>
      <label class="row small"><input type="checkbox" id="ce" ${u.consent && u.consent.email ? "checked" : ""}> Ưu đãi qua email</label>
      <p class="xs muted">BuildX chỉ gửi thông báo khi bạn đồng ý (v3 mục 12).</p>
      <div class="row"><button class="btn" type="button" id="sv">Lưu thông tin</button><button class="btn plain" type="button" id="lo">Đăng xuất</button></div></div>
    <div class="panel"><h2>Sổ địa chỉ nhận hàng</h2><div class="stack" style="gap:8px">${u.addrs.map((a, i) => `<div class="row between" style="border:1px solid var(--line);border-radius:8px;padding:8px 10px"><span><b>${esc(a.label)}</b> ${a.def ? '<span class="pill acc">Mặc định</span>' : ""}<br><span class="small">${esc(a.text)}</span></span><span class="row">${a.def ? "" : `<button class="btn sm plain" type="button" data-def="${i}">Đặt mặc định</button>`}<button class="btn sm plain" type="button" data-del="${i}">Xóa</button></span></div>`).join("") || '<p class="small muted">Chưa có địa chỉ.</p>'}</div>
      <form id="fa" style="margin-top:12px"><div class="grid2"><div class="field"><label for="al">Tên gợi nhớ</label><input id="al" type="text" placeholder="Nhà riêng, Văn phòng…" required></div><div class="field"><label for="at">Địa chỉ</label><input id="at" type="text" required></div></div><button class="btn sm" type="submit">Thêm địa chỉ</button></form>
      <div class="row" style="margin-top:14px"><a class="btn sm ghost" href="#/saved">Cấu hình đã lưu (${S.saved.length})</a><a class="btn sm ghost" href="#/orders-me">Đơn của tôi</a></div></div></div></div>`;
  }, () => {
    if (!S.user) return;
    $("#sv").onclick = () => quiet(run("profile.save", { name: $("#pn").value, email: $("#pe").value, consent: { zalo: $("#cz").checked, email: $("#ce").checked }, company: $("#b2b-comp") ? { name: $("#b2b-comp").value, taxId: $("#b2b-tax").value, addr: $("#b2b-addr").value } : undefined }, "Đã lưu hồ sơ"));
    const fb = $("#fb2b"); if (fb) fb.onsubmit = (e) => { e.preventDefault(); const t = $("#bq-t").value.trim(); if (!/^\d{10}(-\d{3})?$/.test(t)) return toast("Mã số thuế gồm 10 chữ số (chi nhánh thêm -xxx)."); quiet(run("b2b.request", { name: $("#bq-n").value.trim(), taxId: t, addr: $("#bq-a").value.trim() }, "Đã gửi yêu cầu, cửa hàng sẽ duyệt")); };
    $("#lo").onclick = async () => { try { await API.auth("logout"); await API.refresh({ silent: true }); } catch (e) { toast(e.message); } go("#/home"); };
    $$("[data-def]").forEach((b) => (b.onclick = () => quiet(run("addr.def", { i: +b.dataset.def }))));
    $$("[data-del]").forEach((b) => (b.onclick = () => quiet(run("addr.del", { i: +b.dataset.del }, "Đã xóa địa chỉ"))));
    $("#fa").onsubmit = (e) => { e.preventDefault(); quiet(run("addr.add", { label: $("#al").value, text: $("#at").value }, "Đã thêm địa chỉ")); };
  });

  // ================= SC03 – Cấu hình đã lưu =================
  add("SC03", "saved", "Cấu hình đã lưu", "UC01", "store", () => `<div class="wrap page"><h1>Cấu hình đã lưu</h1><p class="muted small">Mở lại để chỉnh, chia sẻ link cho bạn bè hoặc chuyên viên. ${tag("SC03", "UC01")}</p>
    <div class="stack" style="margin-top:12px">${S.saved.map((s, i) => `<div class="panel row between"><div style="min-width:0;flex:1"><span class="mono xs muted">${s.code} · ${s.date}${s.kind === "upgrade" ? " · Nâng cấp" : ""}</span><br><b>${esc(s.title)}</b><div class="small muted">${esc(partsList(s.cfg))}</div></div><div class="row"><span class="price">${fmt(E.cfgPrice(s.cfg))}</span><input type="text" readonly value="buildx.vn/c/${s.code}" style="width:180px" aria-label="Link chia sẻ"><button class="btn sm plain" type="button" data-copy="buildx.vn/c/${s.code}">Sao chép link</button><button class="btn sm" type="button" data-open="${i}">Mở</button><button class="btn sm plain" type="button" data-rm="${i}">Xóa</button></div></div>`).join("") || '<div class="empty">Chưa có cấu hình nào. <a href="#/builder">Build PC</a></div>'}</div></div>`, () => {
    $$("[data-copy]").forEach((b) => (b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Đã sao chép link"), () => toast("Hãy sao chép link thủ công")); } catch (e) { toast("Hãy sao chép link thủ công"); } }));
    $$("[data-open]").forEach((b) => (b.onclick = () => { const s = S.saved[+b.dataset.open]; S.build = E.clone(s.cfg); S.buildSrc = s.title; S.buildStep = 0; go("#/summary"); }));
    $$("[data-rm]").forEach((b) => (b.onclick = () => { const code = S.saved[+b.dataset.rm].code; if (S.user) quiet(run("saved.remove", { code }, "Đã xóa cấu hình")); else { API.removeGuestSaved(code); toast("Đã xóa cấu hình"); rerender(); } }));
  });

  // ================= SC04 – Trang chủ =================
  add("SC04", "home", "Trang chủ", "UC02", "store", () => {
    const ban = S.banners.filter((b) => b.on && b.place === "Trang chủ");
    return `<div class="wrap page">
    <section class="hero"><div><span class="pill acc">Cửa hàng mặt phố Hà Nội · Xưởng lắp ráp tại chỗ</span>
      <h1 style="margin-top:12px">Chỉ chọn được linh kiện lắp vừa nhau. Máy chạy thử 2–4 giờ trước khi giao.</h1>
      <p class="muted" style="font-size:16px;max-width:58ch">Mua máy mới, tự build, mua combo hay nâng cấp máy đang dùng: công cụ của BuildX chỉ hiện linh kiện tương thích với những gì bạn đã chọn hoặc đã có.</p>
      <form id="hs" class="row" style="margin-top:14px;max-width:520px"><input id="hq" type="text" placeholder="Tìm linh kiện: RTX 5060, DDR4, 650W…" aria-label="Tìm kiếm" style="flex:1"><button class="btn" type="submit">Tìm</button></form>
      <p class="xs muted" style="margin-top:6px">${tag("SC04", "UC02")}</p></div>
    <div class="grid2"><a class="card entry" href="#/need"><b>Tư vấn theo nhu cầu</b><span class="small muted">Nhập ngân sách, game, phần mềm → 3 phương án có lý do.</span></a><a class="card entry" href="#/builder"><b>Build PC từng bước</b><span class="small muted">Bắt đầu từ mainboard, bỏ trống hoặc dùng linh kiện đã có.</span></a><a class="card entry" href="#/upgrade"><b>Nâng cấp PC đang dùng</b><span class="small muted">Khai báo máy hiện tại, chỉ thấy linh kiện lắp được.</span></a><a class="card entry" href="#/service"><b>Đặt lịch dịch vụ</b><span class="small muted">Lắp ráp, vệ sinh tại cửa hàng hoặc tận nhà.</span></a></div></section>
    ${ban.map((b) => `<div class="notice" style="margin-top:16px"><b>${esc(b.title)}</b>${b.sponsor ? ` <span class="pill">Nội dung tài trợ · ${esc(b.sponsor)}</span>` : ""}</div>`).join("")}
    <h2 style="margin-top:26px">4 combo PC</h2><p class="small muted">Giá combo = tổng giá từng linh kiện tại BuildX. Lắp ráp + burn-in tính riêng 300.000đ, không bắt buộc. Giao nội thành Hà Nội miễn phí.</p>
    <div class="grid4" style="margin-top:10px">${COMBOS.map((c) => { const cfg = E.cfgFromCombo(c.key); return `<div class="card"><div class="thumb">${c.name}<br>${byId(c.parts.vga).n.replace("GeForce ", "")}</div><b>${c.name}</b><span class="small muted">${c.use}</span><span class="price big">${fmt(E.cfgPrice(cfg))}</span><a class="btn sm plain" href="#/combo/${c.key}">Xem combo</a></div>`; }).join("")}</div></div>`;
  }, () => { $("#hs").onsubmit = (e) => { e.preventDefault(); go("#/catalog/" + encodeURIComponent($("#hq").value)); }; });

  // ================= SC05 – Danh mục & bộ lọc =================
  add("SC05", "catalog", "Danh mục & bộ lọc", "UC02", "store", (q) => {
    const brands = [...new Set(E.P.filter((p) => !p.ref).map((p) => p.brand))].sort();
    return `<div class="wrap page"><div class="row between"><div><h1>Linh kiện</h1><p class="muted small">Giá đã gồm VAT. Tồn khả dụng = tồn thực tế − hàng đã giữ cho đơn khác. ${tag("SC05", "UC02")}</p></div><input id="q" type="text" placeholder="Tìm theo tên, socket, VRAM…" style="max-width:300px" value="${esc(decodeURIComponent(q || ""))}" aria-label="Tìm"></div>
    <div class="side l" style="margin-top:12px"><div class="panel stack" style="gap:10px">
      <div class="field"><label for="ct">Loại</label><select id="ct"><option value="">Tất cả</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="field"><label for="br">Thương hiệu</label><select id="br"><option value="">Tất cả</option>${brands.map((b) => `<option>${esc(b)}</option>`).join("")}</select></div>
      <div class="field"><label for="pm">Giá tối đa: <span id="pmv"></span></label><input id="pm" type="range" min="500000" max="30000000" step="500000" value="30000000"></div>
      <label class="row small"><input type="checkbox" id="ins"> Chỉ hàng có sẵn</label>
      <div class="field"><label for="so">Sắp xếp</label><select id="so"><option value="pa">Giá tăng dần</option><option value="pd">Giá giảm dần</option><option value="n">Tên</option></select></div>
      <p class="xs muted">Hàng nhóm C (CPU, VGA cao cấp) nhập theo đơn, đặt cọc 30%.</p></div>
    <div><p class="small muted" id="cnt"></p><div class="grid3" id="list"></div></div></div></div>`;
  }, () => {
    const draw = () => {
      const q = $("#q").value.toLowerCase(), ct = $("#ct").value, br = $("#br").value, pm = +$("#pm").value, ins = $("#ins").checked, so = $("#so").value;
      $("#pmv").textContent = fmt(pm);
      let l = E.P.filter((p) => !p.ref && (!ct || p.cat === ct) && (!br || p.brand === br) && p.price <= pm && (!ins || E.avail(p.id) > 0) && (!q || (p.n + " " + (p.socket || "") + " " + (p.type || "") + " " + JSON.stringify(p.spec)).toLowerCase().includes(q)));
      l.sort((a, b) => (so === "pa" ? a.price - b.price : so === "pd" ? b.price - a.price : a.n.localeCompare(b.n)));
      $("#cnt").textContent = `${l.length} sản phẩm`;
      $("#list").innerHTML = l.map((p) => `<a class="card" href="#/item/${p.id}" style="text-decoration:none;color:inherit"><div class="thumb">${CAT[p.cat]}<br>${p.id}</div><b>${esc(p.n)}</b><span class="row between"><span class="price">${fmt(p.price)}</span>${availPill(p)}</span></a>`).join("") || '<div class="empty">Không có sản phẩm phù hợp.</div>';
    };
    ["q", "ct", "br", "pm", "ins", "so"].forEach((id) => ($("#" + id).oninput = draw));
    draw();
  });

  // ================= SC06 – Chi tiết sản phẩm =================
  const compatSpec = (p) => {
    const m = { cpu: [["Socket", p.socket], ["Điện năng tối đa", p.w + " W"], ["GPU tích hợp", p.igpu ? "Có" : "Không"], ["Tản kèm hộp", p.box ? "Có" : "Không"]], main: [["Socket", p.socket], ["Loại RAM", p.ram], ["Khe RAM", p.slots + " (tối đa " + p.maxRam + "GB, bus " + p.bus + ")"], ["Kích thước", p.ff], ["Khe M.2", p.m2], ["Cổng SATA", p.sata], ["PCIe x1", p.x1], ["WiFi", p.wifi ? "Có" : "Không"]], ram: [["Loại", p.type], ["Dung lượng/thanh", p.gb + "GB"], ["Bus", p.bus]], vga: [["Điện năng", p.w + " W"], ["Chiều dài", p.len + " mm"], ["Đầu nguồn", p.pin8 + " × 8-pin" + (p.p16 ? " hoặc 12V-2x6" : "")]], ssd: [["Giao tiếp", p.iface], ["Dạng", p.form]], cool: [["Socket hỗ trợ", (p.sockets || []).join(", ")], [p.rad ? "Radiator" : "Chiều cao", p.rad ? p.rad + " mm" : p.h + " mm"], ["Khả năng tản", "~" + p.tdp + " W"]], case: [["Mainboard", (p.ff || []).join(", ")], ["VGA tối đa", p.gpu + " mm"], ["Tản tối đa", p.cool + " mm"], ["Radiator tối đa", p.rad + " mm"], ["Vị trí quạt", p.fans + " (có sẵn " + p.pre + ")"], ["Màu", p.color]], psu: [["Công suất", p.w + " W"], ["Đầu PCIe 8-pin", p.pin8], ["12V-2x6", p.p16 ? "Có" : "Không"]], opt: [["Yêu cầu", p.need === "x1" ? "Khe PCIe x1 trống" : p.need === "fan3" ? "Case còn 3 vị trí quạt" : "Không"]] };
    return m[p.cat] || [];
  };
  add("SC06", "item", "Chi tiết sản phẩm", "UC03", "store", (id) => {
    const p = byId(id || "G02");
    return `<div class="wrap page"><a href="#/catalog" class="small">← Danh mục</a><div class="side" style="margin-top:10px"><div class="panel"><span class="lbl">${CAT[p.cat]} · ${p.id} · ${esc(p.brand)}${p.demo ? " · giá minh họa" : ""}</span><h1>${esc(p.n)}</h1><p class="muted">${esc(p.why)}</p>
      <h3 style="margin-top:14px">Thông số tương thích</h3><dl class="spec">${compatSpec(p).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}${Object.entries(p.spec || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <p class="xs muted" style="margin-top:10px">${tag("SC06", "UC03")}</p></div>
    <div class="panel stack"><span class="price big">${fmt(p.price)}</span>${availPill(p)}<p class="xs muted">Báo giá có hiệu lực 24–48 giờ vì giá linh kiện biến động. Bảo hành theo chính sách hãng; BuildX là đầu mối nhận bảo hành.</p>
      <div class="row"><label for="qty" class="small">Số lượng</label><input id="qty" type="number" min="1" value="1" style="width:80px"></div>
      <button class="btn" type="button" id="buy">Thêm vào giỏ</button>${["opt"].includes(p.cat) ? "" : `<button class="btn ghost" type="button" id="use">Dùng trong Build PC</button>`}</div></div></div>`;
  }, (id) => {
    const p = byId(id || "G02");
    $("#buy").onclick = () => { const q = Math.max(1, +$("#qty").value || 1); const ex = S.cart.find((l) => l.type === "part" && l.id === p.id); if (ex) ex.qty += q; else S.cart.push({ type: "part", id: p.id, qty: q }); $("#cartn").textContent = S.cart.length; toast("Đã thêm vào giỏ (chưa giữ hàng)"); };
    const u = $("#use"); if (u) u.onclick = () => { const t = E.tryPart(S.build, p.cat, p.id); if (t.bad.length) return toast("Không hợp với cấu hình đang build: " + t.bad[0].m); S.build[p.cat] = { mode: "buy", id: p.id, qty: 1 }; S.buildStep = ORDER.indexOf(p.cat); go("#/builder"); };
  });

  // ================= SC07 – Khai báo nhu cầu =================
  // Ngân sách nhập tay: chấp nhận "25000000", "25.000.000", "25,5 triệu", "25tr"
  const BUDGET_MIN = 10000000, BUDGET_MAX = 200000000;
  function parseBudget(raw) {
    const t = String(raw || "").trim().toLowerCase().replace(/đ|vnd|vnđ/g, "").trim();
    if (!t) return { err: "Vui lòng nhập ngân sách." };
    let v;
    const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(triệu|trieu|tr|m)$/);
    if (m) v = Math.round(parseFloat(m[1].replace(",", ".")) * 1e6);
    else if (/^[\d.,\s]+$/.test(t)) v = Number(t.replace(/[.,\s]/g, ""));
    else return { err: "Ngân sách chỉ gồm số (VD: 25.000.000 hoặc 25 triệu)." };
    if (!Number.isFinite(v) || v <= 0) return { err: "Ngân sách không hợp lệ." };
    if (v < BUDGET_MIN) return { err: `Ngân sách tối thiểu ${fmt(BUDGET_MIN)} (PC rẻ nhất hiện có khoảng 21,7 triệu).` };
    if (v > BUDGET_MAX) return { err: `Ngân sách tối đa ${fmt(BUDGET_MAX)}; cấu hình cao hơn vui lòng liên hệ tư vấn riêng.` };
    return { v: Math.round(v / 1000) * 1000 };
  }
  // Độ phân giải: lọc combo theo sức mạnh VGA (tier) tối thiểu
  const RES_ORDER = ["1080", "1080hz", "1440", "1440uw", "2160"];
  const RES = {
    "1080": { label: "1080p (Full HD) 60–144Hz", short: "1080p", minTier: 1, hint: "Phổ biến nhất, mọi combo đều đáp ứng." },
    "1080hz": { label: "1080p 240Hz (eSports thi đấu)", short: "1080p 240Hz", minTier: 1, hint: "Ưu tiên FPS rất cao trong game eSports; CPU quan trọng hơn VGA." },
    "1440": { label: "1440p (2K QHD)", short: "1440p", minTier: 2, hint: "Cần VGA từ RTX 5060 trở lên; bỏ combo eSports." },
    "1440uw": { label: "3440×1440 Ultrawide", short: "Ultrawide 1440p", minTier: 3, hint: "Nhiều điểm ảnh hơn 2K 34%; cần RTX 5060 Ti trở lên." },
    "2160": { label: "4K (2160p UHD)", short: "4K", minTier: 4, hint: "Cần RTX 5070 trở lên và DLSS; chỉ BX Pro đáp ứng, nên tư vấn cấu hình riêng nếu muốn thiết lập cao." },
  };
  if (!RES[S.need.res]) S.need.res = "1080";
  add("SC07", "need", "Khai báo nhu cầu", "UC04", "store", () => {
    const n = S.need, purposes = [["game", "Chơi game"], ["esports", "Esports"], ["creator", "Đồ họa, dựng video, AI"], ["study", "Học tập, văn phòng"]];
    return `<div class="wrap page" style="max-width:780px"><h1>Bạn cần PC để làm gì?</h1><p class="muted small">Khoảng 1 phút. Hệ thống chọn từ các combo mẫu đã kiểm tra tương thích. ${tag("SC07", "UC04")}</p>
    <div class="panel stack" style="margin-top:12px">
      <div class="field"><label for="bd">Ngân sách (đồng)</label><input id="bd" type="text" inputmode="numeric" autocomplete="off" placeholder="VD: 25.000.000 hoặc 25 triệu" value="${n.budget.toLocaleString("vi-VN")}" aria-describedby="bdh bde" required><span class="xs muted" id="bdh">Từ ${fmt(BUDGET_MIN)} đến ${fmt(BUDGET_MAX)}. Có thể nhập "25 triệu" hoặc "25tr".</span><span class="xs" id="bde" role="alert" style="color:var(--bad)"></span></div>
      <div><span class="lbl">Mục đích</span><div class="chips" id="pu">${purposes.map(([k, l]) => `<button type="button" class="chip" data-p="${k}" aria-pressed="${n.purpose === k}">${l}</button>`).join("")}</div></div>
      <div><span class="lbl">Game / phần mềm</span><div class="chips" id="ap"></div></div>
      <div class="grid2"><div class="field"><label for="rs">Độ phân giải màn hình</label><select id="rs">${RES_ORDER.map((k) => [k, RES[k]]).map(([k, r]) => `<option value="${k}" ${n.res === k ? "selected" : ""}>${r.label}</option>`).join("")}</select><span class="xs muted" id="rsh">${esc(RES[n.res] ? RES[n.res].hint : "")}</span></div>
      <div class="field"><label for="cl">Màu case</label><select id="cl">${["Không quan trọng", "Đen", "Trắng"].map((c) => `<option ${n.color === c ? "selected" : ""}>${c}</option>`).join("")}</select></div></div>
      <button class="btn" type="button" id="go">Xem 3 phương án</button></div></div>`;
  }, () => {
    const n = S.need;
    const drawApps = () => { $("#ap").innerHTML = APPS[n.purpose].map((a) => `<button type="button" class="chip" data-a="${esc(a)}" aria-pressed="${n.apps.includes(a)}">${esc(a)}</button>`).join(""); $$("[data-a]").forEach((b) => (b.onclick = () => { const a = b.dataset.a; n.apps = n.apps.includes(a) ? n.apps.filter((x) => x !== a) : [...n.apps, a]; drawApps(); })); };
    // Kiểm tra ngân sách khi gõ: hiện lỗi ngay dưới ô, khóa nút khi sai
    const check = () => { const r = parseBudget($("#bd").value); $("#bde").textContent = r.err || (r.v ? "= " + fmt(r.v) : ""); $("#bde").style.color = r.err ? "var(--bad)" : "var(--muted)"; $("#bd").setAttribute("aria-invalid", r.err ? "true" : "false"); $("#go").disabled = !!r.err; return r; };
    $("#bd").oninput = check; $("#bd").onblur = () => { const r = check(); if (!r.err) $("#bd").value = r.v.toLocaleString("vi-VN"); };
    $("#rs").onchange = () => ($("#rsh").textContent = RES[$("#rs").value].hint);
    check(); drawApps();
    $$("[data-p]").forEach((b) => (b.onclick = () => { n.purpose = b.dataset.p; n.apps = APPS[n.purpose].slice(0, 2); $$("[data-p]").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawApps(); }));
    $("#go").onclick = () => { const r = check(); if (r.err) return $("#bd").focus(); n.budget = r.v; n.res = $("#rs").value; n.color = $("#cl").value; go("#/results"); };
  });

  // ================= SC08 – Kết quả 3 phương án =================
  function recommend() {
    const n = S.need;
    let pool = COMBOS.map((c) => { const cfg = E.cfgFromCombo(c.key); let note = "";
      if (n.color === "Trắng" && E.part(cfg, "case").color !== "Trắng") { const t = E.clone(cfg); t.case = { mode: "buy", id: "K04", qty: 1 }; if (E.worst(E.evalRules(t)) !== "bad") { Object.assign(cfg, t); note = "Đổi sang case trắng K04 (đã kiểm tra tương thích)."; } else note = "Combo này chưa có bản case trắng tương thích."; }
      return { c, cfg, price: E.cfgPrice(cfg), note }; });
    if (n.purpose === "creator") pool = pool.filter((x) => x.c.key !== "esports");
    if ((n.purpose === "esports" || n.purpose === "study") && RES[n.res].minTier < 3) pool = pool.filter((x) => x.c.key !== "pro");
    const minTier = RES[n.res].minTier;
    const strong = pool.filter((x) => (byId(x.cfg.vga.id).tier || 1) >= minTier);
    if (strong.length) pool = strong;
    pool.sort((a, b) => a.price - b.price);
    const fit = pool.filter((x) => x.price <= n.budget);
    if (!fit.length) recommend.under = pool[0] ? pool[0].price : 0; else recommend.under = 0;
    const bal = fit.length ? fit[fit.length - 1] : pool[0];
    const i = pool.indexOf(bal);
    const lo = i > 0 ? pool[i - 1] : null, hi = pool[i + 1] || null;
    return [["Tiết kiệm", lo], ["Cân bằng", bal], ["Hiệu năng", hi]].filter((x) => x[1]);
  }
  add("SC08", "results", "Kết quả 3 phương án", "UC04", "store", () => {
    const r = recommend(), n = S.need;
    return `<div class="wrap page"><a href="#/need" class="small">← Sửa nhu cầu</a><h1>${r.length < 3 ? r.length + " phương án" : "3 phương án"} cho ngân sách ${fmt(n.budget)}</h1>${recommend.under ? `<div class="notice warn small" style="margin-top:8px">Chưa có cấu hình nào vừa ngân sách ${fmt(n.budget)} cho độ phân giải ${esc(RES[n.res].short)}. Phương án rẻ nhất phù hợp là <b>${fmt(recommend.under)}</b> (vượt ${fmt(recommend.under - n.budget)}). Bạn có thể tăng ngân sách, hạ độ phân giải, hoặc <a href="#/builder">tự build</a> để bỏ bớt linh kiện.</div>` : ""}${n.res === "2160" ? `<div class="notice small" style="margin-top:8px">4K: BX Pro chơi được ở thiết lập trung bình–cao kèm DLSS. Muốn thiết lập Ultra, BuildX tư vấn cấu hình riêng (RTX 5080 trở lên, đặt theo đơn).</div>` : ""}<p class="muted small">${esc(n.apps.join(", ") || "Chưa chọn phần mềm")} · ${esc(RES[n.res].short)} · case ${esc(n.color.toLowerCase())}. Mọi phương án đã qua toàn bộ luật tương thích. ${tag("SC08", "UC04")}</p>
    <div class="grid3" style="margin-top:12px">${r.map(([lbl, x], i) => `<div class="card ${lbl === "Cân bằng" ? "sel" : ""}"><span class="lbl">${lbl}${lbl === "Cân bằng" ? (recommend.under ? " · rẻ nhất phù hợp" : " · gần ngân sách nhất") : ""}</span><b style="font-size:18px">${x.c.name}</b><span class="price big">${fmt(x.price)}</span><span class="small ${x.price > n.budget ? "" : "muted"}">${x.price > n.budget ? "Vượt ngân sách " + fmt(x.price - n.budget) : "Còn dư " + fmt(n.budget - x.price)}</span><span class="mono xs">${fpsLine(x.cfg)}</span>
      <ul class="small" style="margin:4px 0 0;padding-left:18px">${["cpu", "vga", "ram", "case"].map((s) => `<li><b>${byId(x.cfg[s].id).n}${s === "ram" && x.cfg.ram.qty > 1 ? " ×" + x.cfg.ram.qty : ""}:</b> ${esc(byId(x.cfg[s].id).why)}</li>`).join("")}</ul>${x.note ? `<p class="xs muted">${x.note}</p>` : ""}
      <div class="row" style="margin-top:auto"><button class="btn sm" type="button" data-buy="${i}">Chọn mua</button><button class="btn sm ghost" type="button" data-tune="${i}">Tinh chỉnh ở Build PC</button></div></div>`).join("")}</div></div>`;
  }, () => {
    const r = recommend();
    $$("[data-buy]").forEach((b) => (b.onclick = () => { const x = r[+b.dataset.buy][1]; S.cart.push({ type: "pc", title: x.c.name + (x.note.startsWith("Đổi") ? " – case trắng" : ""), src: "combo", cfg: E.clone(x.cfg), asm: "shop" }); go("#/cart"); }));
    $$("[data-tune]").forEach((b) => (b.onclick = () => { const x = r[+b.dataset.tune][1]; S.build = E.clone(x.cfg); S.buildSrc = x.c.name; S.buildStep = 0; go("#/builder"); }));
  });

  // ================= SC09 – Build PC từng bước =================
  S.buildStep = S.buildStep || 0; S.buildAck = S.buildAck || {}; S.buildNotice = "";
  const REQ_NOTE = { main: "Luôn chọn đầu tiên", cpu: "Bắt buộc", ram: "Bắt buộc", ssd: "Bắt buộc", psu: "Bắt buộc", vga: "Bắt buộc nếu CPU không có GPU tích hợp", cool: "Bắt buộc nếu CPU không kèm tản", case: "Bắt buộc nếu chọn lắp ráp" };
  function setSlot(slot, val) {
    const c = S.build; c[slot] = Object.assign({ qty: 1 }, val);
    // gỡ linh kiện không còn hợp ở các ô khác
    const removed = [];
    for (let guard = 0; guard < 8; guard++) {
      const bad = E.evalRules(c).filter((r) => r.lv === "bad");
      if (!bad.length) break;
      const other = bad[0].slots.find((s) => s !== slot && s !== "extras" && c[s] && c[s].id);
      if (!other) break;
      removed.push(`${byId(c[other].id).n} (${bad[0].m})`);
      c[other] = { mode: null, id: null, qty: 1 };
    }
    S.buildNotice = removed.length ? "Đã gỡ linh kiện không còn hợp: " + removed.join("; ") : "";
  }
  const slotDone = (s) => S.build[s].mode === "skip" || (S.build[s].mode && S.build[s].id);
  const mainSet = () => !!E.part(S.build, "main");
  add("SC09", "builder", "Build PC từng bước", "UC05", "store", () => {
    const c = S.build, step = S.buildStep, slot = ORDER[step], cur = c[slot];
    const locked = slot !== "main" && !mainSet();
    const mode = cur.mode || (locked ? "own" : "buy");
    const all = mode === "own" ? E.P.filter((p) => p.cat === slot) : sellable(slot);
    // Mainboard chỉ lọc theo linh kiện "Đã có"; linh kiện "Mua mới" không hợp sẽ bị gỡ kèm thông báo khi đổi mainboard
    const base = slot === "main" ? (() => { const t = E.clone(c); ORDER.forEach((s) => { if (s !== "main" && t[s].mode === "buy") t[s] = { mode: null, id: null, qty: 1 }; }); t.extras = []; return t; })() : c;
    const scored = all.map((p) => ({ p, t: E.tryPart(base, slot, p.id) }));
    const vis = scored.filter((x) => !x.t.bad.length);
    const notes = E.filterNotes(base, slot);
    const miss = E.missing(c, false).find((m) => m.s === slot);
    const ramQty = slot === "ram" ? `<div class="row small" style="margin-bottom:8px"><label for="rq">Số thanh</label><select id="rq" style="width:auto">${[1, 2, 3, 4].filter((q) => !E.part(c, "main") || q <= E.part(c, "main").slots).map((q) => `<option ${cur.qty === q ? "selected" : ""}>${q}</option>`).join("")}</select></div>` : "";
    let body;
    if (mode === "skip") body = `<div class="check ${miss && miss.req ? "bad" : "warn"}"><b class="t">${miss && miss.req ? "CẢNH BÁO" : "LƯU Ý"}</b><span>Bỏ trống ${CAT[slot]}: ${esc(miss ? miss.m : "Không ảnh hưởng.")}</span></div>${miss && miss.req ? `<label class="row small" style="margin-top:10px"><input type="checkbox" id="ack" ${S.buildAck[slot] ? "checked" : ""}> Tôi đã đọc cảnh báo và vẫn muốn bỏ trống</label>` : ""}`;
    else if (locked && mode === "buy") body = `<div class="empty">Chọn mainboard trước: mainboard quyết định socket CPU, loại RAM, số khe M.2 và kích thước case. Bạn vẫn có thể khai báo <b>Đã có</b> cho ô này để lọc mainboard theo linh kiện sẵn có.</div>`;
    else body = `${ramQty}<div class="row between small"><span><b>Đang hiện ${vis.length}/${all.length}</b> ${mode === "own" ? "model (gồm model đã ngừng bán)" : "sản phẩm"} tương thích</span>${notes.length ? `<details><summary class="small">Xem điều kiện lọc</summary><ul class="small" style="margin:6px 0 0;padding-left:18px">${notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}</div>
      <div class="stack" style="gap:8px;margin-top:8px">${vis.map(({ p, t }) => `<button type="button" class="opt ${cur.id === p.id && cur.mode === mode ? "sel" : ""}" data-pick="${p.id}"><span style="flex:1;min-width:0;text-align:left"><b>${esc(p.n)}</b><br><span class="xs muted">${esc(p.why || "Model tham chiếu")}</span>${t.warn.map((w) => `<br><span class="pill warn">Lưu ý: ${esc(w.m)}</span>`).join("")}</span><span style="text-align:right">${mode === "buy" ? `<span class="price">${fmt(p.price)}</span><br>${availPill(p)}` : `<span class="pill">Không tính tiền</span>`}</span></button>`).join("") || '<div class="empty">Không còn linh kiện nào hợp với những gì đã chọn. Đổi linh kiện ở bước trước.</div>'}</div>`;
    const steps = ORDER.map((s, i) => { const x = c[s]; const d = slotDone(s); return `<button type="button" class="stp ${i === step ? "on" : ""}" data-step="${i}"><span class="n">${i + 1}</span><span style="flex:1;min-width:0;text-align:left"><b>${CAT[s]}</b><br><span class="xs muted">${x.mode === "skip" ? "Bỏ trống" : x.id ? esc(byId(x.id).n) + (x.mode === "own" ? " · đã có" : "") + (s === "ram" && x.qty > 1 ? " ×" + x.qty : "") : REQ_NOTE[s]}</span></span>${d ? `<span class="pill ${x.mode === "skip" ? "warn" : x.mode === "own" ? "info" : "ok"}">${x.mode === "skip" ? "Trống" : x.mode === "own" ? "Đã có" : "Mua"}</span>` : ""}</button>`; }).join("");
    return `<div class="wrap page"><div class="row between"><div><h1>Build PC</h1><p class="muted small">${S.buildSrc ? "Đang tinh chỉnh từ " + esc(S.buildSrc) + ". " : ""}Bắt đầu từ mainboard; mỗi bước chỉ hiện linh kiện tương thích với những gì đã chọn hoặc đã có. ${tag("SC09", "UC05")}</p></div><button class="btn sm plain" type="button" id="reset">Làm lại từ đầu</button></div>
    ${S.buildNotice ? `<div class="notice warn" style="margin-top:10px">${esc(S.buildNotice)}</div>` : ""}
    <div class="side l" style="margin-top:12px"><div class="stack" style="gap:6px">${steps}<div class="panel" style="padding:12px"><span class="lbl">Tạm tính (chỉ linh kiện Mua mới)</span><div class="price big">${fmt(E.cfgPrice(c))}</div><a class="btn sm" href="#/summary" style="margin-top:8px">Kiểm tra tổng thể →</a></div></div>
      <div class="panel"><div class="row between"><h2 style="margin:0">Bước ${step + 1}: ${CAT[slot]}</h2><span class="xs muted">${REQ_NOTE[slot]}</span></div>
        <div class="seg" role="group" aria-label="Trạng thái ô" style="margin:12px 0"><button type="button" data-mode="buy" aria-pressed="${mode === "buy"}" ${locked ? "disabled" : ""}>Mua mới</button><button type="button" data-mode="own" aria-pressed="${mode === "own"}">Đã có</button>${slot === "main" ? "" : `<button type="button" data-mode="skip" aria-pressed="${mode === "skip"}" ${locked ? "disabled" : ""}>Bỏ trống</button>`}</div>
        ${body}
        <div class="row between" style="margin-top:14px"><button class="btn plain" type="button" id="prev" ${step === 0 ? "disabled" : ""}>← Bước trước</button>${step < ORDER.length - 1 ? `<button class="btn" type="button" id="next" ${slot === "main" && !mainSet() ? "disabled" : ""}>Bước tiếp →</button>` : `<a class="btn" href="#/summary">Xem tổng kết →</a>`}</div></div></div></div>`;
  }, () => {
    const c = S.build, slot = ORDER[S.buildStep];
    $$("[data-step]").forEach((b) => (b.onclick = () => { const i = +b.dataset.step; if (i > 0 && !mainSet() && ORDER[i] !== "main") { S.buildStep = i; } else S.buildStep = i; S.buildNotice = ""; rerender(); }));
    $$("[data-mode]").forEach((b) => (b.onclick = () => { const m = b.dataset.mode; if (m === "skip") { setSlot(slot, { mode: "skip", id: null }); } else { const keep = c[slot].mode === m ? c[slot].id : null; c[slot] = { mode: m, id: keep, qty: c[slot].qty || 1 }; S.buildNotice = ""; } rerender(); }));
    $$("[data-pick]").forEach((b) => (b.onclick = () => { const m = c[slot].mode === "own" || (slot !== "main" && !mainSet()) ? "own" : "buy"; setSlot(slot, { mode: m, id: b.dataset.pick, qty: c[slot].qty || 1 }); if (!S.buildNotice && S.buildStep < ORDER.length - 1 && (slot !== "main" || mainSet())) S.buildStep++; rerender(); }));
    const rq = $("#rq"); if (rq) rq.onchange = () => { c.ram.qty = +rq.value; if (c.ram.id) setSlot("ram", { mode: c.ram.mode, id: c.ram.id, qty: +rq.value }); rerender(); };
    const ack = $("#ack"); if (ack) ack.onchange = () => { S.buildAck[slot] = ack.checked; };
    $("#prev").onclick = () => { S.buildStep--; S.buildNotice = ""; rerender(); };
    const nx = $("#next"); if (nx) nx.onclick = () => { if (c[slot].mode === "skip" && E.missing(c, false).find((m) => m.s === slot && m.req) && !S.buildAck[slot]) return toast("Hãy xác nhận đã đọc cảnh báo bỏ trống"); S.buildStep++; S.buildNotice = ""; rerender(); };
    $("#reset").onclick = () => { S.build = E.emptyCfg(); S.buildStep = 0; S.buildSrc = null; S.buildAck = {}; S.buildNotice = ""; rerender(); };
  });

  // ================= SC10 – Tổng kết cấu hình =================
  add("SC10", "summary", "Tổng kết cấu hình", "UC05", "store", () => {
    const c = S.build, rs = E.evalRules(c), w = E.worst(rs), miss = E.missing(c, S.buildAsm !== "none"), canAsm = E.canAssemble(c), own = E.hasOwn(c);
    const unacked = miss.filter((m) => m.req && c[m.s].mode === "skip" && !S.buildAck[m.s]);
    const unset = ORDER.filter((s) => !c[s].mode || (c[s].mode !== "skip" && !c[s].id));
    if (!canAsm && S.buildAsm !== "none") S.buildAsm = "none";
    const fee = S.buildAsm === "shop" ? (own ? FEES.asmOwn : FEES.asm) : 0;
    return `<div class="wrap page"><a href="#/builder" class="small">← Quay lại Build PC</a><h1>Tổng kết cấu hình</h1><p class="muted small">Kiểm tra tổng thể công suất nguồn, kích thước, tản nhiệt trước khi đặt. ${tag("SC10", "UC05")}</p>
    <div class="side" style="margin-top:12px"><div class="stack"><div class="tbl"><table><thead><tr><th>Thành phần</th><th>Linh kiện</th><th>Trạng thái</th><th class="num">Giá</th></tr></thead><tbody>${ORDER.map((s) => { const x = c[s], p = x.id ? byId(x.id) : null; return `<tr><td><b>${CAT[s]}</b></td><td>${p ? esc(p.n) + (s === "ram" && x.qty > 1 ? " ×" + x.qty : "") + `<div class="xs muted">${esc(p.why || "")}</div>` : '<span class="muted">—</span>'}</td><td>${x.mode === "buy" ? '<span class="pill ok">Mua mới</span>' : x.mode === "own" ? '<span class="pill info">Đã có</span>' : x.mode === "skip" ? '<span class="pill warn">Bỏ trống</span>' : '<span class="pill">Chưa chọn</span>'}</td><td class="num">${x.mode === "buy" && p ? fmt(p.price * (x.qty || 1)) : "0đ"}</td></tr>`; }).join("")}</tbody></table></div>
      <div class="panel"><h3>Kiểm tra tương thích (${rs.length} kiểm tra)</h3>${A.checkHtml(rs)}</div>
      ${miss.length ? `<div class="panel"><h3>Linh kiện bỏ trống</h3><div class="stack" style="gap:6px">${miss.map((m) => `<div class="check ${m.req ? "bad" : "warn"}"><b class="t">${m.req ? "THIẾU" : "LƯU Ý"}</b><span><b>${CAT[m.s]}:</b> ${esc(m.m)}${m.req && c[m.s].mode === "skip" && S.buildAck[m.s] ? " · khách đã xác nhận" : ""}</span></div>`).join("")}</div></div>` : ""}</div>
    <div class="panel stack"><span class="lbl">Tổng (chỉ linh kiện Mua mới)</span><span class="price big">${fmt(E.cfgPrice(c) + fee)}</span><span class="mono xs muted">Tải ước tính ~${E.load(c)} W · ${fpsLine(c)}</span>
      <fieldset class="stack" style="gap:6px;border:0;padding:0;margin:0"><legend class="lbl">Dịch vụ lắp ráp (không bắt buộc)</legend>
        <label class="row small"><input type="radio" name="asm" value="none" ${S.buildAsm === "none" ? "checked" : ""}> Không lắp, nhận linh kiện rời</label>
        <label class="row small"><input type="radio" name="asm" value="shop" ${S.buildAsm === "shop" ? "checked" : ""} ${canAsm ? "" : "disabled"}> Lắp ráp + burn-in 2–4 giờ: ${fmt(own ? FEES.asmOwn : FEES.asm)}${own ? " (có linh kiện Đã có)" : ""}</label>
        ${canAsm ? "" : '<span class="xs muted">Chỉ chọn được lắp ráp khi mọi linh kiện bắt buộc ở trạng thái Mua mới hoặc Đã có.</span>'}</fieldset>
      ${w === "bad" ? '<div class="notice warn">Còn lỗi tương thích, sửa ở Build PC trước khi đặt.</div>' : ""}${unset.length ? `<div class="notice warn">Còn ${unset.length} ô chưa chọn: ${unset.map((s) => CAT[s]).join(", ")}.</div>` : ""}${unacked.length ? '<div class="notice warn">Có linh kiện bắt buộc bị bỏ trống chưa xác nhận cảnh báo.</div>' : ""}
      <button class="btn" type="button" id="tc" ${w === "bad" || unset.length || unacked.length || !E.cfgPrice(c) ? "disabled" : ""}>${S.posMode ? "Thêm vào đơn tại quầy" : "Thêm vào giỏ"}</button>${S.posMode ? '<span class="xs muted">Đang build hộ khách cho màn hình Bán tại quầy (SC22).</span>' : ""}
      <div class="row"><button class="btn sm plain" type="button" id="sv">Lưu cấu hình</button><button class="btn sm plain" type="button" id="sh">Chia sẻ link</button></div></div></div></div>`;
  }, () => {
    $$("[name=asm]").forEach((r) => (r.onchange = () => { S.buildAsm = r.value; rerender(); }));
    const t = $("#tc"); if (t) t.onclick = () => { if (S.posMode) { S.pos.lines.push({ type: "pc", title: S.buildSrc ? S.buildSrc + " (tùy chỉnh)" : "PC build tại quầy", src: "build", cfg: E.clone(S.build), asm: S.buildAsm }); S.posMode = false; go("#/pos"); return; } S.cart.push({ type: "pc", title: S.buildSrc ? S.buildSrc + " (tùy chỉnh)" : "PC tự build", src: "build", cfg: E.clone(S.build), asm: S.buildAsm }); go("#/cart"); };
    const save = (title, cfg, kind) => S.user ? quiet(run("saved.add", { title, cfg, kind }, "Đã lưu vào tài khoản")) : (API.addGuestSaved({ code: "CFG-" + Math.random().toString(36).slice(2, 6).toUpperCase(), title, cfg: E.clone(cfg), date: E.dstr(E.now()), kind }), toast("Đã lưu trên máy này (đăng nhập để lưu vào tài khoản)"));
    $("#sv").onclick = () => save(S.buildSrc ? S.buildSrc + " (tùy chỉnh)" : "PC tự build", S.build);
    $("#sh").onclick = () => { const code = save(); toast("Link chia sẻ: buildx.vn/c/" + code); };
  });

  // ================= SC11 – Khai báo cấu hình hiện tại (nâng cấp) =================
  const UPG_SLOTS = ["main", "cpu", "ram", "vga", "ssd", "psu", "case"];
  add("SC11", "upgrade", "Khai báo cấu hình hiện tại", "UC06", "store", () => {
    if (!S.upgrade.cfg) { const c = E.emptyCfg(); Object.assign(c, { main: { mode: "own", id: "XM9", qty: 1 }, cpu: { mode: "own", id: "XC9", qty: 1 }, ram: { mode: "own", id: "XR8", qty: 1 }, vga: { mode: "own", id: "XG6", qty: 1 }, ssd: { mode: "own", id: "XS2", qty: 1 }, psu: { mode: "own", id: "XP4", qty: 1 }, case: { mode: "own", id: "XK8", qty: 1 }, cool: { mode: "skip", id: null, qty: 1 } }); S.upgrade.cfg = c; }
    const c = S.upgrade.cfg, rs = E.evalRules(c).filter((r) => r.lv !== "ok");
    return `<div class="wrap page" style="max-width:900px"><h1>Nâng cấp PC đang dùng</h1><p class="muted small">Bước 1/2: khai báo linh kiện máy đang dùng (danh sách gồm cả model đã ngừng bán). ${tag("SC11", "UC06")}</p>
    <div class="panel" style="margin-top:12px"><div class="grid2">${UPG_SLOTS.map((s) => { const opts = E.P.filter((p) => p.cat === s && (s === "main" || !E.part(c, "main") || !E.tryPart(Object.assign(E.clone(c), { [s]: { mode: "own", id: null, qty: 1 } }), s, p.id).bad.some((b) => b.slots.includes("main")))); return `<div class="field"><label for="u-${s}">${CAT[s]}</label><div class="row" style="flex-wrap:nowrap"><select id="u-${s}" data-u="${s}"><option value="">${s === "vga" ? "Không có VGA rời" : "— chọn —"}</option>${opts.map((p) => `<option value="${p.id}" ${c[s].id === p.id ? "selected" : ""}>${esc(p.n)}</option>`).join("")}</select>${s === "ram" ? `<select id="u-rq" style="width:80px" aria-label="Số thanh">${[1, 2, 3, 4].map((q) => `<option ${c.ram.qty === q ? "selected" : ""}>${q}</option>`).join("")}</select>` : ""}</div></div>`; }).join("")}</div>
      <p class="xs muted">Không biết model? Mở CPU-Z hoặc hỏi chuyên viên qua Zalo. CPU, RAM được lọc theo socket và loại RAM của mainboard đã khai báo.</p>
      ${rs.length ? `<div style="margin-top:10px">${A.checkHtml(rs)}</div>` : ""}
      <div class="row" style="margin-top:12px"><button class="btn" type="button" id="nx" ${E.part(c, "main") ? "" : "disabled"}>Chọn mục tiêu nâng cấp →</button><button class="btn plain" type="button" id="sv">Lưu cấu hình hiện tại</button></div></div></div>`;
  }, () => {
    const c = S.upgrade.cfg;
    $$("[data-u]").forEach((sel) => (sel.onchange = () => { const s = sel.dataset.u; c[s] = sel.value ? { mode: "own", id: sel.value, qty: s === "ram" ? c.ram.qty : 1 } : { mode: "skip", id: null, qty: 1 }; rerender(); }));
    $("#u-rq").onchange = (e) => { c.ram.qty = +e.target.value; rerender(); };
    $("#nx").onclick = () => go("#/upgrade-pick");
    $("#sv").onclick = () => { if (S.user) quiet(run("saved.add", { title: "Máy hiện tại (nâng cấp)", cfg: c, kind: "upgrade" }, "Đã lưu vào tài khoản")); else { API.addGuestSaved({ code: "CFG-" + Math.random().toString(36).slice(2, 6).toUpperCase(), title: "Máy hiện tại (nâng cấp)", cfg: E.clone(c), date: E.dstr(E.now()), kind: "upgrade" }); toast("Đã lưu trên máy này"); } };
  });

  // ================= SC12 – Mục tiêu & gợi ý nâng cấp =================
  function upgradeOptions(goal) {
    const base = S.upgrade.cfg, out = [];
    const fix = (t, slot) => {   // tìm linh kiện mua kèm rẻ nhất để hết lỗi
      const bad = E.evalRules(t).filter((r) => r.lv === "bad");
      if (!bad.length) return { cfg: t, adds: [] };
      for (const s of ["psu", "case"]) {
        if (!bad.some((b) => b.slots.includes(s)) || s === slot) continue;
        const cands = sellable(s).map((p) => { const x = E.clone(t); x[s] = { mode: "buy", id: p.id, qty: 1 }; return { p, x }; }).filter((y) => !E.evalRules(y.x).some((r) => r.lv === "bad" && r.slots.includes(s))).sort((a, b) => a.p.price - b.p.price);
        if (cands.length) { const r = fix(cands[0].x, slot); if (r) return { cfg: r.cfg, adds: [cands[0].p, ...r.adds] }; }
      }
      return null;
    };
    const tryCfg = (t, label, slot) => { const r = fix(t, slot); if (r) out.push({ label, cfg: r.cfg, adds: r.adds, warn: E.evalRules(r.cfg).filter((x) => x.lv === "warn") }); };
    if (["vga", "cpu", "psu"].includes(goal)) {
      const curP = E.part(base, goal);
      sellable(goal).forEach((p) => { if (curP && goal === "vga" && p.tier <= curP.tier) return; if (curP && goal === "psu" && p.w <= curP.w) return; if (curP && p.id === curP.id) return; const t = E.clone(base); t[goal] = { mode: "buy", id: p.id, qty: 1 }; tryCfg(t, p, goal); });
    } else {
      sellable(goal).forEach((p) => { const t = E.clone(base); t.extras = [{ id: p.id, qty: goal === "ram" ? 1 : 1 }]; if (goal === "ram") { const r2 = E.clone(base); r2.extras = [{ id: p.id, qty: 2 }]; if (E.worst(E.evalRules(r2)) !== "bad") out.push({ label: p, qty: 2, cfg: r2, adds: [], warn: E.evalRules(r2).filter((x) => x.lv === "warn") }); } if (E.worst(E.evalRules(t)) !== "bad") out.push({ label: p, qty: 1, cfg: t, adds: [], warn: E.evalRules(t).filter((x) => x.lv === "warn") }); });
    }
    return out;
  }
  add("SC12", "upgrade-pick", "Mục tiêu & gợi ý nâng cấp", "UC06", "store", () => {
    if (!S.upgrade.cfg) return `<div class="wrap page"><div class="empty">Chưa khai báo máy hiện tại. <a href="#/upgrade">Khai báo</a></div></div>`;
    const goal = S.upgrade.goal, goals = [["vga", "Đổi VGA"], ["ram", "Thêm RAM"], ["ssd", "Thêm ổ lưu trữ"], ["cpu", "Đổi CPU"], ["psu", "Đổi nguồn"]];
    const opts = upgradeOptions(goal), base = S.upgrade.cfg, total = sellable(goal).length;
    return `<div class="wrap page"><a href="#/upgrade" class="small">← Sửa cấu hình hiện tại</a><h1>Bạn muốn nâng cấp gì?</h1><p class="muted small">Máy hiện tại: ${esc(partsList(base))}. ${tag("SC12", "UC06")}</p>
    <div class="chips" style="margin-top:10px">${goals.map(([k, l]) => `<button type="button" class="chip" data-g="${k}" aria-pressed="${goal === k}">${l}</button>`).join("")}</div>
    <p class="small" style="margin-top:12px"><b>${opts.length} phương án lắp được</b> vào máy của bạn (lọc từ ${total} sản phẩm; kiểm tra cả công suất nguồn và kích thước case).</p>
    <div class="grid2" style="margin-top:8px">${opts.map((o, i) => { const main = o.label, price = main.price * (o.qty || 1) + o.adds.reduce((t, p) => t + p.price, 0); return `<div class="card"><b>${esc(main.n)}${o.qty > 1 ? " ×" + o.qty : ""}</b><span class="small muted">${esc(main.why)}</span>${o.adds.length ? `<div class="notice warn small"><b>Cần mua kèm:</b> ${o.adds.map((p) => esc(p.n) + " (" + fmt(p.price) + ")").join(", ")} – hiệu ứng dây chuyền: máy hiện tại không đáp ứng.</div>` : ""}${o.warn.map((w) => `<span class="pill warn">Lưu ý: ${esc(w.m)}</span>`).join("")}
      <span class="price big">${fmt(price)}</span><div class="row"><select data-asm="${i}" aria-label="Lắp đặt" style="width:auto"><option value="none">Tự lắp</option><option value="shop">Lắp tại cửa hàng (${fmt(FEES.asmOwn)})</option><option value="home">Lắp tận nhà (${fmt(FEES.asmOwn + FEES.homeIn)})</option></select><button class="btn sm" type="button" data-add="${i}">Thêm vào giỏ</button></div></div>`; }).join("") || `<div class="empty">Không có linh kiện nào lắp được cho mục tiêu này với máy hiện tại.${goal === "cpu" ? " CPU đời mới khác socket, cần đổi cả mainboard (và có thể cả RAM): dùng <a href=\"#/builder\">Build PC</a> và khai báo linh kiện Đã có." : ""}</div>`}</div></div>`;
  }, () => {
    if (!S.upgrade.cfg) return;
    $$("[data-g]").forEach((b) => (b.onclick = () => { S.upgrade.goal = b.dataset.g; rerender(); }));
    const opts = upgradeOptions(S.upgrade.goal);
    $$("[data-add]").forEach((b) => (b.onclick = () => { const o = opts[+b.dataset.add]; const asm = $(`[data-asm="${b.dataset.add}"]`).value; S.cart.push({ type: "pc", title: "Nâng cấp: " + o.label.n + (o.adds.length ? " + mua kèm" : ""), src: "upgrade", cfg: E.clone(o.cfg), asm }); go("#/cart"); }));
  });

  // ================= SC13 – Trang PC dựng sẵn (combo) =================
  S.comboSel = S.comboSel || {};
  add("SC13", "combo", "Trang PC dựng sẵn (combo)", "UC07", "store", (key) => {
    const cb = COMBOS.find((x) => x.key === key) || COMBOS[1], base = E.cfgFromCombo(cb.key), sel = S.comboSel[cb.key] || (S.comboSel[cb.key] = { extras: [], asm: true });
    const cfg = E.clone(base); cfg.extras = sel.extras.map((id) => ({ id, qty: 1 }));
    const opts = COMBO_OPTS[cb.key].map((id) => { const t = E.clone(cfg); if (!sel.extras.includes(id)) t.extras.push({ id, qty: 1 }); return { p: byId(id), ok: E.worst(E.evalRules(t)) !== "bad", why: E.evalRules(t).filter((r) => r.lv === "bad").map((r) => r.m)[0] }; });
    const shown = opts.filter((o) => o.ok), price = E.cfgPrice(cfg) + (sel.asm ? FEES.asm : 0);
    return `<div class="wrap page"><a href="#/home" class="small">← Trang chủ</a><div class="side" style="margin-top:10px"><div class="stack"><div class="panel"><span class="lbl">Combo · tỷ trọng kế hoạch ${cb.share}%</span><h1>${cb.name}</h1><p class="muted">${cb.use}</p>
      <div class="tbl" style="margin-top:10px"><table><thead><tr><th>Thành phần</th><th>Linh kiện & lý do chọn</th><th class="num">Giá</th></tr></thead><tbody>${ORDER.map((s) => { const p = byId(base[s].id), q = base[s].qty; return `<tr><td><b>${CAT[s]}</b></td><td>${esc(p.n)}${q > 1 ? " ×" + q : ""}<div class="xs muted">${esc(p.why)}</div></td><td class="num">${fmt(p.price * q)}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="mono xs" style="margin-top:8px">FPS ước tính 1080p: ${Object.keys(FPS).slice(0, 5).map((g) => `${g} ~${FPS[g][byId(base.vga.id).tier - 1]}`).join(" · ")}</p></div>
      <div class="panel"><h3>Linh kiện tùy chọn tương thích</h3><p class="small muted">Chỉ hiện linh kiện còn chỗ và còn đủ điện trong combo (khe RAM, M.2, PCIe x1, vị trí quạt, công suất nguồn). Đang hiện ${shown.length}/${opts.length}. ${tag("SC13", "UC07")}</p>
      <div class="stack" style="gap:6px;margin-top:8px">${opts.map((o) => o.ok || sel.extras.includes(o.p.id) ? `<label class="opt" style="cursor:pointer"><input type="checkbox" data-x="${o.p.id}" ${sel.extras.includes(o.p.id) ? "checked" : ""}><span style="flex:1;text-align:left"><b>${esc(o.p.n)}</b><br><span class="xs muted">${esc(o.p.why)}</span></span><span class="price">${fmt(o.p.price)}</span></label>` : "").join("")}</div>
      ${opts.filter((o) => !o.ok && !sel.extras.includes(o.p.id)).length ? `<details style="margin-top:8px"><summary class="small">Vì sao một số linh kiện bị ẩn</summary><ul class="small">${opts.filter((o) => !o.ok && !sel.extras.includes(o.p.id)).map((o) => `<li>${esc(o.p.n)}: ${esc(o.why)}</li>`).join("")}</ul></details>` : ""}</div></div>
    <div class="panel stack"><span class="lbl">Giá combo</span><span class="price big">${fmt(price)}</span><span class="xs muted">Linh kiện ${fmt(E.cfgPrice(cfg))}${sel.asm ? " + lắp ráp " + fmt(FEES.asm) : ""}. Giao nội thành Hà Nội miễn phí.</span>
      ${cb.comp ? `<div class="notice small">So với ${esc(cb.comp.src)}: ${fmt(cb.comp.price)} (đã gồm lắp ráp). BuildX + lắp ráp ${fmt(E.cfgPrice(base) + FEES.asm)} ${E.cfgPrice(base) + FEES.asm < cb.comp.price ? "rẻ hơn" : "đắt hơn"} ${Math.abs(Math.round((1 - (E.cfgPrice(base) + FEES.asm) / cb.comp.price) * 1000) / 10).toLocaleString("vi-VN")}%.</div>` : ""}
      <label class="row small"><input type="checkbox" id="asm" ${sel.asm ? "checked" : ""}> Lắp ráp + burn-in 2–4 giờ (${fmt(FEES.asm)}, không bắt buộc)</label>
      ${checkHtml(E.evalRules(cfg).filter((r) => r.lv !== "ok"))}
      <button class="btn" type="button" id="add">Thêm vào giỏ</button><button class="btn ghost" type="button" id="tune">Tùy chỉnh linh kiện chính</button></div></div></div>`;
  }, (key) => {
    const cb = COMBOS.find((x) => x.key === key) || COMBOS[1], sel = S.comboSel[cb.key];
    $$("[data-x]").forEach((x) => (x.onchange = () => { const id = x.dataset.x; sel.extras = x.checked ? [...sel.extras, id] : sel.extras.filter((y) => y !== id); rerender(); }));
    $("#asm").onchange = (e) => { sel.asm = e.target.checked; rerender(); };
    $("#add").onclick = () => { const cfg = E.cfgFromCombo(cb.key); cfg.extras = sel.extras.map((id) => ({ id, qty: 1 })); S.cart.push({ type: "pc", title: cb.name + (sel.extras.length ? " + tùy chọn" : ""), src: "combo", cfg, asm: sel.asm ? "shop" : "none" }); go("#/cart"); };
    $("#tune").onclick = () => { S.build = E.cfgFromCombo(cb.key); S.buildSrc = cb.name; S.buildStep = 0; go("#/builder"); };
  });

  // ================= SC14 – Giỏ hàng =================
  const cartLines = () => S.cart;
  const cartSub = () => S.cart.reduce((t, l) => t + E.linePrice(l), 0);
  // Đơn đã đặt hiện ngay trong giỏ hàng để khách theo dõi trạng thái (tự cập nhật khi nhân viên xử lý)
  function placedOrders() {
    if (!S.user) return "";
    const list = myOrders();
    if (!list.length) return "";
    const flowOf = (o) => ["Mới", "Đã xác nhận", ...(o.short.length || o.preorder.length ? ["Chờ hàng"] : []), ...(o.asm ? ["Lắp ráp & QC"] : []), "Đóng gói", "Đang giao / Chờ nhận", "Hoàn tất"];
    const active = list.filter((o) => !["Hoàn tất", "Đã hủy"].includes(o.status)), done = list.filter((o) => ["Hoàn tất", "Đã hủy"].includes(o.status));
    const card = (o) => { const f = flowOf(o), i = f.indexOf(o.status), pct = o.status === "Đã hủy" ? 0 : Math.round(((i + 1) / f.length) * 100);
      return `<div class="panel stack" style="gap:6px"><div class="row between"><a class="mono" href="#/order-me/${o.id}"><b>${o.id}</b></a>${stPill(o.status)}</div>
        <div class="small">${o.lines.map((l) => `<div><b>${esc(l.title || (byId(l.id) ? byId(l.id).n : l.id))}</b>${l.qty > 1 ? " ×" + l.qty : ""}${l.cfg ? `<div class="xs muted">${esc(partsList(l.cfg))}</div>` : ""}</div>`).join("")}</div>
        ${o.status === "Đã hủy" ? "" : `<div style="background:var(--line);height:6px;border-radius:3px;overflow:hidden"><div style="background:var(--accent);width:${pct}%;height:100%"></div></div><span class="xs muted">Bước ${i + 1}/${f.length}: ${esc(o.status)}${f[i + 1] ? " · tiếp theo: " + esc(f[i + 1]) : ""}</span>`}
        <div class="row between small"><span>${E.dstr(o.date)} · ${esc(o.pay.method)} – ${esc(o.pay.status)}</span><b>${fmt(o.total)}</b></div>
        ${o.status === "Mới" && o.pay.status === "Chưa thanh toán" && !["COD", "Công nợ B2B"].includes(o.pay.method) ? `<a class="btn sm" href="#/order-me/${o.id}">Thanh toán ${fmt(o.pay.due)}</a>` : ""}</div>`; };
    return `<h2 style="margin-top:22px">Đơn đã đặt (${active.length} đang xử lý)</h2><p class="muted small">Trạng thái tự cập nhật khi cửa hàng xử lý đơn. Bấm mã đơn để xem chi tiết, báo cáo burn-in và hủy đơn.</p>
      <div class="grid2" style="margin-top:8px">${active.map(card).join("") || '<div class="empty">Không có đơn đang xử lý.</div>'}</div>
      ${done.length ? `<details style="margin-top:10px"><summary class="small">Đơn đã hoàn tất / đã hủy (${done.length})</summary><div class="grid2" style="margin-top:8px">${done.slice(0, 10).map(card).join("")}</div></details>` : ""}`;
  }
  add("SC14", "cart", "Giỏ hàng", "UC08", "store", () => {
    if (!S.cart.length) return `<div class="wrap page"><h1>Giỏ hàng</h1><div class="empty">Giỏ hàng trống. <a href="#/need">Tư vấn cấu hình</a> · <a href="#/catalog">Xem linh kiện</a></div>${placedOrders()}${!S.user ? '<p class="small muted" style="margin-top:12px"><a href="#/login">Đăng nhập</a> để xem các đơn đã đặt.</p>' : ""}</div>`;
    const hasPC = S.cart.some((l) => l.type === "pc"), hasCare = S.cart.some((l) => l.code === "care"), sub = cartSub();
    const cp = S.coupon ? E.couponCheck(S.coupon, S.cart) : null;
    const pre = E.preorderItems(S.cart);
    const uTier = S.user ? CUST_TIERS[S.user.tier] : null;
    const tierDisc = uTier && uTier.discRate ? Math.round(sub * uTier.discRate / 1000) * 1000 : 0;
    const cpAmt = cp && cp.ok ? cp.amt : 0;
    const finalTotal = Math.max(0, sub - cpAmt - tierDisc);
    return `<div class="wrap page"><h1>Giỏ hàng</h1><p class="muted small">Thêm vào giỏ chưa giữ hàng; giá và tồn kho được kiểm tra lại khi đặt hàng. ${tag("SC14", "UC08")}</p>
    ${uTier && uTier.discRate ? `<div class="notice ok small" style="margin-top:10px"><b>Đặc quyền ${esc(uTier.name)}:</b> Tự động giảm ${uTier.discRate * 100}% (${fmt(tierDisc)}) cho toàn đơn hàng. ${uTier.priorityAsm ? "Ưu tiên xưởng lắp ráp." : ""}</div>` : !S.user ? `<div class="notice small" style="margin-top:10px">Bạn chưa đăng nhập. <a href="#/login">Đăng nhập hoặc đăng ký</a> để đặt hàng, theo dõi đơn và tích điểm (VIP giảm 2%, B2B giảm 5%).</div>` : ""}
    <div class="side" style="margin-top:12px"><div class="stack">${S.cart.map((l, i) => l.type === "pc" ? `<div class="panel"><div class="row between"><b>${esc(l.title)}</b><span class="price">${fmt(E.cfgPrice(l.cfg))}</span></div><p class="small muted" style="margin:4px 0">${esc(partsList(l.cfg))}</p>
        <div class="row between"><select data-asm="${i}" style="width:auto" aria-label="Lắp ráp"><option value="none" ${l.asm === "none" ? "selected" : ""}>Không lắp ráp</option>${E.canAssemble(l.cfg) || l.src === "upgrade" ? `<option value="shop" ${l.asm === "shop" ? "selected" : ""}>Lắp ráp${l.src === "upgrade" ? " tại cửa hàng" : " + burn-in"}: ${fmt(E.hasOwn(l.cfg) ? FEES.asmOwn : FEES.asm)}</option>` : ""}${l.src === "upgrade" ? `<option value="home" ${l.asm === "home" ? "selected" : ""}>Lắp tận nhà: ${fmt(FEES.asmOwn + FEES.homeIn)}</option>` : ""}</select><span class="row"><span class="price small">${E.asmFee(l) ? "+ " + fmt(E.asmFee(l)) : ""}</span><button class="btn sm plain" type="button" data-rm="${i}">Xóa</button></span></div></div>`
      : l.type === "part" ? `<div class="panel row between"><span><b>${esc(byId(l.id).n)}</b><br>${availPill(byId(l.id))}</span><span class="row"><input type="number" min="1" value="${l.qty}" data-q="${i}" style="width:70px" aria-label="Số lượng"><span class="price">${fmt(E.linePrice(l))}</span><button class="btn sm plain" type="button" data-rm="${i}">Xóa</button></span></div>`
      : `<div class="panel row between"><span><b>${esc(l.title)}</b></span><span class="row"><span class="price">${fmt(l.price)}</span><button class="btn sm plain" type="button" data-rm="${i}">Xóa</button></span></div>`).join("")}
      ${hasPC && !hasCare ? `<div class="panel row between"><span><b>Gói BuildX Care 12 tháng</b><br><span class="small muted">2 lần vệ sinh (mua lẻ 500.000đ), kiểm tra nhiệt độ, hỗ trợ từ xa ưu tiên</span></span><button class="btn sm ghost" type="button" id="care">Thêm ${fmt(FEES.care)}</button></div>` : ""}
      ${pre.length ? `<div class="notice warn small"><b>Hàng cần đặt trước:</b> ${pre.map((x) => esc(byId(x.id).n) + " (thiếu " + x.short + ")").join(", ")}. Sẽ báo thời gian nhập ở bước đặt hàng.</div>` : ""}</div>
    <div class="panel stack"><span class="lbl">Tạm tính thanh toán</span><span class="price big">${fmt(finalTotal)}</span>
      ${tierDisc ? `<div class="row between small" style="color:var(--ok)"><span>Chiết khấu ${esc(uTier.badge)}</span><span>−${fmt(tierDisc)}</span></div>` : ""}
      <div class="row" style="flex-wrap:nowrap"><input id="vc" type="text" placeholder="Mã giảm giá" value="${esc(S.coupon || "")}" aria-label="Mã giảm giá"><button class="btn sm plain" type="button" id="av">Áp dụng</button></div>
      ${cp ? `<span class="small ${cp.ok ? "" : "muted"}">${cp.ok ? "✓ " : "✗ "}${esc(cp.m)}</span>` : '<span class="xs muted">Thử mã thêm: MOBAN, HSSV, TUAN200</span>'}
      ${S.user ? '<a class="btn" href="#/checkout">Tiến hành đặt hàng</a>' : '<a class="btn" href="#/login">Đăng nhập để đặt hàng</a><span class="xs muted">Giỏ hàng được giữ lại sau khi đăng nhập.</span>'}</div></div>${placedOrders()}</div>`;
  }, () => {
    $$("[data-rm]").forEach((b) => (b.onclick = () => { S.cart.splice(+b.dataset.rm, 1); rerender(); }));
    $$("[data-asm]").forEach((s) => (s.onchange = () => { S.cart[+s.dataset.asm].asm = s.value; rerender(); }));
    $$("[data-q]").forEach((s) => (s.onchange = () => { S.cart[+s.dataset.q].qty = Math.max(1, +s.value || 1); rerender(); }));
    const c = $("#care"); if (c) c.onclick = () => { S.cart.push({ type: "svc", code: "care", title: "Gói BuildX Care 12 tháng", price: FEES.care }); rerender(); };
    const av = $("#av"); if (av) av.onclick = () => { S.coupon = $("#vc").value.trim().toUpperCase() || null; rerender(); };
  });

  // ================= SC15 – Thông tin nhận hàng =================
  add("SC15", "checkout", "Thông tin nhận hàng", "UC09", "store", () => {
    if (!S.cart.length) return `<div class="wrap page"><div class="empty">Giỏ hàng trống.</div></div>`;
    if (!S.user) return `<div class="wrap page" style="max-width:520px"><div class="panel"><h1>Đăng nhập để đặt hàng</h1><p class="muted">Đơn hàng gắn với tài khoản để bạn theo dõi trạng thái, nhận bảo hành và tích điểm. Giỏ hàng (${S.cart.length} dòng) được giữ lại. ${tag("SC15", "UC09")}</p><div class="row"><a class="btn" href="#/login">Đăng nhập / Đăng ký</a><a class="btn plain" href="#/cart">← Giỏ hàng</a></div></div></div>`;
    if (S.checkout && S.checkout.owner !== S.user.phone) S.checkout = null;
    const ck = S.checkout || (S.checkout = { owner: S.user.phone, mode: "in", name: S.user ? S.user.name : "", phone: S.user ? S.user.phone : S.me.phone || "", addr: S.user && S.user.addrs.length ? S.user.addrs.find((a) => a.def).text : "", agree: false, vat: !!(S.user && S.user.tier === "b2b") });
    const pre = E.preorderItems(S.cart), dep = pre.some((x) => x.grp === "C");
    const uTier = S.user ? CUST_TIERS[S.user.tier] : null;
    return `<div class="wrap page" style="max-width:900px"><h1>Thông tin nhận hàng</h1><p class="muted small">Hệ thống kiểm tra lại tồn kho khi đặt. ${tag("SC15", "UC09")}</p>
    ${uTier && uTier.priorityAsm ? `<div class="notice ok small" style="margin-top:10px">⚡ <b>Đặc quyền ${esc(uTier.name)}:</b> Đơn hàng này được gắn cờ Ưu tiên xưởng lắp ráp & QC hỏa tốc.</div>` : ""}
    <div class="panel" style="margin-top:12px"><form id="fc"><div class="grid2"><div class="field"><label for="cn">Họ tên / Đại diện</label><input id="cn" type="text" value="${esc(ck.name)}" required></div><div class="field"><label for="cp">SĐT người nhận</label><input id="cp" type="tel" value="${esc(ck.phone)}" required></div></div>
      <fieldset class="stack" style="gap:6px;border:0;padding:0;margin:0 0 12px"><legend class="lbl">Cách nhận</legend>
        <label class="row small"><input type="radio" name="m" value="in" ${ck.mode === "in" ? "checked" : ""}> Giao nội thành Hà Nội – miễn phí</label>
        <label class="row small"><input type="radio" name="m" value="out" ${ck.mode === "out" ? "checked" : ""}> Giao liên tỉnh – phí theo biểu phí hãng vận chuyển, báo khi xác nhận; PC đóng kiện gỗ</label>
        <label class="row small"><input type="radio" name="m" value="pickup" ${ck.mode === "pickup" ? "checked" : ""}> Nhận tại cửa hàng</label></fieldset>
      ${ck.mode === "pickup" ? "" : `<div class="field"><label for="ca">Địa chỉ</label>${S.user && S.user.addrs.length ? `<select id="cas" style="margin-bottom:6px">${S.user.addrs.map((a) => `<option ${a.text === ck.addr ? "selected" : ""}>${esc(a.text)}</option>`).join("")}<option value="">Địa chỉ khác…</option></select>` : ""}<input id="ca" type="text" value="${esc(ck.addr)}" required></div>`}
      
      <div class="panel stack" style="margin:12px 0;background:var(--card)">
        <label class="row small"><b><input type="checkbox" id="cvat" ${ck.vat ? "checked" : ""}> Yêu cầu xuất hóa đơn điện tử GTGT (VAT)</b></label>
        <div id="vat-box" style="${ck.vat ? "" : "display:none"}" class="grid2">
          <div class="field"><label>Tên công ty</label><input type="text" id="v-name" maxlength="150" value="${esc(S.user && S.user.company ? S.user.company.name : "")}"></div>
          <div class="field"><label>Mã số thuế</label><input type="text" id="v-tax" inputmode="numeric" maxlength="14" value="${esc(S.user && S.user.company ? S.user.company.taxId : "")}"></div>
          <div class="field" style="grid-column:1/-1"><label>Địa chỉ công ty</label><input type="text" id="v-addr" maxlength="250" value="${esc(S.user && S.user.company ? S.user.company.addr : "")}"></div>
        </div>
      </div>

      ${pre.length ? `<div class="notice warn"><b>Thiếu hàng – cần đặt trước</b><ul class="small" style="margin:6px 0">${pre.map((x) => `<li>${esc(byId(x.id).n)}: thiếu ${x.short}, dự kiến nhập ${x.grp === "C" ? "2–3" : "1–2"} ngày${x.grp === "C" ? " (nhóm C – nhập theo đơn)" : ""}</li>`).join("")}</ul>${dep && (!S.user || S.user.tier !== "b2b") ? `<p class="small">Đơn có hàng nhóm C: cần đặt cọc 30% online trước khi BuildX nhập hàng; không áp dụng COD.</p>` : ""}<label class="row small"><input type="checkbox" id="ag" ${ck.agree ? "checked" : ""}> Tôi đồng ý đặt trước và chờ thời gian nhập hàng</label></div>` : '<div class="notice ok small">Tất cả hàng đều có sẵn.</div>'}
      <div class="row" style="margin-top:12px"><a class="btn plain" href="#/cart">← Giỏ hàng</a><button class="btn" type="submit">Tiếp tục thanh toán</button></div></form></div></div>`;
  }, () => {
    if (!S.cart.length || !S.user || !S.checkout) return;
    const ck = S.checkout;
    $$("[name=m]").forEach((r) => (r.onchange = () => { ck.name = $("#cn").value; ck.phone = $("#cp").value; ck.mode = r.value; rerender(); }));
    const cas = $("#cas"); if (cas) cas.onchange = () => { $("#ca").value = cas.value; };
    const cvat = $("#cvat"); if (cvat) cvat.onchange = () => { ck.vat = cvat.checked; $("#vat-box").style.display = cvat.checked ? "grid" : "none"; };
    $("#fc").onsubmit = (e) => {
      e.preventDefault();
      ck.name = $("#cn").value;
      ck.phone = $("#cp").value;
      ck.addr = ck.mode === "pickup" ? "Nhận tại cửa hàng" : $("#ca").value;
      const ag = $("#ag");
      ck.agree = ag ? ag.checked : true;
      if (E.preorderItems(S.cart).length && !ck.agree) return toast("Cần đồng ý đặt trước để tiếp tục");
      if (ck.vat) {
        ck.vatInvoice = { name: $("#v-name").value.trim(), taxId: $("#v-tax").value.trim(), addr: $("#v-addr").value.trim() };
        if (!ck.vatInvoice.name || !ck.vatInvoice.addr) return toast("Nhập tên và địa chỉ công ty để xuất hóa đơn VAT");
        if (!/^\d{10}(-\d{3})?$/.test(ck.vatInvoice.taxId)) return toast("Mã số thuế gồm 10 chữ số (chi nhánh thêm -xxx)");
      } else ck.vatInvoice = null;
      if (!/^0\d{9}$/.test(ck.phone.replace(/[\s.-]/g, ""))) return toast("Số điện thoại người nhận cần 10 chữ số, bắt đầu bằng 0");
      S.guestPhone = ck.phone;
      ck.stage = "choose";
      go("#/pay");
    };
  });

  // ================= SC16 – Thanh toán =================
  add("SC16", "pay", "Thanh toán", "UC09", "store", () => {
    const ck = S.checkout;
    if (ck && ck.order && !E.findOrder(ck.order)) ck.order = null;
    if (!ck || (!S.cart.length && !ck.order)) return `<div class="wrap page"><div class="empty">Chưa có đơn để thanh toán. <a href="#/cart">Giỏ hàng</a></div></div>`;
    if (!S.user && !ck.order) return `<div class="wrap page"><div class="empty">Vui lòng <a href="#/login">đăng nhập</a> để đặt hàng.</div></div>`;
    if (ck.stage === "otp") { const o = E.findOrder(ck.order); return `<div class="wrap page" style="max-width:520px"><div class="panel"><h1>Xác minh đơn hàng</h1><p class="small">Đơn ${o.id} có điểm rủi ro ${o.risk.score}/100 (${esc(o.risk.reasons.join("; "))}). Nhập OTP gửi tới ${esc(o.cust.phone)}. ${tag("SC16", "UC09")}</p>${ck.devOtp ? `<div class="notice small">Chưa nối nhà cung cấp SMS – mã thử nghiệm: <b class="mono">${ck.devOtp}</b></div>` : ""}<div class="otp" style="margin-top:10px">${[1, 2, 3, 4, 5, 6].map((i) => `<input inputmode="numeric" maxlength="1" aria-label="Số ${i}">`).join("")}</div><div class="row" style="margin-top:12px"><button class="btn" type="button" id="vo">Xác minh</button><button class="btn plain" type="button" id="rs">Gửi lại mã</button></div></div></div>`; }
    if (ck.stage === "gateway") { const o = E.findOrder(ck.order); return `<div class="wrap page" style="max-width:560px"><div class="panel stack"><span class="lbl">Cổng ${esc(o.pay.method)} · môi trường thử (sandbox)</span><h1>${o.pay.due < o.total ? "Đặt cọc 30%" : "Thanh toán"} ${fmt(o.pay.due)}</h1><p class="small muted">Đơn ${o.id} · tổng ${fmt(o.total)}. Đơn chỉ được đánh dấu đã thanh toán khi máy chủ BuildX xác thực thông báo (IPN) hợp lệ từ cổng, không dựa vào trang trả về của trình duyệt.</p><div class="row"><button class="btn" type="button" id="ok">Mô phỏng: thanh toán thành công</button><button class="btn plain" type="button" id="ko">Mô phỏng: khách hủy</button></div><p class="xs muted">${tag("SC16", "UC09")}</p></div></div>`; }
    const pre = E.preorderItems(S.cart), dep = pre.some((x) => x.grp === "C");
    const cp = S.coupon ? E.couponCheck(S.coupon, S.cart) : null;
    const uTier = S.user ? CUST_TIERS[S.user.tier] : null;
    const tierDisc = uTier && uTier.discRate ? Math.round(cartSub() * uTier.discRate / 1000) * 1000 : 0;
    const cpAmt = cp && cp.ok ? cp.amt : 0;
    const total = Math.max(0, cartSub() - cpAmt - tierDisc);
    const isB2B = S.user && S.user.tier === "b2b";
    const methods = [
      ["COD", "Thanh toán khi nhận hàng (COD)"],
      ["MoMo", "Ví MoMo"],
      ["VNPAY", "VNPAY QR / ngân hàng"],
      ["Thẻ", "Thẻ Visa/Mastercard/JCB"],
      ...(isB2B ? [["Công nợ B2B", "Công nợ Doanh nghiệp (Đối soát & thanh toán theo hợp đồng 15–30 ngày)"]] : [])
    ];
    const m = ck.method || (isB2B ? "Công nợ B2B" : dep ? "VNPAY" : "COD");
    return `<div class="wrap page" style="max-width:900px"><h1>Thanh toán</h1><p class="muted small">${tag("SC16", "UC09")}</p>
    <div class="side" style="margin-top:12px"><div class="panel"><fieldset class="stack" style="gap:8px;border:0;padding:0;margin:0"><legend class="lbl">Phương thức</legend>${methods.map(([k, l]) => `<label class="row small"><input type="radio" name="pm" value="${k}" ${m === k ? "checked" : ""} ${dep && k === "COD" && !isB2B ? "disabled" : ""}> ${l}${dep && k === "COD" && !isB2B ? " – không áp dụng cho đơn đặt cọc" : ""}</label>`).join("")}</fieldset>
      <p class="xs muted" style="margin-top:10px">Đơn rủi ro (giá trị cao, COD lần đầu, địa chỉ trùng, nhiều đơn trong thời gian ngắn) cần xác minh OTP hoặc nhân viên gọi xác nhận.</p></div>
    <div class="panel stack"><span class="lbl">Tổng thanh toán</span><span class="price big">${fmt(total)}</span>
      ${tierDisc ? `<span class="small" style="color:var(--ok)">✓ Đặc quyền ${esc(uTier.name)}: −${fmt(tierDisc)}</span>` : ""}
      ${cp && cp.ok ? `<span class="small">Đã giảm mã ${fmt(cp.amt)} (${esc(cp.cp.code)})</span>` : ""}
      ${dep && m !== "Công nợ B2B" ? `<div class="notice small">Đặt cọc 30% ngay: <b>${fmt(Math.round((total * FEES.depositRate) / 1000) * 1000)}</b>; phần còn lại thanh toán khi nhận.</div>` : ""}
      <span class="small">Nhận: ${ck.mode === "in" ? "giao nội thành, miễn phí" : ck.mode === "out" ? "giao liên tỉnh, phí báo khi xác nhận" : "tại cửa hàng"}</span>
      <button class="btn" type="button" id="po">Đặt hàng</button><a class="small" href="#/checkout">← Sửa thông tin nhận hàng</a></div></div></div>`;
  }, () => {
    const ck = S.checkout; if (!ck) return;
    $$("[name=pm]").forEach((r) => (r.onchange = () => { ck.method = r.value; }));
    const po = $("#po"); if (po) po.onclick = async () => {
      const m = ($("input[name=pm]:checked") || {}).value;
      if (!m) return toast("Chọn phương thức thanh toán");
      po.disabled = true;
      try {
        const r = await API.act("order.create", { cust: { name: ck.name, phone: ck.phone, addr: ck.addr }, lines: S.cart, ship: { mode: ck.mode }, coupon: S.coupon, payMethod: m, agreePreorder: !!ck.agree, vatInvoice: ck.vatInvoice || null });
        S.cart = []; S.coupon = null; ck.order = r.id; ck.devOtp = r.devOtp; ck.method = null; S.lastOrder = r.id;
        if (m === "COD" || m === "Công nợ B2B") { S.checkout = null; return go("#/done"); }
        ck.stage = r.needOtp ? "otp" : "gateway"; rerender();
      } catch (e) { po.disabled = false; toast(e.message); }
    };
    const vo = $("#vo"); if (vo) { const ins = $$(".otp input"); ins.forEach((i, k) => (i.oninput = () => { i.value = i.value.replace(/\D/g, "").slice(-1); if (i.value && ins[k + 1]) ins[k + 1].focus(); })); vo.onclick = () => quiet(run("order.otp", { id: ck.order, code: ins.map((i) => i.value).join("") }, "Đã xác minh").then(() => { ck.stage = "gateway"; ck.devOtp = null; rerender(); })); }
    const rs = $("#rs"); if (rs) rs.onclick = () => quiet(run("order.otpResend", { id: ck.order }, "Đã gửi lại mã").then((r) => { ck.devOtp = r.devOtp; rerender(); }));
    const ok = $("#ok"); if (ok) ok.onclick = () => quiet(run("order.pay", { id: ck.order, result: "ok" }, "Cổng báo thanh toán thành công").then(() => go("#/done")));
    const ko = $("#ko"); if (ko) ko.onclick = () => quiet(run("order.pay", { id: ck.order, result: "cancel" }).then(() => go("#/done")));
  });

  // ================= SC17 – Kết quả đặt hàng =================
  add("SC17", "done", "Kết quả đặt hàng", "UC09", "store", () => {
    const o = E.findOrder(S.lastOrder);
    if (!o) return `<div class="wrap page"><div class="empty">Chưa có đơn nào vừa đặt.</div></div>`;
    const next = o.pay.status === "Chưa thanh toán" ? "Đơn chưa được thanh toán. Bạn có thể thanh toán lại hoặc chọn COD khi nhân viên liên hệ." : o.pay.method === "COD" ? (o.risk.needVerify ? "Đơn cần xác minh: nhân viên sẽ gọi trong 30 phút trước khi xác nhận." : "Nhân viên sẽ xác nhận đơn và giữ hàng. Thanh toán khi nhận.") : o.pay.status === "Đã cọc" ? "Đã nhận tiền cọc. BuildX đặt hàng nhóm C với nhà phân phối và báo ngày về." : "Đã nhận thanh toán. Nhân viên xác nhận và giữ hàng cho bạn.";
    return `<div class="wrap page" style="max-width:640px"><div class="panel stack"><span class="pill ok" style="justify-self:start">Đặt hàng thành công</span><h1>Đơn ${o.id}</h1><dl class="spec"><dt>Trạng thái đơn</dt><dd>${o.status}</dd><dt>Thanh toán</dt><dd>${o.pay.method} · ${o.pay.status}${o.pay.paid ? " · đã nhận " + fmt(o.pay.paid) : ""}</dd><dt>Tổng</dt><dd>${fmt(o.total)}</dd>${o.preorder.length ? `<dt>Đặt trước</dt><dd>${o.preorder.map((x) => x.id).join(", ")}</dd>` : ""}</dl><div class="notice">${next}</div><div class="row"><a class="btn" href="#/order-me/${o.id}">Theo dõi đơn</a><a class="btn plain" href="#/orders-me">Đơn của tôi</a></div><p class="xs muted">${tag("SC17", "UC09")}</p></div></div>`;
  });

  // ================= SC18 – Đơn của tôi =================
  add("SC18", "orders-me", "Đơn của tôi", "UC10", "store", () => {
    const list = myOrders();
    return `<div class="wrap page"><h1>Đơn của tôi</h1><p class="muted small">${custPhone() ? "Theo số " + esc(custPhone()) : "Đăng nhập hoặc đặt hàng để xem đơn"}. ${tag("SC18", "UC10")}</p>
    ${!custPhone() ? `<div class="row" style="margin-top:10px"><a class="btn" href="#/login">Đăng nhập</a></div>` : `<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Mã đơn</th><th>Ngày</th><th>Sản phẩm</th><th>Trạng thái</th><th>Thanh toán</th><th class="num">Tổng</th><th></th></tr></thead><tbody>${list.map((o) => `<tr><td class="mono">${o.id}</td><td>${E.dstr(o.date)}</td><td>${esc(o.lines.map((l) => l.title || byId(l.id).n).join(", "))}</td><td>${stPill(o.status)}</td><td>${payPill(o.pay)}</td><td class="num">${fmt(o.total)}</td><td><a class="btn sm plain" href="#/order-me/${o.id}">Chi tiết</a></td></tr>`).join("") || '<tr><td colspan="7" class="muted">Chưa có đơn.</td></tr>'}</tbody></table></div>`}</div>`;
  });

  // ================= SC19 – Chi tiết đơn =================
  add("SC19", "order-me", "Chi tiết đơn", "UC10", "store", (id) => {
    const o = myOrders().find((x) => x.id === id) || myOrders()[0];
    if (!o) return `<div class="wrap page"><div class="empty">Không tìm thấy đơn trên máy này. <a href="#/login">Đăng nhập bằng SĐT đặt hàng</a> để xem mọi đơn của bạn.</div></div>`;
    const flow = ["Mới", "Đã xác nhận", ...(o.short.length || o.preorder.length ? ["Chờ hàng"] : []), ...(o.asm ? ["Lắp ráp & QC"] : []), "Đóng gói", "Đang giao / Chờ nhận", "Hoàn tất"];
    const idx = o.status === "Đã hủy" ? -1 : flow.indexOf(o.status);
    const canCancel = !["Đang giao / Chờ nhận", "Hoàn tất", "Đã hủy"].includes(o.status);
    return `<div class="wrap page"><a href="#/orders-me" class="small">← Đơn của tôi</a><div class="row between" style="margin-top:6px"><h1>Đơn ${o.id}</h1>${stPill(o.status)}</div><p class="muted small">${E.dstr(o.date)} · ${o.channel} · ${fmt(o.total)} · ${o.pay.method} – ${o.pay.status} ${tag("SC19", "UC10")}</p>
    <div class="side" style="margin-top:12px"><div class="stack"><div class="panel"><h3>Tiến trình</h3>${o.status === "Đã hủy" ? '<div class="notice warn">Đơn đã hủy; hàng đã giữ được giải phóng, tiền đã trả xử lý theo chính sách.</div>' : `<ol class="steps">${flow.map((s, i) => `<li class="${i < idx ? "done" : i === idx ? "now" : ""}"><span class="dot">${i < idx ? "✓" : i + 1}</span><span><b>${s}</b></span></li>`).join("")}</ol>`}</div>
      ${o.qc ? `<div class="panel"><h3>Báo cáo burn-in máy của bạn</h3><div class="grid4"><div class="kpi"><div class="lbl">CPU tối đa</div><div class="v">${o.qc.cpu}°C</div><div class="d">Ngưỡng &lt; 90°C</div></div><div class="kpi"><div class="lbl">GPU tối đa</div><div class="v">${o.qc.gpu}°C</div><div class="d">Ngưỡng &lt; 85°C</div></div><div class="kpi"><div class="lbl">Cinebench R23</div><div class="v">${o.qc.cb.toLocaleString("vi-VN")}</div></div><div class="kpi"><div class="lbl">MemTest86</div><div class="v">${o.qc.ram} lỗi</div></div></div><p class="xs muted" style="margin-top:8px">Burn-in ${o.qc.min} phút · ${o.qc.photos} ảnh đi dây · kỹ thuật viên ${esc(o.tech || "—")} · số liệu minh họa</p></div>` : `<div class="panel small muted">Báo cáo burn-in hiện sau bước Lắp ráp & QC${o.asm ? "" : " (đơn này không lắp ráp)"}.</div>`}</div>
    <div class="panel stack"><h3>Sản phẩm</h3>${o.lines.map((l) => `<div class="small"><b>${esc(l.title || byId(l.id).n)}</b>${l.cfg ? `<div class="xs muted">${esc(partsList(l.cfg))}</div>` : ""}</div>`).join("")}
      ${o.status === "Mới" && o.pay.method !== "COD" && o.pay.status === "Chưa thanh toán" ? `<button class="btn" type="button" id="rp">Thanh toán ${fmt(o.pay.due)}</button>` : ""}
      ${canCancel ? `<button class="btn danger" type="button" id="cx">Hủy đơn</button><span class="xs muted">Hủy được khi chưa xuất kho; hàng đã giữ sẽ được giải phóng.</span>` : ""}
      ${o.status === "Hoàn tất" ? `<button class="btn plain" type="button" disabled>Đánh giá (P2 – sau khai trương)</button><a class="btn sm ghost" href="#/warranty">Phiếu bảo hành</a>` : ""}</div></div></div>`;
  }, (id) => {
    const o = myOrders().find((x) => x.id === id) || myOrders()[0]; if (!o) return;
    const cx = $("#cx"); if (cx) cx.onclick = () => { if (!confirm("Hủy đơn " + o.id + "?")) return; quiet(run("order.cancelMine", { id: o.id }, "Đã hủy đơn")); };
    const rp = $("#rp"); if (rp) rp.onclick = () => { S.checkout = { order: o.id, stage: o.risk.needVerify && !o.risk.verified ? "otp" : "gateway" }; S.lastOrder = o.id; go("#/pay"); };
  });

  // ================= SC20 – Đặt lịch dịch vụ =================
  add("SC20", "service", "Đặt lịch dịch vụ", "UC11", "store", () => `<div class="wrap page" style="max-width:820px"><h1>Đặt lịch dịch vụ</h1><p class="muted small">Không cần mua máy tại BuildX. Ghi nhận hiện trạng máy trước khi làm. ${tag("SC20", "UC11")}</p>
    <form class="panel" id="fs" style="margin-top:12px"><fieldset class="stack" style="gap:6px;border:0;padding:0;margin:0 0 12px"><legend class="lbl">Dịch vụ</legend>
      <label class="row small"><input type="radio" name="sv" value="clean" checked> Vệ sinh, thay keo tản nhiệt – ${fmt(FEES.clean)} (miễn phí 2 lần với BuildX Care)</label>
      <label class="row small"><input type="radio" name="sv" value="own"> Lắp ráp có linh kiện khách mang tới / nâng cấp máy đang dùng – ${fmt(FEES.asmOwn)} (gồm kiểm tra linh kiện mang tới)</label>
      <label class="row small"><input type="radio" name="sv" value="asm"> Lắp ráp linh kiện mua tại BuildX – ${fmt(FEES.asm)}</label></fieldset>
      <fieldset class="stack" style="gap:6px;border:0;padding:0;margin:0 0 12px"><legend class="lbl">Địa điểm</legend>
      <label class="row small"><input type="radio" name="lc" value="shop" checked> Tại cửa hàng</label>
      <label class="row small"><input type="radio" name="lc" value="in"> Tận nhà nội thành (+${fmt(FEES.homeIn)})</label>
      <label class="row small"><input type="radio" name="lc" value="out"> Tận nhà ngoại thành (+${fmt(FEES.homeOut)})</label></fieldset>
      <div class="grid2"><div class="field"><label for="dd">Ngày</label><input id="dd" type="date" value="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}" min="${new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label for="sl">Khung giờ</label><select id="sl"><option>09:00–11:00</option><option>14:00–16:00</option><option>18:00–20:00</option></select></div>
      <div class="field"><label for="nm">Họ tên</label><input id="nm" type="text" value="${esc(S.user ? S.user.name : "")}" required></div><div class="field"><label for="ph">Điện thoại</label><input id="ph" type="tel" value="${esc(S.user ? S.user.phone : "")}" required></div></div>
      <div class="field"><label for="nt">Tình trạng máy</label><textarea id="nt">Máy nóng, quạt kêu to khi chơi game.</textarea></div>
      <label class="row small"><input type="checkbox" id="rm"> Nhắc bảo dưỡng định kỳ qua Zalo (chỉ gửi khi bạn đồng ý)</label>
      <div class="row" style="margin-top:12px"><span class="price" id="fee"></span><button class="btn" type="submit">Đặt lịch</button></div></form></div>`, () => {
    const fee = () => { const s = $("input[name=sv]:checked").value, l = $("input[name=lc]:checked").value; $("#fee").textContent = "Tạm tính " + fmt((s === "clean" ? FEES.clean : s === "own" ? FEES.asmOwn : FEES.asm) + (l === "in" ? FEES.homeIn : l === "out" ? FEES.homeOut : 0)); };
    $$("input[type=radio]").forEach((r) => (r.onchange = fee)); fee();
    $("#fs").onsubmit = async (e) => {
      e.preventDefault(); const btn = $("#fs button[type=submit]"); btn.disabled = true;
      try {
        const r = await API.act("service.book", { svc: $("input[name=sv]:checked").value, loc: $("input[name=lc]:checked").value, date: $("#dd").value, slot: $("#sl").value, name: $("#nm").value, phone: $("#ph").value, note: $("#nt").value, remind: $("#rm").checked });
        toast("Đã đặt lịch, mã theo dõi " + r.code);
        $("#fs").innerHTML = `<div class="notice ok">Đã nhận lịch hẹn. Mã theo dõi <b>${r.code}</b>. Nhân viên xác nhận qua điện thoại; lịch được điều phối để cửa hàng luôn có người trực.</div>`;
      } catch (err) { btn.disabled = false; toast(err.message); }
    };
  });

  // ================= SC21 – Bảo hành & gói Care =================
  add("SC21", "warranty", "Bảo hành & gói Care", "UC11", "store", () => {
    const ws = S.warranties.filter((w) => S.me.orderIds.includes(w.order));
    const reqs = S.requests.filter((r) => r.type === "Bảo hành");
    return `<div class="wrap page"><h1>Bảo hành & BuildX Care</h1><p class="muted small">BuildX là đầu mối: nhận máy, khoanh vùng lỗi và làm việc với nhà phân phối thay bạn. ${tag("SC21", "UC11")}</p>
    ${!custPhone() ? `<div class="notice" style="margin-top:12px">Đăng nhập để xem phiếu bảo hành điện tử theo serial. <a href="#/login">Đăng nhập</a> (demo: 0912 345 678)</div>` : ""}
    <div class="grid2" style="margin-top:12px"><div class="panel"><h2>Phiếu bảo hành điện tử</h2>${ws.length ? `<div class="tbl"><table><thead><tr><th>Serial</th><th>Linh kiện</th><th>Đơn</th><th>Hiệu lực</th></tr></thead><tbody>${ws.map((w) => `<tr><td class="mono xs">${w.sn}</td><td class="small">${esc(byId(w.id).n)}</td><td class="mono xs">${w.order}</td><td class="small">${E.dstr(w.from)} + ${w.months} tháng</td></tr>`).join("")}</tbody></table></div><p class="xs muted" style="margin-top:6px">Bảo hành công lắp ráp 12 tháng. Thời hạn linh kiện theo hãng (minh họa 36 tháng).</p>` : '<p class="small muted">Chưa có máy nào đã giao.</p>'}</div>
    <div class="panel"><h2>Gửi yêu cầu bảo hành</h2><form id="fw"><div class="field"><label for="sn">Máy / serial</label><select id="sn">${ws.length ? ws.map((w) => `<option value="${w.sn}">${w.sn} · ${esc(byId(w.id).n)}</option>`).join("") : '<option value="">Nhập serial bên dưới</option>'}</select></div><div class="field"><label for="sx">Hoặc nhập serial</label><input id="sx" type="text" placeholder="VD: G02-1012"></div><div class="field"><label for="ds">Mô tả lỗi</label><textarea id="ds" required>Máy tự tắt khi chơi game nặng.</textarea></div><div class="field"><label for="im">Ảnh/video</label><input id="im" type="file" accept="image/*,video/*" multiple></div><button class="btn" type="submit">Gửi yêu cầu</button></form>${reqs.length ? `<h3 style="margin-top:14px">Yêu cầu đã gửi</h3>${reqs.map((r) => `<div class="small"><b class="mono">${r.code}</b> · ${esc(r.what)} · <span class="pill ${r.st === "Hoàn tất" ? "ok" : r.st === "Đã hủy" ? "bad" : "info"}">${r.st}</span></div>`).join("")}` : ""}</div></div>
    <div class="panel" style="margin-top:16px"><div class="row between"><div><h2>Gói BuildX Care 12 tháng – ${fmt(FEES.care)}</h2><p class="small muted">2 lần vệ sinh, thay keo (mua lẻ 2 × ${fmt(FEES.clean)} = 500.000đ), kiểm tra nhiệt độ, hỗ trợ từ xa ưu tiên. Nhắc lịch qua Zalo khi bạn đồng ý.</p></div><button class="btn" type="button" id="bc">Thêm vào giỏ</button></div></div></div>`;
  }, () => {
    $("#fw").onsubmit = async (e) => {
      e.preventDefault(); const sn = $("#sx").value.trim() || $("#sn").value; if (!sn) return toast("Chọn hoặc nhập serial");
      const btn = $("#fw button[type=submit]"); btn.disabled = true;
      try {
        const r = await API.act("warranty.request", { sn, desc: $("#ds").value, name: S.user ? S.user.name : "" });
        toast("Đã gửi, mã theo dõi " + r.code);
        $("#fw").innerHTML = `<div class="notice ok">Đã tiếp nhận yêu cầu <b>${r.code}</b> cho serial ${esc(sn)}${r.verifiedSn ? " (khớp phiếu bảo hành điện tử)" : " (chưa khớp phiếu bảo hành – kỹ thuật viên sẽ kiểm tra)"}. Kỹ thuật viên sẽ liên hệ.</div>`;
      } catch (err) { btn.disabled = false; toast(err.message); }
    };
    $("#bc").onclick = () => { if (!S.cart.some((l) => l.code === "care")) S.cart.push({ type: "svc", code: "care", title: "Gói BuildX Care 12 tháng", price: FEES.care }); go("#/cart"); };
  });
})();
