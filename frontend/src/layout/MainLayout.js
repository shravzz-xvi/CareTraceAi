import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar  from "../components/Topbar";

export default function MainLayout({ user, onLogout, darkMode, toggleDark }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--surface)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar user={user} onLogout={onLogout} darkMode={darkMode} toggleDark={toggleDark} />
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}