// The signed-in site: login and sign-up, map, sessions, host tools, approvals and tutorials.
import L from "leaflet";
import { createLiveApi } from "./api-live.js";
import { createDemoApi } from "./api-demo.js";

const { t: T, auth: AUTH, lang, prefix, feePercent, config } = window.MERKATS;
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const api = isLocal && !new URLSearchParams(location.search).has("live") ? createDemoApi() : createLiveApi(config);
const appUrl = `${prefix}/app.html`;
const loginUrl = `${prefix}/login.html`;

// Build DOM with text nodes, never HTML strings, so user content can't inject markup.
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value" || k === "checked" || k === "disabled") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const money = (cents) => new Intl.NumberFormat(lang === "zh" ? "zh-CN" : lang, { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const when = (iso) => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const errorText = (e) => T.errors[e?.message] || T.errors.try_again;
const toCents = (v) => Math.round(parseFloat(v || "0") * 100);
const toDollars = (c) => (c === null || c === undefined ? "" : (c / 100).toFixed(2));
const localInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const hostShare = (cents) => cents - Math.round((cents * feePercent) / 100);

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = h("div", { class: "toast", role: "status" }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
const field = (label, input, help) => h("label", { class: "field" }, h("span", {}, label), input, help && h("small", {}, help));
// Runs an action, showing any failure next to the control the person used.
async function attempt(fn, errorEl) {
  if (errorEl) errorEl.textContent = "";
  try { return await fn(); } catch (e) {
    console.error(e);
    if (errorEl) errorEl.textContent = errorText(e); else toast(errorText(e));
    return undefined;
  }
}

// ---- login page ---------------------------------------------------------------
async function initLogin() {
  const [signin, signup, title] = ["signin", "signup", "auth-title"].map((x) => document.getElementById(x));
  if (await api.hasSession()) { location.replace(appUrl); return; }
  const show = (up) => {
    signin.hidden = up; signup.hidden = !up;
    title.textContent = up ? AUTH.create : AUTH.welcome;
    document.querySelectorAll(".note").forEach((n) => { n.textContent = ""; });
  };
  document.getElementById("to-signup").onclick = () => { show(true); history.replaceState(null, "", "#signup"); };
  document.getElementById("to-signin").onclick = () => { show(false); history.replaceState(null, "", location.pathname); };
  const fromHash = () => show(location.hash === "#signup");
  fromHash();
  addEventListener("hashchange", fromHash);

  const submit = (form, run) => form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const note = form.querySelector(".note");
    note.textContent = ""; button.disabled = true;
    try { await run(Object.fromEntries(new FormData(form)), note); }
    catch (err) { console.error(err); note.textContent = errorText(err); }
    finally { button.disabled = false; }
  });
  submit(signin, async (v) => {
    await api.signIn({ identifier: v.username, password: v.password });
    location.replace(appUrl);
  });
  submit(signup, async (v, note) => {
    const res = await api.signUp({ name: v.name, username: v.username, email: v.email, password: v.password, role: v.role, redirectTo: `${location.origin}${appUrl}` });
    if (res.needsConfirmation) { note.textContent = T.auth.checkEmail; return; }
    location.replace(appUrl);
  });
}

// ---- app shell ---------------------------------------------------------------
let me = null;
let root;
let view;
let cleanup = null;

