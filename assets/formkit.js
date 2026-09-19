/* Reusable form pieces: used by the public forms and the CRM on-spot form */
import { CFG, esc, icon, normalizePhone, formatPhone, normalizeRoll, validName, cleanText } from "./common.js";

/* ---------- Errors ---------- */
export function setError(id, msg) {
  const p = document.getElementById("err-" + id);
  const el = document.getElementById(id);
  if (p) p.textContent = msg || "";
  if (el) {
    if (msg) {
      el.setAttribute("aria-invalid", "true");
      el.classList.add("invalid");
    } else {
      el.removeAttribute("aria-invalid");
      el.classList.remove("invalid");
    }
  }
}
export const clearError = (id) => setError(id, "");

/* ---------- Field builders ---------- */
export function fieldHTML({ id, label, type = "text", placeholder = "", hint = "", attrs = "", autocomplete = "off", required = true }) {
  return `<div class="field" id="f-${id}">
    <label for="${id}">${esc(label)}${required ? '<span class="req" aria-hidden="true"> *</span>' : ""}</label>
    <input class="input" id="${id}" name="${id}" type="${type}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}" ${attrs} aria-describedby="err-${id}">
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    <p class="err" id="err-${id}" role="alert"></p>
  </div>`;
}

function deptFieldHTML(prefix) {
  const id = `${prefix}-dept`;
  const opts = (CFG.DEPARTMENTS || []).map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
  return `<div class="field" id="f-${id}">
    <label for="${id}">Department<span class="req" aria-hidden="true"> *</span></label>
    <select class="input select" id="${id}" name="${id}" aria-describedby="err-${id}">
      <option value="">Select department</option>${opts}
      <option value="__other">Other (type your own)</option>
    </select>
    <input class="input other-input" id="${id}-other" type="text" maxlength="60" placeholder="Type your department" aria-label="Type your department" hidden>
    <p class="err" id="err-${id}" role="alert"></p>
  </div>`;
}

/* One person: name, roll number, department, contact number */
export function personBlockHTML(prefix, { autofill = false } = {}) {
  return `<div class="grid-2" data-person="${prefix}">
    ${fieldHTML({ id: `${prefix}-name`, label: "Full name", placeholder: "e.g. Ahmed Khan", autocomplete: autofill ? "name" : "off", attrs: 'maxlength="80"' })}
    ${fieldHTML({ id: `${prefix}-roll`, label: "Roll number", placeholder: "e.g. 25BSCS016", hint: "Letters, numbers, - and / only.", attrs: 'maxlength="30" autocapitalize="characters" spellcheck="false"' })}
    ${deptFieldHTML(prefix)}
    ${fieldHTML({ id: `${prefix}-phone`, label: "Contact number", type: "tel", placeholder: "03XX XXXXXXX", hint: "Pakistani mobile number.", autocomplete: autofill ? "tel" : "off", attrs: 'inputmode="tel" maxlength="20"' })}
  </div>`;
}

