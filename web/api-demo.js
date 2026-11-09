// Demo backend for looking at the site on localhost. Everything lives in this
// browser's localStorage, payments are simulated, and passwords aren't used.
const KEY = "merkats.demo.db";
const SESSION = "merkats.demo.session";
const id = () => crypto.randomUUID();
const inDays = (n, h = 18) => { const d = new Date(Date.now() + n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString(); };

function seed() {
  const users = [
    { id: "u-member", name: "Demo Member", username: "demo.member", email: "member@example.test", role: "member", tutorialsSeen: [], isAdmin: false },
    { id: "u-host", name: "Demo Host", username: "demo.host", email: "host@example.test", role: "host", tutorialsSeen: [], isAdmin: false },
    { id: "u-admin", name: "Demo Approver", username: "demo.admin", email: "admin@example.test", role: "member", tutorialsSeen: ["member"], isAdmin: true },
  ];
  const loc = (lid, host, name, area, lat, lng, description, status = "approved") => ({ id: lid, host_id: host, name, area, description, approx_lat: +lat.toFixed(2), approx_lng: +lng.toFixed(2), status, review_note: null, private: { address: `${name}, 100 Example St, Philadelphia, PA`, lat, lng, directions: "Ring the side-door bell." } });
  return {
    users,
    locations: [
      loc("l-fish", "u-host", "Fishtown Kitchen", "Fishtown, Philadelphia", 39.9712, -75.1346, "A bright shared kitchen with two ovens and room for eight."),
      loc("l-west", "u-other", "West Philly Table", "West Philadelphia", 39.9526, -75.2098, "A cozy home kitchen near the park."),
      loc("l-pend", "u-other", "Old City Loft", "Old City, Philadelphia", 39.9502, -75.1447, "A loft kitchen waiting for review.", "pending"),
    ],
    sessions: [
      { id: "s-1", location_id: "l-fish", host_id: "u-host", title: "Weeknight bowls", menu: "Chicken teriyaki, rice, roasted vegetables", starts_at: inDays(3), duration_minutes: 120, price_cents: 2200, seats: 6, status: "open" },
      { id: "s-2", location_id: "l-fish", host_id: "u-host", title: "Soup and bread", menu: "Tomato soup, lentil soup, focaccia", starts_at: inDays(8), duration_minutes: 150, price_cents: 1800, seats: 4, status: "open" },
      { id: "s-3", location_id: "l-west", host_id: "u-other", title: "Curry prep", menu: "Chickpea curry, basmati rice, raita", starts_at: inDays(5), duration_minutes: 120, price_cents: 2000, seats: 5, status: "open" },
    ],
    commitments: [{ id: "c-seed", session_id: "s-1", member_id: "u-seed", name: "Sam Rivera", username: "sam", status: "paid", amount_cents: 2200, fee_cents: 220, host_cents: 1980, paid_at: new Date().toISOString() }],
    groceries: [{ id: id(), session_id: "s-1", name: "Chicken thighs", quantity: "3 lb", estimated_cents: 1500, actual_cents: null, purchased: false }, { id: id(), session_id: "s-1", name: "Jasmine rice", quantity: "2 lb", estimated_cents: 500, actual_cents: 450, purchased: true }],
    payoutsReady: false,
  };
}
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch {} const d = seed(); localStorage.setItem(KEY, JSON.stringify(d)); return d; };
const write = (fn) => { const d = load(); const out = fn(d); localStorage.setItem(KEY, JSON.stringify(d)); return out; };
const fail = (code) => { throw new Error(code); };
const taken = (d, sid) => d.commitments.filter((c) => c.session_id === sid && ["pending", "paid", "completed"].includes(c.status)).length;
const withSeats = (d, list) => list.map((s) => ({ ...s, seats_taken: taken(d, s.id) }));
const current = () => { const d = load(); return d.users.find((u) => u.id === localStorage.getItem(SESSION)) || null; };

