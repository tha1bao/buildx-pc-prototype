// Kết nối PostgreSQL (Neon trên Vercel, hoặc Postgres chạy tại máy khi phát triển),
// tạo bảng, đọc toàn bộ dữ liệu vận hành và ghi lại phần đã thay đổi.
"use strict";
const { Pool } = require("pg");

let pool;
function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Object.assign(new Error("Chưa cấu hình DATABASE_URL (CSDL Neon/Postgres)."), { status: 503 });
  pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000 });
  return pool;
}

// Mỗi bảng: khóa chính + vài cột để truy vấn/ERD, nội dung đầy đủ trong cột doc (jsonb).
const TABLES = {
  orders: { table: "orders", key: "id", cols: (o) => ({ phone: normPhone(o.cust.phone), status: o.status, created_at: new Date(o.date) }) },
  units: { table: "stock_units", key: "sn", cols: (u) => ({ product_id: u.id, state: u.state, order_id: u.order || null, in_date: new Date(u.inDate) }) },
  pos: { table: "purchase_orders", key: "id", cols: (p) => ({ status: p.status, for_order: p.forOrder }) },
  requests: { table: "service_requests", key: "id", cols: (r) => ({ phone: normPhone(r.phone), status: r.st, type: r.type }) },
  rma: { table: "rma_tickets", key: "id", cols: (r) => ({ sn: r.sn, status: r.st }) },
  warranties: { table: "warranties", key: "sn", cols: (w) => ({ phone: normPhone(w.phone), order_id: w.order }) },
  coupons: { table: "coupons", key: "code", cols: () => ({}) },
};
const num = (id) => Number(String(id).replace(/\D/g, "")) || 0;
const normPhone = (p) => String(p || "").replace(/[^\d]/g, "").replace(/^84/, "0");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS customers (phone text PRIMARY KEY, name text NOT NULL, doc jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS staff_users (email text PRIMARY KEY, name text NOT NULL, role text NOT NULL, active boolean NOT NULL DEFAULT true, pass_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS otp_codes (phone text PRIMARY KEY, code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts int NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, phone text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE TABLE IF NOT EXISTS stock_units (sn text PRIMARY KEY, product_id text NOT NULL, state text NOT NULL, order_id text REFERENCES orders(id), in_date timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS stock_units_product_idx ON stock_units (product_id, state);
CREATE TABLE IF NOT EXISTS purchase_orders (id text PRIMARY KEY, status text NOT NULL, for_order text, updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS service_requests (id text PRIMARY KEY, phone text NOT NULL, status text NOT NULL, type text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS rma_tickets (id text PRIMARY KEY, sn text, status text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS warranties (sn text PRIMARY KEY, phone text NOT NULL, order_id text REFERENCES orders(id), updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS coupons (code text PRIMARY KEY, updated_at timestamptz NOT NULL DEFAULT now(), doc jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), who text NOT NULL, action text NOT NULL, target text NOT NULL DEFAULT '');
`;

// Chạy fn trong một giao dịch. Thao tác ghi khóa toàn cục (advisory lock) để các lệnh
// giữ hàng/xuất kho chạy lần lượt: hai khách mua cùng món cuối cùng không thể cùng được giữ.
async function tx(fn, { lock = true } = {}) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    if (lock) await c.query("SELECT pg_advisory_xact_lock(424242)");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch (_) { /* bỏ qua */ }
    throw e;
  } finally {
    c.release();
  }
}
const q = (sql, params) => getPool().query(sql, params);

let ready = null;
// Tạo bảng và nạp dữ liệu mẫu ở lần chạy đầu (không cần chạy lệnh thủ công sau khi gắn CSDL)
function ensureReady() {
  if (!ready) ready = (async () => {
    await tx(async (c) => {
      await c.query(SCHEMA);
      const r = await c.query("SELECT value FROM app_meta WHERE key = 'seeded'");
      if (!r.rows.length) await require("./seed").seed(c);
    });
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

async function getMeta(c, key) { const r = await c.query("SELECT value FROM app_meta WHERE key = $1", [key]); return r.rows.length ? r.rows[0].value : null; }
async function setMeta(c, key, value) { await c.query("INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, JSON.stringify(value)]); }

// JSON từ CSDL: chuỗi ngày ISO → Date để engine so sánh được
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function revive(x) {
  if (typeof x === "string") return ISO.test(x) ? new Date(x) : x;
  if (Array.isArray(x)) return x.map(revive);
  if (x && typeof x === "object" && !(x instanceof Date)) { for (const k of Object.keys(x)) x[k] = revive(x[k]); }
  return x;
}

// Đọc toàn bộ dữ liệu vận hành thành "st" cho engine. Kèm bản chụp JSON để biết cái gì đã đổi.
async function loadState(c) {
  const st = require("../public/engine.js").emptyState();
  const snap = {};
  for (const [kind, t] of Object.entries(TABLES)) {
    const order = kind === "orders" ? "created_at DESC, id DESC" : kind === "units" ? "in_date, sn" : kind === "coupons" ? "code" : `${t.key} DESC`;
    const r = await c.query(`SELECT ${t.key} AS k, doc FROM ${t.table} ORDER BY ${order}`);
    snap[kind] = new Map();
    st[kind] = r.rows.map((row) => { snap[kind].set(row.k, JSON.stringify(row.doc)); return revive(row.doc); });
    if (["pos", "requests", "rma"].includes(kind)) st[kind].sort((a, b) => num(b.id) - num(a.id)); // mới nhất trước
  }
  const lg = await c.query("SELECT id, at, who, action, target FROM audit_log ORDER BY id DESC LIMIT 200");
  st.log = lg.rows.map((x) => ({ id: Number(x.id), t: x.at, who: x.who, action: x.action, target: x.target }));
  const su = await c.query("SELECT email, name, role, active FROM staff_users ORDER BY created_at, email");
  st.staffUsers = su.rows.map((u) => ({ name: u.name, email: u.email, role: u.role, on: u.active }));
  st.seq = Object.assign(st.seq, (await getMeta(c, "seq")) || {});
  snap.seq = JSON.stringify(st.seq);
  return { st, snap };
}

// Ghi những bản ghi mới hoặc đã đổi; nhật ký mới (chưa có id) được chèn vào audit_log.
async function saveState(c, st, snap) {
  let changed = 0;
  for (const [kind, t] of Object.entries(TABLES)) {
    for (const doc of st[kind]) {
      const k = doc[t.key], js = JSON.stringify(doc);
      if (snap[kind].get(k) === js) continue;
      const extra = t.cols(doc), cols = [t.key, ...Object.keys(extra), "doc"], vals = [k, ...Object.values(extra), js];
      const upd = cols.slice(1).map((col) => `${col} = EXCLUDED.${col}`).concat(["updated_at = now()"]).join(", ");
      await c.query(`INSERT INTO ${t.table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(", ")}) ON CONFLICT (${t.key}) DO UPDATE SET ${upd}`, vals);
      changed++;
    }
  }
  const fresh = st.log.filter((l) => !l.id).reverse();
  for (const l of fresh) await c.query("INSERT INTO audit_log (at, who, action, target) VALUES ($1, $2, $3, $4)", [new Date(l.t), l.who, l.action, l.target || ""]);
  if (JSON.stringify(st.seq) !== snap.seq) await setMeta(c, "seq", st.seq);
  if (changed || fresh.length) await c.query("INSERT INTO app_meta (key, value) VALUES ('version', '1') ON CONFLICT (key) DO UPDATE SET value = to_jsonb((app_meta.value)::int + 1)");
  return changed;
}

async function version() {
  const r = await q("SELECT value FROM app_meta WHERE key = 'version'");
  return r.rows.length ? Number(r.rows[0].value) : 0;
}

module.exports = { getPool, tx, q, ensureReady, loadState, saveState, getMeta, setMeta, revive, normPhone, version, SCHEMA, TABLES, resetPool: async () => { if (pool) { await pool.end(); pool = null; } ready = null; } };
