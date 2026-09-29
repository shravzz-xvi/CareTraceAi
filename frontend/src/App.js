import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout     from "./layout/MainLayout";
import Dashboard      from "./pages/Dashboard";
import Patients       from "./pages/Patients";
import PatientDetail  from "./pages/PatientDetail";
import Alerts         from "./pages/Alerts";
import Workflows      from "./pages/Workflows";
import Settings       from "./pages/Settings";
import Login          from "./pages/Login";
import PatientCheckin from "./pages/PatientCheckin";
import "./index.css";

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("aura_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("aura_theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("aura_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleLogin  = (u) => setUser(u);
  const handleLogout = () => {
    localStorage.removeItem("aura_token");
    localStorage.removeItem("aura_user");
    setUser(null);
  };
  const toggleDark = () => setDarkMode(v => !v);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public patient-facing check-in portal accessed via WhatsApp link (No login required) */}
        <Route path="/checkin/:id" element={<PatientCheckin />} />

        {!user ? (
          <Route path="*" element={<Login onLogin={handleLogin} darkMode={darkMode} toggleDark={toggleDark} />} />
        ) : (
          <>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route element={<MainLayout user={user} onLogout={handleLogout} darkMode={darkMode} toggleDark={toggleDark} />}>
              <Route index               element={<Dashboard />}     />
              <Route path="patients"     element={<Patients />}      />
              <Route path="patients/:id" element={<PatientDetail />} />
              <Route path="alerts"       element={<Alerts />}        />
              <Route path="workflows"    element={<Workflows />}     />
              <Route path="settings"     element={<Settings />}      />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}