export function createDemoApi() {
  return {
    demo: true,
    hasSession: async () => !!current(),
    me: async () => current(),
    async signUp({ name, username, email, role }) {
      write((d) => {
        if (d.users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) fail("username_taken");
        if (d.users.some((u) => u.email === email.trim().toLowerCase())) fail("email_taken");
        const user = { id: id(), name: name.trim(), username: username.trim(), email: email.trim().toLowerCase(), role, tutorialsSeen: [], isAdmin: false };
        d.users.push(user);
        localStorage.setItem(SESSION, user.id);
      });
      return { needsConfirmation: false };
    },
    async signIn({ identifier }) {
      const q = identifier.trim().toLowerCase();
      const user = load().users.find((u) => u.username.toLowerCase() === q || u.email === q);
      if (!user) fail("no_account");
      localStorage.setItem(SESSION, user.id);
    },
    signOut: async () => localStorage.removeItem(SESSION),
    setRole: async (role) => write((d) => { d.users.find((u) => u.id === localStorage.getItem(SESSION)).role = role; }),
    markTutorialSeen: async (role) => write((d) => { const u = d.users.find((x) => x.id === localStorage.getItem(SESSION)); if (!u.tutorialsSeen.includes(role)) u.tutorialsSeen.push(role); }),

    approvedLocations: async () => load().locations.filter((l) => l.status === "approved"),
    myLocations: async (me) => load().locations.filter((l) => l.host_id === me.id),
    location: async (lid) => load().locations.find((l) => l.id === lid) || null,
    async locationAddress(lid) {
      const d = load(); const me = localStorage.getItem(SESSION); const l = d.locations.find((x) => x.id === lid);
      const paid = d.commitments.some((c) => c.member_id === me && c.status === "paid" && d.sessions.find((s) => s.id === c.session_id)?.location_id === lid);
      return l && (l.host_id === me || paid) ? { address: l.private.address, directions: l.private.directions } : null;
    },
    submitLocation: async (l) => write((d) => {
      const me = localStorage.getItem(SESSION);
      const row = { host_id: me, name: l.name, description: l.description, area: l.area, approx_lat: +l.lat.toFixed(2), approx_lng: +l.lng.toFixed(2), status: "pending", review_note: null, private: { address: l.address, lat: l.lat, lng: l.lng, directions: l.directions } };
      const found = l.id && d.locations.find((x) => x.id === l.id && x.host_id === me);
      if (found) Object.assign(found, row); else d.locations.push({ id: id(), ...row });
    }),
    searchAddress: async (input) => [1, 2, 3].map((n) => ({ placeId: `${input}|${n}`, main: `${n * 100} ${input}`, secondary: "Philadelphia, PA (demo)" })),
    addressDetails: async (placeId) => { const [input, n] = placeId.split("|"); return { placeId, address: `${n * 100} ${input}, Philadelphia, PA`, lat: 39.95 + n * 0.012, lng: -75.17 + n * 0.012, area: "Philadelphia, PA" }; },

    pendingLocations: async () => { const d = load(); return d.locations.filter((l) => l.status === "pending").map((l) => ({ ...l, address: l.private.address, directions: l.private.directions, host_name: d.users.find((u) => u.id === l.host_id)?.name || "Another host", submitted_at: new Date().toISOString() })); },
    reviewLocation: async (lid, approve, note) => write((d) => { const l = d.locations.find((x) => x.id === lid); l.status = approve ? "approved" : "rejected"; l.review_note = note || null; }),

    upcomingSessions: async (lid) => { const d = load(); return withSeats(d, d.sessions.filter((s) => s.location_id === lid && s.status === "open" && Date.parse(s.starts_at) > Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))); },
    locationSessions: async (lid) => { const d = load(); return withSeats(d, d.sessions.filter((s) => s.location_id === lid)); },
    session: async (sid) => load().sessions.find((s) => s.id === sid) || null,
    createSession: async (s) => write((d) => { const row = { id: id(), status: "open", ...s }; d.sessions.push(row); return row; }),
    updateSession: async (sid, patch) => write((d) => {
      const s = d.sessions.find((x) => x.id === sid);
      if (taken(d, sid) > 0 && ((patch.price_cents ?? s.price_cents) !== s.price_cents || (patch.starts_at && Date.parse(patch.starts_at) !== Date.parse(s.starts_at)))) fail("session_has_commitments");
      if (patch.seats !== undefined && patch.seats < taken(d, sid)) fail("seats_below_committed");
      Object.assign(s, patch);
    }),
    cancelSession: async (sid) => write((d) => { d.sessions.find((s) => s.id === sid).status = "cancelled"; d.commitments.filter((c) => c.session_id === sid && c.status === "paid").forEach((c) => { c.status = "refunded"; }); }),

    myCommitments: async (me) => { const d = load(); return d.commitments.filter((c) => c.member_id === me.id).map((c) => { const s = d.sessions.find((x) => x.id === c.session_id); return { ...c, session: { ...s, location: d.locations.find((l) => l.id === s.location_id) } }; }); },
    checkout: async (sid) => write((d) => {
      const me = d.users.find((u) => u.id === localStorage.getItem(SESSION)); const s = d.sessions.find((x) => x.id === sid);
      if (!s || s.status !== "open") fail("session_unavailable");
      if (s.host_id === me.id) fail("own_session");
      if (d.commitments.some((c) => c.session_id === sid && c.member_id === me.id && c.status === "paid")) fail("already_committed");
      if (taken(d, sid) >= s.seats) fail("session_full");
      const fee = Math.round(s.price_cents * 0.1);
      d.commitments.push({ id: id(), session_id: sid, member_id: me.id, name: me.name, username: me.username, status: "paid", amount_cents: s.price_cents, fee_cents: fee, host_cents: s.price_cents - fee, paid_at: new Date().toISOString() });
      return { demoPaid: true };
    }),
    syncCommitment: async () => ({ status: "paid" }),
    leaveSession: async (cid) => write((d) => { d.commitments.find((c) => c.id === cid).status = "refunded"; }),

    roster: async (sid) => load().commitments.filter((c) => c.session_id === sid).map((c) => ({ commitment_id: c.id, name: c.name, username: c.username, status: c.status, amount_cents: c.amount_cents, paid_at: c.paid_at })),
    groceries: async (sid) => load().groceries.filter((g) => g.session_id === sid),
    addGrocery: async (g) => write((d) => { const row = { id: id(), actual_cents: null, purchased: false, ...g }; d.groceries.push(row); return row; }),
    updateGrocery: async (gid, patch) => write((d) => { Object.assign(d.groceries.find((g) => g.id === gid), patch); }),
    removeGrocery: async (gid) => write((d) => { d.groceries = d.groceries.filter((g) => g.id !== gid); }),

    payoutStatus: async () => ({ ready: load().payoutsReady }),
    payoutSetup: async () => { write((d) => { d.payoutsReady = true; }); return { demoReady: true }; },
    payoutDashboard: async () => ({ demoReady: true }),
  };
}
