// Phiên đăng nhập bằng cookie ký HMAC, băm mật khẩu bằng scrypt, mã OTP cho khách hàng.
"use strict";
const crypto = require("crypto");
const db = require("./db");

let secretCache = null;
// Khóa ký phiên: lấy từ SESSION_SECRET nếu có, nếu không tự sinh một lần và lưu trong CSDL.
async function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (secretCache) return secretCache;
  secretCache = await db.tx(async (c) => {
    let s = await db.getMeta(c, "session_secret");
    if (!s) { s = crypto.randomBytes(32).toString("hex"); await db.setMeta(c, "session_secret", s); }
    return s;
  }, { lock: false });
  return secretCache;
}

const b64 = (s) => Buffer.from(s).toString("base64url");
async function sign(obj) { const body = b64(JSON.stringify(obj)); const mac = crypto.createHmac("sha256", await secret()).update(body).digest("base64url"); return body + "." + mac; }
async function verify(tok) {
  if (!tok || !tok.includes(".")) return null;
  const [body, mac] = tok.split(".");
  const want = crypto.createHmac("sha256", await secret()).update(body).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try { const o = JSON.parse(Buffer.from(body, "base64url").toString()); return o.exp && o.exp < Date.now() ? null : o; } catch (_) { return null; }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function cookie(res, name, value, maxAgeSec, req) {
  const secure = req && (req.headers["x-forwarded-proto"] === "https" || process.env.VERCEL) ? "; Secure" : "";
  const c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, c) : c);
}

// Phiên khách: { phone?, verified, orders: [mã đơn đặt trên máy này] }
const C_COOKIE = "bx_c", S_COOKIE = "bx_s";
async function sessions(req) {
  const ck = parseCookies(req);
  return { cust: (await verify(ck[C_COOKIE])) || { verified: false, orders: [] }, staff: await verify(ck[S_COOKIE]) };
}
async function setCust(res, req, sess) { sess.exp = Date.now() + 30 * 864e5; sess.orders = (sess.orders || []).slice(-30); cookie(res, C_COOKIE, await sign(sess), 30 * 86400, req); }
async function setStaff(res, req, sess) { sess.exp = Date.now() + 12 * 3600e3; cookie(res, S_COOKIE, await sign(sess), 12 * 3600, req); }
const clear = (res, req, name) => cookie(res, name, "", 0, req);

function hashPassword(pw) { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(String(pw), salt, 32); return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`; }
function checkPassword(pw, stored) {
  const [alg, salt, h] = String(stored || "").split("$");
  if (alg !== "scrypt") return false;
  const got = crypto.scryptSync(String(pw), Buffer.from(salt, "hex"), 32);
  return crypto.timingSafeEqual(got, Buffer.from(h, "hex"));
}
const hashOtp = (phone, code) => crypto.createHash("sha256").update(phone + ":" + code).digest("hex");
const randomCode = () => String(crypto.randomInt(0, 1e6)).padStart(6, "0");

module.exports = { sessions, setCust, setStaff, clear, C_COOKIE, S_COOKIE, hashPassword, checkPassword, hashOtp, randomCode, parseCookies };
