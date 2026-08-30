import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ShieldCheck, LogOut, Save, RefreshCw, Search } from "lucide-react";
import { supabase } from "./supabaseClient";

const TRIAL_DAYS = 60;

function subscriptionState(row) {
  const today = new Date();
  if (row.subscription_status === "active" && row.subscription_expires_at) {
    const expires = new Date(row.subscription_expires_at);
    if (expires >= today) return { label: "Active", detail: `until ${row.subscription_expires_at}`, tone: "ok" };
    return { label: "Expired", detail: `subscription ended ${row.subscription_expires_at}`, tone: "bad" };
  }
  const start = new Date(row.trial_start_date || row.updated_at || today);
  const daysUsed = Math.floor((today - start) / 86400000);
  const daysLeft = TRIAL_DAYS - daysUsed;
  if (daysLeft > 0) return { label: "Trial", detail: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, tone: daysLeft <= 7 ? "warn" : "ok" };
  return { label: "Expired", detail: "trial ended", tone: "bad" };
}

export default function AdminDashboard({ T, mono, body, adminEmail, onExitAdmin }) {
  const [businesses, setBusinesses] = useState([]);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState({ renewal_message: "", payment_instructions: "" });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState(null); // user_id currently being edited
  const [editExpiry, setEditExpiry] = useState("");

  const fireToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: settingsRows }, { data: prodRows }, { data: histRows }, { data: configRow }] = await Promise.all([
      supabase.from("settings").select("*").order("updated_at", { ascending: false }),
      supabase.from("products").select("id,user_id"),
      supabase.from("stock_history").select("user_id,created_at").order("created_at", { ascending: false }),
      supabase.from("app_config").select("*").eq("id", 1).maybeSingle(),
    ]);
    setBusinesses(settingsRows || []);
    setProducts(prodRows || []);
    setHistory(histRows || []);
    if (configRow) setConfig(configRow);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const productCount = useMemo(() => {
    const m = {};
    products.forEach((p) => { m[p.user_id] = (m[p.user_id] || 0) + 1; });
    return m;
  }, [products]);

  const lastActivity = useMemo(() => {
    const m = {};
    history.forEach((h) => { if (!m[h.user_id]) m[h.user_id] = h.created_at; });
    return m;
  }, [history]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) => (b.business_name || "").toLowerCase().includes(q) || (b.owner_email || "").toLowerCase().includes(q));
  }, [businesses, search]);

  const saveConfig = async () => {
    const { error } = await supabase.from("app_config").update({
      renewal_message: config.renewal_message,
      payment_instructions: config.payment_instructions,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    fireToast(error ? `Could not save: ${error.message}` : "Renewal message saved");
  };

  const startEdit = (row) => { setEditing(row.user_id); setEditExpiry(row.subscription_expires_at || ""); };

  const markActive = async (row) => {
    if (!editExpiry) { fireToast("Pick an expiry date first"); return; }
    const { error } = await supabase.from("settings").update({ subscription_status: "active", subscription_expires_at: editExpiry }).eq("user_id", row.user_id);
    if (error) { fireToast(`Failed: ${error.message}`); return; }
    fireToast(`${row.business_name} marked active until ${editExpiry}`);
    setEditing(null);
    loadAll();
  };

  const markExpired = async (row) => {
    const { error } = await supabase.from("settings").update({ subscription_status: "expired" }).eq("user_id", row.user_id);
    if (error) { fireToast(`Failed: ${error.message}`); return; }
    fireToast(`${row.business_name} marked expired`);
    setEditing(null);
    loadAll();
  };

  const resetToTrial = async (row) => {
    const { error } = await supabase.from("settings").update({ subscription_status: "trial", subscription_expires_at: null }).eq("user_id", row.user_id);
    if (error) { fireToast(`Failed: ${error.message}`); return; }
    fireToast(`${row.business_name} reset to trial`);
    setEditing(null);
    loadAll();
  };

  const badgeColor = (tone) => (tone === "ok" ? T.green : tone === "warn" ? T.amber : T.stamp);

  return (
    <div style={{ ...body, minHeight: "100vh", background: T.paper, color: T.ink }}>
      <div style={{ background: T.ink, color: T.cream, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={18} />
          <div>
            <div style={{ ...mono, fontWeight: 700, fontSize: 14 }}>TallyBust — Admin Dashboard</div>
            <div style={{ fontSize: 11, color: T.slateLight }}>{adminEmail}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: `1px solid ${T.slateLight}`, background: "transparent", color: T.cream, cursor: "pointer", fontSize: 12 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={onExitAdmin} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: "none", background: T.paper, color: T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <LogOut size={13} /> Exit admin view
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 20px 60px" }}>
        {loading ? (
          <div style={{ ...mono, color: T.slate, padding: "40px 0" }}>Loading businesses…</div>
        ) : (
          <>
            <div style={{ background: T.cream, borderRadius: 6, padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate, marginBottom: 10 }}>
                Renewal message shown to expired businesses
              </div>
              <textarea
                value={config.renewal_message}
                onChange={(e) => setConfig({ ...config, renewal_message: e.target.value })}
                rows={2}
                style={{ width: "100%", padding: "9px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 13, ...body, outline: "none", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
              />
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate, marginBottom: 10 }}>
                How to pay
              </div>
              <textarea
                value={config.payment_instructions}
                onChange={(e) => setConfig({ ...config, payment_instructions: e.target.value })}
                rows={3}
                style={{ width: "100%", padding: "9px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 13, ...body, outline: "none", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
              />
              <button onClick={saveConfig} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12 }}>
                <Save size={13} /> SAVE
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.cream, borderRadius: 4, padding: "8px 10px", marginBottom: 14, maxWidth: 320 }}>
              <Search size={14} color={T.slate} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search businesses..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1, ...body }} />
            </div>

            <div style={{ ...mono, fontSize: 11, color: T.slate, marginBottom: 8 }}>{filtered.length} business{filtered.length === 1 ? "" : "es"}</div>

            <div style={{ background: T.cream, borderRadius: 6, overflow: "hidden" }}>
              {filtered.length === 0 && <div style={{ padding: 20, fontSize: 13, color: T.slateLight }}>No businesses yet.</div>}
              {filtered.map((row) => {
                const state = subscriptionState(row);
                const last = lastActivity[row.user_id];
                return (
                  <div key={row.user_id} style={{ padding: "14px 16px", borderBottom: `1px solid ${T.paperDim}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{row.business_name || "Unnamed business"}</div>
                        <div style={{ fontSize: 11.5, color: T.slate }}>{row.owner_email || "—"}</div>
                        <div style={{ fontSize: 11.5, color: T.slateLight, marginTop: 3 }}>
                          {productCount[row.user_id] || 0} products · last activity {last ? new Date(last).toLocaleDateString() : "never"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 20, background: badgeColor(state.tone), color: T.cream, fontSize: 11, fontWeight: 700, ...mono }}>
                          {state.label}
                        </span>
                        <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{state.detail}</div>
                      </div>
                    </div>

                    {editing === row.user_id ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                        <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} style={{ padding: "7px 9px", borderRadius: 4, border: `1px solid ${T.paperDim}`, fontSize: 12.5, ...body }} />
                        <button onClick={() => markActive(row)} style={{ padding: "7px 12px", borderRadius: 4, border: "none", background: T.green, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Mark active until this date</button>
                        <button onClick={() => markExpired(row)} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.stamp}`, background: "transparent", color: T.stamp, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Mark expired</button>
                        <button onClick={() => resetToTrial(row)} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Reset to trial</button>
                        <button onClick={() => setEditing(null)} style={{ padding: "7px 12px", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", fontSize: 11.5, color: T.slate }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(row)} style={{ marginTop: 10, padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>
                        Manage subscription
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.ink, color: T.cream, padding: "10px 18px", borderRadius: 4, ...mono, fontSize: 12.5, boxShadow: "0 6px 20px rgba(0,0,0,0.3)", zIndex: 60 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
