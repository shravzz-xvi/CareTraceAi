import { useLocation } from "react-router-dom";

const PAGE_META = {
  "/":           { title: "Dashboard",           subtitle: "Live patient monitoring overview" },
  "/patients":   { title: "Patients",            subtitle: "Manage and review patient records" },
  "/alerts":     { title: "Clinical Alerts",     subtitle: "Longitudinal recovery deteriorations requiring attention" },
  "/workflows":  { title: "Check-in Simulator",  subtitle: "Simulate recovery check-ins & test longitudinal Hindsight" },
  "/settings":   { title: "Settings",            subtitle: "System configuration and credentials" },
};

export default function Topbar({ user, onLogout, darkMode, toggleDark }) {
  const { pathname } = useLocation();
  const base = "/" + pathname.split("/")[1];
  const meta = PAGE_META[base] || { title: "CareTraceAI", subtitle: "Post-Surgery Recovery Intelligence" };
  const now  = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const initials = user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "A";

  return (
    <header style={{
      height: "var(--topbar-h)", background: "var(--card)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 28px", flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{meta.subtitle}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{now}</span>

        <div style={{ width: 1, height: 20, background: "var(--border-md)" }} />

        {/* Online status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 20, padding: "5px 12px" }}>
          <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success-dot)", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--success-text)" }}>Online</span>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border-md)" }} />

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            background: darkMode ? "rgba(99,102,241,0.15)" : "var(--card-2)",
            border: `1px solid ${darkMode ? "rgba(99,102,241,0.3)" : "var(--border-md)"}`,
            borderRadius: 8, padding: "6px 8px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            transition: "all 0.2s", color: darkMode ? "#818cf8" : "var(--text-muted)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = darkMode ? "rgba(99,102,241,0.25)" : "var(--surface)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = darkMode ? "rgba(99,102,241,0.15)" : "var(--card-2)"; }}
        >
          {darkMode ? (
            /* Sun icon */
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            /* Moon icon */
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          <span style={{ fontSize: 11, fontWeight: 600 }}>{darkMode ? "Light" : "Dark"}</span>
        </button>

        <div style={{ width: 1, height: 20, background: "var(--border-md)" }} />

        {/* User */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
            }}>{initials}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{user.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "capitalize" }}>{user.role || "admin"}</div>
            </div>
            <button onClick={onLogout} title="Sign out" style={{
              background: "transparent", border: "1px solid var(--border-md)", borderRadius: 8,
              padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)",
              display: "flex", alignItems: "center", transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger-text)"; e.currentTarget.style.borderColor = "var(--danger-border)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border-md)"; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}