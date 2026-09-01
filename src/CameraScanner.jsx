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

  useEffect(() => {
    stoppedRef.current = false;
    const html5QrCode = new Html5Qrcode(elIdRef.current, { verbose: false });
    instanceRef.current = html5QrCode;
    let cancelled = false;

    // Small delay before requesting the camera: on iOS Safari, switching
    // facingMode right after a previous getUserMedia call (e.g. the front
    // camera used for the selfie step) can otherwise return a blank feed.
    const timer = setTimeout(() => {
      if (cancelled) return;
      html5QrCode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decodedText) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            try {
              html5QrCode
                .stop()
                .then(() => html5QrCode.clear())
                .catch(() => {})
                .finally(() => onDetected(decodedText));
            } catch (e) {
              // stop() can throw synchronously if the scanner already
              // isn't running — nothing to clean up, still report the code
              onDetected(decodedText);
            }
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
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const inst = instanceRef.current;
      // Only stop if we haven't already stopped it (e.g. a code was just
      // detected). Calling stop() on an already-stopped scanner throws
      // synchronously in html5-qrcode — that uncaught throw is what was
      // crashing the whole app after a successful scan.
      if (inst && !stoppedRef.current) {
        stoppedRef.current = true;
        try {
          const res = inst.stop();
          if (res && typeof res.then === "function") {
            res.then(() => inst.clear()).catch(() => {});
          }
        } catch (e) {
          // scanner wasn't actually running — safe to ignore
        }
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
