/* PlayVerse shared helpers (used by the public forms and the CRM) */

export const CFG = window.PLAYVERSE_CONFIG || {};
export const PKT = "Asia/Karachi";
export const GAMES = CFG.GAMES || [];
export const gameMeta = (slug) => GAMES.find((g) => g.slug === slug) || null;

/* ---------- Supabase client ---------- */
let _client = null;
export function getClient(opts = {}) {
  if (_client) return _client;
  const url = CFG.SUPABASE_URL || "";
  const key = CFG.SUPABASE_ANON_KEY || "";
  if (!url || !key || url.includes("PASTE_") || key.includes("PASTE_") || !window.supabase) return null;
  _client = window.supabase.createClient(url, key, {
    auth: { persistSession: opts.persist !== false, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return _client;
}

/* ---------- Text helpers ---------- */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const money = (n) => (n == null || n === "" ? null : "PKR " + Number(n).toLocaleString("en-PK"));

/* ---------- Validation (mirrors the server-side rules) ---------- */
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = "0" + d.slice(4);
  else if (d.startsWith("92") && d.length === 12) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("3")) d = "0" + d;
  return /^03\d{9}$/.test(d) ? d : null;
}
export const formatPhone = (n) => (n && n.length === 11 ? `${n.slice(0, 4)} ${n.slice(4)}` : n || "");

export function normalizeRoll(raw) {
  const r = String(raw ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9][A-Z0-9/-]{2,29}$/.test(r) ? r : null;
}

export function normalizeEmail(raw) {
  const e = String(raw ?? "").trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) ? e : null;
}

export const cleanText = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export function validName(raw) {
  const s = cleanText(raw);
  return s.length >= 2 && s.length <= 80 && /^[\p{L}][\p{L}\p{M} .'’-]*$/u.test(s);
}

/* ---------- Dates (always shown in Pakistan Standard Time) ---------- */
const fDate = new Intl.DateTimeFormat("en-GB", { timeZone: PKT, day: "2-digit", month: "short", year: "numeric" });
const fTime = new Intl.DateTimeFormat("en-US", { timeZone: PKT, hour: "numeric", minute: "2-digit", hour12: true });
const fKey = new Intl.DateTimeFormat("en-CA", { timeZone: PKT, year: "numeric", month: "2-digit", day: "2-digit" });
export const fmtDate = (iso) => (iso ? fDate.format(new Date(iso)) : "—");
export const fmtTime = (iso) => (iso ? fTime.format(new Date(iso)) : "—");
export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : "—");
export const dateKey = (iso) => (iso ? fKey.format(new Date(iso)) : "");

/* ---------- Clipboard ---------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch (e2) {
      return false;
    }
  }
}

/* ---------- Toasts ---------- */
export function toast(msg, type = "ok") {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add("out"), 3400);
  setTimeout(() => el.remove(), 3800);
}

/* ---------- Icons (24px line icons) ---------- */
const P = {
  dashboard: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  list: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  plus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4"/><path d="M6 12H2"/><path d="M12 6V2"/><path d="M12 22v-4"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="m12 8 3.8 2.8-1.5 4.5H9.7l-1.5-4.5z"/><path d="M12 8V2.5"/><path d="m15.8 10.8 5.2-1.7"/><path d="m14.3 15.3 3.2 4.4"/><path d="m9.7 15.3-3.2 4.4"/><path d="M8.2 10.8 3 9.1"/>',
  rocket: '<path d="M12 2c3.5 2.5 5 6 5 10l-2.5 3.5h-5L7 12c0-4 1.5-7.5 5-10z"/><circle cx="12" cy="9" r="1.6"/><path d="m7 13-3 3 3 1"/><path d="m17 13 3 3-3 1"/><path d="M10 19c0 1.5.8 2.5 2 3 1.2-.5 2-1.5 2-3"/>',
  mask: '<path d="M3 6c5 1.5 13 1.5 18 0v6c0 5-4 9-9 9s-9-4-9-9z"/><path d="M8 11h.01M16 11h.01"/><path d="M9 15.5c1.5 1.2 4.5 1.2 6 0"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};
export function icon(name, size = 20, cls = "") {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

/* PlayVerse logo mark: a play button */
export function logoMark(size = 36) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="pvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D4DFF"/><stop offset="1" stop-color="#00C2D9"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#pvg)"/><path d="M15 11.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 15 11.5z" fill="#fff"/></svg>`;
}
