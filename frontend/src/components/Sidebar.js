import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/", label: "Dashboard", icon: "grid" },
  { to: "/patients", label: "Patients", icon: "users" },
  { to: "/alerts", label: "Alerts", icon: "alert" },
  { to: "/workflows", label: "Check-in Simulator", icon: "activity" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function Icon({ type }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (type === "alert") {
    return (
      <svg {...common}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }

  if (type === "activity") {
    return (
      <svg {...common}>
        <path d="M3 12h4l2-7 4 14 2-7h6" />
      </svg>
    );
  }

  if (type === "settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03H6v-2.4h.9a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 12.73 6H13v2.4h-.27a1.7 1.7 0 0 0-1.56 1.03" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside
      style={{
        width: "var(--sidebar-w)",
        background: "var(--sidebar-bg)",
        color: "#fff",
        padding: "24px 14px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      <div style={{ padding: "0 10px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "linear-gradient(135deg,#14b8a6,#22d3ee)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 22px rgba(20,184,166,.25)",
            }}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h4l2-7 4 14 2-7h6" />
            </svg>
          </div>

          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              CareTrace
              <span style={{ color: "#67e8f9" }}>AI</span>
            </div>

            <div
              style={{
                fontSize: 9.5,
                color: "rgba(255,255,255,.48)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Recovery intelligence
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "0 10px 10px",
          fontSize: 9,
          fontWeight: 700,
          color: "rgba(255,255,255,.35)",
          letterSpacing: ".12em",
          textTransform: "uppercase",
        }}
      >
        Workspace
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {items.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                textDecoration: "none",
                color: active ? "#fff" : "rgba(255,255,255,.62)",
                background: active
                  ? "linear-gradient(90deg,rgba(20,184,166,.22),rgba(34,211,238,.08))"
                  : "transparent",
                border: active
                  ? "1px solid rgba(103,232,249,.14)"
                  : "1px solid transparent",
                borderRadius: 11,
                padding: "10px 11px",
                display: "flex",
                alignItems: "center",
                gap: 11,
                fontSize: 12.5,
                fontWeight: active ? 700 : 500,
              }}
            >
              <span
                style={{
                  color: active ? "#67e8f9" : "currentColor",
                  display: "grid",
                }}
              >
                <Icon type={item.icon} />
              </span>

              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          padding: 12,
          borderRadius: 14,
          background: "rgba(255,255,255,.045)",
          border: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 7,
          }}
        >
          <span
            className="pulse"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#34d399",
            }}
          />

          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#a7f3d0",
            }}
          >
            CARETRACE ONLINE
          </span>
        </div>

        <div
          style={{
            fontSize: 10.5,
            color: "rgba(255,255,255,.45)",
            lineHeight: 1.5,
          }}
        >
          Continuous recovery monitoring with longitudinal memory.
        </div>
      </div>
    </aside>
  );
}