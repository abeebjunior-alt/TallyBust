// Staff members don't type an email/password anywhere in the UI — they
// only ever see a Business Code + Username + PIN. Behind the scenes each
// one still gets a REAL, independent Supabase Auth account (so their own
// phone can sign in on its own, with no dependency on the Owner's device
// or session) built deterministically from those three values. Nothing
// here is secret math — the security is the same as any password: you
// still need the exact business code + username + PIN to reconstruct it.

const STAFF_EMAIL_DOMAIN = "staff.tallybust.app";

function clean(value) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function staffAuthEmail(username, businessCode) {
  const u = clean(username) || "user";
  const c = clean(businessCode) || "shop";
  return `${u}.${c}@${STAFF_EMAIL_DOMAIN}`;
}

export function staffAuthPassword(pin) {
  const p = (pin || "").trim();
  // Padded so even a 4-digit PIN clears Supabase's 6-character minimum.
  return `tb-staff-${p}-key`;
}
