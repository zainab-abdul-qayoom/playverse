/* PlayVerse | public pages: landing (game cards) and the 5 registration forms */
import { CFG, GAMES, gameMeta, getClient, esc, icon, logoMark, money, copyText, toast, cleanText } from "./common.js";
import { personBlockHTML, bindPerson, readPerson, validatePerson, fieldHTML, setError, clearError,
         receiptHTML, bindReceipt, checkReceipt, uploadReceipt, friendlyError } from "./formkit.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const EVENT = CFG.EVENT_NAME || "PlayVerse";
const sb = getClient({ persist: false });
/* Game artwork: drop bg-<game>.jpg into /assets to override the built-in bg-<game>.svg */
const BRAND = { pubg: "#E0A03A", tekken: "#D64550", fifa: "#6FA8D6", "mini-militia": "#3FA34D", "mafia-wars": "#B8BDC6" };
const POS = { pubg: "50% 38%", tekken: "50% 72%", fifa: "50% 62%", "mini-militia": "50% 78%", "mafia-wars": "50% 28%" };
const art = (slug) => `url(/assets/bg-${slug}.jpg), url(/assets/bg-${slug}.svg)`;

const logo = $("#logo");
if (logo) logo.innerHTML = logoMark(32);

async function fetchGames() {
  if (!sb) return [];
  const { data, error } = await sb.from("games").select("slug,name,fee,is_open,max_slots").order("sort_order");
  return error ? [] : data || [];
}
const feeText = (row, g) => (row && row.fee != null ? money(row.fee) + (g.type === "team" ? " per team" : " per person") : "");

/* ---------------- Landing ---------------- */
async function landing() {
  const h = $(".hero-landing h1");
  if (h) h.textContent = "Welcome to " + EVENT;
  const inner = $(".hero-landing .hero-inner");
  if (inner) inner.insertAdjacentHTML("beforeend", `<img class="hero-art" src="/assets/playverse-hero.jpg" width="820" height="655" alt="PlayVerse: different games, one universe">`);
  const by = Object.fromEntries((await fetchGames()).map((r) => [r.slug, r]));
  $("#games").innerHTML = GAMES.map((g, i) => {
    const r = by[g.slug];
    const open = !r || r.is_open;
    const fee = feeText(r, g);
    return `<a class="gcard" style="--accent:${BRAND[g.slug] || g.color}" href="/register/${g.slug}">
      <span class="gart" style="--hero-img:${art(g.slug)};--hero-pos:${POS[g.slug]}"></span>
      <span class="gtile">${icon(g.icon, 26)}</span>
      <h2>${esc(g.name)}</h2>
      <p>${esc(g.blurb)}</p>
      <div class="gmeta">
        <div class="gtags">
          <span class="gtag">${g.type === "team" ? "Team of 4" : "Solo"}</span>
          ${fee ? `<span class="gtag">${esc(fee)}</span>` : ""}
          <span class="gtag ${open ? "open" : "closed"}">${open ? "Open" : "Closed"}</span>
        </div>
        <span class="go">${open ? "Register" : "Details"}</span>
      </div></a>`;
  }).join("");
}

