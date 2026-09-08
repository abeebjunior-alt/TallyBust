import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const T = { ink: "#0A1220", paper: "#FFFFFF", cream: "#F5F7FB", blue: "#1E4FD6", blueSoft: "#3E6DEE", stamp: "#C1352E", slate: "#5B6472", slateLight: "#8A93A3", paperDim: "#E3E8F0", green: "#1F7A4B" };
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

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
const labelStyle = { ...mono, fontSize: 10.5, textTransform: "uppercase", color: T.slate, display: "block" };
const submitBtnStyle = { width: "100%", marginTop: 16, padding: "10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 };
const backLinkStyle = { textAlign: "center", fontSize: 11.5, color: T.slateLight, marginTop: 14, cursor: "pointer" };

function Logo() {
  return (
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
}

function Shell({ children }) {
  return (
    <div style={{ ...body, minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: 340, background: T.cream, borderRadius: 6, padding: 26, boxSizing: "border-box" }}>
        <Logo />
        {children}
      </div>
    </div>
  );
}

function RoleCard({ title, desc, onClick }) {
  return (
    <div onClick={onClick} style={{ padding: "14px 14px", borderRadius: 5, border: `1px solid ${T.paperDim}`, background: T.paper, cursor: "pointer" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T.slate, marginTop: 2 }}>{desc}</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Top-level gate: choose Owner/Admin or Staff, then the matching
   form. Owner/Admin authenticates with the real Supabase account
   (email + password) — that's what actually signs this device in.
   Staff never get their own Supabase account; once this device is
   signed in as the Owner, staff just identify themselves with a
   username + PIN checked against the business's own Staff list.
------------------------------------------------------------------*/
export default function Login({ hasSession, onOwnerAuthenticated, onStaffIdentified }) {
  const [role, setRole] = useState(null); // null | "admin" | "staff"

  if (role === "staff") {
    return (
      <Shell>
        {!hasSession ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>This device isn't set up yet</div>
            <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 18, lineHeight: 1.5 }}>
              Ask your Admin or Owner to sign in here first using the Owner / Admin option. Once they have, staff can log in on this device with just a username and PIN.
            </div>
            <div onClick={() => setRole(null)} style={backLinkStyle}>Back</div>
          </div>
        ) : (
          <StaffLoginForm onBack={() => setRole(null)} onStaffIdentified={onStaffIdentified} />
        )}
      </Shell>
    );
  }

  if (role === "admin") {
    return (
      <Shell>
        <AdminLoginForm onBack={() => setRole(null)} onOwnerAuthenticated={onOwnerAuthenticated} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ fontSize: 13, color: T.slate, marginBottom: 16 }}>
        {hasSession ? "Who's logging in?" : "Sign in to your TallyBust account."}
      </div>
      <RoleCard
        title="Owner / Admin"
        desc={hasSession ? "Continue with full access to this business" : "Sign in with your email and password"}
        onClick={() => (hasSession ? onOwnerAuthenticated() : setRole("admin"))}
      />
      <div style={{ height: 10 }} />
      <RoleCard
        title="Staff"
        desc="Cashier or Storekeeper — log in with a username and PIN"
        onClick={() => setRole("staff")}
      />
      {hasSession && (
        <div onClick={() => supabase.auth.signOut()} style={backLinkStyle}>Not your device? Sign out completely</div>
      )}
    </Shell>
  );
}

function StaffLoginForm({ onBack, onStaffIdentified }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: qErr } = await supabase.from("staff").select("*").ilike("name", username.trim());
    setLoading(false);
    if (qErr) { setError(qErr.message); return; }
    const match = (data || []).find((s) => s.pin === pin.trim());
    if (!match) { setError("Incorrect username or PIN"); return; }
    onStaffIdentified(match);
  };

  return (
    <form onSubmit={submit}>
      <label style={labelStyle}>Username</label>
      <input required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} placeholder="e.g. tolu" />

      <label style={{ ...labelStyle, marginTop: 10 }}>PIN</label>
      <input required inputMode="numeric" type="password" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }} style={{ ...inputStyle, letterSpacing: "0.3em" }} placeholder="\u2022\u2022\u2022\u2022" />

      {error && <div style={{ color: T.stamp, fontSize: 12, marginTop: 10 }}>{error}</div>}

      <button type="submit" disabled={loading} style={submitBtnStyle}>
        {loading ? "..." : "LOG IN"}
      </button>
      <div onClick={onBack} style={backLinkStyle}>Back</div>
    </form>
  );
}

function AdminLoginForm({ onBack, onOwnerAuthenticated }) {
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
      setLoading(false);
      if (error) { setError(error.message); return; }
      onOwnerAuthenticated();
    } else if (mode === "sign-up") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else setInfo("Account created. Check your email to confirm, then sign in.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setLoading(false);
      if (error) setError(error.message);
      else setInfo("Check your email for a link to reset your password.");
    }
  };

  return (
    <form onSubmit={submit}>
      <label style={labelStyle}>Email</label>
      <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

      {mode !== "forgot" && (
        <>
          <label style={{ ...labelStyle, marginTop: 10 }}>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </>
      )}

      {mode === "sign-in" && (
        <div onClick={() => { setMode("forgot"); setError(""); setInfo(""); }} style={{ textAlign: "right", fontSize: 11.5, color: T.blue, marginTop: 8, cursor: "pointer" }}>
          Forgot password?
        </div>
      )}

      {error && <div style={{ color: T.stamp, fontSize: 12, marginTop: 10 }}>{error}</div>}
      {info && <div style={{ color: T.green, fontSize: 12, marginTop: 10 }}>{info}</div>}

      <button type="submit" disabled={loading} style={submitBtnStyle}>
        {loading ? "..." : mode === "sign-in" ? "SIGN IN" : mode === "sign-up" ? "CREATE ACCOUNT" : "SEND RESET LINK"}
      </button>

      <div onClick={() => { setMode(mode === "sign-up" ? "sign-in" : mode === "forgot" ? "sign-in" : "sign-up"); setError(""); setInfo(""); }} style={{ textAlign: "center", fontSize: 12, color: T.slate, marginTop: 12, cursor: "pointer" }}>
        {mode === "sign-in" ? "No account yet? Create one" : mode === "sign-up" ? "Already have an account? Sign in" : "Back to sign in"}
      </div>
      <div onClick={onBack} style={backLinkStyle}>Back to role selection</div>
    </form>
  );
}