function tabs() {
  const items = [["map", T.tabs.map, "mapTab"]];
  if (me.role === "member") items.push(["meals", T.tabs.meals, "mealsTab"]);
  if (me.role === "host") items.push(["host", T.tabs.host, "hostTab"]);
  items.push(["settings", T.tabs.settings, "settingsTab"]);
  if (me.isAdmin) items.push(["admin", T.tabs.admin, "adminTab"]);
  const here = location.hash.replace(/^#\//, "").split("/")[0] || "map";
  const active = here === "location" ? "map" : here;
  return h("nav", { class: "tabs", "aria-label": T.tabs.settings },
    items.map(([route, label, tut]) => h("a", { href: `#/${route}`, "data-tut": tut, "aria-current": route === active ? "page" : null }, label)));
}

async function renderRoute() {
  cleanup?.(); cleanup = null;
  const [route = "map", ...rest] = location.hash.replace(/^#\//, "").split("/");
  root.replaceChildren(api.demo ? h("p", { class: "demo-banner" }, T.demoBanner) : "", tabs(), (view = h("div", { class: "view" }, h("p", { class: "muted" }, T.common.loading))));
  const pages = { map: mapPage, location: locationPage, meals: mealsPage, host: hostPage, session: sessionPage, settings: settingsPage, admin: adminPage };
  const page = pages[route] || mapPage;
  try { view.replaceChildren(...[await page(...rest)].flat(Infinity).filter(Boolean)); afterRender.forEach((f) => f()); afterRender = []; }
  catch (e) { console.error(e); view.replaceChildren(h("p", { class: "error" }, errorText(e))); }
  window.dispatchEvent(new Event("merkats:rendered"));
}
let afterRender = [];

// ---- map -----------------------------------------------------------------------
const pin = (active) => L.divIcon({ className: "", html: `<span class="pin${active ? " active" : ""}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
const miles = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(x));
};

async function mapPage() {
  const locations = await api.approvedLocations();
  const mapEl = h("div", { class: "map", "data-tut": "map" });
  const list = h("div", { class: "kitchen-list", "data-tut": "list" });
  const status = h("p", { class: "muted", role: "status" });
  let origin = null;

  const draw = () => {
    const rows = locations.map((l) => ({ l, away: origin ? miles(origin, { lat: +l.approx_lat, lng: +l.approx_lng }) : null }));
    if (origin) rows.sort((a, b) => a.away - b.away);
    list.replaceChildren(...(rows.length ? rows.map(({ l, away }) => h("a", { class: "card kitchen", href: `#/location/${l.id}` },
      h("strong", {}, l.name), h("span", { class: "muted" }, l.area),
      away !== null && h("span", { class: "muted" }, `${away.toFixed(1)} ${T.map.miles}`))) : [h("p", { class: "muted" }, T.map.empty)]));
  };
  draw();

  afterRender.push(() => {
    const map = L.map(mapEl, { scrollWheelZoom: false }).setView([39.95, -75.16], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    const points = locations.map((l) => {
      const point = [+l.approx_lat, +l.approx_lng];
      const label = h("span", {}, l.name);
      L.marker(point, { icon: pin(), title: l.name, alt: l.name }).addTo(map).bindTooltip(label).on("click", () => { location.hash = `#/location/${l.id}`; });
      return point;
    });
    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
    nearMe.onclick = () => {
      if (!navigator.geolocation) { status.textContent = T.map.denied; return; }
      status.textContent = T.map.locating;
      navigator.geolocation.getCurrentPosition((pos) => {
        origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        status.textContent = "";
        L.circleMarker([origin.lat, origin.lng], { radius: 7, color: "#044836", fillColor: "#C77D7D", fillOpacity: 1 }).addTo(map);
        map.setView([origin.lat, origin.lng], 12);
        draw();
      }, () => { status.textContent = T.map.denied; });
    };
    cleanup = () => map.remove();
  });
  const nearMe = h("button", { class: "btn outline", type: "button" }, T.map.nearMe);
  return [h("div", { class: "head-row" }, h("h1", {}, T.map.title), nearMe), status, h("div", { class: "map-layout" }, mapEl, list), h("p", { class: "muted small" }, T.map.approx)];
}

// ---- a kitchen and its meals ----------------------------------------------------
function sessionCard(s, location_, mine) {
  const left = s.seats - s.seats_taken;
  const error = h("p", { class: "error", role: "alert" });
  const isMine = s.host_id === me.id;
  const joined = mine.some((c) => c.session_id === s.id && ["paid", "completed"].includes(c.status));
  const join = async (e) => {
    e.target.disabled = true;
    const res = await attempt(() => api.checkout(s.id, appUrl), error);
    if (res?.url) { window.location.href = res.url; return; }
    if (res?.demoPaid) { toast(T.meals.paidToast); location.hash = "#/meals"; return; }
    e.target.disabled = false;
  };
  let action;
  if (isMine) action = h("span", { class: "muted" }, T.location.yours);
  else if (joined) action = h("span", { class: "badge ok" }, T.location.committed);
  else if (me.role !== "member") action = h("span", { class: "muted" }, T.location.switchToJoin);
  else if (left <= 0) action = h("span", { class: "badge" }, T.location.full);
  else action = h("button", { class: "btn", type: "button", onclick: join }, T.location.commit);
  return h("article", { class: "card session" },
    h("div", { class: "head-row" }, h("h3", {}, s.title), h("strong", {}, `${money(s.price_cents)} `, h("span", { class: "muted small" }, T.location.perPerson))),
    h("p", { class: "muted" }, when(s.starts_at), " · ", left > 0 ? `${left} ${T.location.seatsLeft}` : T.location.full),
    s.menu && h("p", { class: "pre" }, s.menu), action, error);
}

