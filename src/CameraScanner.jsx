import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Renders a live camera feed and calls onDetected(text) the moment it reads
// a barcode or QR code. Every common format is explicitly enabled (QR,
// EAN-13/8, UPC-A/E, Code 128/39/93, Codabar, ITF, Data Matrix — the kind
// used on a lot of pharmaceutical packaging — and more), and the browser's
// native BarcodeDetector is used automatically where it's available since
// it reads 1D barcodes far more reliably than the JS fallback decoder.
const ALL_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
];

// A long, thin 1D barcode rarely fits well in a small square box — this
// gives a wide rectangle instead (roughly a 2:1 aspect), sized relative to
// whatever the camera preview actually is on this device, which is much
// more forgiving for barcodes while still being plenty big for QR codes.
function scanBoxSize(viewfinderWidth, viewfinderHeight) {
  const width = Math.round(Math.min(320, viewfinderWidth * 0.85));
  const height = Math.round(Math.min(viewfinderHeight * 0.6, width * 0.55));
  return { width, height };
}

export default function CameraScanner({ onDetected, onError }) {
  const elIdRef = useRef(`tb-scanner-${Math.random().toString(36).slice(2)}`);
  const instanceRef = useRef(null);
  const stoppedRef = useRef(false);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    stoppedRef.current = false;
    const html5QrCode = new Html5Qrcode(elIdRef.current, { verbose: false, formatsToSupport: ALL_FORMATS, useBarCodeDetectorIfSupported: true });
    instanceRef.current = html5QrCode;
    let cancelled = false;

    // Small delay before requesting the camera: on iOS Safari, switching
    // facingMode right after a previous getUserMedia call (e.g. the front
    // camera used for the selfie step) can otherwise return a blank feed.
    const timer = setTimeout(() => {
      if (cancelled) return;
      html5QrCode
        .start(
          // A higher requested resolution gives the decoder far more pixels
          // to work with across each bar of a barcode — the single biggest
          // lever for reliable 1D barcode reads on a phone camera.
          { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          {
            fps: 15,
            qrbox: scanBoxSize,
            aspectRatio: 1.5,
            disableFlip: true,
          },
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
      {!starting && (
        <div style={{ fontSize: 11, color: "#8A93A3", marginTop: 6 }}>
          For a printed barcode: hold it flat, well-lit, filling most of the box, about 10–15cm from the camera.
        </div>
      )}
    </div>
  );
}