export function bindPerson(root, prefix, onChange) {
  const $ = (s) => root.querySelector(s);
  const dept = $(`#${prefix}-dept`);
  const other = $(`#${prefix}-dept-other`);
  const roll = $(`#${prefix}-roll`);
  const phone = $(`#${prefix}-phone`);
  const name = $(`#${prefix}-name`);

  dept.addEventListener("change", () => {
    const isOther = dept.value === "__other";
    other.hidden = !isOther;
    if (isOther) other.focus();
    else other.value = "";
    clearError(`${prefix}-dept`);
    onChange && onChange();
  });
  other.addEventListener("input", () => {
    clearError(`${prefix}-dept`);
    onChange && onChange();
  });
  roll.addEventListener("input", () => {
    const pos = roll.selectionStart;
    roll.value = roll.value.toUpperCase();
    try { roll.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    clearError(`${prefix}-roll`);
    onChange && onChange();
  });
  phone.addEventListener("input", () => {
    clearError(`${prefix}-phone`);
    onChange && onChange();
  });
  phone.addEventListener("blur", () => {
    const n = normalizePhone(phone.value);
    if (n) phone.value = formatPhone(n);
  });
  name.addEventListener("input", () => {
    clearError(`${prefix}-name`);
    onChange && onChange();
  });
  // inline validation when leaving a field
  name.addEventListener("blur", () => name.value && !validName(name.value) && setError(`${prefix}-name`, "Use letters only (2–80 characters)."));
  roll.addEventListener("blur", () => roll.value && !normalizeRoll(roll.value) && setError(`${prefix}-roll`, "Enter a valid roll number, e.g. 25BSCS016."));
  phone.addEventListener("blur", () => phone.value && !normalizePhone(phone.value) && setError(`${prefix}-phone`, "Enter a valid mobile number, e.g. 0312 3456789."));
}

export function readPerson(root, prefix) {
  const $ = (s) => root.querySelector(s);
  const d = $(`#${prefix}-dept`).value;
  return {
    full_name: cleanText($(`#${prefix}-name`).value),
    roll_number: ($(`#${prefix}-roll`).value || "").replace(/\s+/g, "").toUpperCase(),
    department: d === "__other" ? cleanText($(`#${prefix}-dept-other`).value) : d,
    contact: normalizePhone($(`#${prefix}-phone`).value) || $(`#${prefix}-phone`).value.trim(),
  };
}

/* Returns [{id, msg}] and shows each message under its field */
export function validatePerson(root, prefix) {
  const $ = (s) => root.querySelector(s);
  const errs = [];
  const nameV = $(`#${prefix}-name`).value;
  const rollV = $(`#${prefix}-roll`).value;
  const deptV = $(`#${prefix}-dept`).value;
  const otherV = cleanText($(`#${prefix}-dept-other`).value);
  const phoneV = $(`#${prefix}-phone`).value;

  if (!cleanText(nameV)) errs.push({ id: `${prefix}-name`, msg: "Enter the full name." });
  else if (!validName(nameV)) errs.push({ id: `${prefix}-name`, msg: "Use letters only (2–80 characters)." });

  if (!rollV.trim()) errs.push({ id: `${prefix}-roll`, msg: "Enter the roll number." });
  else if (!normalizeRoll(rollV)) errs.push({ id: `${prefix}-roll`, msg: "Enter a valid roll number, e.g. 25BSCS016." });

  if (!deptV) errs.push({ id: `${prefix}-dept`, msg: "Select a department." });
  else if (deptV === "__other" && otherV.length < 2) errs.push({ id: `${prefix}-dept`, focus: `${prefix}-dept-other`, msg: "Type the department name." });

  if (!phoneV.trim()) errs.push({ id: `${prefix}-phone`, msg: "Enter a contact number." });
  else if (!normalizePhone(phoneV)) errs.push({ id: `${prefix}-phone`, msg: "Enter a valid mobile number, e.g. 0312 3456789." });

  ["name", "roll", "dept", "phone"].forEach((k) => clearError(`${prefix}-${k}`));
  errs.forEach((e) => setError(e.id, e.msg));
  return errs;
}

/* ---------- Receipt picker ---------- */
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };
const extOf = (f) => (f.name.split(".").pop() || "").toLowerCase();
export const mimeFor = (f) => MIME[extOf(f)] || "";
export const maxBytes = () => (CFG.MAX_FILE_MB || 5) * 1024 * 1024;

export function checkReceipt(file) {
  if (!file) return "Upload your payment receipt.";
  if (!MIME[extOf(file)] || (file.type && !Object.values(MIME).includes(file.type))) return "Only JPG, PNG or PDF files are allowed.";
  if (file.size === 0) return "This file is empty. Choose another one.";
  if (file.size > maxBytes()) return `This file is too large. Maximum size is ${CFG.MAX_FILE_MB || 5} MB.`;
  return "";
}