async function locationPage(id) {
  const l = await api.location(id);
  if (!l) return h("p", {}, T.location.notFound);
  const [sessions, address, mine] = await Promise.all([api.upcomingSessions(id), api.locationAddress(id), api.myCommitments(me)]);
  return [
    h("a", { class: "back-link", href: "#/map" }, `← ${T.common.back}`),
    h("h1", {}, l.name), h("p", { class: "muted" }, l.area), l.description && h("p", { class: "pre" }, l.description),
    address && h("div", { class: "card" }, h("strong", {}, T.location.address), h("p", {}, address.address),
      address.directions && [h("strong", {}, T.location.directions), h("p", { class: "pre" }, address.directions)]),
    h("h2", {}, T.location.upcoming),
    sessions.length ? sessions.map((s) => sessionCard(s, l, mine)) : h("p", { class: "muted" }, T.location.noMeals),
  ];
}

// ---- member: my meals -----------------------------------------------------------
async function mealsPage() {
  const list = (await api.myCommitments(me)).filter((c) => c.session && c.status !== "cancelled");
  const row = (c) => {
    const error = h("p", { class: "error", role: "alert" });
    const leave = async () => {
      if (!confirm(T.meals.leaveConfirm)) return;
      if ((await attempt(() => api.leaveSession(c.id), error)) !== undefined || api.demo) { toast(T.meals.leftToast); renderRoute(); }
    };
    const upcoming = Date.parse(c.session.starts_at) > Date.now();
    return h("article", { class: "card session" },
      h("div", { class: "head-row" }, h("h3", {}, c.session.title), h("span", { class: `badge ${c.status === "paid" || c.status === "completed" ? "ok" : ""}` }, T.meals.status[c.status])),
      h("p", { class: "muted" }, when(c.session.starts_at), " · ", money(c.amount_cents)),
      c.session.location && h("a", { href: `#/location/${c.session.location.id}` }, c.session.location.name),
      c.status === "paid" && upcoming && h("button", { class: "btn outline small-btn", type: "button", onclick: leave }, T.meals.leave), error);
  };
  return h("div", { "data-tut": "meals" }, h("h1", {}, T.meals.title),
    list.length ? list.map(row) : [h("p", { class: "muted" }, T.meals.empty), h("a", { class: "btn", href: "#/map" }, T.meals.find)]);
}

// ---- host: kitchens ----------------------------------------------------------------
function locationForm(existing, done) {
  const token = crypto.randomUUID();
  const name = h("input", { required: true, maxlength: 120, value: existing?.name || "" });
  const description = h("textarea", { rows: 3, maxlength: 2000, value: "" });
  description.value = existing?.description || "";
  const directions = h("textarea", { rows: 2, maxlength: 2000 });
  const address = h("input", { required: true, autocomplete: "off", role: "combobox", "aria-expanded": "false" });
  const options = h("div", { class: "suggestions" });
  const error = h("p", { class: "error", role: "alert" });
  let place = null, timer;
  address.addEventListener("input", () => {
    place = null;
    clearTimeout(timer);
    const q = address.value.trim();
    if (q.length < 3) { options.replaceChildren(); return; }
    timer = setTimeout(async () => {
      const found = await attempt(() => api.searchAddress(q, token), error);
      if (!found) { error.textContent = T.errors.address_unavailable; return; }
      options.replaceChildren(...found.map((s) => h("button", { type: "button", onclick: async () => {
        const details = await attempt(() => api.addressDetails(s.placeId, token), error);
        if (!details) return;
        place = details; address.value = details.address; options.replaceChildren();
      } }, h("strong", {}, s.main), " ", h("span", { class: "muted" }, s.secondary))));
    }, 300);
  });
  const form = h("form", { class: "card form", onsubmit: async (e) => {
    e.preventDefault();
    if (!place) { error.textContent = T.host.pickAddress; return; }
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    const ok = await attempt(async () => {
      await api.submitLocation({ id: existing?.id, name: name.value.trim(), description: description.value.trim(), area: place.area || "", address: place.address, lat: place.lat, lng: place.lng, placeId: place.placeId, directions: directions.value.trim() });
      return true;
    }, error);
    button.disabled = false;
    if (ok) { toast(T.host.submitted); done(); }
  } },
    h("h2", {}, existing ? T.host.resubmit : T.host.register), h("p", { class: "muted" }, T.host.registerHelp),
    field(T.host.name, name), field(T.host.description, description),
    h("div", { class: "field" }, field(T.host.address, address, T.host.addressHelp), options),
    field(T.host.directions, directions), h("p", { class: "muted small" }, T.host.capacityNote),
    h("button", { class: "btn", type: "submit" }, T.host.submit), error);
  return form;
}

