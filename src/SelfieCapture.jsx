import React, { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, AlertCircle } from "lucide-react";

// Opens the front-facing camera, lets the person snap a still photo of
// themselves, and hands the captured frame back as a small compressed
// JPEG data URL via onCapture(dataUrl). Call onSkip if the caller wants
// to allow skipping (TallyBust does not, by default).
export default function SelfieCapture({ onCapture, onCancel, T, mono, body }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch((err) => setError(String(err && err.message ? err.message : err)));

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const size = 320; // small square, compressed — this is an accountability snapshot, not a portrait
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    const vw = video.videoWidth, vh = video.videoHeight;
    const side = Math.min(vw, vh);
    ctx.translate(size, 0); ctx.scale(-1, 1); // mirror, since front camera preview is mirrored
    ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.6));
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  };

  const retake = () => {
    setSnapshot(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      })
      .catch((err) => setError(String(err && err.message ? err.message : err)));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, ...mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: T.slate }}>
        <Camera size={13} /> Step 1 of 2 — Take a quick selfie
      </div>

      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#000", borderRadius: 6, overflow: "hidden" }}>
        {!snapshot ? (
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        ) : (
          <img src={snapshot} alt="Captured selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!ready && !error && !snapshot && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.cream, ...mono, fontSize: 12 }}>
            Requesting camera…
          </div>
        )}
      </div>

      {error && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11.5, color: T.stamp, marginTop: 8 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Couldn't access the front camera ({error}). Check camera permission, or cancel and use search instead.</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "10px", borderRadius: 4, border: `1px solid ${T.paperDim}`, background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...body }}>
          Cancel
        </button>
        {!snapshot ? (
          <button onClick={capture} disabled={!ready} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 4, border: "none", background: ready ? T.ink : T.slateLight, color: T.cream, cursor: ready ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, ...mono }}>
            <Camera size={14} /> CAPTURE
          </button>
        ) : (
          <>
            <button onClick={retake} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 4, border: `1px solid ${T.ink}`, background: "transparent", color: T.ink, cursor: "pointer", fontSize: 12.5, fontWeight: 600, ...mono }}>
              <RotateCcw size={13} /> RETAKE
            </button>
            <button onClick={() => onCapture(snapshot)} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 4, border: "none", background: T.green, color: T.cream, cursor: "pointer", fontSize: 12.5, fontWeight: 700, ...mono }}>
              <Check size={14} /> USE THIS PHOTO
            </button>
          </>
        )}
      </div>
    </div>
  );
}
