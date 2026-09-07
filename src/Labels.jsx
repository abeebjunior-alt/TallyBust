import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, CheckSquare, Square } from "lucide-react";

const T = { ink: "#14140F", paper: "#ECE6D6", cream: "#F6F2E8", slate: "#6E6858", paperDim: "#DFD8C4" };
const mono = { fontFamily: "'Space Mono', monospace" };
const body = { fontFamily: "'Work Sans', sans-serif" };

export default function Labels({ products, businessName }) {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <h1 style={{ ...body, fontSize: 22, fontWeight: 700, margin: 0 }}>Labels</h1>
            <div style={{ fontSize: 12.5, color: T.slate, marginTop: 2 }}>
              Print a QR sticker for each product's code, then stick it on the item — the camera scan reads this code straight back to the SKU.
            </div>
          </div>
          <button
            onClick={() => window.print()}
            disabled={chosen.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 4, border: "none", background: T.ink, color: T.cream, cursor: chosen.length ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 600, ...body }}
          >
            <Printer size={13} /> Print {chosen.length ? `(${chosen.length})` : ""}
          </button>
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ ...mono, fontSize: 10.5, color: T.slate }}>{p.sku}</div>
              </div>
            </div>
          ))}
          {products.length === 0 && <div style={{ fontSize: 12.5, color: T.slate }}>Add products first — labels are generated from their SKU codes.</div>}
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