function sessionForm(locationId, existing, done, locked) {
  const title = h("input", { required: true, maxlength: 120, value: existing?.title || "" });
  const menu = h("textarea", { rows: 3, maxlength: 4000 }); menu.value = existing?.menu || "";
  const starts = h("input", { type: "datetime-local", required: true, disabled: locked, value: existing ? localInput(existing.starts_at) : "" });
  const duration = h("input", { type: "number", min: 15, max: 1440, step: 15, required: true, value: existing?.duration_minutes ?? 120 });
  const price = h("input", { type: "number", min: "0.5", max: 1000, step: "0.01", required: true, disabled: locked, value: existing ? toDollars(existing.price_cents) : "" });
  const seats = h("input", { type: "number", min: 1, max: 100, required: true, value: existing?.seats ?? 6 });
  const hint = h("small", { class: "muted" });
  const updateHint = () => { hint.textContent = price.value ? fill(T.session.payoutHint, { host: money(hostShare(toCents(price.value))), pct: feePercent }) : ""; };
  price.addEventListener("input", updateHint); updateHint();
  const error = h("p", { class: "error", role: "alert" });
  const form = h("form", { class: "card form", onsubmit: async (e) => {
    e.preventDefault();
    const values = { title: title.value.trim(), menu: menu.value.trim(), duration_minutes: +duration.value, seats: +seats.value };
    if (!locked) Object.assign(values, { starts_at: new Date(starts.value).toISOString(), price_cents: toCents(price.value) });
    const saved = await attempt(async () => (existing ? (await api.updateSession(existing.id, values), existing) : api.createSession({ ...values, location_id: locationId, host_id: me.id })), error);
    if (saved) { toast(existing ? T.session.saved : T.session.created); done(saved); }
  } },
    !existing && h("h3", {}, T.host.newSession), locked && h("p", { class: "muted small" }, T.session.locked),
    field(T.session.title, title), field(T.session.menu, menu),
    h("div", { class: "field-row" }, field(T.session.when, starts), field(T.session.duration, duration)),
    h("div", { class: "field-row" }, field(T.session.price, price), field(T.session.seats, seats)), hint,
    h("button", { class: "btn", type: "submit" }, T.common.save), error);
  return form;
}

async function payoutsPanel() {
  const status = await api.payoutStatus().catch(() => ({ ready: false }));
  const error = h("p", { class: "error", role: "alert" });
  const go = async (action) => {
    const res = await attempt(() => action(), error);
    if (res?.url) window.location.href = res.url;
    else if (res?.demoReady) renderRoute();
  };
  return h("section", { class: "card", "data-tut": "payouts" }, h("h2", {}, T.host.payoutsTitle),
    h("p", { class: "muted" }, status.ready ? T.host.payoutsReady : T.host.payoutsNeeded),
    status.ready
      ? h("button", { class: "btn outline", type: "button", onclick: () => go(api.payoutDashboard) }, T.host.dashboard)
      : h("button", { class: "btn", type: "button", onclick: () => go(() => api.payoutSetup(`${location.origin}${appUrl}#/host`)) }, T.host.setup), error);
}

