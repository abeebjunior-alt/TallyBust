import React from "react";

// Without this, any uncaught error anywhere in the tree unmounts the whole
// app and React just leaves a blank white page — no message, nothing in
// the DOM at all. This catches that, shows what actually broke, and gives
// a way back in instead of a dead end.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("TallyBust crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{ minHeight: "100vh", background: "#0A1220", color: "#F5F7FB", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: 480, width: "100%", background: "#F5F7FB", color: "#0A1220", borderRadius: 8, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: "#5B6472", marginBottom: 14, lineHeight: 1.5 }}>
              TallyBust hit an error and couldn't continue. Reloading usually fixes it. If it keeps happening, screenshot the message below and send it over.
            </div>
            <pre style={{ background: "#E3E8F0", borderRadius: 4, padding: 12, fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflow: "auto", marginBottom: 16 }}>
              {String((err && err.message) || err)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 16px", borderRadius: 4, border: "none", background: "#1E4FD6", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
            >
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
