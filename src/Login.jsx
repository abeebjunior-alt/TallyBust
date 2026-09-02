import React, { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";

const T = { ink: "#0A1220", paper: "#FFFFFF", cream: "#F5F7FB", blue: "#1E4FD6", blueSoft: "#3E6DEE", stamp: "#C1352E", green: "#1F7A4B", slate: "#5B6472", paperDim: "#E3E8F0" };
const ROLE_DISPLAY = { Cashier: "Cashier / Sales Agent" };
const roleLabel = (r) => ROLE_DISPLAY[r] || r;
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

const Fonts = () => (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </>
);

const Logo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
    <svg width="20" height="24" viewBox="0 0 26 30">
      <line x1="4" y1="4" x2="4" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="9" y1="4" x2="9" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="14" y1="4" x2="14" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="19" y1="4" x2="19" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="2" y1="26" x2="22" y2="4" stroke={T.blueSoft} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
    <span style={{ ...mono, fontWeight: 700, fontSize: 16 }}>TallyBust</span>
  </div>
);

const inputStyle = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 4,
  border: "1px solid #E3E8F0",
  background: T.paper,
  fontSize: 13,
  fontFamily: "'Work Sans', sans-serif",
  outline: "none",
  marginTop: 4,
  boxSizing: "border-box",
};

const pinInputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 4,
  border: `1px solid ${T.paperDim}`,
  background: T.paper,
  fontSize: 20,
  textAlign: "center",
  letterSpacing: "0.35em",
  boxSizing: "border-box",
  outline: "none",
  marginTop: 4,
};

/* ---------------------------------------------------------------
   Role tabs — shown at the top of the front page at all times, on
   every device, whether or not this device already has a session.
------------------------------------------------------------------*/
function RoleTabs({ role, setRole }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 18, border: `1px solid ${T.paperDim}`, borderRadius: 4, overflow: "hidden" }}>
      {["owner", "staff"].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRole(r)}
          style={{
            flex: 1, padding: "9px 6px", border: "none", cursor: "pointer",
            background: role === r ? T.ink : "transparent",
            color: role === r ? T.paper : T.slate,
            ...mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          }}
        >
          {r === "owner" ? "OWNER / ADMIN" : "STAFF"}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Owner / Admin email + password form (sign-in / sign-up / forgot)