async function hostPage() {
  if (me.role !== "host") return h("p", {}, T.errors.not_a_host);
  const locations = await api.myLocations(me);
  const payouts = await payoutsPanel();
  const cards = await Promise.all(locations.map(async (l) => {
    const sessions = await api.locationSessions(l.id);
    const slot = h("div");
    const badge = l.status === "approved" ? "ok" : l.status === "rejected" ? "bad" : "";
    return h("section", { class: "card" },
      h("div", { class: "head-row" }, h("h2", {}, l.name), h("span", { class: `badge ${badge}` }, T.host.status[l.status])),
      h("p", { class: "muted" }, l.area), l.review_note && h("p", {}, h("strong", {}, `${T.host.note}: `), l.review_note),
      l.status === "approved" ? [
        h("h3", {}, T.host.sessions),
        sessions.length ? h("ul", { class: "plain" }, sessions.map((s) => h("li", { class: "row" },
          h("div", {}, h("strong", {}, s.title), " ", h("span", { class: "muted small" }, when(s.starts_at), " · ", money(s.price_cents), " · ", `${s.seats_taken}/${s.seats}`), s.status === "cancelled" && h("span", { class: "badge bad" }, T.session.cancelled)),
          h("a", { class: "btn outline small-btn", href: `#/session/${s.id}` }, T.session.manage)))) : h("p", { class: "muted" }, T.host.noSessions),
        h("button", { class: "btn", type: "button", onclick: (e) => { e.target.remove(); slot.replaceChildren(sessionForm(l.id, null, (s) => { location.hash = `#/session/${s.id}`; }, false)); } }, T.host.newSession), slot,
      ] : h("p", { class: "muted" }, T.host.approveFirst),
      h("button", { class: "btn outline small-btn", type: "button", onclick: (e) => { e.target.remove(); slot.replaceChildren(locationForm(l, renderRoute)); } }, T.host.resubmit), l.status !== "approved" && slot);
  }));
  const addSlot = h("div");
  const register = locations.length
    ? h("button", { class: "btn outline", type: "button", onclick: (e) => { e.target.remove(); addSlot.replaceChildren(locationForm(null, renderRoute)); } }, T.host.another)
    : locationForm(null, renderRoute);
  return [h("h1", {}, T.host.title), h("div", { "data-tut": "location" }, cards, register, addSlot), payouts];
}

// ---- host: one session: details, groceries, members ----------------------------------
function groceriesPanel(sessionId, items) {
  const body = h("tbody");
  const totals = h("tfoot");
  const error = h("p", { class: "error", role: "alert" });
  const drawTotals = () => {
    const est = items.reduce((a, g) => a + (g.estimated_cents || 0), 0), act = items.reduce((a, g) => a + (g.actual_cents || 0), 0);
    totals.replaceChildren(h("tr", {}, h("th", { colspan: 2, scope: "row" }, T.groceries.total), h("td", {}, money(est)), h("td", {}, money(act)), h("td", { colspan: 2 })));
  };
  const save = (g, patch) => { Object.assign(g, patch); drawTotals(); attempt(() => api.updateGrocery(g.id, patch), error); };
  const row = (g) => {
    const tr = h("tr", {},
      h("td", {}, h("input", { "aria-label": T.groceries.item, value: g.name, maxlength: 200, onchange: (e) => e.target.value.trim() && save(g, { name: e.target.value.trim() }) })),
      h("td", {}, h("input", { "aria-label": T.groceries.qty, value: g.quantity || "", maxlength: 60, onchange: (e) => save(g, { quantity: e.target.value }) })),
      h("td", {}, h("input", { "aria-label": T.groceries.estimate, type: "number", min: 0, step: "0.01", value: toDollars(g.estimated_cents), onchange: (e) => save(g, { estimated_cents: toCents(e.target.value) }) })),
      h("td", {}, h("input", { "aria-label": T.groceries.actual, type: "number", min: 0, step: "0.01", value: toDollars(g.actual_cents), onchange: (e) => save(g, { actual_cents: e.target.value === "" ? null : toCents(e.target.value) }) })),
      h("td", { class: "center" }, h("input", { "aria-label": T.groceries.bought, type: "checkbox", checked: g.purchased, onchange: (e) => save(g, { purchased: e.target.checked }) })),
      h("td", {}, h("button", { class: "link-btn", type: "button", onclick: async () => {
        if ((await attempt(async () => { await api.removeGrocery(g.id); return true; }, error))) { items.splice(items.indexOf(g), 1); tr.remove(); drawTotals(); }
      } }, T.common.remove)));
    return tr;
  };
  body.append(...items.map(row));
  drawTotals();
  const name = h("input", { placeholder: T.groceries.item, "aria-label": T.groceries.item, required: true, maxlength: 200 });
  const qty = h("input", { placeholder: T.groceries.qty, "aria-label": T.groceries.qty, maxlength: 60 });
  const est = h("input", { placeholder: T.groceries.estimate, "aria-label": T.groceries.estimate, type: "number", min: 0, step: "0.01" });
  const add = h("form", { class: "add-row", onsubmit: async (e) => {
    e.preventDefault();
    const g = await attempt(() => api.addGrocery({ session_id: sessionId, name: name.value.trim(), quantity: qty.value.trim(), estimated_cents: toCents(est.value) }), error);
    if (g) { items.push(g); body.append(row(g)); drawTotals(); add.reset(); name.focus(); }
  } }, name, qty, est, h("button", { class: "btn small-btn", type: "submit" }, T.groceries.add));
  return h("section", { class: "card" }, h("h2", {}, T.groceries.title),
    h("div", { class: "table-wrap" }, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, [T.groceries.item, T.groceries.qty, T.groceries.estimate, T.groceries.actual, T.groceries.bought, ""].map((c) => h("th", { scope: "col" }, c)))), body, totals)),
    add, error);
}

