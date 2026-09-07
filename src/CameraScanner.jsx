import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

// Renders a live camera feed and calls onDetected(text) the moment it reads
// a barcode or QR code. Reads virtually every common format (QR, EAN-13,
// UPC-A, Code128, etc.) via the underlying ZXing decoder.
export default function CameraScanner({ onDetected, onError }) {
  const elIdRef = useRef(`tb-scanner-${Math.random().toString(36).slice(2)}`);
  const instanceRef = useRef(null);
  const stoppedRef = useRef(false);
  const [starting, setStarting] = useState(true);

  // Stops the camera at most once, and never lets a failure here (e.g.
  // "scanner not running") escape as an uncaught error — a scanner that's
  // already stopped is not a real problem, just a no-op.
  const safeStop = () => {
    if (!instanceRef.current) return Promise.resolve();
    try {
      return instanceRef.current
        .stop()
        .then(() => {
          try { instanceRef.current && instanceRef.current.clear(); } catch (_) { /* ignore */ }
        })
        .catch(() => {});
    } catch (_) {
      return Promise.resolve();
    }
  };

  useEffect(() => {
    stoppedRef.current = false;
    const html5QrCode = new Html5Qrcode(elIdRef.current, { verbose: false });
    instanceRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          safeStop().finally(() => onDetected(decodedText));
        },
        () => {
          /* per-frame "no code found yet" — expected, ignore */
        }
      )
      .then(() => setStarting(false))
      .catch((err) => {
        setStarting(false);
        onError && onError(err);
      });

    return () => {
      // Only actually stop here if a detection hasn't already stopped it —
      // calling stop() twice in a row is what was crashing the page.
      if (!stoppedRef.current) {
        stoppedRef.current = true;
        safeStop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {starting && (
        <div style={{ fontSize: 12, color: "#6E6858", marginBottom: 8 }}>
          Requesting camera access…
        </div>
      )}
      <div id={elIdRef.current} style={{ width: "100%", borderRadius: 6, overflow: "hidden", background: "#000" }} />
    </div>
  );
}
