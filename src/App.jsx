import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, ScanLine, Package, Receipt, BarChart3, Users, Settings as SettingsIcon,
  Search, AlertTriangle, Download, X, Check, ChevronRight, Shuffle, ArrowUpCircle,
  ArrowDownCircle, RotateCcw, Plus, LogOut, Camera, List, Tag, AlertCircle,
  CheckSquare, Square, Boxes, Minus,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import CameraScanner from "./CameraScanner";
import Labels from "./Labels";
import AdminDashboard from "./AdminDashboard";

// Brand palette: blue / white / black. Red, green, and amber are kept
// as semantic status colors only (critical / positive / warning) — not
// used for branding elements.
const T = {
  ink: "#0A1220", inkSoft: "#152238", paper: "#FFFFFF", paperDim: "#E3E8F0",
  blue: "#1E4FD6", blueSoft: "#3E6DEE",
  stamp: "#C1352E", stampSoft: "#D9695F", green: "#1F7A4B", greenSoft: "#4FA872",
  amber: "#B9822A", slate: "#5B6472", slateLight: "#8D96A6", cream: "#F5F7FB",
};
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

const RESPONSIVE_CSS = `
  * { box-sizing: border-box; }
  .tb-nav-list { display: contents; }
  .tb-nav-overlay { display: none; }
  @media (max-width: 760px) {
    .tb-shell { flex-direction: column; }
    .tb-sidebar {
      width: 100% !important; flex-direction: row !important; align-items: center;
      padding: 8px 10px !important; gap: 6px !important;
      position: sticky; top: 0; z-index: 30;
    }
    .tb-logo { padding: 0 8px 0 0 !important; flex-shrink: 0; cursor: pointer; }
    .tb-nav-overlay { display: block; position: fixed; inset: 0; z-index: 34; }
    .tb-nav-list {
      display: none; position: fixed; top: 52px; left: 0; right: 0; z-index: 35;
      flex-direction: column; background: #0A1220; padding: 8px; gap: 2px;
      max-height: calc(100vh - 52px); overflow-y: auto; box-shadow: 0 10px 24px rgba(0,0,0,0.35);
    }
    .tb-nav-list.open { display: flex; }
    .tb-nav-list .tb-nav-btn { flex-direction: row !important; gap: 10px !important; padding: 12px 14px !important; font-size: 13px !important; width: 100%; justify-content: flex-start; }
    .tb-sidebar-foot { margin-top: 0 !important; border-top: none !important; padding-top: 0 !important; display: flex !important; flex-direction: row !important; align-items: center; flex-shrink: 0; margin-left: auto; gap: 6px; }
    .tb-sidebar-foot button { width: auto !important; padding: 8px !important; }
    .tb-user-email { display: none !important; }
    .tb-signout-label { display: none; }
    .tb-content { padding-bottom: 24px; }
    .tb-content > div { padding: 16px 14px 40px !important; }
    .tb-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .tb-panel-grid { grid-template-columns: 1fr !important; }
    .tb-page-header { flex-direction: column; align-items: flex-start !important; gap: 10px; }
    .tb-scan-btns { width: 100%; }
    .tb-scan-btns > button { flex: 1; justify-content: center; }
    .tb-table-scroll { overflow-x: auto; }
    .tb-table-scroll > div { min-width: 680px; }
  }
`;
const CATEGORIES = ["Medicine", "Supermarket", "Beverages", "Electronics", "Cosmetics", "Other"];
const ROLES = [
  { role: "Admin", access: "Full access — every module" },
  { role: "Manager", access: "Inventory, Labels, Sales, Reports (no scanning)" },
  { role: "Cashier", access: "Dashboard (Stock Out / Refund) & Sales" },
  { role: "Storekeeper", access: "Dashboard (Stock In / Refund) & Inventory / Labels" },
];
// Display-only label. The underlying role value stays "Cashier" everywhere
// (staff table, access-control lookups, DB check constraint) — only what's
// shown on screen changes, so nothing about role matching/permissions breaks.
const roleDisplay = (role) => (role === "Cashier" ? "Cashier/Sales Agent" : role);
const ROLE_TABS = {
  Admin: ["dashboard", "inventory", "labels", "sales", "reports", "staff", "settings"],
  Manager: ["dashboard", "inventory", "labels", "sales", "reports"],
  Cashier: ["dashboard", "sales"],
  Storekeeper: ["dashboard", "inventory", "labels"],
};
const ROLE_SCAN_ACTIONS = {
  Admin: ["stock-in", "sale", "refund"],
  Manager: [],
  Cashier: ["sale", "refund"],
  Storekeeper: ["stock-in", "refund"],
};
const OWNER_STAFF = { id: null, name: "Owner", role: "Admin" };
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const todayStr = iso(today);

function productStatus(p) {
  if (p.qty === 0) return "critical";
  if (p.qty <= p.min_stock) return "low";
  return "ok";
}