function rosterPanel(session, roster) {
  const paid = roster.filter((r) => ["paid", "completed"].includes(r.status));
  const payout = paid.reduce((a, r) => a + hostShare(r.amount_cents), 0);
  const statusBadge = (r) => h("span", { class: `badge ${["paid", "completed"].includes(r.status) ? "ok" : r.status === "refunded" ? "bad" : ""}` },
    r.status === "pending" ? T.roster.committed : ["paid", "completed"].includes(r.status) ? T.roster.paid : T.meals.status[r.status]);
  return h("section", { class: "card" }, h("h2", {}, T.roster.title),
    h("p", { class: "muted" }, fill(T.roster.summary, { paid: paid.length, seats: session.seats }), " · ", `${T.roster.payout}: ${money(payout)}`),
    roster.length ? h("div", { class: "table-wrap" }, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, T.roster.name), h("th", { scope: "col" }, T.roster.status))),
      h("tbody", {}, roster.map((r) => h("tr", {}, h("td", {}, r.name || r.username || "—"), h("td", {}, statusBadge(r))))))) : h("p", { class: "muted" }, T.roster.empty));
}

async function sessionPage(id) {
  const session = await api.session(id);
  if (!session || session.host_id !== me.id) return h("p", {}, T.session.notFound);
  const [items, roster] = await Promise.all([api.groceries(id), api.roster(id)]);
  const locked = roster.some((r) => ["pending", "paid", "completed"].includes(r.status));
  const cancelled = session.status === "cancelled";
  const error = h("p", { class: "error", role: "alert" });
  const cancel = async () => {
    if (!confirm(T.session.cancelConfirm)) return;
    if (await attempt(async () => { await api.cancelSession(id); return true; }, error)) { toast(T.session.cancelledToast); location.hash = "#/host"; }
  };
  return [
    h("a", { class: "back-link", href: "#/host" }, `← ${T.common.back}`),
    h("div", { class: "head-row" }, h("h1", {}, session.title), cancelled && h("span", { class: "badge bad" }, T.session.cancelled)),
    h("p", { class: "muted" }, when(session.starts_at)),
    rosterPanel(session, roster), groceriesPanel(id, items),
    !cancelled && sessionForm(session.location_id, session, renderRoute, locked),
    !cancelled && h("button", { class: "btn danger", type: "button", onclick: cancel }, T.session.cancelSession), error,
  ];
}

// ---- settings ------------------------------------------------------------------
async function settingsPage() {
  const error = h("p", { class: "error", role: "alert" });
  const option = (role, desc) => h("label", { class: "role-option" },
    h("input", { type: "radio", name: "role", checked: me.role === role, onchange: async () => {
      if (await attempt(async () => { await api.setRole(role); return true; }, error)) {
        me.role = role; toast(T.settings.roleSaved); maybeTutorial(); renderRoute();
      }
    } }), h("span", {}, h("strong", {}, T.auth[role]), h("small", { class: "muted" }, desc)));
  return [h("h1", {}, T.settings.title),
    h("section", { class: "card" }, h("h2", {}, T.settings.account), h("p", {}, me.name, " ", h("span", { class: "muted" }, `@${me.username}`)), me.email && h("p", { class: "muted" }, me.email)),
    h("section", { class: "card", "data-tut": "role" }, h("h2", {}, T.settings.role), option("member", T.auth.memberDesc), option("host", T.auth.hostDesc), error),
    h("div", { class: "button-row" },
      h("button", { class: "btn outline", type: "button", onclick: () => runTutorial() }, T.settings.tutorial),
      h("button", { class: "btn outline", type: "button", onclick: async () => { await api.signOut(); location.href = loginUrl; } }, T.settings.signOut)),
  ];
}