------------------------------------------------------------------*/
function OwnerForm() {
  const [mode, setMode] = useState("sign-in"); // sign-in | sign-up | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else if (mode === "sign-up") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Account created. Check your email to confirm, then sign in.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) setError(error.message);
      else setInfo("Check your email for a link to reset your password.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={submit}>
      <label style={{ ...mono, fontSize: 10.5, textTransform: "uppercase", color: T.slate }}>Email</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

      {mode !== "forgot" && (
        <>
          <label style={{ ...mono, fontSize: 10.5, textTransform: "uppercase", color: T.slate, marginTop: 10, display: "block" }}>
            Password
          </label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </>
      )}

      {mode === "sign-in" && (
        <div
          onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}
          style={{ textAlign: "right", fontSize: 11.5, color: T.blue, marginTop: 8, cursor: "pointer" }}
        >
          Forgot password?
        </div>
      )}

      {error && <div style={{ color: T.stamp, fontSize: 12, marginTop: 10 }}>{error}</div>}
      {info && <div style={{ color: T.green, fontSize: 12, marginTop: 10 }}>{info}</div>}

      <button
        type="submit"
        disabled={loading}
        style={{ width: "100%", marginTop: 16, padding: "10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}
      >
        {loading ? "..." : mode === "sign-in" ? "SIGN IN" : mode === "sign-up" ? "CREATE ACCOUNT" : "SEND RESET LINK"}
      </button>

      <div
        onClick={() => { setMode(mode === "sign-up" ? "sign-in" : mode === "forgot" ? "sign-in" : "sign-up"); setError(""); setInfo(""); }}
        style={{ textAlign: "center", fontSize: 12, color: T.slate, marginTop: 12, cursor: "pointer" }}
      >
        {mode === "sign-in" ? "No account yet? Create one" : mode === "sign-up" ? "Already have an account? Sign in" : "Back to sign in"}
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------
   Staff explainer — shown on the STAFF tab when this device has
   never had an owner sign in yet, so there's no staff list to pick
   from.
------------------------------------------------------------------*/
function StaffNoSessionYet({ onBackToOwner }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: T.slate, lineHeight: 1.5 }}>
        Staff sign-in isn't set up on this device yet. Ask your business admin
        to sign in once under <strong>Owner / Admin</strong>, then add you as
        a team member from the Staff page. After that, your name will show up
        here for you to tap and sign in with your PIN.
      </div>
      <button
        type="button"
        onClick={onBackToOwner}
        style={{ width: "100%", marginTop: 16, padding: "10px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", color: T.ink, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}
      >
        CONTINUE AS OWNER / ADMIN
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   "Who's working?" picker — shown once a session exists on this
   device (an owner has signed in here before). Lets the Owner/Admin
   or any staff member unlock the app as themselves.
------------------------------------------------------------------*/
function WhoIsWorking({ userId, userEmail, initialRole, onUnlock }) {
  const [role, setRole] = useState(initialRole);
  const [staffList, setStaffList] = useState([]);
  const [adminPin, setAdminPin] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [pinTarget, setPinTarget] = useState(null); // { id, name, role, pin } or "owner"
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: staffRows, error: e1 }, { data: settingsRow, error: e2 }] = await Promise.all([
        supabase.from("staff").select("*").order("created_at"),
        supabase.from("settings").select("business_name, admin_pin").eq("user_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (e1 || e2) setLoadErr((e1 && e1.message) || (e2 && e2.message) || "Could not load this device's setup.");
      setStaffList(staffRows || []);
      setAdminPin(settingsRow?.admin_pin || null);
      setBusinessName(settingsRow?.business_name || "");
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const openOwnerTile = () => {
    if (adminPin) { setPinTarget("owner"); setPinValue(""); setPinError(""); }
    else onUnlock({ id: null, name: "Owner", role: "Admin" });
  };
  const openStaffTile = (s) => { setPinTarget(s); setPinValue(""); setPinError(""); };

  const submitPin = (e) => {
    e.preventDefault();
    if (pinTarget === "owner") {
      if (pinValue === adminPin) onUnlock({ id: null, name: "Owner", role: "Admin" });
      else setPinError("Incorrect PIN");
      return;
    }
    if (pinValue === pinTarget.pin) onUnlock({ id: pinTarget.id, name: pinTarget.name, role: pinTarget.role });
    else setPinError("Incorrect PIN");
  };

  return (
    <>
      <RoleTabs role={role} setRole={setRole} />

      {role === "owner" ? (
        <div>
          <div style={{ fontSize: 13, color: T.slate, marginBottom: 4 }}>
            {businessName ? <><strong style={{ color: T.ink }}>{businessName}</strong> — </> : null}
            signed in as <span style={{ ...mono, fontSize: 11.5 }}>{userEmail}</span>
          </div>
          <button
            type="button"
            onClick={openOwnerTile}
            style={{ width: "100%", marginTop: 12, padding: "13px", borderRadius: 4, border: "none", background: T.ink, color: T.paper, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>OWNER / ADMIN</span><span style={{ opacity: 0.6, fontWeight: 500 }}>{adminPin ? "PIN required" : "tap to continue"}</span>
          </button>
          {!adminPin && (
            <div style={{ fontSize: 11, color: T.slate, marginTop: 10 }}>
              Tip: set an Admin PIN from Settings so this device locks between visits.
            </div>
          )}
          <div
            onClick={() => supabase.auth.signOut()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11.5, color: T.slate, marginTop: 20, cursor: "pointer" }}
          >
            <LogOut size={12} /> Not your business? Sign out
          </div>
        </div>
      ) : (
        <div>
          {!loaded && <div style={{ fontSize: 12.5, color: T.slate }}>Loading team…</div>}
          {loadErr && <div style={{ color: T.stamp, fontSize: 12 }}>{loadErr}</div>}
          {loaded && staffList.length === 0 && (
            <div style={{ fontSize: 13, color: T.slate, lineHeight: 1.5 }}>
              No staff have been added yet. From <strong>Owner / Admin</strong>, sign in and add
              a username + PIN for each team member from the Staff page.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {staffList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openStaffTile(s)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ fontWeight: 600, fontSize: 13.5, color: T.ink }}>{s.name}</span>
                <span style={{ ...mono, fontSize: 10.5, color: T.slate, textTransform: "uppercase" }}>{roleLabel(s.role)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pinTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setPinTarget(null)} style={{ position: "absolute", inset: 0, background: "rgba(10,18,32,0.55)" }} />
          <form onSubmit={submitPin} style={{ position: "relative", width: 300, background: T.cream, borderRadius: 6, padding: 22, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              Enter {pinTarget === "owner" ? "Admin" : pinTarget.name + "'s"} PIN
            </div>
            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 14 }}>
              to sign in as {pinTarget === "owner" ? "Owner / Admin" : pinTarget.name}
            </div>
            <input autoFocus type="password" inputMode="numeric" maxLength={6} value={pinValue}
              onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, "")); setPinError(""); }} style={pinInputStyle} />
            {pinError && <div style={{ color: T.stamp, fontSize: 12, marginTop: 8 }}>{pinError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setPinTarget(null)} style={{ flex: 1, padding: "9px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5 }}>Cancel</button>
              <button type="submit" style={{ flex: 1, padding: "9px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>Confirm</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------
   Top-level front page. hasSession = this device already has a
   live Supabase session (an owner signed in here before) — in that
   case we show the "who's working" picker instead of the raw
   email/password form.
------------------------------------------------------------------*/
export default function Login({ hasSession, userId, userEmail, onUnlock }) {
  const [role, setRole] = useState("owner");

  return (
    <div style={{ ...body, minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Fonts />
      <div style={{ width: 320, background: T.cream, borderRadius: 6, padding: 26 }}>
        <Logo />
        {hasSession ? (
          <WhoIsWorking userId={userId} userEmail={userEmail} initialRole={role} onUnlock={onUnlock} />
        ) : (
          <>
            <RoleTabs role={role} setRole={setRole} />
            {role === "owner" ? <OwnerForm /> : <StaffNoSessionYet onBackToOwner={() => setRole("owner")} />}
          </>
        )}
      </div>
    </div>
  );
}
