import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { staffAuthEmail, staffAuthPassword, isPinAcceptable } from "./staffAuth";

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
      <span style={{ ...mono, fontWeight: 700, fontSize: 16, color: T.blueSoft }}>TallyBust</span>
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
   Every person — Owner or Staff — signs in with their own, real,
   independent Supabase Auth account. Staff never type an email or
   password anywhere: their Business Code + Username + PIN are turned
   into one behind the scenes (see staffAuth.js), so their own phone
   authenticates directly, with no dependency on any other device.
------------------------------------------------------------------*/
function FeatureRow({ title, desc }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${T.paperDim}` }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{title}</div>
      <div style={{ fontSize: 12, color: T.slate, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Public landing content for logged-out visitors — and for Google.
   Until now this route rendered nothing but a bare login card, so
   there was no actual text for a search engine (or a first-time
   visitor) to read. This is real, crawlable copy about what
   TallyBust does; the existing role-selection/login flow now sits
   one click away, behind "Get Started", instead of being the very
   first thing shown.
------------------------------------------------------------------*/
function LandingPage({ onGetStarted }) {
  return (
    <div style={{ ...body, minHeight: "100vh", background: T.ink }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px 56px", textAlign: "center" }}>
        <img src="/tallybust-logo.png" alt="TallyBust" style={{ height: 30, width: "auto", marginBottom: 22 }} />
        <h1 style={{ ...body, fontSize: 34, fontWeight: 700, color: T.paper, lineHeight: 1.25, margin: "18px 0 12px" }}>
          Scan Your Stock. Track Every Sale.<br />Know What Remains.
        </h1>
        <p style={{ fontSize: 15.5, color: "#B7C0D1", lineHeight: 1.6, maxWidth: 520, margin: "0 auto 28px" }}>
          TallyBust is a smart, scan-based inventory and stock management platform built for pharmacies, retail shops, supermarkets, medical stores, and warehouses across Nigeria. Use your phone's camera to scan a barcode or QR code and record Stock In, Stock Out, Stock Adjustments, Transfers, or a full Stock Count — in seconds.
        </p>
        <button onClick={onGetStarted} style={{ ...mono, fontSize: 13.5, fontWeight: 700, color: "#fff", background: T.blue, border: "none", borderRadius: 5, padding: "13px 28px", cursor: "pointer" }}>
          GET STARTED
        </button>
      </div>

      <div style={{ background: T.cream, borderRadius: "16px 16px 0 0", maxWidth: 900, margin: "0 auto", padding: "36px 28px 48px" }}>
        <h2 style={{ ...mono, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: T.slate, textAlign: "center", marginBottom: 20 }}>
          Built for real inventory work
        </h2>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <FeatureRow title="Scan-based stock tracking" desc="Record Stock In, Stock Out, Adjustments, Transfers, and full Stock Counts by scanning a barcode or QR code with your phone's camera." />
          <FeatureRow title="Auto-generated codes" desc="Products without an existing barcode get their own TallyBust code automatically, so every item can be scanned and tracked." />
          <FeatureRow title="Full audit trail" desc="Every stock movement is logged per product — date, activity, quantity, staff member, and running balance." />
          <FeatureRow title="Smart alerts" desc="Get notified about low stock, out-of-stock items, items expiring soon, and unusual sales patterns." />
          <FeatureRow title="Multi-business & multi-branch" desc="Manage several businesses or branches from one account, each with its own separate inventory and staff." />
          <FeatureRow title="Role-based staff access" desc="Admins, Managers, Cashiers, and Storekeepers each get their own independent login, scoped to what their role should see and do." />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [role, setRole] = useState(null); // null | "admin" | "staff"
  const [showAuth, setShowAuth] = useState(false);

  if (!showAuth) {
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if (role === "staff") {
    return (
      <Shell>
        <StaffLoginForm onBack={() => setRole(null)} />
      </Shell>
    );
  }

  if (role === "admin") {
    return (
      <Shell>
        <AdminLoginForm onBack={() => setRole(null)} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ fontSize: 13, color: T.slate, marginBottom: 16 }}>Sign in to TallyBust.</div>
      <RoleCard title="Owner / Admin" desc="Sign in with your email and password" onClick={() => setRole("admin")} />
      <div style={{ height: 10 }} />
      <RoleCard title="Staff" desc="Cashier or Storekeeper — log in with a Business Code, username, and PIN" onClick={() => setRole("staff")} />
      <div onClick={() => setShowAuth(false)} style={backLinkStyle}>← Back to homepage</div>
    </Shell>
  );
}

function StaffLoginForm({ onBack }) {
  const [businessCode, setBusinessCode] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isPinAcceptable(pin)) { setError("PIN must be 6 digits."); return; }
    setLoading(true);
    const email = staffAuthEmail(username, businessCode);
    const password = staffAuthPassword(pin);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInErr) { setError("Incorrect business code, username, or PIN."); return; }
    // A session now exists — App() picks it up automatically and shows
    // the right dashboard for this staff member.
  };

  return (
    <form onSubmit={submit}>
      <label style={labelStyle}>Business Code</label>
      <input required autoFocus value={businessCode} onChange={(e) => { setBusinessCode(e.target.value.toUpperCase()); setError(""); }} style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "0.1em" }} placeholder="e.g. K3F9QX" />

      <label style={{ ...labelStyle, marginTop: 10 }}>Username</label>
      <input required value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }} style={inputStyle} placeholder="e.g. tolu" />

      <label style={{ ...labelStyle, marginTop: 10 }}>PIN</label>
      <input required inputMode="numeric" type="password" minLength={6} maxLength={6} pattern="\d{6}" title="6-digit PIN" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} style={{ ...inputStyle, letterSpacing: "0.3em" }} placeholder="••••••" />

      {error && <div style={{ color: T.stamp, fontSize: 12, marginTop: 10 }}>{error}</div>}

      <button type="submit" disabled={loading} style={submitBtnStyle}>
        {loading ? "..." : "LOG IN"}
      </button>
      <div style={{ fontSize: 11, color: T.slateLight, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
        Ask your Admin/Owner for the Business Code — it's on their Staff page.
      </div>
      <div onClick={onBack} style={backLinkStyle}>Back</div>
    </form>
  );
}

function AdminLoginForm({ onBack }) {
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
      if (error) setError(error.message);
      // On success, App() picks up the new session automatically.
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
