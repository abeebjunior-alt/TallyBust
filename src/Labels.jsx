import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, CheckSquare, Square, Plus } from "lucide-react";

const T = { ink: "#0A1220", paper: "#FFFFFF", cream: "#F5F7FB", slate: "#5B6472", paperDim: "#E3E8F0", blue: "#1E4FD6" };
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

export default function Labels({ products, businessName, onAddProduct }) {
  const [selected, setSelected] = useState(() => new Set(products.map((p) => p.id)));

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

  const chosen = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected]);

  return (
    <div>
      <div className="tb-no-print">
        <div className="tb-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <h1 style={{ ...body, fontSize: 22, fontWeight: 700, margin: 0 }}>Labels</h1>
            <div style={{ fontSize: 12.5, color: T.slate, marginTop: 2, maxWidth: 420 }}>
              Add a new item here to register it and generate its QR label — it won't count as stock until the printed label is scanned as Stock In.
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
              onClick={() => window.print()}
              disabled={chosen.length === 0}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", color: T.ink, cursor: chosen.length ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 600, ...body }}
            >
              <Printer size={13} /> Print {chosen.length ? `(${chosen.length})` : ""}
            </button>
          </div>
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
              }}
            >
              {selected.has(p.id) ? <CheckSquare size={15} /> : <Square size={15} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slate }}>{p.sku}</div>
              </div>
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
        {chosen.map((p) => (
          <div key={p.id} className="tb-label">
            <QRCodeSVG value={p.sku} size={78} level="M" includeMargin={false} />
            <div className="tb-label-text">
              <div className="tb-label-name">{p.name}</div>
              <div className="tb-label-sku">{p.sku}</div>
              <div className="tb-label-biz">{businessName}</div>
            </div>
          </div>
        ))}
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
        }
      `}</style>
    </div>
  );
}
