import React from "react";

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
      return (
        <div style={{ minHeight: "100vh", background: "#ECE6D6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Work Sans', sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 360, textAlign: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, color: "#6E6858", marginBottom: 16 }}>
              TallyBust hit an unexpected error. Your data is safe — reloading usually fixes this.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 18px", borderRadius: 4, border: "none", background: "#14140F", color: "#F6F2E8", fontWeight: 700, cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