function SubscriptionExpired({ config, businessName, userId, onSignOut }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  const loadReceipts = () => {
    supabase.from("payment_receipts").select("*").eq("user_id", userId).order("submitted_at", { ascending: false })
      .then(({ data }) => { setReceipts(data || []); setLoading(false); });
  };
  useEffect(() => { loadReceipts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const maxW = 700;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setPreview(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!preview) return;
    setSubmitting(true);
    const { error } = await supabase.from("payment_receipts").insert({ user_id: userId, image: preview, note: note || null });
    setSubmitting(false);
    if (error) { setToast(`Could not submit: ${error.message}`); return; }
    setToast("Receipt submitted — we'll verify it and activate your account.");
    setPreview(null); setNote("");
    loadReceipts();
  };

  const pending = receipts.find((r) => r.status === "pending");

  return (
    <div style={{ ...body, minHeight: "100vh", background: T.ink, color: T.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 420, width: "100%", background: T.cream, color: T.ink, borderRadius: 8, padding: "28px 26px" }}>
        <div style={{ textAlign: "center" }}>
          <svg width="26" height="30" viewBox="0 0 26 30" style={{ margin: "0 auto 14px" }}>
            <line x1="4" y1="4" x2="4" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="9" y1="4" x2="9" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="14" y1="4" x2="14" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="19" y1="4" x2="19" y2="26" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="2" y1="26" x2="22" y2="4" stroke={T.blue} strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.stamp, fontWeight: 700, marginBottom: 8 }}>
            Subscription needed
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{businessName || "Your business"}'s access is on hold</div>
          <div style={{ fontSize: 13.5, color: T.slate, lineHeight: 1.5, marginBottom: 18 }}>
            {config.renewal_message || "Your trial has ended. Renew your subscription to keep using TallyBust."}
          </div>
          <div style={{ background: T.paper, borderRadius: 6, padding: "14px 16px", textAlign: "left", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 20 }}>
            {config.payment_instructions || "Contact us to renew your subscription."}
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${T.blue}`, paddingTop: 18, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Receipt size={16} color={T.blue} />
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
              Already paid? Upload your receipt here
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.slate, marginBottom: 12 }}>
            Upload a photo or screenshot of your payment so we can confirm it and reactivate your account.
          </div>

          {pending ? (
            <div style={{ background: T.paper, borderRadius: 6, padding: "12px 14px", fontSize: 12.5, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <img src={pending.image} alt="Submitted receipt" style={{ width: 44, height: 44, borderRadius: 4, objectFit: "cover" }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Receipt submitted</div>
                  <div style={{ color: T.amber }}>Awaiting verification — this can take a little while.</div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={submit}>
              {preview ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <img src={preview} alt="Receipt preview" style={{ width: 60, height: 60, borderRadius: 4, objectFit: "cover" }} />
                  <button type="button" onClick={() => setPreview(null)} style={{ fontSize: 11.5, color: T.stamp, background: "transparent", border: "none", cursor: "pointer" }}>Remove</button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: "22px 16px", borderRadius: 6, border: `2px dashed ${T.blue}`, background: "#EEF2FE", cursor: "pointer", fontSize: 13, color: T.blue, fontWeight: 700, marginBottom: 10 }}>
                  <Camera size={22} color={T.blue} />
                  <span>Tap to upload your payment receipt</span>
                  <span style={{ fontSize: 11, color: T.slate, fontWeight: 500 }}>Photo or screenshot — JPG, PNG</span>
                  <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
                </label>
              )}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. transaction ID"
                style={{ width: "100%", padding: "9px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 13, ...body, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
              <button type="submit" disabled={!preview || submitting} style={{ width: "100%", padding: "10px", borderRadius: 4, border: "none", background: preview ? T.blue : T.paperDim, color: "#fff", fontWeight: 700, cursor: preview ? "pointer" : "not-allowed", ...mono, fontSize: 12.5 }}>
                {submitting ? "SUBMITTING..." : "SUBMIT RECEIPT"}
              </button>
            </form>
          )}

          {receipts.filter((r) => r.status !== "pending").length > 0 && (
            <div style={{ marginTop: 14 }}>
              {receipts.filter((r) => r.status !== "pending").slice(0, 3).map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.slate, padding: "5px 0" }}>
                  <span>{new Date(r.submitted_at).toLocaleDateString()}</span>
                  <span style={{ color: r.status === "approved" ? "#1F7A4B" : T.stamp, fontWeight: 600, textTransform: "capitalize" }}>{r.status}</span>
                </div>
              ))}
            </div>
          )}

          {toast && <div style={{ fontSize: 12, color: "#1F7A4B", marginTop: 10 }}>{toast}</div>}
        </div>

        <button onClick={onSignOut} style={{ width: "100%", marginTop: 18, padding: "10px 18px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", color: T.slate, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...mono }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

function subscriptionState(settings) {
  const TRIAL_DAYS = 60; // 2 months free trial
  const now = new Date();
  if (settings.subscription_status === "expired") {
    return { active: false, trial: false, daysLeft: 0 };
  }
  if (settings.subscription_status === "active" && settings.subscription_expires_at) {
    const expires = new Date(settings.subscription_expires_at);
    if (expires >= now) return { active: true, trial: false, daysLeft: Math.ceil((expires - now) / 86400000) };
    return { active: false, trial: false, daysLeft: 0 };
  }
  const start = new Date(settings.trial_start_date || todayStr);
  const daysUsed = Math.floor((now - start) / 86400000);
  const daysLeft = TRIAL_DAYS - daysUsed;
  return { active: daysLeft > 0, trial: true, daysLeft };
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [authEvent, setAuthEvent] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => { setSession(s); setAuthEvent(event); });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Splash />;
  if (authEvent === "PASSWORD_RECOVERY") return <ResetPassword onDone={() => setAuthEvent(null)} />;
  if (!session) return <Login />;
  return <TallyBust userId={session.user.id} userEmail={session.user.email} />;
}

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <div style={{ ...body, minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ width: 320, background: T.cream, borderRadius: 6, padding: 26 }}>
        <div style={{ ...mono, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Set a new password</div>
        {done ? (
          <>
            <div style={{ fontSize: 13, color: "#1F7A4B", marginBottom: 14 }}>Password updated. Continue to your dashboard.</div>
            <button onClick={onDone} type="button" style={{ width: "100%", padding: "10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}>CONTINUE</button>
          </>
        ) : (
          <>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 4, border: "1px solid #E3E8F0", background: T.paper, fontSize: 13, ...body, outline: "none", boxSizing: "border-box" }} />
            {error && <div style={{ color: T.stamp, fontSize: 12, marginTop: 10 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 14, padding: "10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}>
              {loading ? "..." : "UPDATE PASSWORD"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function Splash() {
  return <div style={{ background: T.ink, minHeight: "100vh", color: T.paper, ...mono, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>;
}

/* --------------------------------------------------------------- */

function TallyBust({ userId, userEmail }) {
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({ business_name: "My Business", currency: "\u20a6" });
  const [appConfig, setAppConfig] = useState({ renewal_message: "", payment_instructions: "" });
  const [adminView, setAdminView] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeStaff, setActiveStaff] = useState(OWNER_STAFF);
  const [staffList, setStaffList] = useState([]);

  const [refunds, setRefunds] = useState([]);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState("stock-in");
  const [scanProductId, setScanProductId] = useState("");
  const [scanQty, setScanQty] = useState("");
  const [scanReason, setScanReason] = useState("");
  const [scanSearch, setScanSearch] = useState("");
  const [scanCameraStage, setScanCameraStage] = useState("off"); // off | scanning
  const [scanMissCode, setScanMissCode] = useState("");
  const [scanOutOfStock, setScanOutOfStock] = useState(null);
  const [scanCameraError, setScanCameraError] = useState("");
  const [addInitialSku, setAddInitialSku] = useState("");

  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("All");
  const [historyProduct, setHistoryProduct] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const [unitSaleOpen, setUnitSaleOpen] = useState(false);
  const [unitSaleProductId, setUnitSaleProductId] = useState("");
  const [unitSaleQty, setUnitSaleQty] = useState("");
  const [unitSaleSearch, setUnitSaleSearch] = useState("");

  const [toast, setToast] = useState(null);
  const fireToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prod, error: e1 }, { data: hist, error: e2 }, { data: settingsRow, error: e3 }, { data: configRow }, { data: staffRows }, { data: refundRows }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("stock_history").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("app_config").select("*").eq("id", 1).maybeSingle(),
      supabase.from("staff").select("*").order("created_at"),
      supabase.from("refunds").select("*").order("requested_at", { ascending: false }).limit(300),
    ]);
    if (e1) fireToast(`Error loading products: ${e1.message}`);
    if (e2) fireToast(`Error loading history: ${e2.message}`);
    if (!settingsRow && !e3) {
      const fresh = { user_id: userId, owner_email: userEmail };
      await supabase.from("settings").insert(fresh);
      setSettings({ business_name: "My Business", currency: "\u20a6", owner_email: userEmail, trial_start_date: todayStr, subscription_status: "trial", is_admin: false });
    } else if (settingsRow) {
      setSettings(settingsRow);
      if (!settingsRow.owner_email && userEmail) {
        supabase.from("settings").update({ owner_email: userEmail }).eq("user_id", userId);
      }
    }
    if (configRow) setAppConfig(configRow);

    // Soft-deleted products older than the 3-day grace window get purged
    // for real here — lazily, whenever data is loaded, since there's no
    // background job. Anyone opening the app periodically keeps this tidy.
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const all = prod || [];
    const stale = all.filter((p) => p.deleted_at && Date.now() - new Date(p.deleted_at).getTime() > THREE_DAYS_MS);
    if (stale.length > 0) {
      await Promise.all(stale.map((p) => supabase.from("products").delete().eq("id", p.id)));
    }
    const staleIds = new Set(stale.map((p) => p.id));
    setAllProducts(all.filter((p) => !staleIds.has(p.id)));
    setHistory(hist || []);
    setStaffList(staffRows || []);
    setRefunds(refundRows || []);
    setLoading(false);
  }, [userId, userEmail, fireToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ---------- derived metrics ---------- */
  const todayHistory = useMemo(() => history.filter((h) => h.occurred_on === todayStr), [history]);
  const itemsSoldToday = useMemo(() => todayHistory.filter((h) => h.type === "sale").reduce((s, h) => s + h.qty, 0), [todayHistory]);
  const stockAddedToday = useMemo(() => todayHistory.filter((h) => h.type === "stock-in" || h.type === "refund").reduce((s, h) => s + h.qty, 0), [todayHistory]);
  const pendingRefunds = useMemo(() => refunds.filter((r) => r.status === "pending"), [refunds]);
  const unitsSoldToday = useMemo(() => todayHistory.filter((h) => h.type === "unit-sale").reduce((s, h) => s + h.qty, 0), [todayHistory]);
  const todaysSales = useMemo(() => todayHistory.filter((h) => h.type === "sale" || h.type === "unit-sale").reduce((s, h) => s + h.qty * Number(h.unit_price), 0), [todayHistory]);
  const products = useMemo(() => allProducts.filter((p) => !p.deleted_at), [allProducts]);
  const deletedProducts = useMemo(() => allProducts.filter((p) => p.deleted_at), [allProducts]);

  const inventoryValue = useMemo(() => products.reduce((s, p) => s + p.qty * Number(p.purchase_price), 0), [products]);
  const totalStockUnits = useMemo(() => products.reduce((s, p) => s + p.qty, 0), [products]);
  const lowStock = useMemo(() => products.filter((p) => productStatus(p) === "low"), [products]);
  const outOfStock = useMemo(() => products.filter((p) => productStatus(p) === "critical"), [products]);
  const expiringSoon = useMemo(() => products.filter((p) => {
    if (!p.expiry) return false;
    const days = Math.round((new Date(p.expiry) - today) / 86400000);
    return days <= 30 && days >= 0;
  }), [products]);

  const bestSellers = useMemo(() => {
    const totals = {};
    history.filter((h) => h.type === "sale").forEach((h) => { totals[h.product_id] = (totals[h.product_id] || 0) + h.qty; });
    return Object.entries(totals)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
      .filter((x) => x.product).sort((a, b) => b.qty - a.qty).slice(0, 4);
  }, [history, products]);

  const weeklyChart = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dStr = iso(d);
      const dayRows = history.filter((h) => h.occurred_on === dStr);
      const inQty = dayRows.filter((h) => h.type === "stock-in" || h.type === "refund").reduce((s, h) => s + h.qty, 0);
      const outQty = dayRows.filter((h) => h.type === "sale").reduce((s, h) => s + h.qty, 0);
      const label = i === 0 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 3);
      out.push({ label, in: inQty, out: outQty });
    }
    return out;
  }, [history]);

  const filteredProducts = useMemo(() => products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(invSearch.toLowerCase()) || p.sku.toLowerCase().includes(invSearch.toLowerCase());
    const matchesCategory = invCategory === "All" || p.category === invCategory;
    return matchesSearch && matchesCategory;
  }), [products, invSearch, invCategory]);

  const scanCandidates = useMemo(() => {
    if (!scanSearch) return products;
    return products.filter((p) => p.name.toLowerCase().includes(scanSearch.toLowerCase()) || p.sku.toLowerCase().includes(scanSearch.toLowerCase()));
  }, [products, scanSearch]);

  const scanProduct = products.find((p) => p.id === scanProductId) || null;

  const unitSaleItems = useMemo(() => products.filter((p) => p.unit_sale_enabled), [products]);
  const unitSaleCandidates = useMemo(() => {
    if (!unitSaleSearch) return unitSaleItems;
    return unitSaleItems.filter((p) => p.name.toLowerCase().includes(unitSaleSearch.toLowerCase()) || p.sku.toLowerCase().includes(unitSaleSearch.toLowerCase()));
  }, [unitSaleItems, unitSaleSearch]);
  const unitSaleProduct = unitSaleItems.find((p) => p.id === unitSaleProductId) || null;

  /* ---------- actions ---------- */
  const allowedTabs = ROLE_TABS[activeStaff.role] || ["dashboard"];
  const allowedScans = ROLE_SCAN_ACTIONS[activeStaff.role] || [];

  const switchStaff = (member) => {
    setActiveStaff(member);
    const tabs = ROLE_TABS[member.role] || ["dashboard"];
    if (!tabs.includes(tab)) setTab(tabs[0]);
  };

  const addStaffMember = async (form) => {
    const { error } = await supabase.from("staff").insert({ user_id: userId, ...form });
    if (error) { fireToast(`Could not add team member: ${error.message}`); return; }
    fireToast(`Added ${form.name}`);
    loadAll();
  };

  const deleteStaffMember = async (member) => {
    const { error } = await supabase.from("staff").delete().eq("id", member.id);
    if (error) { fireToast(`Could not remove: ${error.message}`); return; }
    if (activeStaff.id === member.id) setActiveStaff(OWNER_STAFF);
    fireToast(`Removed ${member.name}`);
    loadAll();
  };

  const openScan = (mode) => {
    if (!allowedScans.includes(mode)) return;
    setScanMode(mode); setScanProductId(""); setScanQty(""); setScanReason(""); setScanSearch("");
    setScanMissCode(""); setScanCameraError(""); setScanOutOfStock(null);
    // Stock In / Stock Out are camera-only. Refund still allows manual search/selection.
    setScanCameraStage(mode === "refund" ? "off" : "scanning");
    setScanOpen(true);
  };
  const randomScan = () => { const pick = products[Math.floor(Math.random() * products.length)]; if (pick) setScanProductId(pick.id); setScanSearch(""); };

  const handleDetectedCode = (rawCode) => {
    const code = rawCode.trim();
    const match = products.find((p) => p.sku.trim().toLowerCase() === code.toLowerCase());
    setScanCameraStage("off");
    if (match) {
      if (scanMode === "sale" && match.qty <= 0) {
        setScanMissCode("");
        setScanOutOfStock(match);
        setScanProductId("");
      } else {
        setScanMissCode("");
        setScanOutOfStock(null);
        setScanProductId(match.id);
      }
    } else {
      setScanOutOfStock(null);
      setScanMissCode(code);
    }
  };

  const rescan = () => {
    setScanOutOfStock(null); setScanMissCode(""); setScanCameraError("");
    setScanCameraStage("scanning");
  };

  const switchScanMode = (newMode) => {
    if (!allowedScans.includes(newMode)) return;
    setScanMode(newMode);
    setScanProductId(""); setScanQty(""); setScanReason(""); setScanSearch("");
    setScanMissCode(""); setScanOutOfStock(null); setScanCameraError("");
    setScanCameraStage(newMode === "refund" ? "off" : "scanning");
  };

  const addNewFromMissedCode = () => {
    setAddInitialSku(scanMissCode);
    setScanOpen(false);
    setAddOpen(true);
  };

  const confirmScan = async () => {
    if (!scanProduct || !scanQty || Number(scanQty) < 0) return;
    if (scanMode === "sale" && scanProduct.qty <= 0) { setScanOutOfStock(scanProduct); setScanProductId(""); return; }
    const n = Number(scanQty);

    // Refunds are recorded on their own — they don't touch stock or the
    // ledger until an Admin reviews and accepts them (see approveRefund).
    if (scanMode === "refund") {
      const { error } = await supabase.from("refunds").insert({
        user_id: userId,
        product_id: scanProduct.id,
        product_name: scanProduct.name,
        qty: n,
        reason: scanReason.trim() || null,
        staff: activeStaff.name,
      });
      if (error) { fireToast(`Save failed: ${error.message}`); return; }
      fireToast(`Refund logged for ${n} \u00d7 ${scanProduct.name} \u2014 awaiting Admin confirmation`);
      setScanOpen(false);
      loadAll();
      return;
    }

    let newQty = scanProduct.qty;
    if (scanMode === "stock-in") newQty = scanProduct.qty + n;
    if (scanMode === "sale") newQty = Math.max(0, scanProduct.qty - n);

    const { error: e1 } = await supabase.from("products").update({ qty: newQty }).eq("id", scanProduct.id);
    const { error: e2 } = await supabase.from("stock_history").insert({
      user_id: userId,
      product_id: scanProduct.id,
      product_name: scanProduct.name,
      type: scanMode,
      qty: n,
      unit_price: scanMode === "sale" ? scanProduct.selling_price : scanProduct.purchase_price,
      staff: activeStaff.name,
      occurred_on: todayStr,
    });
    if (e1 || e2) { fireToast(`Save failed: ${(e1 || e2).message}`); return; }

    fireToast(scanMode === "stock-in" ? `Stocked in ${n} \u00d7 ${scanProduct.name}` : `Sold ${n} \u00d7 ${scanProduct.name}`);
    setScanOpen(false);
    loadAll();
  };

  // Admin reviews a pending refund: accepting adds the quantity back to
  // stock and logs it in the ledger as its own "refund" event; rejecting
  // just closes it out with nothing added back.
  const approveRefund = async (refund) => {
    const product = allProducts.find((p) => p.id === refund.product_id);
    if (!product) { fireToast("That product no longer exists"); return; }
    const newQty = product.qty + refund.qty;
    const { error: e1 } = await supabase.from("products").update({ qty: newQty }).eq("id", product.id);
    const { error: e2 } = await supabase.from("stock_history").insert({
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      type: "refund",
      qty: refund.qty,
      unit_price: product.purchase_price,
      staff: activeStaff.name,
      occurred_on: todayStr,
    });
    const { error: e3 } = await supabase.from("refunds").update({ status: "approved", reviewed_by: activeStaff.name, reviewed_at: new Date().toISOString() }).eq("id", refund.id);
    const err = e1 || e2 || e3;
    if (err) { fireToast(`Failed: ${err.message}`); return; }
    fireToast(`Refund accepted \u2014 ${refund.qty} \u00d7 ${refund.product_name} added back to stock`);
    loadAll();
  };

  const rejectRefund = async (refund) => {
    const { error } = await supabase.from("refunds").update({ status: "rejected", reviewed_by: activeStaff.name, reviewed_at: new Date().toISOString() }).eq("id", refund.id);
    if (error) { fireToast(`Failed: ${error.message}`); return; }
    fireToast(`Refund for ${refund.product_name} rejected`);
    loadAll();
  };

  const openUnitSale = () => {
    setUnitSaleProductId(""); setUnitSaleQty(""); setUnitSaleSearch("");
    setUnitSaleOpen(true);
  };

  const confirmUnitSale = async () => {
    const product = unitSaleProduct;
    const perPack = Number(product && product.unit_qty_per_pack) || 0;
    if (!product || !unitSaleQty || Number(unitSaleQty) <= 0 || perPack <= 0) return;
    const wanted = Number(unitSaleQty);
    const totalAvailable = (product.loose_units || 0) + product.qty * perPack;
    if (wanted > totalAvailable) { fireToast(`Only ${totalAvailable} ${product.unit_name || "units"} left of ${product.name}`); return; }

    // Sell from the already-opened pack first; if that's not enough, open
    // as many whole packs as needed (each one adds unit_qty_per_pack loose
    // units and removes 1 from the pack count) before subtracting the sale.
    let looseUnits = product.loose_units || 0;
    let packQty = product.qty;
    if (wanted > looseUnits) {
      const packsToOpen = Math.ceil((wanted - looseUnits) / perPack);
      packQty -= packsToOpen;
      looseUnits += packsToOpen * perPack;
    }
    looseUnits -= wanted;

    const { error: e1 } = await supabase.from("products").update({ qty: packQty, loose_units: looseUnits }).eq("id", product.id);
    const { error: e2 } = await supabase.from("stock_history").insert({
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      type: "unit-sale",
      qty: wanted,
      unit_price: product.unit_price,
      staff: activeStaff.name,
      occurred_on: todayStr,
    });
    if (e1 || e2) { fireToast(`Save failed: ${(e1 || e2).message}`); return; }

    fireToast(`Sold ${wanted} ${product.unit_name || "unit"}${wanted === 1 ? "" : "s"} of ${product.name}`);
    setUnitSaleOpen(false);
    loadAll();
  };

  const addProduct = async (form) => {
    const { error } = await supabase.from("products").insert({ user_id: userId, ...form });
    if (error) { fireToast(`Could not add product: ${error.message}`); return; }
    fireToast(`Added ${form.name}`);
    setAddOpen(false);
    loadAll();
  };

  const deleteProduct = async (product) => {
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", product.id);
    if (error) { fireToast(`Could not delete: ${error.message}`); return; }
    fireToast(`${product.name} deleted — restorable for 3 days`);
    loadAll();
  };

  const restoreProduct = async (product) => {
    const { error } = await supabase.from("products").update({ deleted_at: null }).eq("id", product.id);
    if (error) { fireToast(`Could not restore: ${error.message}`); return; }
    fireToast(`${product.name} restored`);
    loadAll();
  };

  const exportCSV = () => {
    const header = ["Name", "SKU", "Category", "Qty", "Min Stock", "Purchase Price", "Selling Price", "Supplier", "Expiry"];
    const lines = products.map((p) => [p.name, p.sku, p.category, p.qty, p.min_stock, p.purchase_price, p.selling_price, p.supplier || "", p.expiry || ""].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tallybust-inventory.csv"; a.click();
    URL.revokeObjectURL(url);
    fireToast("Inventory report exported");
  };

  const saveSettings = async (next) => {
    setSettings(next);
    await supabase.from("settings").update(next).eq("user_id", userId);
  };

  const signOut = () => supabase.auth.signOut();

  const productHistory = useCallback((id) => history.filter((h) => h.product_id === id).slice(0, 12), [history]);

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "labels", label: "Labels", icon: Tag },
    { id: "sales", label: "Sales", icon: Receipt },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "staff", label: "Staff", icon: Users },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ].filter((n) => allowedTabs.includes(n.id));

  const currency = settings.currency || "\u20a6";
  const isAdmin = !!settings.is_admin;
  const subState = subscriptionState(settings);

  if (isAdmin && adminView) {
    return <AdminDashboard T={T} mono={mono} body={body} adminEmail={userEmail} onExitAdmin={() => setAdminView(false)} />;
  }

  if (!isAdmin && !subState.active) {
    return <SubscriptionExpired T={T} mono={mono} body={body} config={appConfig} businessName={settings.business_name} userId={userId} onSignOut={signOut} />;
  }

  return (
    <div style={{ ...body, background: T.ink, minHeight: "100vh", color: T.ink, display: "flex", flexDirection: "column", fontSize: 14 }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{RESPONSIVE_CSS}</style>

      {isAdmin && (
        <div onClick={() => setAdminView(true)} style={{ cursor: "pointer", background: T.blue, color: "#fff", textAlign: "center", padding: "6px 10px", fontSize: 11.5, ...mono }}>
          Admin account — viewing as a business. Tap to return to the Admin Dashboard.
        </div>
      )}
      {!isAdmin && subState.trial && subState.daysLeft <= 7 && (
        <div style={{ background: subState.daysLeft <= 3 ? T.stamp : T.amber, color: "#fff", textAlign: "center", padding: "7px 10px", fontSize: 12, ...body }}>
          {subState.daysLeft <= 0 ? "Your free trial ends today." : `Your free trial ends in ${subState.daysLeft} day${subState.daysLeft === 1 ? "" : "s"}.`} Renew from Settings to keep access.
        </div>
      )}

      <div className="tb-shell" style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div className="tb-sidebar" style={{ width: 190, flexShrink: 0, background: T.ink, color: T.paper, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="tb-logo" onClick={() => setMobileNavOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 22px" }}>
          <svg width="22" height="26" viewBox="0 0 26 30">
            <line x1="4" y1="4" x2="4" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="9" y1="4" x2="9" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="14" y1="4" x2="14" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="19" y1="4" x2="19" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="2" y1="26" x2="22" y2="4" stroke={T.blueSoft} strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <div style={{ ...mono, fontWeight: 700, fontSize: 15 }}>TallyBust</div>
        </div>

        {mobileNavOpen && <div className="tb-nav-overlay" onClick={() => setMobileNavOpen(false)} />}

        <div className={`tb-nav-list${mobileNavOpen ? " open" : ""}`}>
          {NAV.map((n) => {
            const Icon = n.icon; const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => { setTab(n.id); setMobileNavOpen(false); }} className="tb-nav-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 4, border: "none", background: active ? T.paper : "transparent", color: active ? T.ink : T.slateLight, cursor: "pointer", fontSize: 13, ...body, fontWeight: active ? 600 : 500, textAlign: "left" }}>
                <Icon size={15} /> {n.label}
              </button>
            );
          })}
        </div>

        <div className="tb-sidebar-foot" style={{ marginTop: "auto", paddingTop: 18, borderTop: `1px solid ${T.inkSoft}` }}>
          {allowedScans.length > 0 && (
            <button onClick={() => openScan(allowedScans[0])} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontWeight: 700, ...mono, fontSize: 12.5 }}>
              <ScanLine size={16} /> SCAN
            </button>
          )}
          {allowedScans.includes("sale") && unitSaleItems.length > 0 && (
            <button onClick={openUnitSale} style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 10px", borderRadius: 4, border: `1px solid ${T.blueSoft}`, background: "transparent", color: T.paper, cursor: "pointer", fontWeight: 700, ...mono, fontSize: 12 }}>
              <Boxes size={15} /> SELL UNITS
            </button>
          )}
          <div className="tb-user-email" style={{ ...mono, fontSize: 9.5, color: T.slateLight, marginTop: 10, textAlign: "center", wordBreak: "break-all" }}>{userEmail} · {activeStaff.name}</div>
          <button onClick={signOut} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "7px", borderRadius: 4, border: "none", background: "transparent", color: T.slateLight, cursor: "pointer", fontSize: 11 }}>
            <LogOut size={12} /> <span className="tb-signout-label">Sign out</span>
          </button>
        </div>
      </div>

      <div className="tb-content" style={{ flex: 1, background: T.paper, overflow: "auto" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "26px 30px 60px" }}>
          {loading ? (
            <div style={{ ...mono, color: T.slate, padding: "40px 0" }}>Loading your data…</div>
          ) : (
            <>
              {tab === "dashboard" && (
                <Dashboard settings={settings} itemsSoldToday={itemsSoldToday} stockAddedToday={stockAddedToday} todaysSales={todaysSales}
                  inventoryValue={inventoryValue} totalStockUnits={totalStockUnits} products={products} lowStock={lowStock} outOfStock={outOfStock}
                  expiringSoon={expiringSoon} bestSellers={bestSellers} weeklyChart={weeklyChart} currency={currency} onScan={openScan} allowedScans={allowedScans}
                  unitsSoldToday={unitsSoldToday} hasUnitSaleItems={unitSaleItems.length > 0} onSellUnits={openUnitSale}
                  canManageRefunds={activeStaff.role === "Admin"} pendingRefunds={pendingRefunds} onApproveRefund={approveRefund} onRejectRefund={rejectRefund}
                  onSelectProduct={(p) => { if (allowedTabs.includes("inventory")) { setTab("inventory"); setHistoryProduct(p); } }} />
              )}
              {tab === "inventory" && (
                <Inventory products={filteredProducts} history={history} search={invSearch} setSearch={setInvSearch} category={invCategory} setCategory={setInvCategory}
                  currency={currency} onExport={exportCSV} onOpenHistory={setHistoryProduct} />
              )}
              {tab === "labels" && <Labels products={products} businessName={settings.business_name} onAddProduct={() => setAddOpen(true)} />}
              {tab === "sales" && <Sales history={history} currency={currency} hasUnitSaleItems={unitSaleItems.length > 0} onSellUnits={openUnitSale} />}
              {tab === "reports" && <Reports products={products} history={history} currency={currency} inventoryValue={inventoryValue} onExport={exportCSV} />}
              {tab === "staff" && <Staff activeStaff={activeStaff} staffList={staffList} onSwitch={switchStaff} onAdd={addStaffMember} onDelete={deleteStaffMember} />}
              {tab === "settings" && <SettingsPane settings={settings} onSave={saveSettings} products={products} deletedProducts={deletedProducts} onDeleteProduct={deleteProduct} onRestoreProduct={restoreProduct} />}
            </>
          )}
        </div>
      </div>
      </div>

      {historyProduct && <HistoryDrawer product={historyProduct} rows={productHistory(historyProduct.id)} currency={currency} onClose={() => setHistoryProduct(null)} />}

      {scanOpen && (
        <ScanModal mode={scanMode} setMode={switchScanMode} candidates={scanCandidates} search={scanSearch} setSearch={setScanSearch}
          selected={scanProduct} setSelected={setScanProductId} qty={scanQty} setQty={setScanQty} reason={scanReason} setReason={setScanReason} onRandom={randomScan}
          onConfirm={confirmScan} onClose={() => setScanOpen(false)} currency={currency} allowedScans={allowedScans}
          cameraStage={scanCameraStage} setCameraStage={setScanCameraStage}
          missCode={scanMissCode} setMissCode={setScanMissCode} outOfStock={scanOutOfStock} onRescan={rescan}
          cameraError={scanCameraError} setCameraError={setScanCameraError} onDetected={handleDetectedCode} onAddNew={addNewFromMissedCode} />
      )}

      {addOpen && <AddProductModal onAdd={addProduct} initialSku={addInitialSku} currency={currency} onClose={() => { setAddOpen(false); setAddInitialSku(""); }} />}

      {unitSaleOpen && (
        <UnitSaleModal candidates={unitSaleCandidates} search={unitSaleSearch} setSearch={setUnitSaleSearch}
          selected={unitSaleProduct} setSelected={setUnitSaleProductId} qty={unitSaleQty} setQty={setUnitSaleQty}
          onConfirm={confirmUnitSale} onClose={() => setUnitSaleOpen(false)} currency={currency} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.ink, color: T.cream, padding: "10px 18px", borderRadius: 4, ...mono, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.3)", zIndex: 60 }}>
          <Check size={14} color={T.greenSoft} /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Presentational pieces (unchanged look & feel from the prototype)
------------------------------------------------------------------*/
function TallyGroup({ n }) {
  const strokes = Math.min(n, 5);
  return (
    <svg width="26" height="30" viewBox="0 0 26 30" style={{ display: "inline-block" }}>
      {Array.from({ length: strokes }).map((_, i) => (
        <line key={i} x1={4 + i * 5} y1={4} x2={4 + i * 5} y2={26} stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      {strokes === 5 && <line x1={2} y1={26} x2={22} y2={4} stroke={T.blue} strokeWidth="2.6" strokeLinecap="round" />}
    </svg>
  );
}
function TallyStrip({ count, label, accent }) {
  const capped = Math.min(count, 40);
  const groups = Math.ceil(capped / 5) || 0;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px", minHeight: 32 }}>
        {groups === 0 ? <span style={{ ...mono, color: T.slateLight, fontSize: 13 }}>no activity yet</span> :
          Array.from({ length: groups }).map((_, i) => <TallyGroup key={i} n={capped - i * 5} />)}
        {count > 40 && <span style={{ ...mono, color: accent, fontSize: 13, marginLeft: 6 }}>+{count - 40} more</span>}
      </div>
      <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", color: T.slate, marginTop: 4, textTransform: "uppercase" }}>{label} — {count}</div>
    </div>
  );
}
function StatStub({ label, value, accent }) {
  return (
    <div style={{ background: T.cream, borderRadius: 4, padding: "14px 16px", borderLeft: `3px solid ${accent || T.ink}` }}>
      <div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.1em", color: T.slate, textTransform: "uppercase" }}>{label}</div>
      <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 4, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
function StatusDot({ status }) {
  const color = status === "critical" ? T.stamp : status === "low" ? T.amber : T.green;
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6, flexShrink: 0 }} />;
}
function LedgerBars({ data }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.in, d.out)));
  const barW = 12, gap = 26, chartH = 120;
  return (
    <svg width={data.length * gap + 20} height={chartH + 30} style={{ maxWidth: "100%" }}>
      {data.map((d, i) => {
        const x = 14 + i * gap, inH = (d.in / max) * chartH, outH = (d.out / max) * chartH;
        return (
          <g key={i}>
            <rect x={x} y={chartH - inH + 4} width={barW} height={inH} fill={T.green} rx="1.5" />
            <rect x={x + barW + 2} y={chartH - outH + 4} width={barW} height={outH} fill={T.stamp} rx="1.5" />
            <text x={x + barW} y={chartH + 20} textAnchor="middle" style={{ ...mono, fontSize: 9, fill: T.slate }}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
function Panel({ title, icon: Icon, iconColor, children }) {
  return (
    <div style={{ background: T.cream, borderRadius: 4, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {Icon && <Icon size={14} color={iconColor} />}
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate }}>{title}</div>
      </div>
      {children}
    </div>
  );
}
function Legend({ color, label }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, background: color, borderRadius: 2, display: "inline-block" }} /><span style={{ fontSize: 11.5, color: T.slate }}>{label}</span></div>;
}
function Empty({ text }) { return <div style={{ ...body, fontSize: 12.5, color: T.slateLight, padding: "10px 0" }}>{text}</div>; }
function AlertRow({ p, status, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
      <div style={{ display: "flex", alignItems: "center" }}><StatusDot status={status} /><span style={{ fontSize: 13 }}>{p.name}</span></div>
      <span style={{ ...mono, fontSize: 12, color: status === "critical" ? T.stamp : T.amber }}>{p.qty} left</span>
    </div>
  );
}
function PageHeader({ title, sub, actions }) {
  return (
    <div className="tb-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
      <div><h1 style={{ ...body, fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>{sub && <div style={{ fontSize: 12.5, color: T.slate, marginTop: 2 }}>{sub}</div>}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {(actions || []).map((a) => (
          <button key={a.label} onClick={a.onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: `1px solid ${T.ink}`, background: a.solid ? T.ink : "transparent", color: a.solid ? T.cream : T.ink, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...body }}>
            <a.icon size={13} /> {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 13, ...body, outline: "none", boxSizing: "border-box" };
function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, marginBottom: 6 }}>{label}</div>{children}</div>;
}

/* ---------------------------------------------------------------
   Dashboard
------------------------------------------------------------------*/
function Dashboard({ settings, itemsSoldToday, stockAddedToday, todaysSales, inventoryValue, totalStockUnits, products, lowStock, outOfStock, expiringSoon, bestSellers, weeklyChart, currency, onScan, allowedScans, unitsSoldToday, hasUnitSaleItems, onSellUnits, canManageRefunds, pendingRefunds, onApproveRefund, onRejectRefund, onSelectProduct }) {
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const fmt = (n) => currency + n.toLocaleString();
  return (
    <div>
      <div className="tb-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <div style={{ ...mono, fontSize: 11, color: T.slate, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h1 style={{ ...body, fontSize: 24, fontWeight: 700, margin: "4px 0 0", lineHeight: 1.15 }}>{greeting}, {settings.business_name} 👋</h1>
        </div>
        {(allowedScans.length > 0 || (allowedScans.includes("sale") && hasUnitSaleItems)) && (
          <div className="tb-scan-btns" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {allowedScans.includes("stock-in") && <ScanButton label="Stock In" icon={ArrowUpCircle} color={T.green} onClick={() => onScan("stock-in")} />}
            {allowedScans.includes("sale") && <ScanButton label="Stock Out" icon={ArrowDownCircle} color={T.stamp} onClick={() => onScan("sale")} />}
            {allowedScans.includes("refund") && <ScanButton label="Refund" icon={RotateCcw} color={T.amber} onClick={() => onScan("refund")} />}
            {allowedScans.includes("sale") && hasUnitSaleItems && <ScanButton label="Sell Units" icon={Boxes} color={T.blue} onClick={onSellUnits} />}
          </div>
        )}
      </div>

      {canManageRefunds && (
        <div style={{ marginBottom: 18 }}>
          <Panel title={`Pending Refunds${pendingRefunds.length ? ` (${pendingRefunds.length})` : ""}`} icon={RotateCcw} iconColor={T.amber}>
            {pendingRefunds.length === 0 && <Empty text="No refund requests waiting for confirmation." />}
            {pendingRefunds.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.paperDim}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.qty} \u00d7 {r.product_name}</div>
                  <div style={{ fontSize: 11.5, color: T.slate, marginTop: 2 }}>Requested by {r.staff} \u00b7 {new Date(r.requested_at).toLocaleString()}</div>
                  {r.reason && <div style={{ fontSize: 11.5, color: T.slateLight, marginTop: 2, fontStyle: "italic" }}>"{r.reason}"</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => onApproveRefund(r)} style={{ padding: "7px 12px", borderRadius: 4, border: "none", background: T.green, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Accept</button>
                  <button onClick={() => onRejectRefund(r)} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.stamp}`, background: "transparent", color: T.stamp, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Reject</button>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      )}

      <div style={{ background: T.cream, borderRadius: 4, padding: "16px 18px", marginBottom: 18, border: `1px dashed ${T.slateLight}` }}>
        <TallyStrip count={itemsSoldToday} label="items sold today" accent={T.stamp} />
      </div>

      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatStub label="Total Products" value={products.length} />
        <StatStub label="Total Stock Units" value={totalStockUnits.toLocaleString()} />
        <StatStub label="Stock Added Today" value={stockAddedToday} accent={T.green} />
        <StatStub label="Items Sold Today" value={itemsSoldToday} accent={T.stamp} />
        <StatStub label="Low Stock" value={lowStock.length} accent={T.amber} />
        <StatStub label="Out of Stock" value={outOfStock.length} accent={T.stamp} />
        <StatStub label="Today's Sales" value={fmt(todaysSales)} accent={T.green} />
        <StatStub label="Inventory Value" value={fmt(inventoryValue)} />
        {hasUnitSaleItems && <StatStub label="Units Sold Today" value={unitsSoldToday} accent={T.blue} />}
      </div>

      <div className="tb-panel-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <Panel title="Stock In vs Stock Out — 7 Days">
          <LedgerBars data={weeklyChart} />
          <div style={{ display: "flex", gap: 16, marginTop: 6 }}><Legend color={T.green} label="Stock In" /><Legend color={T.stamp} label="Stock Out" /></div>
        </Panel>
        <Panel title="Best-Selling Products">
          {bestSellers.length === 0 && <Empty text="No sales recorded yet." />}
          {bestSellers.map((b, i) => (
            <div key={b.product.id} onClick={() => onSelectProduct(b.product)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", cursor: "pointer", borderBottom: i < bestSellers.length - 1 ? `1px solid ${T.paperDim}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ ...mono, fontSize: 11, color: T.slate }}>{String(i + 1).padStart(2, "0")}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{b.product.name}</span></div>
              <span style={{ ...mono, fontSize: 12, color: T.slate }}>{b.qty} sold</span>
            </div>
          ))}
        </Panel>
      </div>

      <div className="tb-panel-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Panel title="Low Stock Alert" icon={AlertTriangle} iconColor={T.amber}>
          {outOfStock.length === 0 && lowStock.length === 0 && <Empty text="Everything is well stocked." />}
          {outOfStock.map((p) => <AlertRow key={p.id} p={p} status="critical" onClick={() => onSelectProduct(p)} />)}
          {lowStock.map((p) => <AlertRow key={p.id} p={p} status="low" onClick={() => onSelectProduct(p)} />)}
        </Panel>
        <Panel title="Expiring Within 30 Days" icon={AlertTriangle} iconColor={T.stamp}>
          {expiringSoon.length === 0 && <Empty text="No items expiring soon." />}
          {expiringSoon.map((p) => {
            const days = Math.round((new Date(p.expiry) - today) / 86400000);
            return (
              <div key={p.id} onClick={() => onSelectProduct(p)} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <span style={{ ...mono, fontSize: 12, color: days <= 10 ? T.stamp : T.amber }}>{days}d left</span>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
function ScanButton({ label, icon: Icon, color, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: `1px solid ${color}`, background: "transparent", color, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...body }}>
      <Icon size={14} /> {label}
    </button>
  );
}

/* ---------------------------------------------------------------
   Inventory
------------------------------------------------------------------*/
function Inventory({ products, history, search, setSearch, category, setCategory, currency, onExport, onOpenHistory }) {
  const totals = useMemo(() => {
    const m = {};
    history.forEach((h) => {
      if (!m[h.product_id]) m[h.product_id] = { added: 0, sold: 0 };
      if (h.type === "stock-in") m[h.product_id].added += h.qty;
      if (h.type === "sale") m[h.product_id].sold += h.qty;
    });
    return m;
  }, [history]);

  return (
    <div>
      <PageHeader title="Inventory" sub={`${products.length} products`} actions={[
        { label: "Export CSV", icon: Download, onClick: onExport },
      ]} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.cream, borderRadius: 4, padding: "8px 10px", flex: 1 }}>
          <Search size={14} color={T.slate} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1, ...body }} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ background: T.cream, border: "none", borderRadius: 4, padding: "0 10px", fontSize: 13, ...body, color: T.ink }}>
          <option>All</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="tb-table-scroll" style={{ background: T.cream, borderRadius: 4, overflow: "hidden" }}>
       <div>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr 1fr 0.7fr", padding: "10px 16px", ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, borderBottom: `1px solid ${T.paperDim}` }}>
          <span>Product</span><span>Category</span><span>Added</span><span>Sold</span><span>In Stock</span><span>Status</span><span>Value</span><span></span>
        </div>
        {products.length === 0 && <Empty text="No items yet — add one from the Labels page." />}
        {products.map((p) => {
          const status = productStatus(p);
          const t = totals[p.id] || { added: 0, sold: 0 };
          return (
            <div key={p.id} onClick={() => onOpenHistory(p)} style={{ display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr 1fr 0.7fr", padding: "11px 16px", alignItems: "center", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}`, fontSize: 13 }}>
              <div><div style={{ fontWeight: 500 }}>{p.name}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</div></div>
              <span style={{ color: T.slate, fontSize: 12.5 }}>{p.category}</span>
              <span style={{ ...mono, color: T.green }}>+{t.added}</span>
              <span style={{ ...mono, color: T.stamp }}>-{t.sold}</span>
              <span style={{ ...mono, fontWeight: 700 }}>
                {p.qty}
                {p.unit_sale_enabled && <div style={{ fontSize: 9.5, color: T.blue, fontWeight: 500 }}>{p.loose_units || 0} {p.unit_name || "unit"}{(p.loose_units || 0) === 1 ? "" : "s"} loose</div>}
              </span>
              <span style={{ display: "flex", alignItems: "center" }}><StatusDot status={status} /><span style={{ fontSize: 11.5, color: T.slate, textTransform: "capitalize" }}>{status === "critical" ? "Out" : status === "low" ? "Low" : "OK"}</span></span>
              <span style={{ ...mono, fontSize: 12.5 }}>{currency}{(p.qty * Number(p.purchase_price)).toLocaleString()}</span>
              <ChevronRight size={14} color={T.slateLight} />
            </div>
          );
        })}
       </div>
      </div>
    </div>
  );
}

