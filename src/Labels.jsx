import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, CheckSquare, Square, Plus, Tag } from "lucide-react";

const T = { ink: "#0A1220", paper: "#FFFFFF", cream: "#F5F7FB", slate: "#5B6472", paperDim: "#E3E8F0", blue: "#1E4FD6", green: "#1F7A4B" };
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

export default function Labels({ products, businessName, onAddProduct, onPrinted }) {
  const [selected, setSelected] = useState(() => new Set(products.map((p) => p.id)));
  const [copies, setCopies] = useState({});

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
  const setCopyCount = (id, n) => setCopies((prev) => ({ ...prev, [id]: Math.max(1, Math.min(500, Number(n) || 1)) }));
  const copyCount = (id) => copies[id] || 1;

  const chosen = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected]);
  const totalLabels = useMemo(() => chosen.reduce((s, p) => s + copyCount(p.id), 0), [chosen, copies]);

  const productsWithLabels = useMemo(() => products.filter((p) => (p.labels_printed_count || 0) > 0).length, [products]);

  const handlePrint = () => {
    if (totalLabels === 0) return;
    if (onPrinted) onPrinted(chosen.map((p) => ({ id: p.id, count: copyCount(p.id) })));
    // give the DB update a beat to fire before the print dialog steals focus
    setTimeout(() => window.print(), 50);
  };

  return (
    <div>
      <div className="tb-no-print">
        <div className="tb-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <h1 style={{ ...body, fontSize: 22, fontWeight: 700, margin: 0 }}>Labels</h1>
            <div style={{ fontSize: 12.5, color: T.slate, marginTop: 2, maxWidth: 460 }}>
              Add a new item to register it and generate its QR code. Set how many copies to print (e.g. 10 units received = 10 identical stickers) — one per physical item, all reading back to the same product.
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
              onClick={handlePrint}
              disabled={totalLabels === 0}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", color: T.ink, cursor: totalLabels ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 600, ...body }}
            >
              <Printer size={13} /> Print {totalLabels ? `(${totalLabels})` : ""}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 18, padding: "9px 12px", borderRadius: 4, background: T.cream, width: "fit-content", ...mono, fontSize: 11.5 }}>
          <Tag size={13} color={T.green} />
          <span>Labels generated for <strong>{productsWithLabels}</strong> of <strong>{products.length}</strong> product{products.length === 1 ? "" : "s"}</span>
        </div>

        <div
          onClick={toggleAll}
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", width: "fit-content", fontSize: 12.5, color: T.slate }}
        >
          {selected.size === products.length ? <CheckSquare size={15} /> : <Square size={15} />}
          Select all
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 26 }}>
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              style={{
                background: T.cream,
                borderRadius: 4,
                padding: 10,
                cursor: "pointer",
                border: `1px solid ${selected.has(p.id) ? T.ink : T.paperDim}`,
                display: "flex",
                gap: 8,
                alignItems: "center",
                position: "relative",
              }}
            >
              {selected.has(p.id) ? <CheckSquare size={15} /> : <Square size={15} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  {(p.labels_printed_count || 0) > 0 && (
                    <span title={`${p.labels_printed_count} label(s) printed`} style={{ flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                  )}
                </div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slate }}>{p.sku}</div>
              </div>
              <input
                type="number"
                min={1}
                max={500}
                value={copyCount(p.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setCopyCount(p.id, e.target.value)}
                title="How many copies of this QR code to print"
                style={{ width: 40, padding: "3px 4px", borderRadius: 3, border: `1px solid ${T.paperDim}`, fontSize: 11, textAlign: "center", flexShrink: 0, ...mono }}
              />
              {p.qty > 0 ? (
                <span style={{ ...mono, fontSize: 9.5, color: "#1F7A4B", flexShrink: 0 }}>{p.qty} in stock</span>
              ) : (
                <span style={{ ...mono, fontSize: 9.5, color: "#B9822A", flexShrink: 0 }}>not stocked in</span>
              )}
            </div>
          ))}
          {products.length === 0 && <div style={{ fontSize: 12.5, color: T.slate }}>No items yet — click "Add Item" above to register your first one and generate its label.</div>}
        </div>
      </div>

      {/* print-only label sheet */}
      <div className="tb-print-sheet">
        {chosen.flatMap((p) => {
          const total = copyCount(p.id);
          return Array.from({ length: total }).map((_, i) => (
            <div key={`${p.id}-${i}`} className="tb-label">
              <QRCodeSVG value={p.sku} size={78} level="M" includeMargin={false} />
              <div className="tb-label-text">
                <div className="tb-label-name">{p.name}</div>
                <div className="tb-label-sku">{p.sku}</div>
                <div className="tb-label-biz">{businessName}</div>
                {total > 1 && <div className="tb-label-count">#{i + 1} of {total}</div>}
              </div>
            </div>
          ));
        })}
      </div>

      <style>{`
        .tb-print-sheet { display: none; }
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
          .tb-label-sku { font-family: 'Space Mono', monospace; font-size: 7.5pt; margin-top: 1mm; }
          .tb-label-biz { font-size: 6.5pt; color: #666; margin-top: 1mm; }
          .tb-label-count { font-family: 'Space Mono', monospace; font-size: 6.5pt; color: #1E4FD6; font-weight: 700; margin-top: 0.5mm; }
        }
      `}</style>
    </div>
  );
}
