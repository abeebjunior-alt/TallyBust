import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, ScanLine, Package, Receipt, BarChart3, Users, Settings as SettingsIcon,
  Search, AlertTriangle, Download, X, Check, ChevronRight, Shuffle, ArrowUpCircle,
  ArrowDownCircle, ClipboardList, Plus, LogOut, Camera, List, Tag, AlertCircle, RotateCcw, Divide,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import CameraScanner from "./CameraScanner";
import Labels from "./Labels";

const T = {
  ink: "#14140F", inkSoft: "#201F18", paper: "#ECE6D6", paperDim: "#DFD8C4",
  stamp: "#A6331F", stampSoft: "#C9694F", green: "#2F6845", greenSoft: "#5C9A78",
  amber: "#C08829", slate: "#6E6858", slateLight: "#9A9382", cream: "#F6F2E8",
};
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };
const CATEGORIES = ["Medicine", "Supermarket", "Beverages", "Electronics", "Cosmetics", "Other"];
const STAFF_NAMES = ["Admin", "Mary", "John", "Fatima"];
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const todayStr = iso(today);

function productStatus(p) {
  if (p.qty === 0) return "critical";
  if (p.qty <= p.min_stock) return "low";
  return "ok";
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Splash />;
  if (!session) return <Login />;
  return <TallyBust userId={session.user.id} userEmail={session.user.email} />;
}

