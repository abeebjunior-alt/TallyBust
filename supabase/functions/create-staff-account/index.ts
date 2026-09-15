// supabase/functions/create-staff-account/index.ts
//
// Replaces the browser calling supabaseStaffAuth.auth.signUp() directly.
// That public endpoint let anyone (not just the business Owner) attempt to
// register a staff@business.staff.tallybust.app address ahead of time —
// this function closes that off by:
//   1. Verifying the caller's own JWT (they must already be signed in).
//   2. Deriving which business they belong to from THAT identity — never
//      from anything the client sends — so no one can add staff to a
//      business they don't own.
//   3. Requiring the caller to be that business's Owner or an Admin-role
//      staff member.
//   4. Creating the auth user via the service-role admin API
//      (auth.admin.createUser) instead of the public signUp() endpoint —
//      immediately confirmed, and never silently returns an
//      already-registered (possibly attacker-controlled) account.
//
// Deploy with: supabase functions deploy create-staff-account
// Required secrets (Project Settings → Edge Functions, or via CLI):
//   supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
// (SUPABASE_URL and the anon/service keys are usually already present as
// default project secrets — check before re-setting them.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STAFF_EMAIL_DOMAIN = "staff.tallybust.app";
const WEAK_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999", "123456", "654321",
]);
const ALLOWED_ROLES = ["Manager", "Cashier", "Storekeeper"]; // never "Admin" via this path

function clean(value: string) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function staffEmail(username: string, businessCode: string) {
  return `${clean(username) || "user"}.${clean(businessCode) || "shop"}@${STAFF_EMAIL_DOMAIN}`;
}
function staffPassword(pin: string) {
  return `tb-staff-${pin}-key`;
}
function isPinAcceptable(pin: string) {
  return /^\d{6}$/.test(pin) && !WEAK_PINS.has(pin);
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: { mode?: string; name?: string; pin?: string; role?: string; staffId?: string | number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { mode = "create", name, pin, role, staffId } = payload;

  if (!pin || !isPinAcceptable(pin)) {
    return json({ error: "PIN must be 6 digits and not an obvious pattern." }, 400);
  }
  if (mode === "create") {
    if (!name || !name.trim()) return json({ error: "Name is required." }, 400);
    if (!role || !ALLOWED_ROLES.includes(role)) return json({ error: "Invalid role." }, 400);
  }
  if (mode === "setup_login" && !staffId) {
    return json({ error: "Missing staffId." }, 400);
  }

  // Identify the caller from their own JWT — this is the ONLY source of
  // truth for who they are. We never trust a business/staff id the client
  // might send for this purpose.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller) return json({ error: "Not authenticated." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Work out which business the caller belongs to, and whether they're
  // allowed to manage staff for it — same rule the RLS policies use
  // (owner, or a staff row with role='Admin').
  const { data: callerStaffRow } = await admin
    .from("staff")
    .select("user_id, role")
    .eq("auth_user_id", caller.id)
    .maybeSingle();

  const businessId = callerStaffRow ? callerStaffRow.user_id : caller.id;
  const callerIsAdmin = !callerStaffRow || callerStaffRow.role === "Admin";
  if (!callerIsAdmin) return json({ error: "Not authorized to manage staff." }, 403);

  const { data: settingsRow } = await admin
    .from("settings")
    .select("business_code")
    .eq("user_id", businessId)
    .maybeSingle();
  if (!settingsRow?.business_code) {
    return json({ error: "This business isn't fully set up yet — try again shortly." }, 400);
  }

  const email = staffEmail(name ?? "", settingsRow.business_code);
  const password = staffPassword(pin);

  if (mode === "setup_login") {
    const { data: staffRow } = await admin
      .from("staff")
      .select("id, user_id")
      .eq("id", staffId)
      .maybeSingle();
    if (!staffRow || staffRow.user_id !== businessId) {
      return json({ error: "Staff member not found." }, 404);
    }

    const staffEmailForRow = staffEmail(staffRow.id === staffId ? (payload.name ?? "") : "", settingsRow.business_code);
    // The real email must be derived from the staff row's own name, not
    // whatever the client happened to send — fetch it explicitly.
    const { data: fullStaffRow } = await admin.from("staff").select("name").eq("id", staffId).maybeSingle();
    const realEmail = staffEmail(fullStaffRow?.name ?? "", settingsRow.business_code);

    const { data: userData, error: createErr } = await admin.auth.admin.createUser({
      email: realEmail,
      password,
      email_confirm: true,
    });
    if (createErr) return json({ error: createErr.message }, 400);

    await admin.from("staff").update({ auth_user_id: userData.user!.id }).eq("id", staffId);
    await admin.rpc("staff_set_pin", { p_staff_id: staffId, p_pin: pin });
    return json({ ok: true });
  }

  // mode === "create": brand-new staff member
  const { data: existing } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", businessId)
    .ilike("name", name!.trim())
    .maybeSingle();
  if (existing) return json({ error: "That username is already taken." }, 409);

  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return json({ error: createErr.message }, 400);

  const { error: insertErr } = await admin.from("staff").insert({
    user_id: businessId,
    auth_user_id: userData.user!.id,
    name: name!.trim(),
    role,
    pin, // the DB trigger hashes this into pin_hash and discards the plaintext
  });
  if (insertErr) {
    // Roll back the auth user so we don't leave an orphaned account behind.
    await admin.auth.admin.deleteUser(userData.user!.id);
    return json({ error: insertErr.message }, 400);
  }

  return json({ ok: true });
});
