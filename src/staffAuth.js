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

const WEAK_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999", "123456", "654321",
]);

// The ONLY entropy in a staff login is the PIN — the prefix/suffix here
// are constants shipped in the JS bundle, so anyone can see them. A short
// PIN is therefore brute-forceable against Supabase's signInWithPassword
// once an attacker knows (or guesses) the business code + username. We
// require a full 6-digit PIN (1,000,000 possibilities) and block a short
// list of trivially-guessable ones. This is a floor, not a real defense —
// the actual defense against brute force has to live server-side (rate
// limiting / lockout on repeated failed sign-ins), see SECURITY-REVIEW.md.
export function isPinAcceptable(pin) {
  const p = (pin || "").trim();
  if (!/^\d{6}$/.test(p)) return false;
  if (WEAK_PINS.has(p)) return false;
  return true;
}

export function staffAuthPassword(pin) {
  const p = (pin || "").trim();
  if (!isPinAcceptable(p)) {
    throw new Error("PIN must be 6 digits and not an obviously weak pattern.");
  }
  return `tb-staff-${p}-key`;
}