function Splash() {
  return <div style={{ background: T.ink, minHeight: "100vh", color: T.paper, ...mono, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>;
}

/* --------------------------------------------------------------- */

function TallyBust({ userId, userEmail }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [totalStockIn, setTotalStockIn] = useState(0);
  const [settings, setSettings] = useState({ business_name: "My Business", currency: "\u20a6" });
  const [tab, setTab] = useState("dashboard");
  const [activeStaff, setActiveStaff] = useState("Admin");

  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState("stock-in");
  const [scanProductId, setScanProductId] = useState("");
  const [scanQty, setScanQty] = useState("");
  const [scanSearch, setScanSearch] = useState("");
  const [scanCameraOn, setScanCameraOn] = useState(false);
  const [scanMissCode, setScanMissCode] = useState("");
  const [scanCameraError, setScanCameraError] = useState("");
  const [addInitialSku, setAddInitialSku] = useState("");

  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("All");
  const [historyProduct, setHistoryProduct] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const fireToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prod, error: e1 }, { data: hist, error: e2 }, { data: settingsRow, error: e3 }, { data: refundRows, error: e4 }, { data: stockInRows, error: e5 }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("stock_history").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("refunds").select("*").order("requested_at", { ascending: false }),
      supabase.from("stock_history").select("qty").eq("type", "stock-in"),
    ]);
    if (e1) fireToast(`Error loading products: ${e1.message}`);
    if (e2) fireToast(`Error loading history: ${e2.message}`);
    if (e4) fireToast(`Error loading refunds: ${e4.message}`);
    if (!settingsRow && !e3) {
      await supabase.from("settings").insert({ user_id: userId });
      setSettings({ business_name: "My Business", currency: "\u20a6" });
    } else if (settingsRow) {
      setSettings(settingsRow);
    }
    setProducts(prod || []);
    setHistory(hist || []);
    setRefunds(refundRows || []);
    setTotalStockIn(e5 ? 0 : (stockInRows || []).reduce((s, r) => s + r.qty, 0));
    setLoading(false);
  }, [userId, fireToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ---------- derived metrics ---------- */
  const isSoldType = (t) => t === "sale" || t === "unit-sale";
  const todayHistory = useMemo(() => history.filter((h) => h.occurred_on === todayStr), [history]);
  const itemsSoldToday = useMemo(() => todayHistory.filter((h) => isSoldType(h.type)).reduce((s, h) => s + h.qty, 0), [todayHistory]);
  const stockAddedToday = useMemo(() => todayHistory.filter((h) => h.type === "stock-in").reduce((s, h) => s + h.qty, 0), [todayHistory]);
  const todaysSales = useMemo(() => todayHistory.filter((h) => isSoldType(h.type)).reduce((s, h) => s + h.qty * Number(h.unit_price), 0), [todayHistory]);
  const inventoryValue = useMemo(() => products.reduce((s, p) => {
    const packValue = p.qty * Number(p.purchase_price);
    const perUnitCost = p.unit_enabled && p.unit_qty ? Number(p.purchase_price) / p.unit_qty : 0;
    const looseValue = (p.loose_units || 0) * perUnitCost;
    return s + packValue + looseValue;
  }, 0), [products]);
  const lowStock = useMemo(() => products.filter((p) => productStatus(p) === "low"), [products]);
  const outOfStock = useMemo(() => products.filter((p) => productStatus(p) === "critical"), [products]);
  const expiringSoon = useMemo(() => products.filter((p) => {
    if (!p.expiry) return false;
    const days = Math.round((new Date(p.expiry) - today) / 86400000);
    return days <= 30 && days >= 0;
  }), [products]);

  const bestSellers = useMemo(() => {
    const totals = {};
    history.filter((h) => isSoldType(h.type)).forEach((h) => { totals[h.product_id] = (totals[h.product_id] || 0) + h.qty; });
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
      const inQty = dayRows.filter((h) => h.type === "stock-in").reduce((s, h) => s + h.qty, 0);
      const outQty = dayRows.filter((h) => isSoldType(h.type)).reduce((s, h) => s + h.qty, 0);
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

  /* ---------- actions ---------- */
  const openScan = (mode) => {
    setScanMode(mode); setScanProductId(""); setScanQty(""); setScanSearch("");
    setScanCameraOn(false); setScanMissCode(""); setScanCameraError("");
    setScanOpen(true);
  };
  const randomScan = () => { const pick = products[Math.floor(Math.random() * products.length)]; if (pick) setScanProductId(pick.id); setScanSearch(""); };

  const handleDetectedCode = (rawCode) => {
    const code = rawCode.trim();
    const match = products.find((p) => p.sku.trim().toLowerCase() === code.toLowerCase());
    setScanCameraOn(false);
    if (match) {
      setScanMissCode("");
      setScanProductId(match.id);
    } else {
      setScanMissCode(code);
    }
  };

  const addNewFromMissedCode = () => {
    setAddInitialSku(scanMissCode);
    setScanOpen(false);
    setAddOpen(true);
  };

  const confirmScan = async () => {
    if (!scanProduct || !scanQty || Number(scanQty) < 0) return;
    const n = Number(scanQty);
    let newQty = scanProduct.qty;
    if (scanMode === "stock-in") newQty = scanProduct.qty + n;
    if (scanMode === "sale") newQty = Math.max(0, scanProduct.qty - n);
    if (scanMode === "count") newQty = n;

    const { error: e1 } = await supabase.from("products").update({ qty: newQty }).eq("id", scanProduct.id);
    const { error: e2 } = await supabase.from("stock_history").insert({
      user_id: userId,
      product_id: scanProduct.id,
      product_name: scanProduct.name,
      type: scanMode,
      qty: scanMode === "count" ? Math.abs(newQty - scanProduct.qty) || n : n,
      unit_price: scanMode === "sale" ? scanProduct.selling_price : scanProduct.purchase_price,
      staff: activeStaff,
      occurred_on: todayStr,
    });
    if (e1 || e2) { fireToast(`Save failed: ${(e1 || e2).message}`); return; }

    fireToast(scanMode === "stock-in" ? `Stocked in ${n} \u00d7 ${scanProduct.name}` : scanMode === "sale" ? `Sold ${n} \u00d7 ${scanProduct.name}` : `Count set: ${scanProduct.name} \u2192 ${newQty}`);
    setScanOpen(false);
    loadAll();
  };

  const addProduct = async (form) => {
    const { error } = await supabase.from("products").insert({ user_id: userId, ...form });
    if (error) { fireToast(`Could not add product: ${error.message}`); return; }
    fireToast(`Added ${form.name}`);
    setAddOpen(false);
    loadAll();
  };

  const updateUnitSettings = async (productId, fields) => {
    const { error } = await supabase.from("products").update(fields).eq("id", productId);
    if (error) { fireToast(`Could not update: ${error.message}`); return; }
    fireToast("Unit sale settings updated");
    loadAll();
  };

  // Sells N loose units of a unit-enabled product. If there aren't enough
  // loose units already sitting open, it "opens" as many whole packs as
  // needed (converting each into unit_qty loose units) before deducting
  // the sale — so a pack's qty only drops when it's actually broken open.
  const sellUnits = async (product, qtyToSell) => {
    const n = Number(qtyToSell);
    if (!product.unit_enabled || !product.unit_qty || n <= 0) return;
    let loose = product.loose_units || 0;
    let packs = product.qty;

    if (loose < n) {
      const unitsNeeded = n - loose;
      const packsToOpen = Math.ceil(unitsNeeded / product.unit_qty);
      if (packsToOpen > packs) {
        fireToast(`Not enough stock — only ${packs} pack(s) and ${loose} loose unit(s) of ${product.name} available.`);
        return;
      }
      packs -= packsToOpen;
      loose += packsToOpen * product.unit_qty;
    }
    loose -= n;

    const { error: e1 } = await supabase.from("products").update({ qty: packs, loose_units: loose }).eq("id", product.id);
    const { error: e2 } = await supabase.from("stock_history").insert({
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      type: "unit-sale",
      qty: n,
      unit_price: product.unit_price,
      staff: activeStaff,
      occurred_on: todayStr,
    });
    if (e1 || e2) { fireToast(`Save failed: ${(e1 || e2).message}`); return; }
    fireToast(`Sold ${n} unit${n === 1 ? "" : "s"} of ${product.name}`);
    loadAll();
  };

  // A product can only be refunded if it has actually been sold at least
  // once (stock-in → sold, never straight off a freshly generated code).
  // Returns how many units are still eligible: total ever sold, minus
  // whatever's already been approved-refunded for that product.
  const checkRefundEligibility = async (productId) => {
    const [{ data: sold, error: e1 }, { data: refunded, error: e2 }] = await Promise.all([
      supabase.from("stock_history").select("qty").eq("product_id", productId).eq("type", "sale"),
      supabase.from("refunds").select("qty").eq("product_id", productId).eq("status", "approved"),
    ]);
    if (e1 || e2) return { eligible: false, maxQty: 0 };
    const totalSold = (sold || []).reduce((s, r) => s + r.qty, 0);
    const totalRefunded = (refunded || []).reduce((s, r) => s + r.qty, 0);
    const maxQty = Math.max(0, totalSold - totalRefunded);
    return { eligible: maxQty > 0, maxQty };
  };

  const requestRefund = async ({ product, qty, reason }) => {
    const { error } = await supabase.from("refunds").insert({
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      qty: Number(qty),
      unit_price: product.selling_price,
      reason: reason || null,
      requested_by: activeStaff,
    });
    if (error) { fireToast(`Could not submit refund: ${error.message}`); return; }
    fireToast(`Refund requested for ${product.name} — awaiting approval`);
    loadAll();
  };

  const approveRefund = async (refund) => {
    const product = products.find((p) => p.id === refund.product_id);
    if (!product) { fireToast("That product no longer exists."); return; }
    const newQty = product.qty + refund.qty;
    const { error: e1 } = await supabase.from("products").update({ qty: newQty }).eq("id", product.id);
    const { error: e2 } = await supabase.from("stock_history").insert({
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      type: "refund",
      qty: refund.qty,
      unit_price: refund.unit_price,
      staff: activeStaff,
      occurred_on: todayStr,
    });
    const { error: e3 } = await supabase.from("refunds").update({
      status: "approved", approved_by: activeStaff, approved_at: new Date().toISOString(),
    }).eq("id", refund.id);
    if (e1 || e2 || e3) { fireToast(`Approval failed: ${(e1 || e2 || e3).message}`); return; }
    fireToast(`Refund approved — ${refund.qty} \u00d7 ${refund.product_name} back in stock`);
    loadAll();
  };

  const rejectRefund = async (refund) => {
    const { error } = await supabase.from("refunds").update({
      status: "rejected", approved_by: activeStaff, approved_at: new Date().toISOString(),
    }).eq("id", refund.id);
    if (error) { fireToast(`Could not reject: ${error.message}`); return; }
    fireToast(`Refund rejected for ${refund.product_name}`);
    loadAll();
  };

  const exportCSV = () => {
    const header = ["Name", "SKU", "Category", "Qty", "Min Stock", "Purchase Price", "Selling Price", "Supplier", "Expiry", "Sold By Unit", "Unit Qty Per Pack", "Unit Price", "Loose Units"];
    const lines = products.map((p) => [p.name, p.sku, p.category, p.qty, p.min_stock, p.purchase_price, p.selling_price, p.supplier || "", p.expiry || "", p.unit_enabled ? "Yes" : "No", p.unit_qty || "", p.unit_price || "", p.loose_units || 0].join(","));
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
    { id: "unit-sales", label: "Unit Sales", icon: Divide },
    { id: "refunds", label: "Refunds", icon: RotateCcw },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "staff", label: "Staff", icon: Users },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const currency = settings.currency || "\u20a6";

  return (
    <div style={{ ...body, background: T.ink, minHeight: "100vh", color: T.ink, display: "flex", fontSize: 14 }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ width: 190, flexShrink: 0, background: T.ink, color: T.paper, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 22px" }}>
          <svg width="22" height="26" viewBox="0 0 26 30">
            <line x1="4" y1="4" x2="4" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="9" y1="4" x2="9" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="14" y1="4" x2="14" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="19" y1="4" x2="19" y2="26" stroke={T.paper} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="2" y1="26" x2="22" y2="4" stroke={T.stampSoft} strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <div style={{ ...mono, fontWeight: 700, fontSize: 15 }}>TallyBust</div>
        </div>

        {NAV.map((n) => {
          const Icon = n.icon; const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 4, border: "none", background: active ? T.paper : "transparent", color: active ? T.ink : T.slateLight, cursor: "pointer", fontSize: 13, ...body, fontWeight: active ? 600 : 500, textAlign: "left" }}>
              <Icon size={15} /> {n.label}
            </button>
          );
        })}

        <div style={{ marginTop: "auto", paddingTop: 18, borderTop: `1px solid ${T.inkSoft}` }}>
          <button onClick={() => openScan("stock-in")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 10px", borderRadius: 4, border: "none", background: T.stamp, color: T.cream, cursor: "pointer", fontWeight: 700, ...mono, fontSize: 12.5 }}>
            <ScanLine size={16} /> SCAN
          </button>
          <div style={{ ...mono, fontSize: 9.5, color: T.slateLight, marginTop: 10, textAlign: "center", wordBreak: "break-all" }}>{userEmail}</div>
          <button onClick={signOut} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "7px", borderRadius: 4, border: "none", background: "transparent", color: T.slateLight, cursor: "pointer", fontSize: 11 }}>
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: T.paper, minHeight: "100vh", overflow: "auto" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "26px 30px 60px" }}>
          {loading ? (
            <div style={{ ...mono, color: T.slate, padding: "40px 0" }}>Loading your data…</div>
          ) : (
            <>
              {tab === "dashboard" && (
                <Dashboard settings={settings} itemsSoldToday={itemsSoldToday} stockAddedToday={stockAddedToday} todaysSales={todaysSales}
                  inventoryValue={inventoryValue} totalStockIn={totalStockIn} products={products} lowStock={lowStock} outOfStock={outOfStock}
                  expiringSoon={expiringSoon} bestSellers={bestSellers} weeklyChart={weeklyChart} currency={currency} onScan={openScan}
                  onSelectProduct={(p) => { setTab("inventory"); setHistoryProduct(p); }} />
              )}
              {tab === "inventory" && (
                <Inventory products={filteredProducts} search={invSearch} setSearch={setInvSearch} category={invCategory} setCategory={setInvCategory}
                  currency={currency} onExport={exportCSV} onOpenHistory={setHistoryProduct} onAdd={() => setAddOpen(true)} />
              )}
              {tab === "labels" && <Labels products={products} businessName={settings.business_name} />}
              {tab === "sales" && <Sales history={history} currency={currency} />}
              {tab === "unit-sales" && (
                <UnitSales products={products} history={history} currency={currency} onSell={sellUnits} />
              )}
              {tab === "refunds" && (
                <Refunds refunds={refunds} products={products} currency={currency}
                  onCheckEligibility={checkRefundEligibility} onRequest={requestRefund}
                  onApprove={approveRefund} onReject={rejectRefund} />
              )}
              {tab === "reports" && <Reports products={products} history={history} currency={currency} inventoryValue={inventoryValue} onExport={exportCSV} />}
              {tab === "staff" && <Staff activeStaff={activeStaff} setActiveStaff={setActiveStaff} />}
              {tab === "settings" && <SettingsPane settings={settings} onSave={saveSettings} />}
            </>
          )}
        </div>
      </div>

      {historyProduct && <HistoryDrawer product={products.find((p) => p.id === historyProduct.id) || historyProduct} rows={productHistory(historyProduct.id)} currency={currency} onClose={() => setHistoryProduct(null)} onUpdateUnitSettings={updateUnitSettings} />}

      {scanOpen && (
        <ScanModal mode={scanMode} setMode={setScanMode} candidates={scanCandidates} search={scanSearch} setSearch={setScanSearch}
          selected={scanProduct} setSelected={setScanProductId} qty={scanQty} setQty={setScanQty} onRandom={randomScan}
          onConfirm={confirmScan} onClose={() => setScanOpen(false)} currency={currency}
          cameraOn={scanCameraOn} setCameraOn={setScanCameraOn} missCode={scanMissCode} setMissCode={setScanMissCode}
          cameraError={scanCameraError} setCameraError={setScanCameraError} onDetected={handleDetectedCode} onAddNew={addNewFromMissedCode} />
      )}

      {addOpen && <AddProductModal onAdd={addProduct} initialSku={addInitialSku} onClose={() => { setAddOpen(false); setAddInitialSku(""); }} />}

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
      {strokes === 5 && <line x1={2} y1={26} x2={22} y2={4} stroke={T.stamp} strokeWidth="2.6" strokeLinecap="round" />}
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
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
function Dashboard({ settings, itemsSoldToday, stockAddedToday, todaysSales, inventoryValue, totalStockIn, products, lowStock, outOfStock, expiringSoon, bestSellers, weeklyChart, currency, onScan, onSelectProduct }) {
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const fmt = (n) => currency + n.toLocaleString();
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <div style={{ ...mono, fontSize: 11, color: T.slate, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h1 style={{ ...body, fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>{greeting}, {settings.business_name} 👋</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ScanButton label="Stock In" icon={ArrowUpCircle} color={T.green} onClick={() => onScan("stock-in")} />
          <ScanButton label="Stock Out" icon={ArrowDownCircle} color={T.stamp} onClick={() => onScan("sale")} />
          <ScanButton label="Count" icon={ClipboardList} color={T.ink} onClick={() => onScan("count")} />
        </div>
      </div>

      <div style={{ background: T.cream, borderRadius: 4, padding: "16px 18px", marginBottom: 18, border: `1px dashed ${T.slateLight}` }}>
        <TallyStrip count={itemsSoldToday} label="items sold today" accent={T.stamp} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <StatStub label="Total Stock In" value={totalStockIn.toLocaleString()} />
        <StatStub label="Stock Added Today" value={stockAddedToday} accent={T.green} />
        <StatStub label="Items Sold Today" value={itemsSoldToday} accent={T.stamp} />
        <StatStub label="Low Stock" value={lowStock.length} accent={T.amber} />
        <StatStub label="Out of Stock" value={outOfStock.length} accent={T.stamp} />
        <StatStub label="Today's Sales" value={fmt(todaysSales)} accent={T.green} />
        <StatStub label="Inventory Value" value={fmt(inventoryValue)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
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
function Inventory({ products, search, setSearch, category, setCategory, currency, onExport, onOpenHistory, onAdd }) {
  return (
    <div>
      <PageHeader title="Inventory" sub={`${products.length} products`} actions={[
        { label: "Add Product", icon: Plus, onClick: onAdd, solid: true },
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
      <div style={{ background: T.cream, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr", padding: "10px 16px", ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, borderBottom: `1px solid ${T.paperDim}` }}>
          <span>Product</span><span>Category</span><span>Stock</span><span>Status</span><span>Value</span><span></span>
        </div>
        {products.length === 0 && <Empty text="No products yet — add your first one." />}
        {products.map((p) => {
          const status = productStatus(p);
          return (
            <div key={p.id} onClick={() => onOpenHistory(p)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr", padding: "11px 16px", alignItems: "center", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}`, fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</div>
                {p.unit_enabled && (
                  <div style={{ fontSize: 10.5, color: T.slate, marginTop: 1 }}>
                    {p.unit_qty}/pack \u00b7 {p.loose_units || 0} loose unit{(p.loose_units || 0) === 1 ? "" : "s"} open
                  </div>
                )}
              </div>
              <span style={{ color: T.slate, fontSize: 12.5 }}>{p.category}</span>
              <span style={{ ...mono }}>{p.qty}</span>
              <span style={{ display: "flex", alignItems: "center" }}><StatusDot status={status} /><span style={{ fontSize: 11.5, color: T.slate, textTransform: "capitalize" }}>{status === "critical" ? "Out" : status === "low" ? "Low" : "OK"}</span></span>
              <span style={{ ...mono, fontSize: 12.5 }}>{currency}{(p.qty * Number(p.purchase_price)).toLocaleString()}</span>
              <ChevronRight size={14} color={T.slateLight} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddProductModal({ onAdd, onClose, initialSku }) {
  const [form, setForm] = useState({ name: "", category: "Medicine", sku: initialSku || "", qty: 0, min_stock: 5, purchase_price: 0, selling_price: 0, supplier: "", expiry: "", batch: "", unit_enabled: false, unit_qty: "", unit_price: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onAdd({
      ...form,
      qty: Number(form.qty), min_stock: Number(form.min_stock), purchase_price: Number(form.purchase_price), selling_price: Number(form.selling_price), expiry: form.expiry || null,
      unit_enabled: form.unit_enabled,
      unit_qty: form.unit_enabled && form.unit_qty ? Number(form.unit_qty) : null,
      unit_price: form.unit_enabled && form.unit_price ? Number(form.unit_price) : null,
    });
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <form onSubmit={submit} style={{ position: "relative", width: 420, maxHeight: "86vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Product</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {initialSku && (
          <div style={{ fontSize: 12, color: T.slate, marginBottom: 12, background: T.paper, borderRadius: 4, padding: "8px 10px" }}>
            Scanned code <strong style={{ ...mono }}>{initialSku}</strong> didn't match anything yet — fill in the rest and it'll be linked to this code from now on.
          </div>
        )}
        <Field label="Name"><input required value={form.name} onChange={set("name")} style={inputStyle} /></Field>
        <Field label="SKU"><input required value={form.sku} onChange={set("sku")} style={inputStyle} placeholder="TB-000000" /></Field>
        <Field label="Category">
          <select value={form.category} onChange={set("category")} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Opening Qty"><input type="number" value={form.qty} onChange={set("qty")} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Min Stock"><input type="number" value={form.min_stock} onChange={set("min_stock")} style={inputStyle} /></Field></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Purchase Price"><input type="number" value={form.purchase_price} onChange={set("purchase_price")} style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Selling Price (per pack)"><input type="number" value={form.selling_price} onChange={set("selling_price")} style={inputStyle} /></Field></div>
        </div>
        <Field label="Supplier"><input value={form.supplier} onChange={set("supplier")} style={inputStyle} /></Field>
        <Field label="Expiry (optional)"><input type="date" value={form.expiry} onChange={set("expiry")} style={inputStyle} /></Field>

        <div style={{ background: T.paper, borderRadius: 4, padding: "12px 14px", marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            <input type="checkbox" checked={form.unit_enabled} onChange={(e) => setForm({ ...form, unit_enabled: e.target.checked })} />
            Also sellable in units (e.g. sell single tablets out of a pack)
          </label>
          {form.unit_enabled && (
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Units Per Pack"><input type="number" min="1" value={form.unit_qty} onChange={set("unit_qty")} style={inputStyle} placeholder="e.g. 12" /></Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Price Per Unit"><input type="number" min="0" value={form.unit_price} onChange={set("unit_price")} style={inputStyle} placeholder="e.g. 100" /></Field>
              </div>
            </div>
          )}
        </div>

        <button type="submit" style={{ width: "100%", marginTop: 6, padding: "10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12.5 }}>SAVE PRODUCT</button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------
   Sales / Reports / Staff / Settings
------------------------------------------------------------------*/
function Sales({ history, currency }) {
  const sales = useMemo(() => history.filter((h) => h.type === "sale"), [history]);
  const total = sales.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  const todaySales = sales.filter((h) => h.occurred_on === todayStr);
  const todayTotal = todaySales.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  return (
    <div>
      <PageHeader title="Sales" sub={`${sales.length} transactions logged`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        <StatStub label="Today's Sales" value={`${currency}${todayTotal.toLocaleString()}`} accent={T.green} />
        <StatStub label="Items Sold Today" value={todaySales.reduce((s, h) => s + h.qty, 0)} accent={T.stamp} />
        <StatStub label="All-Time Revenue" value={`${currency}${total.toLocaleString()}`} />
      </div>
      <div style={{ background: T.cream, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.6fr 0.9fr 0.9fr 0.9fr", padding: "10px 16px", ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, borderBottom: `1px solid ${T.paperDim}` }}>
          <span>Date</span><span>Product</span><span>Qty</span><span>Unit Price</span><span>Total</span><span>Staff</span>
        </div>
        {sales.slice(0, 40).map((h) => (
          <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.6fr 0.9fr 0.9fr 0.9fr", padding: "9px 16px", fontSize: 12.5, borderBottom: `1px solid ${T.paperDim}` }}>
            <span style={{ ...mono, color: T.slate }}>{h.occurred_on}</span>
            <span>{h.product_name}</span>
            <span style={{ ...mono }}>{h.qty}</span>
            <span style={{ ...mono }}>{currency}{Number(h.unit_price).toLocaleString()}</span>
            <span style={{ ...mono, fontWeight: 700 }}>{currency}{(h.qty * Number(h.unit_price)).toLocaleString()}</span>
            <span style={{ color: T.slate }}>{h.staff}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnitSales({ products, history, currency, onSell }) {
  const [sellOpen, setSellOpen] = useState(false);
  const unitRows = useMemo(() => history.filter((h) => h.type === "unit-sale"), [history]);
  const total = unitRows.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  const todayRows = unitRows.filter((h) => h.occurred_on === todayStr);
  const todayTotal = todayRows.reduce((s, h) => s + h.qty * Number(h.unit_price), 0);
  const unitEnabledProducts = useMemo(() => products.filter((p) => p.unit_enabled), [products]);

  return (
    <div>
      <PageHeader
        title="Unit Sales"
        sub={`${unitRows.length} unit sales logged`}
        actions={[{ label: "Sell Unit", icon: Divide, onClick: () => setSellOpen(true), solid: true }]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        <StatStub label="Today's Unit Sales" value={`${currency}${todayTotal.toLocaleString()}`} accent={T.green} />
        <StatStub label="Units Sold Today" value={todayRows.reduce((s, h) => s + h.qty, 0)} accent={T.stamp} />
        <StatStub label="All-Time Unit Revenue" value={`${currency}${total.toLocaleString()}`} />
      </div>

      {unitEnabledProducts.length === 0 && (
        <div style={{ background: T.cream, borderRadius: 4, padding: "14px 16px", marginBottom: 16, fontSize: 12.5, color: T.slate }}>
          No products are set up for unit selling yet. Turn it on when adding a product, or open any product's history and tap "Edit" next to unit settings.
        </div>
      )}

      <div style={{ background: T.cream, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.6fr 0.9fr 0.9fr 0.9fr", padding: "10px 16px", ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate, borderBottom: `1px solid ${T.paperDim}` }}>
          <span>Date</span><span>Product</span><span>Units</span><span>Unit Price</span><span>Total</span><span>Staff</span>
        </div>
        {unitRows.length === 0 && <Empty text="No unit sales recorded yet." />}
        {unitRows.slice(0, 40).map((h) => (
          <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.6fr 0.9fr 0.9fr 0.9fr", padding: "9px 16px", fontSize: 12.5, borderBottom: `1px solid ${T.paperDim}` }}>
            <span style={{ ...mono, color: T.slate }}>{h.occurred_on}</span>
            <span>{h.product_name}</span>
            <span style={{ ...mono }}>{h.qty}</span>
            <span style={{ ...mono }}>{currency}{Number(h.unit_price).toLocaleString()}</span>
            <span style={{ ...mono, fontWeight: 700 }}>{currency}{(h.qty * Number(h.unit_price)).toLocaleString()}</span>
            <span style={{ color: T.slate }}>{h.staff}</span>
          </div>
        ))}
      </div>

      {sellOpen && (
        <SellUnitModal
          products={unitEnabledProducts}
          currency={currency}
          onSell={(product, qty) => { onSell(product, qty); setSellOpen(false); }}
          onClose={() => setSellOpen(false)}
        />
      )}
    </div>
  );
}

function SellUnitModal({ products, currency, onSell, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState("");

  const candidates = useMemo(() => {
    if (!search) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const maxAvailable = selected ? (selected.loose_units || 0) + selected.qty * selected.unit_qty : 0;
  const canSubmit = selected && qty && Number(qty) > 0 && Number(qty) <= maxAvailable;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <div style={{ position: "relative", width: 420, maxHeight: "86vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Divide size={17} /><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Sell Unit</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {!selected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.paper, borderRadius: 4, padding: "8px 10px", marginBottom: 10 }}>
              <Search size={13} color={T.slate} />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1 }} />
            </div>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {candidates.slice(0, 30).map((p) => (
                <div key={p.id} onClick={() => { setSelected(p); setQty(""); }} style={{ display: "flex", justifyContent: "space-between", padding: "9px 8px", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku} \u00b7 {currency}{Number(p.unit_price).toLocaleString()}/unit</div></div>
                  <div style={{ ...mono, fontSize: 12, color: T.slate }}>{p.loose_units || 0} loose \u00b7 {p.qty} packs</div>
                </div>
              ))}
              {candidates.length === 0 && <Empty text="No matching unit-sellable product." />}
            </div>
          </>
        ) : (
          <div>
            <div style={{ background: T.paper, borderRadius: 4, padding: 14, marginBottom: 12 }}>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{selected.sku}</div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0" }}>{selected.name}</div>
              <div style={{ fontSize: 12.5, color: T.slate }}>
                {selected.loose_units || 0} loose unit{(selected.loose_units || 0) === 1 ? "" : "s"} open \u00b7 {selected.qty} unopened pack{selected.qty === 1 ? "" : "s"} ({selected.unit_qty}/pack)
              </div>
            </div>
            <Field label="Units to Sell">
              <input type="number" min="1" max={maxAvailable} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={inputStyle} />
            </Field>
            <div style={{ fontSize: 12, color: T.slate, marginBottom: 10 }}>
              {maxAvailable} unit{maxAvailable === 1 ? "" : "s"} available in total{Number(qty) > (selected.loose_units || 0) ? " \u2014 this will open a new pack" : ""}.
            </div>
            {qty && Number(qty) > 0 && (
              <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>Total: {currency}{(Number(qty) * selected.unit_price).toLocaleString()}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Back</button>
              <button
                onClick={() => onSell(selected, qty)}
                disabled={!canSubmit}
                style={{ flex: 2, padding: "10px", borderRadius: 4, border: "none", background: canSubmit ? T.ink : T.slateLight, color: T.cream, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, ...mono }}
              >
                CONFIRM SALE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Refunds({ refunds, products, currency, onCheckEligibility, onRequest, onApprove, onReject }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const pending = refunds.filter((r) => r.status === "pending");
  const resolved = refunds.filter((r) => r.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Refunds"
        sub={`${pending.length} pending approval`}
        actions={[{ label: "Request Refund", icon: RotateCcw, onClick: () => setRequestOpen(true), solid: true }]}
      />

      <Panel title="Pending Approval">
        {pending.length === 0 && <Empty text="No refund requests waiting." />}
        {pending.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.paperDim}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.qty} \u00d7 {r.product_name}</div>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>
                requested by {r.requested_by} \u00b7 {r.requested_at.slice(0, 10)}{r.reason ? ` \u00b7 "${r.reason}"` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onReject(r)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Reject</button>
              <button onClick={() => onApprove(r)} style={{ padding: "6px 10px", borderRadius: 4, border: "none", background: T.green, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Approve</button>
            </div>
          </div>
        ))}
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title="History">
        {resolved.length === 0 && <Empty text="Approved and rejected refunds will show up here." />}
        {resolved.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.paperDim}` }}>
            <div>
              <div style={{ fontSize: 13 }}>{r.qty} \u00d7 {r.product_name}</div>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>
                {r.requested_by} \u2192 {r.approved_by || "\u2014"} \u00b7 {(r.approved_at || r.requested_at).slice(0, 10)}
              </div>
            </div>
            <span style={{ ...mono, fontSize: 11.5, fontWeight: 700, color: r.status === "approved" ? T.green : T.stamp, textTransform: "uppercase" }}>{r.status}</span>
          </div>
        ))}
      </Panel>

      {requestOpen && (
        <RequestRefundModal
          products={products}
          currency={currency}
          onCheckEligibility={onCheckEligibility}
          onSubmit={(payload) => { onRequest(payload); setRequestOpen(false); }}
          onClose={() => setRequestOpen(false)}
        />
      )}
    </div>
  );
}

function RequestRefundModal({ products, currency, onCheckEligibility, onSubmit, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [checking, setChecking] = useState(false);
  const [eligibility, setEligibility] = useState(null); // { eligible, maxQty }
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  const candidates = useMemo(() => {
    if (!search) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const pick = async (product) => {
    setSelected(product);
    setQty("");
    setChecking(true);
    const result = await onCheckEligibility(product.id);
    setEligibility(result);
    setChecking(false);
  };

  const canSubmit = selected && eligibility && eligibility.eligible && qty && Number(qty) > 0 && Number(qty) <= eligibility.maxQty;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <div style={{ position: "relative", width: 420, maxHeight: "86vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><RotateCcw size={17} /><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Request Refund</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {!selected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.paper, borderRadius: 4, padding: "8px 10px", marginBottom: 10 }}>
              <Search size={13} color={T.slate} />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU..." style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1 }} />
            </div>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {candidates.slice(0, 30).map((p) => (
                <div key={p.id} onClick={() => pick(p)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 8px", cursor: "pointer", borderBottom: `1px solid ${T.paperDim}` }}>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{p.sku}</div></div>
                  <div style={{ ...mono, fontSize: 12, color: T.slate }}>{p.qty} in stock</div>
                </div>
              ))}
              {candidates.length === 0 && <Empty text="No matching product." />}
            </div>
          </>
        ) : (
          <div>
            <div style={{ background: T.paper, borderRadius: 4, padding: 14, marginBottom: 12 }}>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{selected.sku}</div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0" }}>{selected.name}</div>
            </div>

            {checking && <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>Checking refund eligibility\u2026</div>}

            {!checking && eligibility && !eligibility.eligible && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: T.paper, borderRadius: 4, padding: "10px 12px", marginBottom: 12, fontSize: 12.5 }}>
                <AlertCircle size={15} color={T.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>This item hasn't been sold yet (or every sold unit has already been refunded), so it can't be refunded right now \u2014 a refund can only be made against a completed sale.</span>
              </div>
            )}

            {!checking && eligibility && eligibility.eligible && (
              <>
                <div style={{ fontSize: 12, color: T.slate, marginBottom: 10 }}>Up to {eligibility.maxQty} unit{eligibility.maxQty === 1 ? "" : "s"} eligible for refund.</div>
                <Field label="Quantity to Refund">
                  <input type="number" min="1" max={eligibility.maxQty} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={inputStyle} />
                </Field>
                <Field label="Reason (optional)">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} placeholder="e.g. customer returned damaged item" />
                </Field>
                {qty && Number(qty) > 0 && (
                  <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>Refund value: {currency}{(Number(qty) * selected.selling_price).toLocaleString()}</div>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => { setSelected(null); setEligibility(null); }} style={{ flex: 1, padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Back</button>
              <button
                onClick={() => onSubmit({ product: selected, qty, reason })}
                disabled={!canSubmit}
                style={{ flex: 2, padding: "10px", borderRadius: 4, border: "none", background: canSubmit ? T.ink : T.slateLight, color: T.cream, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, ...mono }}
              >
                SUBMIT FOR APPROVAL
              </button>
            </div>
          </div>
        )}
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
      const perUnitCost = p.unit_enabled && p.unit_qty ? Number(p.purchase_price) / p.unit_qty : 0;
      return s + h.qty * perUnitCost;
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
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

const ROLES = [
  { role: "Admin", access: "Full access — every module" },
  { role: "Manager", access: "Inventory, Sales, Reports" },
  { role: "Cashier", access: "Stock Out / Sales only" },
  { role: "Storekeeper", access: "Stock In / Stock Count only" },
];
function Staff({ activeStaff, setActiveStaff }) {
  return (
    <div>
      <PageHeader title="Staff" sub="Roles and the team member acting on transactions" actions={[]} />
      <Panel title="Acting As">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STAFF_NAMES.map((s) => (
            <button key={s} onClick={() => setActiveStaff(s)} style={{ padding: "7px 14px", borderRadius: 4, border: `1px solid ${activeStaff === s ? T.ink : T.paperDim}`, background: activeStaff === s ? T.ink : "transparent", color: activeStaff === s ? T.paper : T.ink, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{s}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T.slate, marginTop: 10 }}>Every scan and adjustment is recorded against whoever is acting — every transaction is auditable.</div>
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Roles &amp; Access">
        {ROLES.map((r, i) => (
          <div key={r.role} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < ROLES.length - 1 ? `1px solid ${T.paperDim}` : "none" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{r.role}</span>
            <span style={{ fontSize: 12.5, color: T.slate }}>{r.access}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function SettingsPane({ settings, onSave }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);
  return (
    <div>
      <PageHeader title="Settings" sub="Business details" actions={[]} />
      <Panel title="Business Profile">
        <Field label="Business Name"><input value={local.business_name} onChange={(e) => setLocal({ ...local, business_name: e.target.value })} style={inputStyle} /></Field>
        <Field label="Currency Symbol"><input value={local.currency} onChange={(e) => setLocal({ ...local, currency: e.target.value })} style={{ ...inputStyle, width: 70 }} /></Field>
        <button onClick={() => onSave(local)} style={{ padding: "9px 16px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, fontWeight: 700, cursor: "pointer", ...mono, fontSize: 12 }}>SAVE</button>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   History drawer & Scan modal
------------------------------------------------------------------*/
function HistoryDrawer({ product, rows, currency, onClose, onUpdateUnitSettings }) {
  const [editingUnits, setEditingUnits] = useState(false);
  const [unitForm, setUnitForm] = useState({
    unit_enabled: product.unit_enabled || false,
    unit_qty: product.unit_qty || "",
    unit_price: product.unit_price || "",
  });

  let running = product.qty;
  const withBalance = rows.map((r) => {
    const entry = { ...r, balanceAfter: running };
    if (r.type === "stock-in") running -= r.qty;
    if (r.type === "sale") running += r.qty;
    return entry;
  });

  const saveUnitSettings = () => {
    onUpdateUnitSettings(product.id, {
      unit_enabled: unitForm.unit_enabled,
      unit_qty: unitForm.unit_enabled && unitForm.unit_qty ? Number(unitForm.unit_qty) : null,
      unit_price: unitForm.unit_enabled && unitForm.unit_price ? Number(unitForm.unit_price) : null,
    });
    setEditingUnits(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.45)" }} />
      <div style={{ position: "relative", width: 380, background: T.cream, height: "100%", padding: "22px 20px", overflow: "auto" }}>
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

        <div style={{ background: T.paper, borderRadius: 4, padding: "12px 14px", margin: "14px 0" }}>
          {!editingUnits ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12.5 }}>
                {product.unit_enabled
                  ? <>Sold by unit: <strong>{product.unit_qty}/pack</strong> at <strong>{currency}{Number(product.unit_price).toLocaleString()}</strong>/unit — {product.loose_units || 0} loose unit{(product.loose_units || 0) === 1 ? "" : "s"} open now</>
                  : "Not currently sellable in units"}
              </div>
              <button onClick={() => setEditingUnits(true)} style={{ padding: "5px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Edit</button>
            </div>
          ) : (
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
                <input type="checkbox" checked={unitForm.unit_enabled} onChange={(e) => setUnitForm({ ...unitForm, unit_enabled: e.target.checked })} />
                Sellable in units
              </label>
              {unitForm.unit_enabled && (
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}><Field label="Units Per Pack"><input type="number" min="1" value={unitForm.unit_qty} onChange={(e) => setUnitForm({ ...unitForm, unit_qty: e.target.value })} style={inputStyle} /></Field></div>
                  <div style={{ flex: 1 }}><Field label="Price Per Unit"><input type="number" min="0" value={unitForm.unit_price} onChange={(e) => setUnitForm({ ...unitForm, unit_price: e.target.value })} style={inputStyle} /></Field></div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditingUnits(false)} style={{ flex: 1, padding: "7px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Cancel</button>
                <button onClick={saveUnitSettings} style={{ flex: 1, padding: "7px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Save</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate, margin: "18px 0 8px" }}>Stock History</div>
        {withBalance.length === 0 && <Empty text="No transactions recorded yet." />}
        {withBalance.map((h) => {
          const isOut = h.type === "sale" || h.type === "unit-sale";
          return (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.paperDim}`, fontSize: 12.5 }}>
              <div><div style={{ fontWeight: 600, textTransform: "capitalize" }}>{h.type.replace("-", " ")}</div><div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{h.occurred_on} · {h.staff}</div></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...mono, color: isOut ? T.stamp : T.green, fontWeight: 700 }}>{isOut ? "-" : "+"}{h.qty}{h.type === "unit-sale" ? " unit" + (h.qty === 1 ? "" : "s") : ""}</div>
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
  mode, setMode, candidates, search, setSearch, selected, setSelected, qty, setQty, onRandom, onConfirm, onClose, currency,
  cameraOn, setCameraOn, missCode, setMissCode, cameraError, setCameraError, onDetected, onAddNew,
}) {
  const MODES = [{ id: "stock-in", label: "Stock In", color: T.green }, { id: "sale", label: "Stock Out", color: T.stamp }, { id: "count", label: "Stock Count", color: T.ink }];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,15,0.55)" }} />
      <div style={{ position: "relative", width: 420, maxHeight: "86vh", overflow: "auto", background: T.cream, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ScanLine size={18} /><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Scan</h2></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 4, border: `1px solid ${mode === m.id ? m.color : T.paperDim}`, background: mode === m.id ? m.color : "transparent", color: mode === m.id ? T.cream : T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{m.label}</button>
          ))}
        </div>
        {!selected ? (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button
                onClick={() => { setMissCode(""); setCameraError(""); setCameraOn(!cameraOn); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 4, border: `1px solid ${T.ink}`, background: cameraOn ? T.ink : "transparent", color: cameraOn ? T.cream : T.ink, cursor: "pointer", fontSize: 12, fontWeight: 600, flex: 1 }}
              >
                <Camera size={14} /> {cameraOn ? "Stop Camera" : "Use Camera"}
              </button>
              <button onClick={onRandom} title="Pick a random product (demo)" style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11, color: T.slate }}>
                <Shuffle size={13} /> Random
              </button>
            </div>

            {cameraOn && (
              <div style={{ marginBottom: 12 }}>
                <CameraScanner onDetected={onDetected} onError={(err) => setCameraError(String(err && err.message ? err.message : err))} />
                <div style={{ fontSize: 11, color: T.slate, marginTop: 6 }}>Point the camera at the product's barcode or QR sticker.</div>
                {cameraError && (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11.5, color: T.stamp, marginTop: 8 }}>
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Couldn't access the camera ({cameraError}). Check that this page has camera permission and is loaded over HTTPS, or use search below instead.</span>
                  </div>
                )}
              </div>
            )}

            {missCode && (
              <div style={{ background: T.paper, borderRadius: 4, padding: "10px 12px", marginBottom: 12, fontSize: 12.5 }}>
                Scanned code <strong style={{ ...mono }}>{missCode}</strong> isn't linked to any product yet.
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={onAddNew} style={{ padding: "6px 10px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Add as new product</button>
                  <button onClick={() => setMissCode("")} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 11.5 }}>Dismiss</button>
                </div>
              </div>
            )}

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
        ) : (
          <div>
            <div style={{ background: T.paper, borderRadius: 4, padding: 14, marginBottom: 12 }}>
              <div style={{ ...mono, fontSize: 10.5, color: T.slateLight }}>{selected.sku}</div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0" }}>{selected.name}</div>
              <div style={{ fontSize: 12.5, color: T.slate }}>Current stock: {selected.qty}</div>
            </div>
            <Field label={mode === "count" ? "Counted Quantity" : mode === "stock-in" ? "Quantity Received" : "Quantity Sold"}>
              <input type="number" min="0" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={inputStyle} />
            </Field>
            {mode === "sale" && qty && <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 10 }}>Total: {currency}{(Number(qty) * selected.selling_price).toLocaleString()}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => setSelected("")} style={{ flex: 1, padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Back</button>
              <button onClick={onConfirm} disabled={!qty} style={{ flex: 2, padding: "10px", borderRadius: 4, border: "none", background: qty ? T.ink : T.slateLight, color: T.cream, cursor: qty ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, ...mono }}>
                CONFIRM {mode === "stock-in" ? "STOCK IN" : mode === "sale" ? "SALE" : "COUNT"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
