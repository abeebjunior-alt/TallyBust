import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, ScanLine, Package, Receipt, BarChart3, Users, Settings as SettingsIcon,
  Search, AlertTriangle, Download, X, Check, ChevronRight, ChevronDown, ArrowUpCircle,
  ArrowDownCircle, RotateCcw, Plus, LogOut, Camera, List, Tag, AlertCircle, Lock,
  CheckSquare, Square, Minus, ClipboardCheck, LifeBuoy,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { isPinAcceptable } from "./staffAuth";
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
  .tb-logo-chevron { display: none; }
  @media (max-width: 760px) {
    .tb-shell { flex-direction: column; }
    .tb-sidebar {
      width: 100% !important; flex-direction: row !important; align-items: center;
      padding: 8px 10px !important; gap: 6px !important;
      position: sticky; top: 0; z-index: 30;
    }
    .tb-logo { padding: 6px 12px !important; flex-shrink: 0; cursor: pointer; background: rgba(255,255,255,0.08); border-radius: 6px; }
    .tb-logo-chevron { display: inline-flex !important; margin-left: 3px; color: ${T.slateLight}; }
    .tb-logo-chevron-bounce { animation: tb-chevron-bounce 1.4s ease-in-out infinite; }
    @keyframes tb-chevron-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
    .tb-nav-overlay { display: block; position: fixed; inset: 0; z-index: 34; }
    .tb-nav-list {
      display: none; position: fixed; top: 52px; left: 0; right: 0; z-index: 35;
      flex-direction: column; background: #0A1220; padding: 8px; gap: 2px;
      max-height: calc(100vh - 52px); overflow-y: auto; box-shadow: 0 10px 24px rgba(0,0,0,0.35);
    }
    .tb-nav-list.open { display: flex; }
    .tb-nav-list .tb-nav-btn { flex-direction: row !important; gap: 10px !important; padding: 12px 14px !important; font-size: 13px !important; width: 100%; justify-content: flex-start; }
    .tb-sidebar-foot { margin-top: 0 !important; border-top: none !important; padding-top: 0 !important; display: flex !important; flex-direction: row !important; align-items: center; flex-shrink: 0; margin-left: auto; gap: 8px; }
    .tb-sidebar-foot button { width: auto !important; }
    .tb-scan-quick-btn { padding: 8px 16px !important; border-radius: 6px !important; font-size: 12px !important; }
    .tb-sellunits-quick-btn { display: none !important; }
    .tb-signout-btn { width: 32px !important; height: 32px !important; padding: 0 !important; border-radius: 50% !important; margin-top: 0 !important; }
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
  .tb-receipt-sheet { display: none; }
  @media print {
    body * { visibility: hidden; }
    .tb-receipt-sheet, .tb-receipt-sheet * { visibility: visible; }
    .tb-receipt-sheet {
      display: block;
      position: absolute; top: 0; left: 0;
      width: 78mm; padding: 4mm;
      font-family: 'Space Mono', monospace;
      color: #000;
    }
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
  Admin: ["dashboard", "inventory", "labels", "sales", "refunds", "stock-health", "reports", "staff", "settings"],
  Manager: ["dashboard", "inventory", "labels", "sales", "reports"],
  Cashier: ["dashboard", "sales", "refunds"],
  Storekeeper: ["dashboard", "inventory", "labels", "refunds"],
};
const ROLE_SCAN_ACTIONS = {
  Admin: ["stock-in", "sale", "refund", "write-off"],
  Manager: [],
  Cashier: ["sale", "refund"],
  Storekeeper: ["stock-in", "refund"],
};
const OWNER_STAFF = { id: null, name: "Owner", role: "Admin" };
const WRITE_OFF_REASONS = ["Expired", "Damaged", "Lost / Stolen", "Other"];
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
  const TRIAL_DAYS = 14; // 14-day free trial
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
  const [resolved, setResolved] = useState(null); // { ownerId, ownerEmail, activeStaff } once we know who's signed in

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setAuthEvent(event);
      if (event === "SIGNED_OUT") setResolved(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Every sign-in (Owner or Staff) is now a real, independent Supabase Auth
  // account. Once one exists, work out whose business it belongs to: if
  // it's linked from a staff row (auth_user_id), it's a staff member
  // signed in on their own device — otherwise it's the Owner themself.
  useEffect(() => {
    if (!session) { setResolved(null); return; }
    let cancelled = false;
    (async () => {
      const { data: staffRow } = await supabase.from("staff").select("*").eq("auth_user_id", session.user.id).maybeSingle();
      if (cancelled) return;
      if (staffRow) setResolved({ ownerId: staffRow.user_id, ownerEmail: null, activeStaff: staffRow });
      else setResolved({ ownerId: session.user.id, ownerEmail: session.user.email, activeStaff: OWNER_STAFF });
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (session === undefined) return <Splash />;
  if (authEvent === "PASSWORD_RECOVERY") return <ResetPassword onDone={() => setAuthEvent(null)} />;
  if (!session) return <Login />;
  if (!resolved) return <Splash />;

  return (
    <TallyBust
      userId={resolved.ownerId}
      userEmail={resolved.ownerEmail}
      initialActiveStaff={resolved.activeStaff}
    />
  );
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

function TallyBust({ userId, userEmail, initialActiveStaff }) {
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({ business_name: "My Business", currency: "\u20a6" });
  const [appConfig, setAppConfig] = useState({ renewal_message: "", payment_instructions: "" });
  const [adminView, setAdminView] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeStaff, setActiveStaff] = useState(initialActiveStaff || OWNER_STAFF);
  const [staffList, setStaffList] = useState([]);

  const [refunds, setRefunds] = useState([]);
  const [writeOffs, setWriteOffs] = useState([]);
  const [productUnits, setProductUnits] = useState([]);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState("stock-in");
  const [scanModeLocked, setScanModeLocked] = useState(false); // true when opened from a page-specific "Scan Refund"/"Scan Write Off" button — hides the mode switcher so it can't drift into another scan type
  const [scanCameraStage, setScanCameraStage] = useState("off"); // off | scanning
  const [scanMissCode, setScanMissCode] = useState("");
  const [scanUnitError, setScanUnitError] = useState(""); // brief message for a bad scan (wrong status, etc.)
  const [scanCameraError, setScanCameraError] = useState("");
  const [scanLastResult, setScanLastResult] = useState(null); // last successful scan, for on-screen feedback
  const [scanSessionCount, setScanSessionCount] = useState(0); // how many scanned this session
  const [scanLinkSearch, setScanLinkSearch] = useState(""); // product search when linking an outside barcode during Stock In
  const [scanWriteOffPending, setScanWriteOffPending] = useState(null); // { unit, product } awaiting a reason
  const [scanRefundPending, setScanRefundPending] = useState(null); // { unit, product, salePrice } awaiting Admin's Restock/Write Off choice
  const [scanPile, setScanPile] = useState([]); // Stock In / Stock Out: items scanned this session, not yet committed
  const [scanBatchSubmitting, setScanBatchSubmitting] = useState(false); // guards against a double-tap on Accept/Mark Sold firing the batch twice
  const [receiptData, setReceiptData] = useState(null); // last sale receipt, for printing
  const [addInitialSku, setAddInitialSku] = useState("");

  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("All");
  const [historyProduct, setHistoryProduct] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const fireToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); }, []);

  const hasLoadedOnce = useRef(false);
  const loadAll = useCallback(async () => {
    // Only blank the whole page on the very first load. Every later call
    // (after a scan, generating labels, etc.) refreshes data quietly in
    // the background — nothing should un-mount the page mid-action, which
    // was breaking things like printing right after generating labels.
    if (!hasLoadedOnce.current) setLoading(true);
    // Every one of these is explicitly scoped to this business's userId,
    // not just left to RLS to filter. RLS normally does restrict a signed-in
    // Owner/Staff account to their own business's rows \u2014 but a platform
    // admin's RLS policy is deliberately broader (it needs cross-business
    // read access to power the Admin Dashboard's stats), so an unfiltered
    // query run from an admin's own account would silently return every
    // business's data instead of just theirs. Filtering here makes the
    // query itself correct regardless of what RLS additionally allows.
    const [{ data: prod, error: e1 }, { data: hist, error: e2 }, { data: settingsRow, error: e3 }, { data: configRow }, { data: staffRows }, { data: refundRows }, { data: writeOffRows }, { data: unitRows }] = await Promise.all([
      supabase.from("products").select("*").eq("user_id", userId).order("name"),
      supabase.from("stock_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("app_config").select("*").eq("id", 1).maybeSingle(),
      supabase.from("staff").select("id,user_id,auth_user_id,name,role,created_at").eq("user_id", userId).order("created_at"),
      supabase.from("refunds").select("*").eq("user_id", userId).order("requested_at", { ascending: false }).limit(300),
      supabase.from("write_offs").select("*").eq("user_id", userId).order("requested_at", { ascending: false }).limit(300),
      supabase.from("product_units").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(3000),
    ]);
    if (e1) fireToast(`Error loading products: ${e1.message}`);
    if (e2) fireToast(`Error loading history: ${e2.message}`);
    if (!settingsRow && !e3) {
      const fresh = { user_id: userId, owner_email: userEmail };
      const { data: inserted } = await supabase.from("settings").insert(fresh).select().single();
      setSettings(inserted || { business_name: "My Business", currency: "\u20a6", owner_email: userEmail, trial_start_date: todayStr, subscription_status: "trial", is_admin: false });
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
    setWriteOffs(writeOffRows || []);
    setProductUnits(unitRows || []);
    hasLoadedOnce.current = true;
    setLoading(false);
  }, [userId, userEmail, fireToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Clears the printed receipt once the print dialog is dismissed —
  // the browser already snapshotted the content, so this is just
  // tidy-up, not a race with the actual printing.
  useEffect(() => {
    if (!receiptData) return;
    const clear = () => setReceiptData(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, [receiptData]);

  /* ---------- derived metrics ---------- */
  const todayHistory = useMemo(() => history.filter((h) => h.occurred_on === todayStr), [history]);
  // Refunds reduce both the reported quantity AND revenue for "today", in
  // the period they're actually approved (not retroactively restated
  // against the original sale day) — this applies whether the item got
  // restocked or written off, since the sale itself genuinely reversed.
  const todaysApprovedRefunds = useMemo(() => refunds.filter((r) => r.status === "approved" && r.reviewed_at && r.reviewed_at.slice(0, 10) === todayStr), [refunds]);
  const todaysRefundQty = useMemo(() => todaysApprovedRefunds.reduce((s, r) => s + Number(r.qty || 0), 0), [todaysApprovedRefunds]);
  const todaysRefundValue = useMemo(() => todaysApprovedRefunds.reduce((s, r) => s + Number(r.sale_price || 0), 0), [todaysApprovedRefunds]);
  const itemsSoldToday = useMemo(() => {
    const gross = todayHistory.filter((h) => h.type === "sale").reduce((s, h) => s + h.qty, 0);
    return Math.max(0, gross - todaysRefundQty);
  }, [todayHistory, todaysRefundQty]);
  const stockAddedToday = useMemo(() => todayHistory.filter((h) => h.type === "stock-in").reduce((s, h) => s + h.qty, 0), [todayHistory]);
  const todaysSalesGross = useMemo(() => todayHistory.filter((h) => h.type === "sale").reduce((s, h) => s + h.qty * Number(h.unit_price), 0), [todayHistory]);
  const todaysSales = Math.max(0, todaysSalesGross - todaysRefundValue);
  const products = useMemo(() => allProducts.filter((p) => !p.deleted_at), [allProducts]);
  const deletedProducts = useMemo(() => allProducts.filter((p) => p.deleted_at), [allProducts]);

  // Quick lookup of a product's unit codes and counts by status, used on
  // the Labels page and for the "existing stock has no code yet" nudge.
  const unitsByProduct = useMemo(() => {
    const map = new Map();
    for (const u of productUnits) {
      if (!map.has(u.product_id)) map.set(u.product_id, []);
      map.get(u.product_id).push(u);
    }
    return map;
  }, [productUnits]);

  // What all current stock would bring in at today's listed prices — the
  // retail/selling value, not the cost. Uses today's selling_price for
  // every unit on hand, since (unlike cost) selling price isn't something
  // we track per-unit-at-time-of-purchase.
  const inventoryValue = useMemo(() => {
    return products.reduce((total, p) => total + p.qty * Number(p.selling_price), 0);
  }, [products]);
  // Products currently available to sell — drops out the moment a product
  // sells out completely, and counts again as soon as it's restocked.
  const totalProductsAvailable = useMemo(() => products.filter((p) => p.qty > 0).length, [products]);
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

  // Quick lookup of a product's unit counts by status, used on the Labels
  // page and for the "existing stock has no code yet" nudge.
  const unitCounts = useMemo(() => {
    const map = new Map();
    for (const [pid, units] of unitsByProduct) {
      map.set(pid, {
        unstocked: units.filter((u) => u.status === "unstocked").length,
        in_stock: units.filter((u) => u.status === "in_stock").length,
        sold: units.filter((u) => u.status === "sold").length,
        written_off: units.filter((u) => u.status === "written_off").length,
        pending_write_off: units.filter((u) => u.status === "pending_write_off").length,
        pending_refund: units.filter((u) => u.status === "pending_refund").length,
      });
    }
    return map;
  }, [unitsByProduct]);

  /* ---------- actions ---------- */
  const allowedTabs = ROLE_TABS[activeStaff.role] || ["dashboard"];
  const allowedScans = ROLE_SCAN_ACTIONS[activeStaff.role] || [];

  const switchStaff = (member) => {
    setActiveStaff(member);
    const tabs = ROLE_TABS[member.role] || ["dashboard"];
    if (!tabs.includes(tab)) setTab(tabs[0]);
  };

  // supabase.functions.invoke() only fills `data` when the function
  // returns 2xx — on an error status it leaves `data` null and gives back
  // a generic "non-2xx status code" message, with the function's actual
  // JSON error body sitting unread on error.context. This pulls it out so
  // the real reason shows up instead of that generic wrapper text.
  const edgeFunctionErrorMessage = async (error) => {
    try {
      const body = await error.context.json();
      return body?.error || error.message;
    } catch {
      return error.message;
    }
  };

  const addStaffMember = async (form) => {
    const nameTaken = staffList.some((s) => s.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (nameTaken) { fireToast(`"${form.name}" is already used as a username \u2014 pick another.`); return; }
    if (!isPinAcceptable(form.pin)) { fireToast("PIN must be 6 digits and not an obvious pattern."); return; }

    // Account creation happens server-side (service role), never via the
    // public signUp() endpoint — see supabase/functions/create-staff-account.
    const { data, error } = await supabase.functions.invoke("create-staff-account", {
      body: { mode: "create", name: form.name, pin: form.pin, role: form.role },
    });
    if (error) { fireToast(`Could not add team member: ${await edgeFunctionErrorMessage(error)}`); return; }
    if (data?.error) { fireToast(`Could not add team member: ${data.error}`); return; }
    fireToast(`Added ${form.name} \u2014 they can now log in with the Business Code, their username, and their PIN`);
    loadAll();
  };

  // For staff added before device logins existed (auth_user_id is null) —
  // gives them a real account now. The Owner re-enters the PIN here rather
  // than it being read back from storage, since plaintext PINs are no
  // longer kept anywhere the client can bulk-fetch them.
  const setupStaffLogin = async (member, pin) => {
    if (!isPinAcceptable(pin)) { fireToast("PIN must be 6 digits and not an obvious pattern."); return; }
    const { data, error } = await supabase.functions.invoke("create-staff-account", {
      body: { mode: "setup_login", staffId: member.id, pin },
    });
    if (error) { fireToast(`Could not set up their login: ${await edgeFunctionErrorMessage(error)}`); return; }
    if (data?.error) { fireToast(`Could not set up their login: ${data.error}`); return; }
    fireToast(`${member.name} can now log in on their own phone`);
    loadAll();
  };

  const deleteStaffMember = async (member) => {
    const { error } = await supabase.from("staff").delete().eq("id", member.id);
    if (error) { fireToast(`Could not remove: ${error.message}`); return; }
    if (activeStaff.id === member.id) setActiveStaff(OWNER_STAFF);
    fireToast(`Removed ${member.name}`);
    loadAll();
  };

  const openScan = (mode, locked = false) => {
    if (!allowedScans.includes(mode)) return;
    setScanMode(mode);
    setScanModeLocked(locked);
    setScanMissCode(""); setScanCameraError(""); setScanUnitError(""); setScanLastResult(null); setScanSessionCount(0); setScanLinkSearch(""); setScanWriteOffPending(null); setScanRefundPending(null); setScanPile([]);
    setScanCameraStage("scanning");
    setScanOpen(true);
  };

  // Every unique code is looked up in product_units (not products) — this
  // is what makes each printed label a one-time-use, single-item scan.
  const findUnitByCode = (rawCode) => {
    const code = rawCode.trim().toLowerCase();
    return productUnits.find((u) => u.code.trim().toLowerCase() === code) || null;
  };

  // Between scans within the same session — deliberately does NOT clear
  // scanPile, since that's the whole point: keep the pile while scanning
  // the next item.
  const rescan = () => {
    setScanMissCode(""); setScanUnitError(""); setScanCameraError(""); setScanLinkSearch(""); setScanWriteOffPending(null); setScanRefundPending(null);
    setScanCameraStage("scanning");
  };

  const switchScanMode = (newMode) => {
    if (!allowedScans.includes(newMode)) return;
    setScanMode(newMode);
    setScanMissCode(""); setScanUnitError(""); setScanCameraError(""); setScanLastResult(null); setScanSessionCount(0); setScanLinkSearch(""); setScanWriteOffPending(null); setScanRefundPending(null); setScanPile([]);
    setScanCameraStage("scanning");
  };

  const addNewFromMissedCode = () => {
    setScanOpen(false);
    setAddOpen(true);
  };

  const scanLinkCandidates = useMemo(() => {
    if (!scanLinkSearch) return products;
    const q = scanLinkSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, scanLinkSearch]);

  const closeScan = () => {
    if (scanPile.length > 0) {
      const ok = window.confirm(`Discard ${scanPile.length} scanned item${scanPile.length === 1 ? "" : "s"} that haven't been ${scanMode === "sale" ? "marked sold" : "accepted"} yet?`);
      if (!ok) return;
    }
    setScanPile([]);
    setScanOpen(false);
  };

  const removeFromPile = (code) => setScanPile((prev) => prev.filter((it) => it.code !== code));
  const discardPile = () => setScanPile([]);

  // Stock In also accepts a barcode/QR that TallyBust never generated —
  // e.g. a manufacturer's own barcode already printed on the box. The
  // first time one is seen, it just needs to be told which item it is —
  // it then joins the pile like any other scan, ready to be Accepted.
  const linkExternalCode = (rawCode, product) => {
    const code = rawCode.trim();
    if (scanPile.some((it) => it.code.toLowerCase() === code.toLowerCase())) {
      setScanUnitError(`${product.name} (${code}) is already in this batch.`);
      setScanMissCode("");
      setTimeout(rescan, 1400);
      return;
    }
    setScanPile((prev) => [...prev, { code, product, unitId: null }]);
    setScanLastResult({ ok: true, text: `Added to batch \u2014 ${product.name}`, code });
    setScanSessionCount((n) => n + 1);
    setScanMissCode(""); setScanLinkSearch("");
    setTimeout(rescan, 900);
  };

  // Write Off needs a reason (matters a lot for a pharmacy) so, unlike
  // the other scan modes, a valid scan pauses here instead of finishing
  // immediately — the reason buttons in ScanModal call this to finish.
  // An Admin (the owner, or a staff member set up with the Admin role)
  // is trusted to finalize on the spot — it comes off the books right
  // away. Anyone else's scan locks the unit and files a pending request
  // instead — nothing is deducted until an Admin reviews it below (see
  // approveWriteOff).
  const finalizeWriteOff = async (reason) => {
    if (!scanWriteOffPending) return;
    const { unit, product } = scanWriteOffPending;
    const nowIso = new Date().toISOString();
    if (activeStaff.role === "Admin") {
      const { error: e1 } = await supabase.from("product_units").update({ status: "written_off", written_off_at: nowIso, write_off_reason: reason }).eq("id", unit.id);
      const { error: e2 } = await supabase.from("products").update({ qty: Math.max(0, product.qty - 1) }).eq("id", product.id);
      const { error: e3 } = await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "write-off", qty: 1, unit_price: unit.purchase_price ?? product.purchase_price, unit_code: unit.code, reason, staff: activeStaff.name, occurred_on: todayStr });
      if (e1 || e2 || e3) { fireToast(`Save failed: ${(e1 || e2 || e3).message}`); setScanWriteOffPending(null); setTimeout(rescan, 1000); return; }
      setScanLastResult({ ok: true, text: `Written off (${reason}) \u2014 ${product.name}`, code: unit.code });
    } else {
      const { error: e1 } = await supabase.from("product_units").update({ status: "pending_write_off", write_off_reason: reason }).eq("id", unit.id);
      const { error: e2 } = await supabase.from("write_offs").insert({ user_id: userId, product_id: product.id, product_name: product.name, qty: 1, unit_code: unit.code, purchase_price: unit.purchase_price ?? product.purchase_price, reason, staff: activeStaff.name, status: "pending" });
      if (e1 || e2) { fireToast(`Save failed: ${(e1 || e2).message}`); setScanWriteOffPending(null); setTimeout(rescan, 1000); return; }
      setScanLastResult({ ok: true, text: `Write off requested (${reason}) \u2014 ${product.name} \u2014 awaiting Admin confirmation`, code: unit.code });
    }
    setScanWriteOffPending(null);
    setScanSessionCount((n) => n + 1);
    loadAll();
    setTimeout(rescan, 900);
  };

  // Same self-approve logic as an Admin's own Write Off, applied to
  // Refund: an Admin picks Restock/Write Off right after the scan and it
  // takes effect immediately — no separate pending step, since there's
  // no one else who needs to sign off on it.
  const finalizeAdminRefund = async (disposition) => {
    if (!scanRefundPending) return;
    const { unit, product, salePrice } = scanRefundPending;
    const nowIso = new Date().toISOString();
    let err = null;
    if (disposition === "restock") {
      const r1 = await supabase.from("product_units").update({ status: "in_stock", stocked_in_at: nowIso }).eq("id", unit.id);
      const r2 = await supabase.from("products").update({ qty: product.qty + 1 }).eq("id", product.id);
      const r3 = await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "refund", qty: 1, unit_price: unit.purchase_price ?? product.purchase_price, unit_code: unit.code, staff: activeStaff.name, occurred_on: todayStr });
      err = r1.error || r2.error || r3.error;
    } else {
      const r1 = await supabase.from("product_units").update({ status: "written_off", written_off_at: nowIso, write_off_reason: "Non-resellable return" }).eq("id", unit.id);
      const r3 = await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "write-off", qty: 1, unit_price: unit.purchase_price ?? product.purchase_price, unit_code: unit.code, reason: "Non-resellable return", staff: activeStaff.name, occurred_on: todayStr });
      err = r1.error || r3.error;
    }
    const r4 = await supabase.from("refunds").insert({ user_id: userId, product_id: product.id, product_name: product.name, qty: 1, unit_code: unit.code, sale_price: salePrice, status: "approved", disposition, staff: activeStaff.name, reviewed_by: activeStaff.name, reviewed_at: nowIso });
    err = err || r4.error;
    if (err) { fireToast(`Save failed: ${err.message}`); setScanRefundPending(null); setTimeout(rescan, 1000); return; }
    setScanLastResult({ ok: true, text: disposition === "restock" ? `Refunded \u2014 ${product.name} back in stock` : `Refunded \u2014 ${product.name} written off`, code: unit.code });
    setScanRefundPending(null);
    setScanSessionCount((n) => n + 1);
    loadAll();
    setTimeout(rescan, 900);
  };


  // actually happens: the unit leaves stock for good, qty drops, and it's
  // logged to the ledger (so it hits Inventory Value and the Write-Off
  // Log). Rejecting just unlocks the unit — it goes back to in_stock as
  // if nothing happened, nothing was ever deducted.
  const approveWriteOff = async (writeOff) => {
    const product = allProducts.find((p) => p.id === writeOff.product_id);
    if (!product) { fireToast("That product no longer exists"); return; }
    const nowIso = new Date().toISOString();
    const unit = productUnits.find((u) => u.code === writeOff.unit_code);
    let err = null;
    if (unit) { const r = await supabase.from("product_units").update({ status: "written_off", written_off_at: nowIso }).eq("id", unit.id); err = err || r.error; }
    const r2 = await supabase.from("products").update({ qty: Math.max(0, product.qty - writeOff.qty) }).eq("id", product.id);
    const r3 = await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "write-off", qty: writeOff.qty, unit_price: writeOff.purchase_price ?? product.purchase_price, unit_code: writeOff.unit_code, reason: writeOff.reason, staff: activeStaff.name, occurred_on: todayStr });
    err = err || r2.error || r3.error;
    const r4 = await supabase.from("write_offs").update({ status: "approved", reviewed_by: activeStaff.name, reviewed_at: nowIso }).eq("id", writeOff.id);
    err = err || r4.error;
    if (err) { fireToast(`Failed: ${err.message}`); return; }
    fireToast(`Write off approved \u2014 ${product.name} removed from stock`);
    loadAll();
  };

  const rejectWriteOff = async (writeOff) => {
    const unit = productUnits.find((u) => u.code === writeOff.unit_code);
    let err = null;
    if (unit) { const r = await supabase.from("product_units").update({ status: "in_stock", write_off_reason: null }).eq("id", unit.id); err = err || r.error; }
    const r2 = await supabase.from("write_offs").update({ status: "rejected", reviewed_by: activeStaff.name, reviewed_at: new Date().toISOString() }).eq("id", writeOff.id);
    err = err || r2.error;
    if (err) { fireToast(`Failed: ${err.message}`); return; }
    fireToast(`Write off for ${writeOff.product_name} rejected \u2014 back in stock`);
    loadAll();
  };

  // Stock In and Stock Out don't touch the database per scan anymore —
  // each valid scan just joins a pile shown in the modal, so nothing is
  // stocked in or sold until the person reviews the pile and explicitly
  // taps Accept / Mark Sold. Refund (which only ever creates a pending
  // request, never an immediate stock change) and Write Off (which
  // already pauses for a reason) are unaffected and still finish per
  // scan — piling those up would add a step without protecting anything.
  const handleDetectedCode = async (rawCode) => {
    setScanCameraStage("off");
    setScanUnitError("");
    setScanMissCode("");
    setScanLastResult(null);
    const unit = findUnitByCode(rawCode);
    if (!unit) {
      if (scanMode === "stock-in") {
        // Unknown code, but Stock In is exactly where a new outside
        // barcode gets linked to an item for the first time.
        setScanMissCode(rawCode.trim());
      } else {
        setScanUnitError("This code hasn't been stocked in yet \u2014 scan it with Stock In first.");
        setTimeout(rescan, 1400);
      }
      return;
    }
    const product = allProducts.find((p) => p.id === unit.product_id);
    if (!product) { setScanUnitError("That item's product no longer exists."); setTimeout(rescan, 1200); return; }

    if (scanMode === "stock-in") {
      if (unit.status !== "unstocked") {
        setScanUnitError(unit.status === "in_stock" ? `${product.name} (${unit.code}) is already stocked in.` : `${product.name} (${unit.code}) can't be stocked in again (currently ${unit.status.replace("_", " ")}).`);
        setTimeout(rescan, 1400);
        return;
      }
      if (scanPile.some((it) => it.code === unit.code)) {
        setScanUnitError(`${product.name} (${unit.code}) is already in this batch.`);
        setTimeout(rescan, 1400);
        return;
      }
      setScanPile((prev) => [...prev, { code: unit.code, product, unitId: unit.id }]);
      setScanLastResult({ ok: true, text: `Added to batch \u2014 ${product.name}`, code: unit.code });
      setScanSessionCount((n) => n + 1);
      setTimeout(rescan, 900);
      return;
    }

    if (scanMode === "sale") {
      if (unit.status !== "in_stock") {
        setScanUnitError(unit.status === "sold" ? `${product.name} (${unit.code}) was already sold.` : `${product.name} (${unit.code}) isn't available to sell (currently ${unit.status.replace("_", " ")}).`);
        setTimeout(rescan, 1400);
        return;
      }
      if (scanPile.some((it) => it.code === unit.code)) {
        setScanUnitError(`${product.name} (${unit.code}) is already in this batch.`);
        setTimeout(rescan, 1400);
        return;
      }
      setScanPile((prev) => [...prev, { code: unit.code, product, unitId: unit.id }]);
      setScanLastResult({ ok: true, text: `Added to batch \u2014 ${product.name}`, code: unit.code });
      setScanSessionCount((n) => n + 1);
      setTimeout(rescan, 900);
      return;
    }

    if (scanMode === "refund") {
      // A unit that's already gone through an approved refund shouldn't be
      // refundable again just because it's sitting at "in_stock" (restocked)
      // or "written_off" (non-resellable) — call that out by name instead of
      // falling through to the generic "hasn't been sold" message below.
      const priorRefund = refunds.find((r) => r.unit_code === unit.code && r.status === "approved");
      if (priorRefund && unit.status !== "sold") {
        const when = new Date(priorRefund.reviewed_at || priorRefund.requested_at).toLocaleDateString();
        setScanUnitError(`${product.name} (${unit.code}) was already refunded on ${when} \u2014 it can't be refunded again.`);
        setTimeout(rescan, 1400);
        return;
      }
      if (unit.status !== "sold") {
        setScanUnitError(
          unit.status === "pending_refund" ? `${product.name} (${unit.code}) already has a refund waiting on Admin confirmation.` :
          unit.status === "pending_write_off" ? `${product.name} (${unit.code}) has a write off pending \u2014 it can't be refunded right now.` :
          `${product.name} (${unit.code}) hasn't been sold \u2014 only a sold item can be refunded.`
        );
        setTimeout(rescan, 1400);
        return;
      }
      // Snapshot what this exact item actually sold for, so the refund
      // nets correctly against revenue even if the price has since
      // changed — falls back to today's price if no matching sale row
      // is found (e.g. it was sold before this tracking existed).
      const saleRow = history.find((h) => h.type === "sale" && h.unit_code === unit.code);
      const salePrice = saleRow ? Number(saleRow.unit_price) : Number(product.selling_price);
      if (activeStaff.role === "Admin") {
        // Trusted to decide Restock vs Write Off on the spot — pause for
        // that choice instead of filing a request (see finalizeAdminRefund).
        setScanRefundPending({ unit, product, salePrice });
        return;
      }
      // Not an Admin: lock the unit so it can't be scanned into another
      // refund while this one is still waiting, and file the request.
      const { error: e1 } = await supabase.from("product_units").update({ status: "pending_refund" }).eq("id", unit.id);
      const { error: e2 } = await supabase.from("refunds").insert({ user_id: userId, product_id: product.id, product_name: product.name, qty: 1, unit_code: unit.code, sale_price: salePrice, staff: activeStaff.name, status: "pending" });
      if (e1 || e2) { fireToast(`Save failed: ${(e1 || e2).message}`); setTimeout(rescan, 1000); return; }
      setScanLastResult({ ok: true, text: `Refund requested \u2014 ${product.name} \u2014 awaiting Admin confirmation`, code: unit.code });
    } else if (scanMode === "write-off") {
      if (unit.status !== "in_stock") {
        setScanUnitError(`${product.name} (${unit.code}) can't be written off from here (currently ${unit.status.replace("_", " ")}).`);
        setTimeout(rescan, 1400);
        return;
      }
      // Needs a reason — pause and let the person pick one instead of
      // finishing automatically (see finalizeWriteOff).
      setScanWriteOffPending({ unit, product });
      return;
    }

    setScanSessionCount((n) => n + 1);
    loadAll();
    setTimeout(rescan, 900);
  };

  // The camera view stays mounted while switching between mode tabs inside
  // the same scan session (Refund <-> Write Off, etc. via switchScanMode),
  // so if the camera component only grabs its onDetected callback once at
  // mount, it can go on calling an old closure that still thinks it's in
  // the previous mode — e.g. showing a Stock In error right after you
  // switched to Refund. Routing every detection through this ref means the
  // camera can hold onto a single stable function forever and it'll still
  // always run against whatever scanMode actually is *right now*.
  const handleDetectedRef = useRef(handleDetectedCode);
  useEffect(() => { handleDetectedRef.current = handleDetectedCode; });
  const handleDetectedStable = useCallback((code) => handleDetectedRef.current(code), []);

  // Nothing in the pile is real yet — this is what actually stocks each
  // scanned item in, all at once, once the person taps Accept.
  const confirmStockInBatch = async () => {
    if (scanPile.length === 0 || scanBatchSubmitting) return;
    setScanBatchSubmitting(true);
    const nowIso = new Date().toISOString();
    const qtyMap = new Map(); // running qty per product, so scanning 5 of the same item adds up correctly
    let successCount = 0;
    for (const item of scanPile) {
      let ok = true;
      if (item.unitId) {
        const { error } = await supabase.from("product_units").update({ status: "in_stock", stocked_in_at: nowIso }).eq("id", item.unitId);
        if (error) ok = false;
      } else {
        const { error } = await supabase.from("product_units").insert({ user_id: userId, product_id: item.product.id, code: item.code, status: "in_stock", stocked_in_at: nowIso, purchase_price: item.product.purchase_price });
        if (error) ok = false;
      }
      if (!ok) continue;
      const currentQty = qtyMap.has(item.product.id) ? qtyMap.get(item.product.id) : item.product.qty;
      const newQty = currentQty + 1;
      qtyMap.set(item.product.id, newQty);
      await supabase.from("products").update({ qty: newQty }).eq("id", item.product.id);
      await supabase.from("stock_history").insert({ user_id: userId, product_id: item.product.id, product_name: item.product.name, type: "stock-in", qty: 1, unit_price: item.product.purchase_price, unit_code: item.code, staff: activeStaff.name, occurred_on: todayStr });
      successCount++;
    }
    fireToast(`${successCount} item${successCount === 1 ? "" : "s"} accepted into stock`);
    setScanPile([]);
    setScanOpen(false);
    setScanBatchSubmitting(false);
    loadAll();
  };

  // Marks every piled item sold, all at once, once the person taps Mark
  // Sold — then prints a receipt for exactly what was just sold.
  const confirmStockOutBatch = async () => {
    if (scanPile.length === 0 || scanBatchSubmitting) return;
    setScanBatchSubmitting(true);
    const nowIso = new Date().toISOString();
    const qtyMap = new Map();
    const soldLines = [];
    let successCount = 0;
    for (const item of scanPile) {
      const { error } = await supabase.from("product_units").update({ status: "sold", sold_at: nowIso }).eq("id", item.unitId);
      if (error) continue;
      const currentQty = qtyMap.has(item.product.id) ? qtyMap.get(item.product.id) : item.product.qty;
      const newQty = Math.max(0, currentQty - 1);
      qtyMap.set(item.product.id, newQty);
      const price = Number(item.product.selling_price) || 0;
      await supabase.from("products").update({ qty: newQty }).eq("id", item.product.id);
      await supabase.from("stock_history").insert({ user_id: userId, product_id: item.product.id, product_name: item.product.name, type: "sale", qty: 1, unit_price: price, unit_code: item.code, staff: activeStaff.name, occurred_on: todayStr });
      soldLines.push({ name: item.product.name, code: item.code, price });
      successCount++;
    }
    fireToast(`${successCount} item${successCount === 1 ? "" : "s"} sold`);
    setScanPile([]);
    setScanOpen(false);
    setScanBatchSubmitting(false);
    if (soldLines.length > 0) {
      setReceiptData({ businessName: settings.business_name, currency, staff: activeStaff.name, date: new Date(), items: soldLines, total: soldLines.reduce((s, l) => s + l.price, 0) });
      setTimeout(() => window.print(), 150);
    }
    loadAll();
  };

  // Admin reviews a pending refund: accepting flips that exact item back
  // to in_stock and logs it in the ledger as its own "refund" event;
  // rejecting just closes it out with nothing added back.
  // disposition: 'restock' puts the item back on the shelf; 'write_off'
  // means it isn't resellable (damaged, opened, out of date, etc.) —
  // either way the sale value is netted out of reported revenue, since
  // the money genuinely went back to the customer regardless of what
  // happens to the item itself.
  const approveRefund = async (refund, disposition) => {
    const product = allProducts.find((p) => p.id === refund.product_id);
    if (!product) { fireToast("That product no longer exists"); return; }
    const nowIso = new Date().toISOString();
    let err = null;

    if (refund.unit_code) {
      // A specific packed item.
      const unit = productUnits.find((u) => u.code === refund.unit_code);
      if (disposition === "restock") {
        if (unit) { const r = await supabase.from("product_units").update({ status: "in_stock", stocked_in_at: nowIso }).eq("id", unit.id); err = err || r.error; }
        const r2 = await supabase.from("products").update({ qty: product.qty + 1 }).eq("id", product.id);
        const r3 = await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "refund", qty: 1, unit_price: unit?.purchase_price ?? product.purchase_price, unit_code: refund.unit_code, staff: activeStaff.name, occurred_on: todayStr });
        err = err || r2.error || r3.error;
      } else {
        if (unit) { const r = await supabase.from("product_units").update({ status: "written_off", written_off_at: nowIso, write_off_reason: "Non-resellable return" }).eq("id", unit.id); err = err || r.error; }
        const r3 = await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "write-off", qty: 1, unit_price: unit?.purchase_price ?? product.purchase_price, unit_code: refund.unit_code, reason: "Non-resellable return", staff: activeStaff.name, occurred_on: todayStr });
        err = err || r3.error;
      }
    }

    const r4 = await supabase.from("refunds").update({ status: "approved", disposition, reviewed_by: activeStaff.name, reviewed_at: nowIso }).eq("id", refund.id);
    err = err || r4.error;
    if (err) { fireToast(`Failed: ${err.message}`); return; }
    fireToast(disposition === "restock" ? `Refund accepted \u2014 added back to stock` : `Refund accepted \u2014 written off, not resellable`);
    loadAll();
  };

  const rejectRefund = async (refund) => {
    let err = null;
    if (refund.unit_code) {
      const unit = productUnits.find((u) => u.code === refund.unit_code);
      if (unit) { const r = await supabase.from("product_units").update({ status: "sold" }).eq("id", unit.id); err = r.error; }
    }
    const r2 = await supabase.from("refunds").update({ status: "rejected", reviewed_by: activeStaff.name, reviewed_at: new Date().toISOString() }).eq("id", refund.id);
    err = err || r2.error;
    if (err) { fireToast(`Failed: ${err.message}`); return; }
    fireToast(`Refund for ${refund.product_name} rejected`);
    loadAll();
  };

  // Creates `count` new unique, one-time-use codes for a product. Normally
  // they start "unstocked" (freshly printed, waiting to be scanned in with
  // Stock In); pass asInStock to instead retroactively tag physical items
  // that were already in stock before this system existed. Each unit's
  // cost is captured now, at the product's current purchase price, so
  // Inventory Value later reflects what was actually paid for this batch.
  const generateProductUnits = async (productId, count, asInStock = false) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product || count <= 0) return [];
    const existing = unitsByProduct.get(productId) || [];
    const startSeq = existing.length + 1;
    const nowIso = new Date().toISOString();
    const rows = Array.from({ length: count }).map((_, i) => ({
      user_id: userId,
      product_id: productId,
      code: `${product.sku}-${String(startSeq + i).padStart(4, "0")}`,
      status: asInStock ? "in_stock" : "unstocked",
      stocked_in_at: asInStock ? nowIso : null,
      purchase_price: product.purchase_price,
    }));
    const { data, error } = await supabase.from("product_units").insert(rows).select();
    if (error) { fireToast(`Could not generate labels: ${error.message}`); return []; }
    loadAll();
    return data || [];
  };

  // Physically counting fewer than the system expects means units are
  // genuinely missing (theft, damage never logged, a scan that didn't
  // save) — this writes off the shortfall immediately, since Stock
  // Health (and Reconcile with it) is only ever reachable by an Admin —
  // there's no one else to review it. Counting MORE just gets flagged,
  // since we can't know which physical items to invent codes for —
  // that's what "tag & print" on the Labels page is for.
  const submitReconciliation = async (counts) => {
    const nowIso = new Date().toISOString();
    let shortfalls = 0, unitsWrittenOff = 0, overages = 0;
    for (const [productId, countedRaw] of Object.entries(counts)) {
      const counted = Number(countedRaw);
      if (countedRaw === "" || Number.isNaN(counted)) continue;
      const product = allProducts.find((p) => p.id === productId);
      if (!product) continue;
      const expected = product.qty;
      if (counted === expected) continue;
      if (counted > expected) { overages++; continue; }
      const short = expected - counted;
      const inStockUnits = (unitsByProduct.get(productId) || []).filter((u) => u.status === "in_stock").slice(0, short);
      for (const unit of inStockUnits) {
        await supabase.from("product_units").update({ status: "written_off", written_off_at: nowIso, write_off_reason: "Reconciliation shortfall" }).eq("id", unit.id);
        await supabase.from("stock_history").insert({ user_id: userId, product_id: product.id, product_name: product.name, type: "write-off", qty: 1, unit_price: unit.purchase_price ?? product.purchase_price, unit_code: unit.code, reason: "Reconciliation shortfall", staff: activeStaff.name, occurred_on: todayStr });
        unitsWrittenOff++;
      }
      if (inStockUnits.length > 0) {
        await supabase.from("products").update({ qty: Math.max(0, product.qty - inStockUnits.length) }).eq("id", product.id);
        shortfalls++;
      }
    }
    loadAll();
    return { shortfalls, unitsWrittenOff, overages };
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

  // The Reports page's export used to just be an alias for exportCSV above
  // (a plain product list) — so clicking it never actually gave you the
  // revenue/COGS/profit/refund numbers the page itself was showing. This
  // mirrors the exact same math the Reports screen uses, so the file
  // matches what's on screen instead of being a different report entirely.
  const exportReportCSV = () => {
    const approvedRefunds = refunds.filter((r) => r.status === "approved");
    const grossRevenue = history.filter((h) => h.type === "sale").reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
    const refundValue = approvedRefunds.reduce((s, r) => s + Number(r.sale_price || 0), 0);
    const totalSaleRevenue = grossRevenue - refundValue;
    const writeOffValue = history.filter((h) => h.type === "write-off" && h.reason !== "Non-resellable return").reduce((s, h) => s + h.qty * Number(h.unit_price || 0), 0);
    const restockedUnitCodes = new Set(approvedRefunds.filter((r) => r.disposition === "restock" && r.unit_code).map((r) => r.unit_code));
    const totalCOGS = history.filter((h) => h.type === "sale").reduce((s, h) => {
      if (h.unit_code && restockedUnitCodes.has(h.unit_code)) return s;
      const p = products.find((pr) => pr.id === h.product_id);
      if (!p) return s;
      return s + h.qty * Number(p.purchase_price);
    }, 0);
    const profit = totalSaleRevenue - totalCOGS - writeOffValue;
    const restockedRefundValue = approvedRefunds.filter((r) => r.disposition === "restock").reduce((s, r) => s + Number(r.sale_price || 0), 0);
    const writtenOffRefundValue = approvedRefunds.filter((r) => r.disposition === "write_off").reduce((s, r) => s + Number(r.sale_price || 0), 0);
    const byCategory = CATEGORIES.map((c) => ({
      category: c,
      units: products.filter((p) => p.category === c).reduce((s, p) => s + p.qty, 0),
      value: products.filter((p) => p.category === c).reduce((s, p) => s + p.qty * Number(p.selling_price), 0),
    })).filter((c) => c.units > 0 || c.value > 0);

    // Wrap any text field that might contain a comma so it can't silently
    // shift columns when the file is opened in Excel/Sheets.
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const lines = [];
    lines.push(`TallyBust Report \u2014 exported ${new Date().toISOString().slice(0, 10)}`);
    lines.push("");
    lines.push("SUMMARY");
    lines.push(["Metric", "Value"].join(","));
    lines.push(["Total Revenue", totalSaleRevenue].join(","));
    lines.push(["Cost of Goods Sold", totalCOGS].join(","));
    lines.push(["Gross Profit", profit].join(","));
    lines.push(["Refunded \u2014 Restocked (net of revenue)", restockedRefundValue].join(","));
    lines.push(["Refunded \u2014 Written Off (net of revenue)", writtenOffRefundValue].join(","));
    lines.push(["Written Off \u2014 Direct (never sold)", writeOffValue].join(","));
    lines.push(["Total Inventory Value", inventoryValue].join(","));
    lines.push("");
    lines.push("INVENTORY VALUE BY CATEGORY");
    lines.push(["Category", "Units", "Value"].join(","));
    byCategory.forEach((c) => lines.push([q(c.category), c.units, c.value].join(",")));
    lines.push("");
    lines.push("FULL PRODUCT LIST");
    lines.push(["Name", "SKU", "Category", "Qty", "Min Stock", "Purchase Price", "Selling Price", "Supplier", "Expiry"].join(","));
    products.forEach((p) => lines.push([q(p.name), q(p.sku), q(p.category), p.qty, p.min_stock, p.purchase_price, p.selling_price, q(p.supplier || ""), q(p.expiry || "")].join(",")));

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tallybust-report-${todayStr}.csv`; a.click();
    URL.revokeObjectURL(url);
    fireToast("Report exported");
  };

  const saveSettings = async (next) => {
    setSettings(next);
    const { error } = await supabase.from("settings").update(next).eq("user_id", userId);
    if (error) fireToast(`Could not save: ${error.message}`);
    else fireToast("Settings saved");
  };

  const dismissSubscriptionWelcome = async () => {
    const nowIso = new Date().toISOString();
    setSettings((s) => ({ ...s, subscription_welcomed_at: nowIso }));
    await supabase.from("settings").update({ subscription_welcomed_at: nowIso }).eq("user_id", userId);
  };

  const signOut = () => supabase.auth.signOut();

  const productHistory = useCallback((id) => history.filter((h) => h.product_id === id).slice(0, 12), [history]);

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "labels", label: "Labels", icon: Tag },
    { id: "sales", label: "Sales", icon: Receipt },
    { id: "refunds", label: "Refunds", icon: RotateCcw },
    { id: "stock-health", label: "Stock Health", icon: ClipboardCheck },
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
      {!isAdmin && subState.trial && (
        <div style={{ background: subState.daysLeft <= 3 ? T.stamp : subState.daysLeft <= 7 ? T.amber : T.blue, color: "#fff", textAlign: "center", padding: "7px 10px", fontSize: 12, ...body }}>
          {subState.daysLeft <= 0 ? "Your free trial ends today." : `Free trial — ${subState.daysLeft} day${subState.daysLeft === 1 ? "" : "s"} left.`} {subState.daysLeft <= 7 ? "Renew from Settings to keep access." : ""}
        </div>
      )}
      {!isAdmin && settings.subscription_status === "active" && !settings.subscription_welcomed_at && (
        <div style={{ background: T.green, color: "#fff", textAlign: "center", padding: "9px 14px", fontSize: 12.5, ...body, display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
          <span>
            🎉 Your subscription is successful! You have {subState.daysLeft} day{subState.daysLeft === 1 ? "" : "s"} remaining{settings.subscription_expires_at ? ` (until ${settings.subscription_expires_at})` : ""}.
          </span>
          <button onClick={dismissSubscriptionWelcome} style={{ background: "rgba(255,255,255,0.22)", border: "none", color: "#fff", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 11.5, fontWeight: 700, ...mono }}>
            Got it
          </button>
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
          <div style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.blueSoft }}>TallyBust</div>
          <ChevronDown
            size={14}
            className={`tb-logo-chevron${mobileNavOpen ? "" : " tb-logo-chevron-bounce"}`}
            style={{ transform: mobileNavOpen ? "rotate(180deg)" : undefined, transition: "transform 0.2s ease" }}
          />
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
            <button onClick={() => openScan(allowedScans[0])} className="tb-scan-quick-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 10px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontWeight: 700, ...mono, fontSize: 12.5 }}>
              <ScanLine size={16} /> SCAN
            </button>
          )}
          <div className="tb-user-email" style={{ ...mono, fontSize: 9.5, color: T.slateLight, marginTop: 10, textAlign: "center", wordBreak: "break-all" }}>
            {activeStaff.id === null ? (userEmail || settings.owner_email || "Owner") : `${activeStaff.name} \u00b7 ${activeStaff.role}`}
          </div>
          <button onClick={signOut} className="tb-signout-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, padding: "7px", borderRadius: 4, border: "none", background: "transparent", color: T.slateLight, cursor: "pointer", fontSize: 11 }}>
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
                  inventoryValue={inventoryValue} totalProductsAvailable={totalProductsAvailable} products={products} lowStock={lowStock} outOfStock={outOfStock}
                  expiringSoon={expiringSoon} bestSellers={bestSellers} weeklyChart={weeklyChart} currency={currency} onScan={openScan} allowedScans={allowedScans}
                  onSelectProduct={(p) => { if (allowedTabs.includes("inventory")) { setTab("inventory"); setHistoryProduct(p); } }} />
              )}
              {tab === "inventory" && (
                <Inventory products={filteredProducts} history={history} search={invSearch} setSearch={setInvSearch} category={invCategory} setCategory={setInvCategory}
                  currency={currency} onExport={exportCSV} onOpenHistory={setHistoryProduct} />
              )}
              {tab === "labels" && <Labels products={products} unitCounts={unitCounts} businessName={settings.business_name} onAddProduct={() => setAddOpen(true)} onGenerateUnits={generateProductUnits} />}
              {tab === "sales" && <Sales history={history} currency={currency} refunds={refunds} />}
              {tab === "refunds" && (
                <Refunds refunds={refunds} canScanRefund={allowedScans.includes("refund")} onScan={() => openScan("refund", true)}
                  canManageRefunds={activeStaff.role === "Admin"} onApproveRefund={approveRefund} onRejectRefund={rejectRefund}
                  currency={currency} />
              )}
              {tab === "stock-health" && (
                <StockHealth products={products} unitCounts={unitCounts} history={history} currency={currency}
                  canWriteOff={allowedScans.includes("write-off")} onScanWriteOff={() => openScan("write-off", true)}
                  onSubmitReconciliation={submitReconciliation}
                  writeOffs={writeOffs} canManageWriteOffs={activeStaff.role === "Admin"}
                  onApproveWriteOff={approveWriteOff} onRejectWriteOff={rejectWriteOff} />
              )}
              {tab === "reports" && <Reports products={products} history={history} currency={currency} inventoryValue={inventoryValue} onExport={exportReportCSV} refunds={refunds} productUnits={productUnits} />}
              {tab === "staff" && <Staff activeStaff={activeStaff} staffList={staffList} businessCode={settings.business_code} onSwitch={switchStaff} onAdd={addStaffMember} onDelete={deleteStaffMember} onSetupLogin={setupStaffLogin} />}
              {tab === "settings" && <SettingsPane settings={settings} onSave={saveSettings} products={products} deletedProducts={deletedProducts} onDeleteProduct={deleteProduct} onRestoreProduct={restoreProduct} />}
            </>
          )}
        </div>
      </div>
      </div>

      {historyProduct && <HistoryDrawer product={historyProduct} rows={productHistory(historyProduct.id)} currency={currency} onClose={() => setHistoryProduct(null)} />}

      {scanOpen && (
        <ScanModal mode={scanMode} setMode={switchScanMode} onClose={closeScan} allowedScans={allowedScans} lockMode={scanModeLocked}
          cameraStage={scanCameraStage} missCode={scanMissCode} unitError={scanUnitError} lastResult={scanLastResult} sessionCount={scanSessionCount}
          onRescan={rescan} cameraError={scanCameraError} setCameraError={setScanCameraError} onDetected={handleDetectedStable} onAddNew={addNewFromMissedCode}
          linkCandidates={scanLinkCandidates} linkSearch={scanLinkSearch} setLinkSearch={setScanLinkSearch} onLinkCode={linkExternalCode}
          writeOffPending={scanWriteOffPending} onFinalizeWriteOff={finalizeWriteOff}
          refundPending={scanRefundPending} onFinalizeAdminRefund={finalizeAdminRefund}
          pile={scanPile} onRemoveFromPile={removeFromPile} onDiscardPile={discardPile}
          onConfirmStockIn={confirmStockInBatch} onConfirmStockOut={confirmStockOutBatch} submitting={scanBatchSubmitting} currency={currency} />
      )}

      {addOpen && <AddProductModal onAdd={addProduct} initialSku={addInitialSku} currency={currency} onClose={() => { setAddOpen(false); setAddInitialSku(""); }} />}

      {receiptData && (
        <div className="tb-receipt-sheet">
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>{receiptData.businessName}</div>
          <div style={{ textAlign: "center", fontSize: 9, marginTop: 2 }}>{receiptData.date.toLocaleString()}</div>
          <div style={{ textAlign: "center", fontSize: 9 }}>Served by {receiptData.staff}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {receiptData.items.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
              <span>{line.name}</span>
              <span>{receiptData.currency}{line.price.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 11 }}>
            <span>TOTAL ({receiptData.items.length})</span>
            <span>{receiptData.currency}{receiptData.total.toLocaleString()}</span>
          </div>
          <div style={{ textAlign: "center", fontSize: 9, marginTop: 8 }}>Thank you!</div>
        </div>
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
function Dashboard({ settings, itemsSoldToday, stockAddedToday, todaysSales, inventoryValue, totalProductsAvailable, products, lowStock, outOfStock, expiringSoon, bestSellers, weeklyChart, currency, onScan, allowedScans, onSelectProduct }) {
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
        {allowedScans.length > 0 && (
          <div className="tb-scan-btns" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {allowedScans.includes("stock-in") && <ScanButton label="Stock In" icon={ArrowUpCircle} color={T.green} onClick={() => onScan("stock-in")} />}
            {allowedScans.includes("sale") && <ScanButton label="Stock Out" icon={ArrowDownCircle} color={T.stamp} onClick={() => onScan("sale")} />}
          </div>
        )}
      </div>

      <div style={{ background: T.cream, borderRadius: 4, padding: "16px 18px", marginBottom: 18, border: `1px dashed ${T.slateLight}` }}>
        <TallyStrip count={itemsSoldToday} label="items sold today" accent={T.stamp} />
      </div>

      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatStub label="Total Products" value={totalProductsAvailable.toLocaleString()} />
        <StatStub label="Stock Added Today" value={stockAddedToday} accent={T.green} />
        <StatStub label="Items Sold Today" value={itemsSoldToday} accent={T.stamp} />
        <StatStub label="Low Stock" value={lowStock.length} accent={T.amber} />
        <StatStub label="Out of Stock" value={outOfStock.length} accent={T.stamp} />
        <StatStub label="Today's Sales" value={fmt(todaysSales)} accent={T.green} />
        <StatStub label="Inventory Value" value={fmt(inventoryValue)} />
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
              <span style={{ ...mono, fontWeight: 700 }}>{p.qty}</span>
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
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onAdd({
      ...form,
      qty: 0,
      min_stock: Number(form.min_stock),
      purchase_price: Number(form.purchase_price),
      selling_price: Number(form.selling_price),
      expiry: form.expiry || null,
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

        <button type="submit" style={{ width: "100%", marginTop: 6, padding: "10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}>SAVE & GENERATE LABEL</button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------
   Sales / Reports / Staff / Settings
------------------------------------------------------------------*/
function Sales({ history, currency, refunds }) {
  const sales = useMemo(() => history.filter((h) => h.type === "sale"), [history]);
  const approvedRefunds = useMemo(() => (refunds || []).filter((r) => r.status === "approved"), [refunds]);
  // Matched by unit_code so each sale row can show whether *that exact
  // item* was later returned, and what happened to it \u2014 instead of the
  // sale and its refund just sitting there as two disconnected rows.
  const refundByUnitCode = useMemo(() => {
    const m = new Map();
    approvedRefunds.forEach((r) => { if (r.unit_code) m.set(r.unit_code, r); });
    return m;
  }, [approvedRefunds]);
  const refundValue = approvedRefunds.reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const total = Math.max(0, sales.reduce((s, h) => s + h.qty * Number(h.unit_price), 0) - refundValue);
  const todaySales = sales.filter((h) => h.occurred_on === todayStr);
  const todayApprovedRefunds = approvedRefunds.filter((r) => r.reviewed_at && r.reviewed_at.slice(0, 10) === todayStr);
  const todayRefundValue = todayApprovedRefunds.reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const todayRefundQty = todayApprovedRefunds.reduce((s, r) => s + Number(r.qty || 0), 0);
  const todayTotal = Math.max(0, todaySales.reduce((s, h) => s + h.qty * Number(h.unit_price), 0) - todayRefundValue);
  const todayItemsSold = Math.max(0, todaySales.reduce((s, h) => s + h.qty, 0) - todayRefundQty);
  return (
    <div>
      <PageHeader title="Sales" sub={`${sales.length} transactions logged`} />
      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        <StatStub label="Today's Sales" value={`${currency}${todayTotal.toLocaleString()}`} accent={T.green} />
        <StatStub label="Items Sold Today" value={todayItemsSold} accent={T.stamp} />
        <StatStub label="All-Time Revenue" value={`${currency}${total.toLocaleString()}`} />
      </div>

      <div className="tb-table-scroll" style={{ background: T.cream, borderRadius: 4, overflow: "hidden" }}>
       <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 0.5fr 0.8fr 0.8fr 0.8fr 1fr", padding: "10px 16px", ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, borderBottom: `1px solid ${T.paperDim}` }}>
          <span>Date</span><span>Product</span><span>Qty</span><span>Unit Price</span><span>Total</span><span>Staff</span><span>Status</span>
        </div>
        {sales.slice(0, 40).map((h) => {
          const refund = h.unit_code ? refundByUnitCode.get(h.unit_code) : null;
          return (
          <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 0.5fr 0.8fr 0.8fr 0.8fr 1fr", padding: "9px 16px", fontSize: 12.5, borderBottom: `1px solid ${T.paperDim}`, opacity: refund ? 0.65 : 1 }}>
            <span style={{ ...mono, color: T.slate }}>{h.occurred_on}</span>
            <span>{h.product_name}</span>
            <span style={{ ...mono }}>{h.qty}</span>
            <span style={{ ...mono }}>{currency}{Number(h.unit_price).toLocaleString()}</span>
            <span style={{ ...mono, fontWeight: 700, textDecoration: refund ? "line-through" : "none" }}>{currency}{(h.qty * Number(h.unit_price)).toLocaleString()}</span>
            <span style={{ color: T.slate }}>{h.staff}</span>
            <span style={{ ...mono, fontSize: 10.5, fontWeight: 700, color: refund ? T.amber : T.green }}>
              {refund ? (refund.disposition === "restock" ? "RETURNED \u2014 RESTOCKED" : "RETURNED \u2014 WRITTEN OFF") : "SOLD"}
            </span>
          </div>
          );
        })}
       </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Refunds — its own page, separate from Dashboard/Sales. Submitting
   a refund is scan-only (no manual product search — see ScanModal),
   recorded in its own table, and only affects stock once an Admin
   accepts it here.
------------------------------------------------------------------*/
function Refunds({ refunds, canScanRefund, onScan, canManageRefunds, onApproveRefund, onRejectRefund }) {
  const pending = useMemo(() => refunds.filter((r) => r.status === "pending"), [refunds]);
  const resolved = useMemo(() => refunds.filter((r) => r.status !== "pending").slice(0, 40), [refunds]);

  return (
    <div>
      <PageHeader title="Refunds" sub="Items returned by a customer — scanned in, then confirmed by an Admin before anything is added back to stock."
        actions={canScanRefund ? [{ label: "Scan Refund", icon: RotateCcw, onClick: onScan, solid: true }] : []} />

      {canManageRefunds && (
        <Panel title={`Pending Confirmation${pending.length ? ` (${pending.length})` : ""}`} icon={RotateCcw} iconColor={T.amber}>
          {pending.length === 0 && <Empty text="No refund requests waiting for confirmation." />}
          {pending.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.paperDim}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.product_name}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slateLight, marginTop: 1 }}>{r.unit_code}</div>
                <div style={{ fontSize: 11.5, color: T.slate, marginTop: 2 }}>Requested by {r.staff} · {new Date(r.requested_at).toLocaleString()}</div>
                {r.reason && <div style={{ fontSize: 11.5, color: T.slateLight, marginTop: 2, fontStyle: "italic" }}>"{r.reason}"</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                <button onClick={() => onApproveRefund(r, "restock")} style={{ padding: "7px 12px", borderRadius: 4, border: "none", background: T.green, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Restock</button>
                <button onClick={() => onApproveRefund(r, "write_off")} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.slate}`, background: "transparent", color: T.slate, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Write Off</button>
                <button onClick={() => onRejectRefund(r)} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.stamp}`, background: "transparent", color: T.stamp, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Reject</button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: T.slateLight, marginTop: 10 }}>
            <strong>Restock</strong> puts it back on the shelf to sell again. <strong>Write Off</strong> keeps the refund (money still went back to the customer) but the item itself doesn't return to stock \u2014 use this for anything damaged, opened, or not safe to resell.
          </div>
        </Panel>
      )}

      {!canManageRefunds && (
        <Panel title={`Awaiting Confirmation${pending.length ? ` (${pending.length})` : ""}`} icon={RotateCcw} iconColor={T.amber}>
          {pending.length === 0 && <Empty text="No refunds waiting on Admin confirmation." />}
          {pending.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.paperDim}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.product_name}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slateLight, marginTop: 1 }}>{r.unit_code}</div>
                <div style={{ fontSize: 11.5, color: T.slate }}>{new Date(r.requested_at).toLocaleString()}</div>
              </div>
              <span style={{ ...mono, fontSize: 11, color: T.amber, alignSelf: "center" }}>PENDING</span>
            </div>
          ))}
        </Panel>
      )}

      <div style={{ marginTop: 16 }}>
        <Panel title="Refund History">
          {resolved.length === 0 && <Empty text="No refunds have been resolved yet." />}
          {resolved.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.paperDim}`, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.product_name}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slateLight, marginTop: 1 }}>{r.unit_code}</div>
                <div style={{ fontSize: 11.5, color: T.slate }}>{r.staff} · {new Date(r.requested_at).toLocaleString()}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: r.status === "approved" ? T.green : T.stamp, textTransform: "uppercase" }}>{r.status}</div>
                {r.status === "approved" && r.disposition && <div style={{ fontSize: 10.5, color: T.slate, marginTop: 2 }}>{r.disposition === "restock" ? "Restocked" : "Written off"}</div>}
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function StockHealth({ products, unitCounts, history, currency, canWriteOff, onScanWriteOff, onSubmitReconciliation, writeOffs, canManageWriteOffs, onApproveWriteOff, onRejectWriteOff }) {
  const [counts, setCounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const pendingWriteOffs = useMemo(() => (writeOffs || []).filter((w) => w.status === "pending"), [writeOffs]);

  const setCount = (id, val) => setCounts((prev) => ({ ...prev, [id]: val }));

  const submit = async () => {
    const entries = Object.entries(counts).filter(([, v]) => v !== "" && v !== undefined);
    if (entries.length === 0) return;
    setSubmitting(true);
    const result = await onSubmitReconciliation(Object.fromEntries(entries));
    setSubmitting(false);
    setSummary(result);
    setCounts({});
  };

  const writeOffLog = useMemo(() => history.filter((h) => h.type === "write-off").slice(0, 40), [history]);

  return (
    <div>
      <PageHeader title="Stock Health" sub="Reconcile physical counts against the system, and keep a record of anything written off as damaged, expired, or lost."
        actions={canWriteOff ? [{ label: "Scan Write Off", icon: ClipboardCheck, onClick: onScanWriteOff, solid: true }] : []} />

      {canManageWriteOffs && (
        <Panel title={`Pending Write Offs${pendingWriteOffs.length ? ` (${pendingWriteOffs.length})` : ""}`} icon={ClipboardCheck} iconColor={T.amber}>
          {pendingWriteOffs.length === 0 && <Empty text="No write-off requests waiting for confirmation." />}
          {pendingWriteOffs.map((w) => (
            <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.paperDim}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{w.product_name}</div>
                {w.unit_code && <div style={{ ...mono, fontSize: 10.5, color: T.slateLight, marginTop: 1 }}>{w.unit_code}</div>}
                <div style={{ fontSize: 11.5, color: T.slate, marginTop: 2 }}>Requested by {w.staff} · {new Date(w.requested_at).toLocaleString()}</div>
                {w.reason && <div style={{ fontSize: 11.5, color: T.slateLight, marginTop: 2, fontStyle: "italic" }}>"{w.reason}"</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <span style={{ ...mono, fontSize: 11, color: T.slate, marginRight: 4 }}>{currency}{Number(w.purchase_price || 0).toLocaleString()}</span>
                <button onClick={() => onApproveWriteOff(w)} style={{ padding: "7px 12px", borderRadius: 4, border: "none", background: T.stamp, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Confirm Write Off</button>
                <button onClick={() => onRejectWriteOff(w)} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.slate}`, background: "transparent", color: T.slate, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Reject</button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: T.slateLight, marginTop: 10 }}>
            Item stays counted in stock and Inventory Value until you confirm. <strong>Confirm Write Off</strong> removes it from stock and logs the loss. <strong>Reject</strong> puts it back to normal, in-stock, with nothing lost.
          </div>
        </Panel>
      )}

      {!canManageWriteOffs && pendingWriteOffs.length > 0 && (
        <Panel title={`Awaiting Confirmation (${pendingWriteOffs.length})`} icon={ClipboardCheck} iconColor={T.amber}>
          {pendingWriteOffs.map((w) => (
            <div key={w.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.paperDim}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{w.product_name}</div>
                {w.unit_code && <div style={{ ...mono, fontSize: 10.5, color: T.slateLight, marginTop: 1 }}>{w.unit_code}</div>}
                <div style={{ fontSize: 11.5, color: T.slate }}>{new Date(w.requested_at).toLocaleString()}</div>
              </div>
              <span style={{ ...mono, fontSize: 11, color: T.amber, alignSelf: "center" }}>PENDING</span>
            </div>
          ))}
        </Panel>
      )}

      <Panel title="Reconcile" icon={ClipboardCheck} iconColor={T.blue}>
        <div style={{ fontSize: 12, color: T.slate, marginBottom: 12 }}>
          Physically count what's on the shelf and enter it below — leave anything you haven't counted this session blank. Counting fewer than expected writes off the shortfall (with a reason logged); counting more just gets flagged, since new stock needs its own code first (see Labels).
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 14px", alignItems: "center" }}>
          <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", color: T.slate }}>Item</div>
          <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", color: T.slate, textAlign: "center" }}>System</div>
          <div style={{ ...mono, fontSize: 10, textTransform: "uppercase", color: T.slate, textAlign: "center" }}>Counted</div>
          {products.map((p) => (
            <React.Fragment key={p.id}>
              <div style={{ fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.paperDim}` }}>{p.name}</div>
              <div style={{ ...mono, fontSize: 12.5, textAlign: "center", padding: "6px 0", borderBottom: `1px solid ${T.paperDim}` }}>{p.qty}</div>
              <div style={{ padding: "4px 0", borderBottom: `1px solid ${T.paperDim}`, textAlign: "center" }}>
                <input type="number" min="0" value={counts[p.id] ?? ""} onChange={(e) => setCount(p.id, e.target.value)} placeholder="—" style={{ width: 64, padding: "5px 6px", borderRadius: 4, border: `1px solid ${T.paperDim}`, fontSize: 12.5, textAlign: "center", ...mono }} />
              </div>
            </React.Fragment>
          ))}
        </div>
        {products.length === 0 && <Empty text="No items to reconcile yet." />}
        <button onClick={submit} disabled={submitting} style={{ marginTop: 14, padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 600 }}>
          {submitting ? "Submitting…" : "Submit Reconciliation"}
        </button>
        {summary && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: T.slate, background: T.paper, borderRadius: 4, padding: "10px 12px" }}>
            {summary.shortfalls === 0 && summary.overages === 0 ? "Everything matched — nothing to reconcile." : (
              <>
                {summary.shortfalls > 0 && <div>{summary.unitsWrittenOff} unit{summary.unitsWrittenOff === 1 ? "" : "s"} written off across {summary.shortfalls} item{summary.shortfalls === 1 ? "" : "s"} that came up short.</div>}
                {summary.overages > 0 && <div style={{ marginTop: summary.shortfalls > 0 ? 4 : 0 }}>{summary.overages} item{summary.overages === 1 ? "" : "s"} had more on hand than expected — visit Labels to tag the extra stock.</div>}
              </>
            )}
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title="Write-Off Log">
          {writeOffLog.length === 0 && <Empty text="Nothing written off yet." />}
          {writeOffLog.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.paperDim}`, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13 }}>{h.product_name}</div>
                {h.unit_code && <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{h.unit_code}</div>}
                <div style={{ fontSize: 11, color: T.slate }}>{h.staff} · {h.occurred_on}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {h.reason && <div style={{ ...mono, fontSize: 11, color: T.stamp, fontWeight: 600 }}>{h.reason}</div>}
                <div style={{ ...mono, fontSize: 11, color: T.slate }}>{currency}{Number(h.unit_price || 0).toLocaleString()} lost</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Reports({ products, history, currency, inventoryValue, onExport, refunds, productUnits }) {
  const grossRevenue = history.filter((h) => h.type === "sale").reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  // Refunds reduce revenue whether the item was restocked or written off —
  // the money genuinely left the till either way.
  const approvedRefunds = refunds.filter((r) => r.status === "approved");
  const refundValue = approvedRefunds.reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const totalSaleRevenue = grossRevenue - refundValue;
  // A refund-driven write-off already carries its own "write-off" history
  // row (reason: "Non-resellable return") with the item's cost — so its
  // cost must NOT also be pulled into the COGS total below via the
  // original sale, or that one unit's cost gets charged twice. Direct
  // write-offs (expired stock, shrinkage, etc.) never went through a sale
  // at all, so counting their cost here is correct and unaffected.
  const writeOffValue = history.filter((h) => h.type === "write-off" && h.reason !== "Non-resellable return").reduce((s, h) => s + h.qty * Number(h.unit_price || 0), 0);
  // A restocked refund puts the item back on the shelf unsold — its cost
  // shouldn't count as "cost of goods sold" anymore, so exclude the sale
  // rows for exactly those returned units. A written-off refund's cost is
  // still a real, permanent cost, so its original sale row still counts.
  const restockedUnitCodes = new Set(approvedRefunds.filter((r) => r.disposition === "restock" && r.unit_code).map((r) => r.unit_code));
  const totalCOGS = history.filter((h) => h.type === "sale").reduce((s, h) => {
    if (h.unit_code && restockedUnitCodes.has(h.unit_code)) return s;
    const p = products.find((pr) => pr.id === h.product_id);
    if (!p) return s;
    return s + h.qty * Number(p.purchase_price);
  }, 0);
  const profit = totalSaleRevenue - totalCOGS - writeOffValue;
  const restockedRefundValue = approvedRefunds.filter((r) => r.disposition === "restock").reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const writtenOffRefundValue = approvedRefunds.filter((r) => r.disposition === "write_off").reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    units: products.filter((p) => p.category === c).reduce((s, p) => s + p.qty, 0),
    value: products.filter((p) => p.category === c).reduce((s, p) => s + p.qty * Number(p.selling_price), 0),
  })).filter((c) => c.units > 0 || c.value > 0);
  return (
    <div>
      <PageHeader title="Reports" sub="Inventory, sales & profit summary" actions={[{ label: "Export Report CSV", icon: Download, onClick: onExport }]} />
      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
        <StatStub label="Total Revenue" value={`${currency}${totalSaleRevenue.toLocaleString()}`} accent={T.green} />
        <StatStub label="Cost of Goods Sold" value={`${currency}${totalCOGS.toLocaleString()}`} />
        <StatStub label="Gross Profit" value={`${currency}${profit.toLocaleString()}`} accent={T.stamp} />
      </div>
      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 20 }}>
        <StatStub label="Refunded — Restocked (net of revenue)" value={`${currency}${restockedRefundValue.toLocaleString()}`} accent={T.amber} />
        <StatStub label="Refunded — Written Off (net of revenue)" value={`${currency}${writtenOffRefundValue.toLocaleString()}`} accent={T.amber} />
      </div>
      <div className="tb-stat-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 20 }}>
        <StatStub label="Written Off — Direct (expired/damaged/lost, never sold)" value={`${currency}${writeOffValue.toLocaleString()}`} accent={T.amber} />
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

function Staff({ activeStaff, staffList, businessCode, onSwitch, onAdd, onDelete, onSetupLogin }) {
  const [pinTarget, setPinTarget] = useState(null); // staff member awaiting PIN entry
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isOwner = activeStaff.id === null;

  const [pinChecking, setPinChecking] = useState(false);
  const [setupTarget, setSetupTarget] = useState(null); // staff member awaiting a fresh PIN to enable device login
  const [setupPin, setSetupPin] = useState("");

  const chooseChip = (member) => {
    if (member.id === null) { onSwitch(member); return; } // Owner — already authenticated, no PIN needed
    setPinTarget(member); setPinValue(""); setPinError("");
  };

  // The PIN is never sent to this client for comparison — that's what let
  // any staff member read a coworker's PIN straight out of the staff list.
  // Instead we ask the database to check it (see hardening.sql for the
  // staff_verify_pin RPC, which hashes/compares server-side and returns
  // only true/false).
  const submitPin = async (e) => {
    e.preventDefault();
    setPinChecking(true);
    const { data: ok, error } = await supabase.rpc("staff_verify_pin", { p_staff_id: pinTarget.id, p_pin: pinValue });
    setPinChecking(false);
    if (!error && ok) { onSwitch(pinTarget); setPinTarget(null); }
    else setPinError("Incorrect PIN");
  };

  const copyCode = () => {
    if (!businessCode) return;
    navigator.clipboard?.writeText(businessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <PageHeader title="Staff" sub="Who's acting, and what they can do" actions={[]} />

      {isOwner && (
        <>
          <Panel title="Business Code" icon={Lock} iconColor={T.blue}>
            <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>
              Share this with your staff. On their own phone they log in with this code, their username, and their PIN — no need for your password, and no need to sign in here first.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...mono, fontSize: 20, fontWeight: 700, letterSpacing: "0.15em", background: T.paper, border: `1px solid ${T.paperDim}`, borderRadius: 4, padding: "8px 16px" }}>
                {businessCode || "\u2026"}
              </div>
              <button onClick={copyCode} disabled={!businessCode} style={{ padding: "9px 14px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: businessCode ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </Panel>
          <div style={{ height: 16 }} />
        </>
      )}

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
          Currently acting as <strong>{activeStaff.name}</strong> ({roleDisplay(activeStaff.role)}) on this device/session. This is a quick way to attribute scans to a team member without them logging in themselves — it's separate from a real device login above.
        </div>
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="Team Members">
        {staffList.length === 0 && <Empty text="No team members added yet." />}
        {staffList.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.paperDim}`, flexWrap: "wrap", gap: 8 }}>
            <div><span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span> <span style={{ fontSize: 12, color: T.slate }}>— {roleDisplay(s.role)}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isOwner && !s.auth_user_id && (
                <button onClick={() => { setSetupTarget(s); setSetupPin(""); }} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.blue}`, background: "transparent", color: T.blue, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Set up device login</button>
              )}
              {isOwner && s.auth_user_id && <span style={{ fontSize: 11, color: T.green }}>Can log in on their phone</span>}
              {isOwner && <button onClick={() => onDelete(s)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.stamp }}><X size={15} /></button>}
            </div>
          </div>
        ))}
        {isOwner && (
          <button onClick={() => setAddOpen(true)} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            <Plus size={13} /> Add Team Member
          </button>
        )}
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
            <input autoFocus type="password" inputMode="numeric" maxLength={6} value={pinValue} onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
              style={{ width: "100%", padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 18, textAlign: "center", letterSpacing: "0.3em", boxSizing: "border-box", outline: "none" }} />
            {pinError && <div style={{ color: T.stamp, fontSize: 12, marginTop: 8 }}>{pinError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setPinTarget(null)} style={{ flex: 1, padding: "9px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5 }}>Cancel</button>
              <button type="submit" disabled={pinChecking || pinValue.length !== 6} style={{ flex: 1, padding: "9px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: pinChecking ? "not-allowed" : "pointer", fontSize: 12.5, opacity: pinChecking ? 0.7 : 1 }}>{pinChecking ? "…" : "Confirm"}</button>
            </div>
          </form>
        </div>
      )}

      {addOpen && <AddStaffModal onAdd={(s) => { onAdd(s); setAddOpen(false); }} onClose={() => setAddOpen(false)} />}

      {setupTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setSetupTarget(null)} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
          <form onSubmit={(e) => { e.preventDefault(); if (!isPinAcceptable(setupPin)) return; onSetupLogin(setupTarget, setupPin); setSetupTarget(null); }} style={{ position: "relative", width: 300, background: T.cream, borderRadius: 6, padding: 22, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Set {setupTarget.name}'s PIN</div>
            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 14 }}>This is what they'll type on their own phone, along with the Business Code and their username.</div>
            <input autoFocus type="password" inputMode="numeric" minLength={6} maxLength={6} value={setupPin} onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ width: "100%", padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: T.paper, fontSize: 18, textAlign: "center", letterSpacing: "0.3em", boxSizing: "border-box", outline: "none" }} placeholder="123456" />
            {setupPin.length > 0 && !isPinAcceptable(setupPin) && <div style={{ fontSize: 11, color: T.stamp, marginTop: 8 }}>Needs to be 6 digits and not an obvious pattern.</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setSetupTarget(null)} style={{ flex: 1, padding: "9px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5 }}>Cancel</button>
              <button type="submit" disabled={!isPinAcceptable(setupPin)} style={{ flex: 1, padding: "9px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: isPinAcceptable(setupPin) ? "pointer" : "not-allowed", fontSize: 12.5, opacity: isPinAcceptable(setupPin) ? 1 : 0.6 }}>Save &amp; Enable</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AddStaffModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("Cashier");
  const submit = (e) => {
    e.preventDefault();
    if (!isPinAcceptable(pin)) { return; }
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
        <Field label="Username"><input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. tolu" /></Field>
        <Field label="PIN (6 digits)"><input required inputMode="numeric" minLength={6} maxLength={6} pattern="\d{6}" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} style={inputStyle} placeholder="123456" /></Field>
        {pin.length > 0 && !isPinAcceptable(pin) && <div style={{ fontSize: 11, color: T.stamp, marginTop: -6, marginBottom: 10 }}>Needs to be 6 digits and not an obvious pattern.</div>}
        <div style={{ fontSize: 11, color: T.slate, marginBottom: 12, marginTop: -6 }}>They'll use your Business Code (shown on the Staff page) plus this username and PIN to log in on their own phone.</div>
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

      <div style={{ height: 16 }} />
      <Panel title="Contact TallyBust" icon={LifeBuoy} iconColor={T.blue}>
        <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>
          Questions, a bug to report, or need a hand with something? Reach the TallyBust team directly.
        </div>
        <a href="mailto:support@tallybust.app" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 4, border: `1px solid ${T.ink}`, color: T.ink, textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}>
          support@tallybust.app
        </a>
      </Panel>
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
        {product.supplier && <div style={{ fontSize: 12, color: T.slate, marginBottom: 4 }}>Supplier: {product.supplier}</div>}
        {product.expiry && <div style={{ fontSize: 12, color: T.slate, marginBottom: 4 }}>Expiry: {product.expiry}{product.batch ? ` (batch ${product.batch})` : ""}</div>}
        <div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate, margin: "18px 0 8px" }}>Stock History</div>
        {withBalance.length === 0 && <Empty text="No transactions recorded yet." />}
        {withBalance.map((h) => {
          const isOutflow = h.type === "sale";
          return (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.paperDim}`, fontSize: 12.5 }}>
              <div><div style={{ fontWeight: 600, textTransform: "capitalize" }}>{h.type.replace("-", " ")}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{h.occurred_on} · {h.staff}</div></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...mono, color: isOutflow ? T.stamp : T.green, fontWeight: 700 }}>{isOutflow ? "-" : "+"}{h.qty}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>bal {h.balanceAfter}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScanModal({
  mode, setMode, onClose, allowedScans, lockMode,
  cameraStage, missCode, unitError, lastResult, sessionCount, onRescan, cameraError, setCameraError, onDetected, onAddNew,
  linkCandidates, linkSearch, setLinkSearch, onLinkCode,
  writeOffPending, onFinalizeWriteOff,
  refundPending, onFinalizeAdminRefund,
  pile, onRemoveFromPile, onDiscardPile, onConfirmStockIn, onConfirmStockOut, submitting, currency,
}) {
  const ALL_MODES = [{ id: "stock-in", label: "Stock In", color: T.green }, { id: "sale", label: "Stock Out", color: T.stamp }, { id: "refund", label: "Refund", color: T.amber }, { id: "write-off", label: "Write Off", color: T.slate }];
  const MODES = ALL_MODES.filter((m) => allowedScans.includes(m.id));
  const modeLabel = mode === "stock-in" ? "Stock In" : mode === "sale" ? "Stock Out" : mode === "refund" ? "Refund" : "Write Off";
  const piles = mode === "stock-in" || mode === "sale"; // these two modes pile up instead of finishing per scan
  const pileTotal = mode === "sale" ? pile.reduce((s, it) => s + (Number(it.product.selling_price) || 0), 0) : 0;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <div style={{ position: "relative", width: 420, maxWidth: "94vw", maxHeight: "92vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ScanLine size={18} /><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Scan</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {!lockMode && MODES.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 4, border: `1px solid ${mode === m.id ? m.color : T.paperDim}`, background: mode === m.id ? m.color : "transparent", color: mode === m.id ? T.cream : T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{m.label}</button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 10.5, color: T.slate }}>
            {piles ? `${modeLabel} \u2014 scan as many as you like, then ${mode === "sale" ? "mark them sold" : "accept them"} below.` : `${modeLabel} \u2014 scan one item at a time, no typing needed.`}
          </div>
          {!piles && sessionCount > 0 && <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: T.ink }}>{sessionCount} scanned</div>}
        </div>

        {piles && pile.length > 0 && (
          <div style={{ background: T.paper, border: `1px solid ${T.paperDim}`, borderRadius: 4, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderBottom: `1px solid ${T.paperDim}` }}>
              <span style={{ ...mono, fontSize: 11, fontWeight: 700 }}>{pile.length} item{pile.length === 1 ? "" : "s"} ready</span>
              <button onClick={onDiscardPile} style={{ border: "none", background: "transparent", color: T.stamp, cursor: "pointer", fontSize: 11 }}>Discard all</button>
            </div>
            <div style={{ maxHeight: 160, overflow: "auto" }}>
              {pile.map((it) => (
                <div key={it.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderBottom: `1px solid ${T.paperDim}` }}>
                  <div>
                    <div style={{ fontSize: 12.5 }}>{it.product.name}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.slateLight }}>{it.code}</div>
                  </div>
                  <button onClick={() => onRemoveFromPile(it.code)} style={{ border: "none", background: "transparent", color: T.stamp, cursor: "pointer" }}><X size={14} /></button>
                </div>
              ))}
            </div>
            {mode === "sale" && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderTop: `1px solid ${T.paperDim}`, ...mono, fontSize: 12, fontWeight: 700 }}>
                <span>Total</span>
                <span>{currency}{pileTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {lastResult && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#E9F6EF", border: "1px solid #BFE5D1", borderRadius: 4, padding: "9px 12px", marginBottom: 10 }}>
            <CheckSquare size={15} color={T.green} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.green }}>{lastResult.text}</div>
              <div style={{ ...mono, fontSize: 10, color: T.slate }}>{lastResult.code}</div>
            </div>
          </div>
        )}

        {unitError && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FDECEA", border: `1px solid ${T.stamp}`, borderRadius: 4, padding: "9px 12px", marginBottom: 10 }}>
            <AlertCircle size={15} color={T.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: T.stamp }}>{unitError}</div>
          </div>
        )}

        {cameraStage === "scanning" && (
          <div style={{ marginBottom: 12 }}>
            <CameraScanner key={mode} onDetected={onDetected} onError={(err) => setCameraError(String(err && err.message ? err.message : err))} />
            <div style={{ fontSize: 11, color: T.slate, marginTop: 6 }}>Point the camera at the item's unique sticker. It'll keep scanning automatically — close this when you're done.</div>
            {cameraError && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: T.stamp, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Couldn't access the camera ({cameraError}). Check that this page has camera permission and is loaded over HTTPS.</span>
                </div>
                <button onClick={onRescan} style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Try again</button>
              </div>
            )}
          </div>
        )}

        {cameraStage === "off" && !cameraError && !missCode && !writeOffPending && !refundPending && (
          <div style={{ textAlign: "center", padding: "18px 10px" }}>
            <button onClick={onRescan} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...mono }}>
              <Camera size={14} /> SCAN NEXT
            </button>
          </div>
        )}

        {writeOffPending && (
          <div style={{ background: T.paper, borderRadius: 4, padding: "10px 12px", marginTop: 4 }}>
            <div style={{ fontSize: 12.5, marginBottom: 4 }}>
              <strong>{writeOffPending.product.name}</strong> <span style={{ ...mono, color: T.slateLight }}>({writeOffPending.unit.code})</span>
            </div>
            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 10 }}>Why is this being written off?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {WRITE_OFF_REASONS.map((r) => (
                <button key={r} onClick={() => onFinalizeWriteOff(r)} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.slate}`, background: "transparent", color: T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{r}</button>
              ))}
            </div>
          </div>
        )}

        {refundPending && (
          <div style={{ background: T.paper, borderRadius: 4, padding: "10px 12px", marginTop: 4 }}>
            <div style={{ fontSize: 12.5, marginBottom: 4 }}>
              <strong>{refundPending.product.name}</strong> <span style={{ ...mono, color: T.slateLight }}>({refundPending.unit.code})</span>
            </div>
            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 10 }}>Refund this back to the customer — does the item go back on the shelf, or is it not resellable?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button onClick={() => onFinalizeAdminRefund("restock")} style={{ padding: "7px 12px", borderRadius: 4, border: "none", background: T.green, color: T.cream, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Restock</button>
              <button onClick={() => onFinalizeAdminRefund("write_off")} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${T.slate}`, background: "transparent", color: T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Write Off</button>
            </div>
          </div>
        )}

        {missCode && (
          <div style={{ background: T.paper, borderRadius: 4, padding: "10px 12px", marginTop: 4 }}>
            {mode === "stock-in" ? (
              <>
                <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                  Code <strong style={{ ...mono }}>{missCode}</strong> isn't one of ours yet — which item is this?
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.cream, borderRadius: 4, padding: "8px 10px", marginBottom: 8 }}>
                  <Search size={13} color={T.slate} />
                  <input autoFocus value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Search item name or SKU..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1 }} />
                </div>
                <div style={{ maxHeight: 180, overflow: "auto", marginBottom: 8 }}>
                  {linkCandidates.slice(0, 20).map((p) => (
                    <div key={p.id} onClick={() => onLinkCode(missCode, p)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 6px", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
                      <div><div style={{ fontSize: 13 }}>{p.name}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</div></div>
                      <div style={{ ...mono, fontSize: 11, color: T.slate, alignSelf: "center" }}>{p.qty} in stock</div>
                    </div>
                  ))}
                  {linkCandidates.length === 0 && <div style={{ fontSize: 12, color: T.slate, padding: "6px 4px" }}>No matching item.</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={onAddNew} style={{ padding: "6px 10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>It's a brand-new item</button>
                  <button onClick={onRescan} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12.5 }}>Scanned code <strong style={{ ...mono }}>{missCode}</strong> doesn't match any item.</div>
                <button onClick={onRescan} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Scan again</button>
              </>
            )}
          </div>
        )}

        {piles && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.paperDim}` }}>
            <button
              onClick={mode === "stock-in" ? onConfirmStockIn : onConfirmStockOut}
              disabled={pile.length === 0 || submitting}
              style={{ width: "100%", padding: "12px", borderRadius: 4, border: "none", background: (pile.length && !submitting) ? (mode === "stock-in" ? T.green : T.stamp) : T.slateLight, color: "#fff", cursor: (pile.length && !submitting) ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, ...mono }}
            >
              {submitting ? "SAVING\u2026" : mode === "stock-in" ? `ACCEPT${pile.length ? ` ${pile.length} ITEM${pile.length === 1 ? "" : "S"}` : ""}` : `MARK ${pile.length || ""} SOLD \u0026 PRINT RECEIPT`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

