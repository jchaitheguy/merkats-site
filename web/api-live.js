// The real backend: Supabase plus the `sessions` and `host-payouts` Edge Functions.
import { createClient } from "@supabase/supabase-js";

const KNOWN = /(username_taken|email_taken|session_full|session_closed|session_unavailable|already_committed|own_session|host_not_ready|too_late_to_cancel|cannot_cancel|not_a_host|not_allowed|session_has_commitments|seats_below_committed)/;
const codeOf = (error) => KNOWN.exec(error?.message || "")?.[1] || "try_again";
const unwrap = async (query) => {
  const { data, error } = await query;
  if (error) { console.error(error); throw new Error(codeOf(error)); }
  return data;
};

export function createLiveApi({ url, anonKey }) {
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  const invoke = async (name, body) => {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      throw new Error(detail?.error && KNOWN.test(detail.error) ? detail.error : "try_again");
    }
    return data;
  };

  // Accounts need a role row, a username link and the profile row the app reads.
  // Runs at each login because confirming an email can happen long after sign-up.
  async function ensureProfile(user) {
    const meta = user.user_metadata || {};
    const [account] = await unwrap(sb.rpc("ensure_account", { p_role: meta.role === "host" ? "host" : "member" }));
    const key = `users:${user.id}`;
    let profile = (await unwrap(sb.from("kv").select("value").eq("key", key).maybeSingle()))?.value;
    if (!profile && meta.username) {
      await sb.rpc("register_username", { p_username: meta.username, p_email: user.email });
      profile = { id: user.id, name: meta.name || meta.username, username: meta.username, email: null, password: null, avatar: null, photo: null, bio: "", allergies: [], funFacts: [], createdAt: Date.now() };
      await unwrap(sb.from("kv").upsert({ key, value: profile }, { onConflict: "key" }));
    }
    return { id: user.id, email: user.email, name: profile?.name || meta.name || "", username: profile?.username || meta.username || "", role: account.role, tutorialsSeen: account.tutorials_seen || [], isAdmin: !!account.is_admin };
  }

  const withAvailability = async (locationId, sessions) => {
    const rows = await unwrap(sb.rpc("session_availability", { p_location: locationId }));
    const taken = Object.fromEntries((rows || []).map((r) => [r.session_id, r.seats_taken]));
    return sessions.map((s) => ({ ...s, seats_taken: taken[s.id] || 0 }));
  };

  return {
    demo: false,
    async hasSession() { return !!(await sb.auth.getSession()).data.session; },
    async me() {
      const { data } = await sb.auth.getSession();
      return data.session ? ensureProfile(data.session.user) : null;
    },
    async signUp({ name, username, email, password, role, redirectTo }) {
      const handle = username.trim();
      if (await unwrap(sb.rpc("username_taken", { p_username: handle }))) throw new Error("username_taken");
      if (await unwrap(sb.rpc("email_taken", { p_email: email.trim() }))) throw new Error("email_taken");
      const { data, error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: redirectTo, data: { name: name.trim(), username: handle, role } } });
      if (error) throw new Error(/weak|short/i.test(error.message) ? "weak_password" : "try_again");
      if (!data.session) return { needsConfirmation: true };
      await ensureProfile(data.user);
      return { needsConfirmation: false };
    },
    async signIn({ identifier, password }) {
      let email = identifier.trim();
      if (!email.includes("@")) {
        email = await unwrap(sb.rpc("email_for_username", { p_username: email }));
        if (!email) throw new Error("no_account");
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/confirm/i.test(error.message) ? "email_unconfirmed" : "bad_login");
    },
    signOut: () => sb.auth.signOut(),
    setRole: (role) => unwrap(sb.rpc("set_my_role", { p_role: role })),
    markTutorialSeen: (role) => unwrap(sb.rpc("mark_tutorial_seen", { p_role: role })),

    approvedLocations: () => unwrap(sb.from("host_locations").select("id,name,description,area,approx_lat,approx_lng").eq("status", "approved").order("name")),
    myLocations: (me) => unwrap(sb.from("host_locations").select("*").eq("host_id", me.id).order("submitted_at")),
    location: (id) => unwrap(sb.from("host_locations").select("*").eq("id", id).maybeSingle()),
    async locationAddress(id) { return (await unwrap(sb.rpc("location_address", { p_id: id })))?.[0] || null; },
    submitLocation: (l) => unwrap(sb.rpc("submit_location", { p_name: l.name, p_description: l.description, p_area: l.area, p_address: l.address, p_lat: l.lat, p_lng: l.lng, p_place_id: l.placeId || null, p_directions: l.directions, p_id: l.id || null })),
    async searchAddress(input, token) {
      const res = await invoke("places", { action: "autocomplete", input, sessionToken: token });
      return res.suggestions || [];
    },
    async addressDetails(placeId, token) { return (await invoke("places", { action: "details", placeId, sessionToken: token })).place; },

    pendingLocations: () => unwrap(sb.rpc("pending_locations")),
    reviewLocation: (id, approve, note) => unwrap(sb.rpc("review_location", { p_id: id, p_approve: approve, p_note: note || null })),

    async upcomingSessions(locationId) {
      const rows = await unwrap(sb.from("meal_sessions").select("*").eq("location_id", locationId).eq("status", "open").gt("starts_at", new Date().toISOString()).order("starts_at"));
      return withAvailability(locationId, rows);
    },
    async locationSessions(locationId) {
      return withAvailability(locationId, await unwrap(sb.from("meal_sessions").select("*").eq("location_id", locationId).order("starts_at", { ascending: false })));
    },
    session: (id) => unwrap(sb.from("meal_sessions").select("*").eq("id", id).maybeSingle()),
    createSession: (s) => unwrap(sb.from("meal_sessions").insert(s).select().single()),
    updateSession: (id, patch) => unwrap(sb.from("meal_sessions").update(patch).eq("id", id)),
    cancelSession: (id) => invoke("sessions", { action: "cancelSession", sessionId: id }),

    myCommitments: (me) => unwrap(sb.from("commitments").select("*, session:meal_sessions(*, location:host_locations(id,name,area))").eq("member_id", me.id).order("created_at", { ascending: false })),
    checkout: (sessionId, returnPath) => invoke("sessions", { action: "checkout", sessionId, returnPath }),
    syncCommitment: (id) => invoke("sessions", { action: "sync", commitmentId: id }),
    leaveSession: (id) => invoke("sessions", { action: "cancel", commitmentId: id }),

    roster: (sessionId) => unwrap(sb.rpc("session_roster", { p_session: sessionId })),
    groceries: (sessionId) => unwrap(sb.from("grocery_items").select("*").eq("session_id", sessionId).order("created_at")),
    addGrocery: (item) => unwrap(sb.from("grocery_items").insert(item).select().single()),
    updateGrocery: (id, patch) => unwrap(sb.from("grocery_items").update(patch).eq("id", id)),
    removeGrocery: (id) => unwrap(sb.from("grocery_items").delete().eq("id", id)),

    async payoutStatus() { return (await invoke("host-payouts", { action: "status" })).status; },
    payoutSetup: (returnUrl) => invoke("host-payouts", { action: "onboard", returnUrl }),
    payoutDashboard: () => invoke("host-payouts", { action: "dashboard" }),
  };
}