function AddProductModal({ onAdd, onClose, initialSku, currency }) {
  const [form, setForm] = useState({
    name: "", category: "Medicine", sku: initialSku || "", min_stock: 5, purchase_price: 0, selling_price: 0, supplier: "", expiry: "", batch: "",
    unit_sale_enabled: false, unit_name: "", unit_qty_per_pack: "", unit_price: "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleUnitSale = () => setForm({ ...form, unit_sale_enabled: !form.unit_sale_enabled });

  const packFromUnits = Number(form.unit_qty_per_pack || 0) * Number(form.unit_price || 0);

  const submit = (e) => {
    e.preventDefault();
    onAdd({
      ...form,
      qty: 0,
      min_stock: Number(form.min_stock),
      purchase_price: Number(form.purchase_price),
      selling_price: Number(form.selling_price),
      expiry: form.expiry || null,
      unit_sale_enabled: !!form.unit_sale_enabled,
      unit_name: form.unit_sale_enabled ? (form.unit_name || null) : null,
      unit_qty_per_pack: form.unit_sale_enabled ? Number(form.unit_qty_per_pack || 0) : 0,
      unit_price: form.unit_sale_enabled ? Number(form.unit_price || 0) : 0,
      loose_units: 0,
    });
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <form onSubmit={submit} style={{ position: "relative", width: 420, maxWidth: "94vw", maxHeight: "86vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Item</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {initialSku && (
          <div style={{ fontSize: 12, color: T.slate, marginBottom: 12, background: T.paper, borderRadius: 4, padding: "8px 10px" }}>
            Scanned code <strong style={{ ...mono }}>{initialSku}</strong> didn't match anything yet — fill in the rest and it'll be linked to this code from now on.
          </div>
        )}
        <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 12, background: T.paper, borderRadius: 4, padding: "8px 10px" }}>
          This just registers the item and generates its label — it won't count as stock yet. Print the label, stick it on the item, then scan it as <strong>Stock In</strong> to add it to inventory.
        </div>
        <Field label="Name"><input required value={form.name} onChange={set("name")} style={inputStyle} /></Field>
        <Field label="SKU"><input required value={form.sku} onChange={set("sku")} style={inputStyle} placeholder="TB-000000" /></Field>
        <Field label="Category">
          <select value={form.category} onChange={set("category")} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Purchase Price (per pack)"><input type="number" value={form.purchase_price} onChange={set("purchase_price")} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Selling Price (per pack)"><input type="number" value={form.selling_price} onChange={set("selling_price")} style={inputStyle} /></Field></div>
        </div>
        <Field label="Min Stock (low-stock alert level)"><input type="number" value={form.min_stock} onChange={set("min_stock")} style={inputStyle} /></Field>
        <Field label="Supplier"><input value={form.supplier} onChange={set("supplier")} style={inputStyle} /></Field>
        <Field label="Expiry (optional)"><input type="date" value={form.expiry} onChange={set("expiry")} style={inputStyle} /></Field>

        <div
          onClick={toggleUnitSale}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 16, marginBottom: form.unit_sale_enabled ? 10 : 4, padding: "10px 12px", borderRadius: 4, background: form.unit_sale_enabled ? "#EEF2FE" : T.paper, border: `1px solid ${form.unit_sale_enabled ? T.blue : T.paperDim}` }}
        >
          {form.unit_sale_enabled ? <CheckSquare size={16} color={T.blue} /> : <Square size={16} color={T.slate} />}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: form.unit_sale_enabled ? T.blue : T.ink }}>This item can also be sold in units</div>
            <div style={{ fontSize: 11, color: T.slate }}>e.g. sell single tablets out of a box of Paracetamol</div>
          </div>
        </div>

        {form.unit_sale_enabled && (
          <div style={{ background: T.paper, borderRadius: 4, padding: "12px 12px 2px", marginBottom: 12 }}>
            <Field label="Unit name (e.g. tablet, sachet, piece)">
              <input required={form.unit_sale_enabled} value={form.unit_name} onChange={set("unit_name")} style={inputStyle} placeholder="tablet" />
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Units per pack">
                  <input required={form.unit_sale_enabled} type="number" min={1} value={form.unit_qty_per_pack} onChange={set("unit_qty_per_pack")} style={inputStyle} placeholder="12" />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Price per unit">
                  <input required={form.unit_sale_enabled} type="number" min={0} value={form.unit_price} onChange={set("unit_price")} style={inputStyle} placeholder="100" />
                </Field>
              </div>
            </div>
            {Number(form.unit_qty_per_pack) > 0 && Number(form.unit_price) > 0 && (
              <div style={{ fontSize: 11, color: T.slate, marginBottom: 10 }}>
                {form.unit_qty_per_pack} {form.unit_name || "units"} × {currency}{Number(form.unit_price).toLocaleString()} = {currency}{packFromUnits.toLocaleString()} per pack
                {Number(form.selling_price) > 0 && Math.abs(packFromUnits - Number(form.selling_price)) > 0.01 && (
                  <span style={{ color: T.amber }}> — pack selling price is {currency}{Number(form.selling_price).toLocaleString()}, double check these match</span>
                )}
              </div>
            )}
          </div>
        )}

        <button type="submit" style={{ width: "100%", marginTop: 6, padding: "10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}>SAVE & GENERATE LABEL</button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------
   Sales / Reports / Staff / Settings
------------------------------------------------------------------*/
function Sales({ history, currency, hasUnitSaleItems, onSellUnits }) {
  const sales = useMemo(() => history.filter((h) => h.type === "sale" || h.type === "unit-sale"), [history]);
  const total = sales.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  const todaySales = sales.filter((h) => h.occurred_on === todayStr);
  const todayTotal = todaySales.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  const unitSales = useMemo(() => history.filter((h) => h.type === "unit-sale"), [history]);
  const unitSalesToday = unitSales.filter((h) => h.occurred_on === todayStr);
  const unitSalesTodayTotal = unitSalesToday.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  return (
    <div>
      <PageHeader title="Sales" sub={`${sales.length} transactions logged`} actions={hasUnitSaleItems ? [{ label: "Sell Units", icon: Boxes, onClick: onSellUnits }] : []} />
      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        <StatStub label="Today's Sales" value={`${currency}${todayTotal.toLocaleString()}`} accent={T.green} />
        <StatStub label="Items Sold Today" value={todaySales.reduce((s, h) => s + h.qty, 0)} accent={T.stamp} />
        <StatStub label="All-Time Revenue" value={`${currency}${total.toLocaleString()}`} />
      </div>

      {hasUnitSaleItems && (
        <div style={{ background: T.cream, borderRadius: 6, padding: "14px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Boxes size={15} color={T.blue} /> Unit Sales</div>
            <div style={{ fontSize: 12, color: T.slate, marginTop: 2 }}>
              {unitSalesToday.reduce((s, h) => s + h.qty, 0)} unit{unitSalesToday.reduce((s, h) => s + h.qty, 0) === 1 ? "" : "s"} sold today · {currency}{unitSalesTodayTotal.toLocaleString()}
            </div>
          </div>
          <button onClick={onSellUnits} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            <Boxes size={14} /> Sell Units
          </button>
        </div>
      )}

      <div className="tb-table-scroll" style={{ background: T.cream, borderRadius: 4, overflow: "hidden" }}>
       <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.6fr 0.6fr 0.9fr 0.9fr 0.9fr", padding: "10px 16px", ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, borderBottom: `1px solid ${T.paperDim}` }}>
          <span>Date</span><span>Product</span><span>Type</span><span>Qty</span><span>Unit Price</span><span>Total</span><span>Staff</span>
        </div>
        {sales.slice(0, 40).map((h) => (
          <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.6fr 0.6fr 0.9fr 0.9fr 0.9fr", padding: "9px 16px", fontSize: 12.5, borderBottom: `1px solid ${T.paperDim}` }}>
            <span style={{ ...mono, color: T.slate }}>{h.occurred_on}</span>
            <span>{h.product_name}</span>
            <span style={{ ...mono, fontSize: 10.5, color: h.type === "unit-sale" ? T.blue : T.slate }}>{h.type === "unit-sale" ? "Unit" : "Pack"}</span>
            <span style={{ ...mono }}>{h.qty}</span>
            <span style={{ ...mono }}>{currency}{Number(h.unit_price).toLocaleString()}</span>
            <span style={{ ...mono, fontWeight: 700 }}>{currency}{(h.qty * Number(h.unit_price)).toLocaleString()}</span>
            <span style={{ color: T.slate }}>{h.staff}</span>
          </div>
        ))}
       </div>
      </div>
    </div>
  );
}

function Reports({ products, history, currency, inventoryValue, onExport }) {
  const totalSaleRevenue = history.filter((h) => h.type === "sale" || h.type === "unit-sale").reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  const totalCOGS = history.filter((h) => h.type === "sale" || h.type === "unit-sale").reduce((s, h) => {
    const p = products.find((pr) => pr.id === h.product_id);
    if (!p) return s;
    if (h.type === "unit-sale") {
      const perPack = Number(p.unit_qty_per_pack) || 1;
      return s + h.qty * (Number(p.purchase_price) / perPack);
    }
    return s + h.qty * Number(p.purchase_price);
  }, 0);
  const profit = totalSaleRevenue - totalCOGS;
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    units: products.filter((p) => p.category === c).reduce((s, p) => s + p.qty, 0),
    value: products.filter((p) => p.category === c).reduce((s, p) => s + p.qty * Number(p.purchase_price), 0),
  })).filter((c) => c.units > 0 || c.value > 0);
  return (
    <div>
      <PageHeader title="Reports" sub="Inventory, sales & profit summary" actions={[{ label: "Export Inventory CSV", icon: Download, onClick: onExport }]} />
      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        <StatStub label="Total Revenue" value={`${currency}${totalSaleRevenue.toLocaleString()}`} accent={T.green} />
        <StatStub label="Cost of Goods Sold" value={`${currency}${totalCOGS.toLocaleString()}`} />
        <StatStub label="Gross Profit" value={`${currency}${profit.toLocaleString()}`} accent={T.stamp} />
      </div>
      <Panel title="Inventory Value by Category">
        {byCategory.length === 0 && <Empty text="Add products to see category breakdown." />}
        {byCategory.map((c, i) => (
          <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < byCategory.length - 1 ? `1px solid ${T.paperDim}` : "none" }}>
            <span style={{ fontSize: 13 }}>{c.category}</span>
            <span style={{ ...mono, fontSize: 12.5, color: T.slate }}>{c.units} units</span>
            <span style={{ ...mono, fontSize: 12.5, fontWeight: 700 }}>{currency}{c.value.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `1px solid ${T.slateLight}` }}>
          <span style={{ ...mono, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Inventory Value</span>
          <span style={{ ...mono, fontWeight: 700 }}>{currency}{inventoryValue.toLocaleString()}</span>
        </div>
      </Panel>
    </div>
  );
}

function Staff({ activeStaff, staffList, onSwitch, onAdd, onDelete }) {
  const [pinTarget, setPinTarget] = useState(null); // staff member awaiting PIN entry
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const chooseChip = (member) => {
    if (member.id === null) { onSwitch(member); return; } // Owner — already authenticated, no PIN needed
    setPinTarget(member); setPinValue(""); setPinError("");
  };

  const submitPin = (e) => {
    e.preventDefault();
    if (pinValue === pinTarget.pin) { onSwitch(pinTarget); setPinTarget(null); }
    else setPinError("Incorrect PIN");
  };

  return (
    <div>
      <PageHeader title="Staff" sub="Who's acting, and what they can do" actions={[]} />
      <Panel title="Acting As">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => chooseChip(OWNER_STAFF)} style={{ padding: "7px 14px", borderRadius: 4, border: `1px solid ${activeStaff.id === null ? T.ink : T.paperDim}`, background: activeStaff.id === null ? T.ink : "transparent", color: activeStaff.id === null ? T.paper : T.ink, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Owner (Admin)</button>
          {staffList.map((s) => (
            <button key={s.id} onClick={() => chooseChip(s)} style={{ padding: "7px 14px", borderRadius: 4, border: `1px solid ${activeStaff.id === s.id ? T.ink : T.paperDim}`, background: activeStaff.id === s.id ? T.ink : "transparent", color: activeStaff.id === s.id ? T.paper : T.ink, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
              {s.name} <span style={{ opacity: 0.65, fontWeight: 500 }}>· {roleDisplay(s.role)}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T.slate, marginTop: 10 }}>
          Currently acting as <strong>{activeStaff.name}</strong> ({roleDisplay(activeStaff.role)}). Every scan and adjustment is recorded against them — switching to a team member requires their PIN.
        </div>
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="Team Members">
        {staffList.length === 0 && <Empty text="No team members added yet." />}
        {staffList.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.paperDim}` }}>
            <div><span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span> <span style={{ fontSize: 12, color: T.slate }}>— {roleDisplay(s.role)}</span></div>
            <button onClick={() => onDelete(s)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.stamp }}><X size={15} /></button>
          </div>
        ))}
        <button onClick={() => setAddOpen(true)} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <Plus size={13} /> Add Team Member
        </button>
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="Roles &amp; Access">
        {ROLES.map((r, i) => (
          <div key={r.role} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < ROLES.length - 1 ? `1px solid ${T.paperDim}` : "none" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{roleDisplay(r.role)}</span>
            <span style={{ fontSize: 12.5, color: T.slate, textAlign: "right" }}>{r.access}</span>
          </div>
        ))}
      </Panel>

      {pinTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setPinTarget(null)} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
          <form onSubmit={submitPin} style={{ position: "relative", width: 300, background: T.cream, borderRadius: 6, padding: 22, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Enter {pinTarget.name}'s PIN</div>
            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 14 }}>to switch to acting as {pinTarget.name}</div>
            <input autoFocus type="password" inputMode="numeric" maxLength={6} value={pinValue} onChange={(e) => { setPinValue(e.target.value); setPinError(""); }}
              style={{ width: "100%", padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 18, textAlign: "center", letterSpacing: "0.3em", boxSizing: "border-box", outline: "none" }} />
            {pinError && <div style={{ color: T.stamp, fontSize: 12, marginTop: 8 }}>{pinError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setPinTarget(null)} style={{ flex: 1, padding: "9px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5 }}>Cancel</button>
              <button type="submit" style={{ flex: 1, padding: "9px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>Confirm</button>
            </div>
          </form>
        </div>
      )}

      {addOpen && <AddStaffModal onAdd={(s) => { onAdd(s); setAddOpen(false); }} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddStaffModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("Cashier");
  const submit = (e) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return;
    onAdd({ name, pin, role });
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <form onSubmit={submit} style={{ position: "relative", width: 360, background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Team Member</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
        <Field label="PIN (4–6 digits)"><input required inputMode="numeric" pattern="\d{4,6}" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} style={inputStyle} placeholder="1234" /></Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
            {ROLES.filter((r) => r.role !== "Admin").map((r) => <option key={r.role} value={r.role}>{roleDisplay(r.role)}</option>)}
          </select>
        </Field>
        <button type="submit" style={{ width: "100%", marginTop: 6, padding: "10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}>SAVE TEAM MEMBER</button>
      </form>
    </div>
  );
}

function SettingsPane({ settings, onSave, products, deletedProducts, onDeleteProduct, onRestoreProduct }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const daysLeft = (deletedAt) => {
    const elapsedMs = Date.now() - new Date(deletedAt).getTime();
    const left = 3 - elapsedMs / 86400000;
    return Math.max(0, Math.ceil(left));
  };

  return (
    <div>
      <PageHeader title="Settings" sub="Business details" actions={[]} />
      <Panel title="Business Profile">
        <Field label="Business Name"><input value={local.business_name} onChange={(e) => setLocal({ ...local, business_name: e.target.value })} style={inputStyle} /></Field>
        <Field label="Currency Symbol"><input value={local.currency} onChange={(e) => setLocal({ ...local, currency: e.target.value })} style={{ ...inputStyle, width: 70 }} /></Field>
        <button onClick={() => onSave(local)} style={{ padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12 }}>SAVE</button>
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="Manage Items">
        <div style={{ fontSize: 12, color: T.slate, marginBottom: 10 }}>Deleting an item removes it from the whole app immediately. It's kept for 3 days in case you need to undo it, then it's gone for good.</div>
        {products.length === 0 && <Empty text="No items to manage." />}
        {products.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.paperDim}` }}>
            <div><span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span> <span style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</span></div>
            {confirmDelete === p.id ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { onDeleteProduct(p); setConfirmDelete(null); }} style={{ padding: "5px 10px", borderRadius: 4, border: "none", background: T.stamp, color: "#fff", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Confirm delete</button>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: "5px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(p.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.stamp }}><X size={15} /></button>
            )}
          </div>
        ))}
      </Panel>

      {deletedProducts.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <Panel title="Recently Deleted">
            <div style={{ fontSize: 12, color: T.slate, marginBottom: 10 }}>Restore an item before its time runs out, or it's permanently deleted.</div>
            {deletedProducts.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.paperDim}` }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span> <span style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</span>
                  <div style={{ fontSize: 11, color: T.amber, marginTop: 2 }}>{daysLeft(p.deleted_at)} day{daysLeft(p.deleted_at) === 1 ? "" : "s"} left to restore</div>
                </div>
                <button onClick={() => onRestoreProduct(p)} style={{ padding: "6px 12px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Restore</button>
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   History drawer & Scan modal
------------------------------------------------------------------*/
function HistoryDrawer({ product, rows, currency, onClose }) {
  let running = product.qty;
  const withBalance = rows.map((r) => {
    const entry = { ...r, balanceAfter: running };
    if (r.type === "stock-in") running -= r.qty;
    if (r.type === "sale") running += r.qty;
    return entry;
  });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.45)" }} />
      <div style={{ position: "relative", width: 380, maxWidth: "100vw", background: T.cream, height: "100%", padding: "22px 20px", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><div style={{ ...mono, fontSize: 10.5, color: T.slate, textTransform: "uppercase" }}>{product.sku}</div><h2 style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0" }}>{product.name}</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          <StatStub label="Current Stock" value={product.qty} />
          <StatStub label="Min Level" value={product.min_stock} accent={T.amber} />
        </div>
        {product.unit_sale_enabled && (
          <div style={{ fontSize: 12, color: T.slate, marginBottom: 4 }}>
            Sold in units too: {product.loose_units || 0} {product.unit_name || "unit"}{(product.loose_units || 0) === 1 ? "" : "s"} loose, {currency}{Number(product.unit_price).toLocaleString()} per {product.unit_name || "unit"}
          </div>
        )}
        {product.supplier && <div style={{ fontSize: 12, color: T.slate, marginBottom: 4 }}>Supplier: {product.supplier}</div>}
        {product.expiry && <div style={{ fontSize: 12, color: T.slate, marginBottom: 4 }}>Expiry: {product.expiry}{product.batch ? ` (batch ${product.batch})` : ""}</div>}
        <div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate, margin: "18px 0 8px" }}>Stock History</div>
        {withBalance.length === 0 && <Empty text="No transactions recorded yet." />}
        {withBalance.map((h) => {
          const isOutflow = h.type === "sale" || h.type === "unit-sale";
          const qtyLabel = h.type === "unit-sale" ? `${h.qty} ${product.unit_name || "unit"}${h.qty === 1 ? "" : "s"}` : h.qty;
          return (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.paperDim}`, fontSize: 12.5 }}>
              <div><div style={{ fontWeight: 600, textTransform: "capitalize" }}>{h.type.replace("-", " ")}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{h.occurred_on} · {h.staff}</div></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...mono, color: isOutflow ? T.stamp : T.green, fontWeight: 700 }}>{isOutflow ? "-" : "+"}{qtyLabel}</div>
                {h.type !== "unit-sale" && <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>bal {h.balanceAfter}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScanModal({
  mode, setMode, candidates, search, setSearch, selected, setSelected, qty, setQty, reason, setReason, onRandom, onConfirm, onClose, currency, allowedScans,
  cameraStage, setCameraStage, missCode, setMissCode, outOfStock, onRescan, cameraError, setCameraError, onDetected, onAddNew,
}) {
  const ALL_MODES = [{ id: "stock-in", label: "Stock In", color: T.green }, { id: "sale", label: "Stock Out", color: T.stamp }, { id: "refund", label: "Refund", color: T.amber }];
  const MODES = ALL_MODES.filter((m) => allowedScans.includes(m.id));
  const cameraOn = cameraStage !== "off";
  const manualAllowed = mode === "refund"; // Stock In / Stock Out are barcode-only
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <div style={{ position: "relative", width: 420, maxWidth: "94vw", maxHeight: "92vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ScanLine size={18} /><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Scan</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {MODES.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 4, border: `1px solid ${mode === m.id ? m.color : T.paperDim}`, background: mode === m.id ? m.color : "transparent", color: mode === m.id ? T.cream : T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{m.label}</button>
            ))}
          </div>
        )}
        {!manualAllowed && (
          <div style={{ ...mono, fontSize: 10.5, color: T.slate, marginBottom: 10 }}>
            {mode === "stock-in" ? "Stock In" : "Stock Out"} is barcode-only — scan the product's sticker to continue.
          </div>
        )}
        {outOfStock ? (
          <div style={{ textAlign: "center", padding: "18px 10px" }}>
            <AlertCircle size={26} color={T.stamp} style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{outOfStock.name} is out of stock</div>
            <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 16 }}>There's nothing left to sell. Restock this item first, or scan a different product.</div>
            <button onClick={onRescan} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...mono }}>
              <Camera size={14} /> SCAN ANOTHER
            </button>
          </div>
        ) : !selected ? (
          <>
            {manualAllowed ? (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button
                  onClick={() => { setMissCode(""); setCameraError(""); setCameraStage(cameraOn ? "off" : "scanning"); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 4, border: `1px solid ${T.ink}`, background: cameraOn ? T.ink : "transparent", color: cameraOn ? T.cream : T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600, flex: 1 }}
                >
                  <Camera size={14} /> {cameraOn ? "Stop Camera" : "Use Camera"}
                </button>
                <button onClick={onRandom} title="Pick a random product (demo)" style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11, color: T.slate }}>
                  <Shuffle size={13} /> Random
                </button>
              </div>
            ) : cameraStage === "off" && (
              <div style={{ textAlign: "center", padding: "18px 10px" }}>
                <button onClick={onRescan} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...mono }}>
                  <Camera size={14} /> SCAN
                </button>
              </div>
            )}

            {cameraStage === "scanning" && (
              <div style={{ marginBottom: 12 }}>
                <CameraScanner onDetected={onDetected} onError={(err) => setCameraError(String(err && err.message ? err.message : err))} />
                <div style={{ fontSize: 11, color: T.slate, marginTop: 6 }}>Point the camera at the product's barcode or QR sticker.</div>
                {cameraError && (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11.5, color: T.stamp, marginTop: 8 }}>
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Couldn't access the camera ({cameraError}). Check that this page has camera permission and is loaded over HTTPS.{manualAllowed ? " Or use search below instead." : ""}</span>
                    {!manualAllowed && (
                      <button onClick={onRescan} style={{ display: "block", marginTop: 8, padding: "6px 12px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Try again</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {missCode && (
              <div style={{ background: T.paper, borderRadius: 4, padding: "10px 12px", marginBottom: 12, fontSize: 12.5 }}>
                Scanned code <strong style={{ ...mono }}>{missCode}</strong> isn't linked to any product yet.
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={onAddNew} style={{ padding: "6px 10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Add as new product</button>
                  {manualAllowed ? (
                    <button onClick={() => setMissCode("")} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Dismiss</button>
                  ) : (
                    <button onClick={onRescan} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Scan again</button>
                  )}
                </div>
              </div>
            )}

            {manualAllowed && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.paper, borderRadius: 4, padding: "8px 10px", marginBottom: 10 }}>
                  <Search size={13} color={T.slate} />
                  <input autoFocus={!cameraOn} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Or search product / SKU..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1 }} />
                </div>
                <div style={{ maxHeight: 200, overflow: "auto" }}>
                  {candidates.slice(0, 30).map((p) => (
                    <div key={p.id} onClick={() => setSelected(p.id)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 8px", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
                      <div><div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</div></div>
                      <div style={{ ...mono, fontSize: 12, color: T.slate }}>{p.qty} in stock</div>
                    </div>
                  ))}
                  {candidates.length === 0 && <Empty text="No matching product." />}
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <div style={{ background: T.paper, borderRadius: 4, padding: 14, marginBottom: 12 }}>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{selected.sku}</div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0" }}>{selected.name}</div>
              <div style={{ fontSize: 12.5, color: T.slate }}>Current stock: {selected.qty}</div>
            </div>
            <Field label={mode === "refund" ? "Quantity Returned" : mode === "stock-in" ? "Quantity Received" : "Quantity Sold"}>
              <input type="number" min="0" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={inputStyle} />
            </Field>
            {mode === "sale" && qty && <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>Total: {currency}{(Number(qty) * selected.selling_price).toLocaleString()}</div>}
            {mode === "refund" && (
              <Field label="Reason (optional)">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. customer returned unopened item" style={{ ...inputStyle, resize: "vertical" }} />
              </Field>
            )}
            {mode === "refund" && (
              <div style={{ ...mono, fontSize: 10.5, color: T.slate, marginBottom: 10 }}>
                Refunds are recorded separately and only added back to stock once an Admin confirms them.
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => setSelected("")} style={{ flex: 1, padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Back</button>
              <button onClick={onConfirm} disabled={!qty} style={{ flex: 2, padding: "10px", borderRadius: 4, border: "none", background: qty ? T.ink : T.slateLight, color: T.cream, cursor: qty ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, ...mono }}>
                {mode === "stock-in" ? "CONFIRM STOCK IN" : mode === "sale" ? "CONFIRM SALE" : "SUBMIT REFUND"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Unit Sale — sell loose units (e.g. single tablets) out of a pack
------------------------------------------------------------------*/
function UnitSaleModal({ candidates, search, setSearch, selected, setSelected, qty, setQty, onConfirm, onClose, currency }) {
  const perPack = Number(selected && selected.unit_qty_per_pack) || 0;
  const looseUnits = selected ? (selected.loose_units || 0) : 0;
  const totalAvailable = selected ? looseUnits + selected.qty * perPack : 0;
  const unitLabel = (selected && selected.unit_name) || "unit";
  const wanted = Number(qty) || 0;
  const overStock = selected && wanted > totalAvailable;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <div style={{ position: "relative", width: 420, maxWidth: "94vw", maxHeight: "92vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Boxes size={18} color={T.blue} /><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Sell Units</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {!selected ? (
          <>
            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 12 }}>
              Search for a stocked item that can be sold in units, then choose how many to sell.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.paper, borderRadius: 4, padding: "8px 10px", marginBottom: 10 }}>
              <Search size={13} color={T.slate} />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item name or SKU..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1 }} />
            </div>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {candidates.slice(0, 30).map((p) => {
                const avail = (p.loose_units || 0) + p.qty * (p.unit_qty_per_pack || 0);
                return (
                  <div key={p.id} onClick={() => setSelected(p.id)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 8px", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{currency}{Number(p.unit_price).toLocaleString()} / {p.unit_name || "unit"}</div>
                    </div>
                    <div style={{ ...mono, fontSize: 12, color: avail > 0 ? T.slate : T.stamp }}>{avail} {p.unit_name || "unit"}{avail === 1 ? "" : "s"} left</div>
                  </div>
                );
              })}
              {candidates.length === 0 && <Empty text="No unit-sale items match your search." />}
            </div>
          </>
        ) : (
          <div>
            <div style={{ background: T.paper, borderRadius: 4, padding: 14, marginBottom: 12 }}>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{selected.sku}</div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0" }}>{selected.name}</div>
              <div style={{ fontSize: 12.5, color: T.slate }}>
                {looseUnits} {unitLabel}{looseUnits === 1 ? "" : "s"} already loose ({currency}{(looseUnits * Number(selected.unit_price)).toLocaleString()}) · {selected.qty} sealed pack{selected.qty === 1 ? "" : "s"} in stock
              </div>
              <div style={{ fontSize: 12.5, color: T.slate, marginTop: 2 }}>{totalAvailable} {unitLabel}{totalAvailable === 1 ? "" : "s"} available in total · {currency}{Number(selected.unit_price).toLocaleString()} per {unitLabel}</div>
            </div>

            {totalAvailable === 0 ? (
              <div style={{ textAlign: "center", padding: "14px 10px" }}>
                <AlertCircle size={24} color={T.stamp} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>Nothing left to sell in units</div>
                <div style={{ fontSize: 12, color: T.slate, marginBottom: 14 }}>Restock this item first.</div>
                <button onClick={() => setSelected("")} style={{ padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...mono }}>CHOOSE ANOTHER ITEM</button>
              </div>
            ) : (
              <>
                <Field label={`Quantity (${unitLabel}s)`}>
                  <input type="number" min="1" max={totalAvailable} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={inputStyle} />
                </Field>
                {overStock && <div style={{ fontSize: 12, color: T.stamp, marginBottom: 10 }}>Only {totalAvailable} {unitLabel}{totalAvailable === 1 ? "" : "s"} left.</div>}
                {!overStock && wanted > 0 && (
                  <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>
                    Total: {currency}{(wanted * Number(selected.unit_price)).toLocaleString()}
                    {wanted > looseUnits && perPack > 0 && (
                      <span> — opens {Math.ceil((wanted - looseUnits) / perPack)} more pack{Math.ceil((wanted - looseUnits) / perPack) === 1 ? "" : "s"}</span>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button onClick={() => setSelected("")} style={{ flex: 1, padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Back</button>
                  <button onClick={onConfirm} disabled={!qty || overStock} style={{ flex: 2, padding: "10px", borderRadius: 4, border: "none", background: (qty && !overStock) ? T.blue : T.slateLight, color: "#fff", cursor: (qty && !overStock) ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, ...mono }}>
                    CONFIRM SOLD
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
