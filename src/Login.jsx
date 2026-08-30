import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const T = { ink: "#0A1220", paper: "#FFFFFF", cream: "#F5F7FB", blue: "#1E4FD6", blueSoft: "#3E6DEE", stamp: "#C1352E", slate: "#5B6472" };
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

export default function Login() {
  const [mode, setMode] = useState("sign-in");
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
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Account created. Check your email to confirm, then sign in.");
    }
    setLoading(false);
  };

  return (
    <div style={{ ...body, minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <form onSubmit={submit} style={{ width: 320, background: T.cream, borderRadius: 6, padding: 26 }}>
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

        <label style={{ ...mono, fontSize: 10.5, textTransform: "uppercase", color: T.slate }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <label style={{ ...mono, fontSize: 10.5, textTransform: "uppercase", color: T.slate, marginTop: 10, display: "block" }}>
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <div style={{ color: T.stamp, fontSize: 12, marginTop: 10 }}>{error}</div>}
        {info && <div style={{ color: "#1F7A4B", fontSize: 12, marginTop: 10 }}>{info}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", marginTop: 16, padding: "10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}
        >
          {loading ? "..." : mode === "sign-in" ? "SIGN IN" : "CREATE ACCOUNT"}
        </button>

        <div
          onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setInfo(""); }}
          style={{ textAlign: "center", fontSize: 12, color: T.slate, marginTop: 12, cursor: "pointer" }}
        >
          {mode === "sign-in" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </div>
      </form>
    </div>
  );
}

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
