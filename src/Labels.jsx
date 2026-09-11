import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, CheckSquare, Square, Plus, Loader2 } from "lucide-react";

const T = { ink: "#0A1220", paper: "#FFFFFF", cream: "#F5F7FB", slate: "#5B6472", paperDim: "#E3E8F0", blue: "#1E4FD6", green: "#1F7A4B", amber: "#B9822A" };
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

// Each unit's label is now its own unique, one-time-use code — scanning
// it always means exactly one physical item, never "type a quantity".
export default function Labels({ products, unitCounts, businessName, onAddProduct, onGenerateUnits }) {
  const [selected, setSelected] = useState(() => new Set(products.map((p) => p.id)));
  const [genCounts, setGenCounts] = useState({});
  const [printBatch, setPrintBatch] = useState([]); // [{ code, product }] queued for the next print
  const [generating, setGenerating] = useState(false);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  };
  const setGenCount = (id, n) => setGenCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.min(500, Number(n) || 0)) }));
  const genCount = (id) => (id in genCounts ? genCounts[id] : 1);

  const countsFor = (id) => unitCounts.get(id) || { unstocked: 0, in_stock: 0, sold: 0 };

  const chosen = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected]);
  const totalToGenerate = useMemo(() => chosen.reduce((s, p) => s + genCount(p.id), 0), [chosen, genCounts]);

  // Generates a fresh, unique code for every unit requested across the
  // selected products, then prints just that new batch.
  const generateAndPrint = async () => {
    if (totalToGenerate === 0 || generating) return;
    setGenerating(true);
    const batch = [];
    for (const p of chosen) {
      const n = genCount(p.id);
      if (n <= 0) continue;
      const rows = await onGenerateUnits(p.id, n, false);
      for (const row of rows) batch.push({ code: row.code, product: p });
    }
    setGenerating(false);
    setPrintBatch(batch);
    setGenCounts({});
    // Let the print sheet render with the new batch before opening the dialog.
    setTimeout(() => window.print(), 60);
  };

  // For a product whose current stock qty is ahead of how many coded
  // units it has "in stock" — usually stock entered before this system
  // existed — this retroactively creates codes for the difference,
  // already marked in_stock, so those existing boxes can be tagged too.
  const tagExistingStock = async (p) => {
    const c = countsFor(p.id);
    const untagged = Math.max(0, p.qty - c.in_stock);
    if (untagged === 0) return;
    setGenerating(true);
    const rows = await onGenerateUnits(p.id, untagged, true);
    setGenerating(false);
    setPrintBatch(rows.map((row) => ({ code: row.code, product: p })));
    setTimeout(() => window.print(), 60);
  };

  return (
    <div>
      <div className="tb-no-print">
        <div className="tb-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <h1 style={{ ...body, fontSize: 22, fontWeight: 700, margin: 0 }}>Labels</h1>
            <div style={{ fontSize: 12.5, color: T.slate, marginTop: 2, maxWidth: 480 }}>
              Add a new item to register it, then generate labels for a shipment — each sticker gets its own unique code for one specific physical item. Scan each one individually to stock it in or sell it; no quantities to type.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onAddProduct}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...body }}
            >
              <Plus size={13} /> Add Item
            </button>
            <button
              onClick={generateAndPrint}
              disabled={totalToGenerate === 0 || generating}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", color: T.ink, cursor: (totalToGenerate && !generating) ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 600, ...body, opacity: generating ? 0.6 : 1 }}
            >
              {generating ? <Loader2 size={13} className="tb-spin" /> : <Printer size={13} />} {generating ? "Generating…" : `Generate & Print${totalToGenerate ? ` (${totalToGenerate})` : ""}`}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div
            onClick={toggleAll}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", width: "fit-content", fontSize: 12.5, color: T.slate }}
          >
            {selected.size === products.length ? <CheckSquare size={15} /> : <Square size={15} />}
            Select all
          </div>
          <div style={{ ...mono, fontSize: 11.5, color: T.slate }}>
            {products.length} item{products.length === 1 ? "" : "s"} registered
            {totalToGenerate > 0 ? ` · ${totalToGenerate} new label${totalToGenerate === 1 ? "" : "s"} queued` : ""}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, marginBottom: 26 }}>
          {products.map((p) => {
            const c = countsFor(p.id);
            const untagged = Math.max(0, p.qty - c.in_stock);
            return (
              <div
                key={p.id}
                style={{
                  background: T.cream,
                  borderRadius: 4,
                  padding: 10,
                  border: `1px solid ${selected.has(p.id) ? T.ink : T.paperDim}`,
                }}
              >
                <div onClick={() => toggle(p.id)} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  {selected.has(p.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.slate }}>{p.sku}</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={genCount(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setGenCount(p.id, e.target.value)}
                    title="How many new unique labels to generate for this item"
                    style={{ width: 44, padding: "3px 4px", borderRadius: 3, border: `1px solid ${T.paperDim}`, fontSize: 11, textAlign: "center", flexShrink: 0, ...mono }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 10, ...mono }}>
                  <span style={{ color: T.green }}>{c.in_stock} in stock</span>
                  <span style={{ color: T.amber }}>{c.unstocked} not scanned in</span>
                  {c.opened > 0 && <span style={{ color: T.blue }}>{c.opened} opened for loose sale</span>}
                  <span style={{ color: T.slate }}>{c.sold} sold</span>
                  {c.written_off > 0 && <span style={{ color: T.slate }}>{c.written_off} written off</span>}
                </div>
                {untagged > 0 && (
                  <button onClick={() => tagExistingStock(p)} disabled={generating} style={{ marginTop: 8, width: "100%", padding: "6px 8px", borderRadius: 4, border: `1px dashed ${T.slate}`, background: "transparent", color: T.slate, cursor: generating ? "not-allowed" : "pointer", fontSize: 10.5 }}>
                    {untagged} existing unit{untagged === 1 ? "" : "s"} have no code yet — tag &amp; print
                  </button>
                )}
              </div>
            );
          })}
          {products.length === 0 && <div style={{ fontSize: 12.5, color: T.slate }}>No items yet — click "Add Item" above to register your first one.</div>}
        </div>
      </div>

      {/* print-only label sheet — only the most recently generated batch */}
      <div className="tb-print-sheet">
        {printBatch.map(({ code, product }, i) => (
          <div key={code} className="tb-label">
            <QRCodeSVG value={code} size={78} level="M" includeMargin={false} />
            <div className="tb-label-text">
              <div className="tb-label-name">{product.name}</div>
              <div className="tb-label-sku">{code}</div>
              <div className="tb-label-biz">{businessName}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .tb-print-sheet { display: none; }
        .tb-spin { animation: tb-spin 0.8s linear infinite; }
        @keyframes tb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          body * { visibility: hidden; }
          .tb-no-print { display: none !important; }
          .tb-print-sheet, .tb-print-sheet * { visibility: visible; }
          .tb-print-sheet {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8mm;
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            padding: 8mm;
          }
          .tb-label {
            display: flex;
            align-items: center;
            gap: 3mm;
            border: 0.5px dashed #999;
            padding: 3mm;
            break-inside: avoid;
          }
          .tb-label-text { font-family: 'Work Sans', sans-serif; min-width: 0; }
          .tb-label-name { font-size: 8.5pt; font-weight: 600; line-height: 1.15; }
          .tb-label-sku { font-family: 'Space Mono', monospace; font-size: 7pt; margin-top: 1mm; }
          .tb-label-biz { font-size: 6.5pt; color: #666; margin-top: 1mm; }
        }
      `}</style>
    </div>
  );
}