export function receiptHTML(id = "receipt", { label = "Payment receipt", required = true } = {}) {
  return `<div class="field" id="f-${id}">
    <label for="${id}">${esc(label)}${required ? '<span class="req" aria-hidden="true"> *</span>' : ""}</label>
    <label class="drop" id="${id}-drop">
      <input class="sr-only" type="file" id="${id}" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" aria-describedby="err-${id}">
      <span class="drop-empty">
        ${icon("upload", 26)}
        <strong>Tap to upload your receipt</strong>
        <span>JPG, PNG or PDF, up to ${CFG.MAX_FILE_MB || 5} MB</span>
      </span>
      <span class="drop-file" hidden>
        <span class="thumb-wrap"><img class="thumb" alt="" hidden><span class="pdf-badge" hidden>PDF</span></span>
        <span class="meta"><strong class="fname"></strong><span class="fsize"></span></span>
        <button type="button" class="btn ghost sm remove">Remove</button>
      </span>
    </label>
    <p class="err" id="err-${id}" role="alert"></p>
  </div>`;
}

export function bindReceipt(root, id, onChange) {
  const input = root.querySelector(`#${id}`);
  const drop = root.querySelector(`#${id}-drop`);
  const empty = drop.querySelector(".drop-empty");
  const filebox = drop.querySelector(".drop-file");
  const thumb = drop.querySelector(".thumb");
  const pdf = drop.querySelector(".pdf-badge");
  let file = null;
  let url = null;

  const reset = () => {
    if (url) URL.revokeObjectURL(url);
    url = null;
    file = null;
    input.value = "";
    empty.hidden = false;
    filebox.hidden = true;
    thumb.hidden = true;
    pdf.hidden = true;
    thumb.removeAttribute("src");
  };
  const take = (f) => {
    const msg = checkReceipt(f);
    if (msg) {
      reset();
      setError(id, msg);
      onChange && onChange();
      return;
    }
    clearError(id);
    if (url) URL.revokeObjectURL(url);
    file = f;
    empty.hidden = true;
    filebox.hidden = false;
    drop.querySelector(".fname").textContent = f.name;
    drop.querySelector(".fsize").textContent = f.size >= 1048576 ? (f.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(f.size / 1024)) + " KB";
    if (mimeFor(f).startsWith("image/")) {
      url = URL.createObjectURL(f);
      thumb.src = url;
      thumb.hidden = false;
      pdf.hidden = true;
    } else {
      thumb.hidden = true;
      pdf.hidden = false;
    }
    onChange && onChange();
  };

  input.addEventListener("change", () => input.files && input.files[0] && take(input.files[0]));
  drop.querySelector(".remove").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    reset();
    onChange && onChange();
  });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => e.dataTransfer && e.dataTransfer.files[0] && take(e.dataTransfer.files[0]));

  return { getFile: () => file, reset };
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function uploadReceipt(sb, file) {
  const path = `${uuid()}.${extOf(file)}`;
  const { error } = await sb.storage.from("receipts").upload(path, file, {
    contentType: mimeFor(file),
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

/* Turn technical errors into messages people can act on */
export function friendlyError(e) {
  const m = String((e && (e.message || e.error_description)) || e || "");
  if (/failed to fetch|networkerror|load failed|network request/i.test(m)) return "Network problem. Check your internet connection and try again.";
  if (/payload too large|too large|exceeded the maximum|413/i.test(m)) return `The file is too large. Maximum size is ${CFG.MAX_FILE_MB || 5} MB.`;
  if (/mime type|invalid_mime|is not supported/i.test(m)) return "Only JPG, PNG or PDF files are allowed.";
  if (/violates|permission denied|syntax|relation|column|function|schema|jwt|row-level|policy|duplicate key/i.test(m)) return "Something went wrong on our side. Please try again in a moment.";
  return m || "Something went wrong. Please try again.";
}