// ---- approvals -------------------------------------------------------------------
async function adminPage() {
  if (!me.isAdmin) return h("p", {}, T.errors.not_allowed);
  const pending = await api.pendingLocations();
  const card = (l) => {
    const note = h("input", { maxlength: 500 });
    const error = h("p", { class: "error", role: "alert" });
    const decide = async (approve) => {
      if (await attempt(async () => { await api.reviewLocation(l.id, approve, note.value.trim()); return true; }, error)) { toast(approve ? T.admin.approved : T.admin.rejected); renderRoute(); }
    };
    return h("article", { class: "card" }, h("h2", {}, l.name), h("p", { class: "muted" }, `${T.admin.submittedBy} ${l.host_name || "—"}`), h("p", {}, l.address),
      l.description && h("p", { class: "pre" }, l.description), l.directions && h("p", { class: "muted pre" }, l.directions), field(T.admin.notePrompt, note),
      h("div", { class: "button-row" }, h("button", { class: "btn", type: "button", onclick: () => decide(true) }, T.admin.approve), h("button", { class: "btn outline", type: "button", onclick: () => decide(false) }, T.admin.reject)), error);
  };
  return [h("h1", {}, T.admin.title), pending.length ? pending.map(card) : h("p", { class: "muted" }, T.admin.empty)];
}

// ---- tutorials: walk through the real pages, one highlighted part at a time -------
let tutorialOn = false;
function runTutorial() {
  const steps = T.tutorial[me.role];
  let i = 0;
  tutorialOn = true;
  const shade = h("div", { class: "tut-shade" });
  const card = h("div", { class: "tut-card", role: "dialog", "aria-modal": "true" });
  document.body.append(shade, card);
  let focused = null;
  const unfocus = () => { focused?.classList.remove("tut-focus"); focused = null; };
  const finish = async () => {
    tutorialOn = false; unfocus(); shade.remove(); card.remove();
    window.removeEventListener("merkats:rendered", show);
    if (!me.tutorialsSeen.includes(me.role)) { me.tutorialsSeen.push(me.role); attempt(() => api.markTutorialSeen(me.role)); }
  };
  function show() {
    const step = steps[i];
    unfocus();
    focused = document.querySelector(`[data-tut="${step.target}"]`);
    if (focused) { focused.classList.add("tut-focus"); focused.scrollIntoView({ block: "center", behavior: "smooth" }); }
    const nextBtn = h("button", { class: "btn", type: "button", onclick: () => { if (i === steps.length - 1) finish(); else go(i + 1); } }, i === steps.length - 1 ? T.common.done : T.common.next);
    card.replaceChildren(h("small", { class: "muted" }, fill(T.tutorial.step, { n: i + 1, total: steps.length })), h("h2", {}, step.title), h("p", {}, step.body),
      h("div", { class: "button-row" }, i > 0 && h("button", { class: "btn outline", type: "button", onclick: () => go(i - 1) }, T.common.back), nextBtn, h("button", { class: "link-btn", type: "button", onclick: finish }, T.common.skip)));
    nextBtn.focus();
  }
  function go(n) {
    i = n;
    const target = `#/${steps[i].route}`;
    if (location.hash === target) show(); else location.hash = target; // the rendered event calls show()
  }
  window.addEventListener("merkats:rendered", show);
  go(0);
}
function maybeTutorial() {
  if (!tutorialOn && !me.tutorialsSeen.includes(me.role)) setTimeout(runTutorial, 300);
}

// ---- start -------------------------------------------------------------------------
async function initApp() {
  root = document.getElementById("app");
  me = await api.me().catch((e) => { console.error(e); return null; });
  if (!me) { location.replace(loginUrl); return; }
  if (!location.hash) history.replaceState(null, "", me.role === "host" ? "#/host" : "#/map");

  const params = new URLSearchParams(location.search);
  if (params.get("checkout")) {
    const id = params.get("c");
    if (params.get("checkout") === "success" && id) { await attempt(() => api.syncCommitment(id)); toast(T.meals.paidToast); }
    else toast(T.meals.cancelledToast);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  addEventListener("hashchange", renderRoute);
  await renderRoute();
  maybeTutorial();
}

if (document.getElementById("signin")) initLogin();
if (document.getElementById("app")) initApp();