/* ---------------- Registration form ---------------- */
async function form() {
  const app = $("#app");
  const slug = document.body.dataset.game;
  const meta = gameMeta(slug);
  if (!meta) { app.innerHTML = `<div class="card center-card"><h2>Game not found</h2><p class="hint">Go back and choose a game.</p></div>`; return; }

  document.title = `${meta.name} registration | ${EVENT}`;
  document.documentElement.style.setProperty("--accent", BRAND[slug] || meta.color);
  $(".hero").style.setProperty("--hero-img", art(slug));
  $(".hero").style.setProperty("--hero-pos", POS[slug]);
  const isTeam = meta.type === "team";
  const players = isTeam ? [1, 2, 3, 4] : [1];

  let row = null;
  if (sb) {
    const { data } = await sb.from("games").select("*").eq("slug", slug).maybeSingle();
    row = data;
  }
  const open = !row || row.is_open;
  const fee = feeText(row, meta);

  $("#gamehead").innerHTML = `<span class="game-tile">${icon(meta.icon, 32)}</span>
    <div><h1>${esc(meta.name)} registration</h1><p>${esc(meta.blurb)}</p></div>`;
  $("#chips").innerHTML = `<span class="chip">${isTeam ? "Team of 4 players" : "Individual"}</span>
    ${fee ? `<span class="chip">${esc(fee)}</span>` : ""}
    <span class="chip ${open ? "ok" : "closed"}">${open ? "Registrations open" : "Registrations closed"}</span>`;

  if (!sb) {
    app.innerHTML = `<div class="alert error">${icon("alert", 20)}<div class="alert-body"><b>This form is not connected yet.</b><br>Add your Supabase URL and key in assets/config.js, then reload.</div></div>`;
    return;
  }
  if (!open) {
    app.innerHTML = `<div class="card center-card"><div class="ic-big">${icon("clock", 30)}</div><h2>Registrations are closed</h2>
      <p class="hint" style="margin:8px 0 18px">${esc(meta.name)} is not accepting new registrations right now.</p><a class="btn secondary" href="/">See other games</a></div>`;
    return;
  }

  const P = CFG.PAYMENT || {};
  const section = (n, title, sub, inner) => `<section class="card"><div class="sec-head"><span class="sec-num">${n}</span>
    <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>${inner}</section>`;

  const playersHTML = isTeam
    ? `<div class="squad">${players.map((n) => `<div class="player${n === 1 ? " captain" : ""}">
        <div class="player-head"><span class="av">${n}</span><h3>Player ${n}${n === 1 ? " (Captain)" : ""}</h3>
        <span class="tag">${n === 1 ? "Team captain" : "Squad"}</span></div>${personBlockHTML(`p${n}`)}</div>`).join("")}</div>`
    : personBlockHTML("p1", { autofill: true });

  const consents = [
    "I confirm that the information provided in this registration form is accurate and correct.",
    `I agree to follow the rules, instructions, schedule, and code of conduct of ${EVENT} and understand that failure to follow event rules may affect my participation.${CFG.RULES_URL ? ` <a href="${esc(CFG.RULES_URL)}" target="_blank" rel="noopener">Read the rules</a>` : ""}`,
    `I confirm that the payment receipt submitted with this registration is genuine and belongs to this ${EVENT} registration.`,
    `I consent to ${EVENT} collecting and using the information provided in this form for registration, event management, communication, scheduling, and participant coordination purposes.`,
  ];

  app.innerHTML = `
    <div class="progress" aria-live="polite"><div class="progress-row"><span>Form progress</span><b id="pct">0%</b></div><div class="bar"><i id="bar"></i></div></div>
    <form id="form" novalidate autocomplete="on">
      ${isTeam ? section(1, "Team", "Choose a name for your squad.", fieldHTML({ id: "team", label: "Team name", placeholder: "e.g. Night Owls", attrs: 'maxlength="40"' })) : ""}
      ${section(isTeam ? 2 : 1, isTeam ? "Players" : "Your details", isTeam ? "Player 1 is the team captain. All four players are required." : "", playersHTML)}
      ${section(isTeam ? 3 : 2, "Payment", "Pay the entry fee, then upload your receipt.", `
        <div class="pay">
          <div class="pay-top"><span class="pay-method">${icon("wallet", 18)} ${esc(P.method || "Easypaisa")}</span>
            ${fee ? `<span class="pay-fee">${esc(fee)}</span>` : `<span class="pay-fee tbd">Fee to be announced</span>`}</div>
          <p class="pay-name" style="margin-top:16px">Account number</p>
          <div class="pay-num" style="margin-top:4px"><span class="num">${esc(P.number || "")}</span>
            <button type="button" class="btn light sm" id="copy">${icon("copy", 16)} Copy number</button></div>
          <p class="pay-name" style="margin-top:10px">Account name: <b>${esc(P.name || "")}</b></p>
        </div>
        <ol class="steps"><li>Send the entry fee to the account above.</li><li>Save a screenshot or PDF of the receipt.</li><li>Upload it below${isTeam ? ". One receipt covers the whole team" : ""}.</li></ol>
        ${receiptHTML("receipt")}`)}
      ${section(isTeam ? 4 : 3, "Agreements", "All four are required.", `
        <div class="check-wrap"><div class="checks">${consents.map((t, i) => `<label class="check"><input type="checkbox" name="consent" id="consent-${i + 1}"><span>${t}</span></label>`).join("")}</div>
        <p class="err" id="err-consent" role="alert"></p></div>`)}
      <input class="hp" id="hp" name="hp_trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div id="alert"></div>
      <button class="btn primary lg block" id="submit" type="submit"><span class="spin"></span>Submit registration</button>
      <p class="submit-note">You will get your Registration ID on the next screen.</p>
    </form>`;

  const val = (id) => (document.getElementById(id) || {}).value || "";
  const receipt = bindReceipt(app, "receipt", () => progress());
  players.forEach((n) => bindPerson(app, `p${n}`, () => progress()));
  const team = $("#team");
  if (team) team.addEventListener("input", () => { clearError("team"); progress(); });
  $$('input[name="consent"]').forEach((c) => c.addEventListener("change", () => { setError("consent", ""); progress(); }));
  $("#copy").addEventListener("click", async () => toast((await copyText(P.number || "")) ? "Account number copied" : "Copy failed. Select the number and copy it.", "ok"));

  function progress() {
    let done = 0, total = 0;
    const add = (ok) => { total++; if (ok) done++; };
    players.forEach((n) => {
      add(val(`p${n}-name`).trim());
      add(val(`p${n}-roll`).trim());
      const d = val(`p${n}-dept`);
      add(d && (d !== "__other" || val(`p${n}-dept-other`).trim()));
      add(val(`p${n}-phone`).trim());
      add(val(`p${n}-email`).trim());
    });
    if (isTeam) add(val("team").trim());
    add(receipt.getFile());
    $$('input[name="consent"]').forEach((c) => add(c.checked));
    const pct = Math.round((done / total) * 100);
    $("#pct").textContent = pct + "%";
    $("#bar").style.width = pct + "%";
  }

  const alertBox = $("#alert");
  const showAlert = (kind, title, msg, actions = "") => {
    alertBox.innerHTML = `<div class="alert ${kind}" role="alert">${icon("alert", 20)}<div class="alert-body"><b>${title}</b><p>${esc(msg)}</p>${actions ? `<div class="actions">${actions}</div>` : ""}</div></div>`;
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  function validate() {
    const errs = [];
    if (isTeam) {
      const t = cleanText(val("team"));
      const msg = !t ? "Enter your team name." : t.length < 2 || t.length > 40 ? "Team name must be 2 to 40 characters." : "";
      setError("team", msg);
      if (msg) errs.push({ id: "team" });
    }
    players.forEach((n) => errs.push(...validatePerson(app, `p${n}`)));
    if (!errs.length || errs.every((e) => e.id === "team")) {
      const seen = {};
      players.forEach((n) => {
        const r = readPerson(app, `p${n}`).roll_number;
        if (seen[r]) { setError(`p${n}-roll`, "This roll number is already used by another player."); errs.push({ id: `p${n}-roll` }); }
        seen[r] = true;
      });
    }
    const rm = checkReceipt(receipt.getFile());
    setError("receipt", rm);
    if (rm) errs.push({ id: "receipt" });
    if (!$$('input[name="consent"]').every((c) => c.checked)) {
      setError("consent", "Please accept all four agreements to continue.");
      errs.push({ id: "consent-1" });
    }
    return errs;
  }

  let busy = false;
  let uploaded = null;
  async function submit(force = false) {
    if (busy) return;
    alertBox.innerHTML = "";
    const errs = validate();
    if (errs.length) {
      const el = document.getElementById(errs[0].focus || errs[0].id);
      if (el) {
        (el.closest(".field, .check-wrap") || el).scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
      return;
    }
    const btn = $("#submit");
    busy = true; btn.classList.add("loading"); btn.disabled = true;
    try {
      const file = receipt.getFile();
      if (!uploaded || uploaded.file !== file) uploaded = { file, path: await uploadReceipt(sb, file) };
      const payload = {
        game: slug, source: "online",
        team_name: isTeam ? cleanText(val("team")) : null,
        participants: players.map((n) => readPerson(app, `p${n}`)),
        receipt_path: uploaded.path, receipt_name: file.name,
        consent: true, hp: val("hp"),
      };
      const { data, error } = await sb.rpc("submit_registration", { p: payload, p_force: force });
      if (error) throw error;
      if (data && data.duplicate) {
        showAlert("warn", "Possible duplicate registration", data.message + " If this is a different person or team, you can continue.",
          `<button type="button" class="btn primary sm" id="force">Register anyway</button><button type="button" class="btn secondary sm" id="review">Review my details</button>`);
        $("#force").addEventListener("click", () => submit(true));
        $("#review").addEventListener("click", () => { alertBox.innerHTML = ""; window.scrollTo({ top: 0, behavior: "smooth" }); });
        return;
      }
      if (!data || !data.ok) throw new Error("We could not complete your registration. Please try again.");
      ticket(data);
    } catch (e) {
      console.error(e);
      showAlert("error", "Registration not completed", friendlyError(e));
    } finally {
      busy = false; btn.classList.remove("loading"); btn.disabled = false;
    }
  }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); submit(false); });

  function ticket(d) {
    const status = String(d.status || "new").replace(/^./, (c) => c.toUpperCase());
    const rows = [["Game", d.game], isTeam ? ["Team name", d.team_name] : null, [isTeam ? "Captain" : "Participant", isTeam ? d.captain : d.participant], ["Registration status", status], ["Payment", "Pending verification"]]
      .filter(Boolean).map(([k, v]) => `<div><span class="k">${k}</span><b>${esc(v)}</b></div>`).join("");
    app.innerHTML = `<div class="ticket">
      <div class="ticket-top"><div class="ticket-check">${icon("check", 30)}</div><h2>Registration successful!</h2><p>Thank you for registering for ${esc(EVENT)}.</p></div>
      <div class="ticket-id"><div class="lbl">Registration ID</div><div class="code">${esc(d.reg_code)}</div></div>
      <div class="ticket-rows">${rows}</div>
      <div class="ticket-foot"><p class="keep">Please keep your Registration ID for event verification. Take a screenshot of this page.</p>
        <div class="ticket-actions no-print">
          <button class="btn primary" id="cid">${icon("copy", 16)} Copy ID</button>
          <button class="btn secondary" id="prt">${icon("printer", 16)} Save or print</button>
          <a class="btn secondary" href="/">Other games</a></div></div></div>`;
    $("#cid").addEventListener("click", async () => toast((await copyText(d.reg_code)) ? "Registration ID copied" : "Copy failed", "ok"));
    $("#prt").addEventListener("click", () => window.print());
    $("#chips").innerHTML = `<span class="chip ok">Registered</span>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  progress();
}

if (document.body.dataset.page === "landing") landing();
else form();
