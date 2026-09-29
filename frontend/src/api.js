const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

function getToken() {
  return localStorage.getItem("aura_token") || "";
}

async function request(path, options = {}) {
  const { skipAuthRedirect, ...fetchOptions } = options;
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  // Token expired — force logout only for protected dashboard routes
  if (res.status === 401 && !skipAuthRedirect) {
    localStorage.removeItem("aura_token");
    localStorage.removeItem("aura_user");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Patients API
export const getPatients        = ()         => request("/api/patients");
export const getPatient         = (id, opt)  => request(`/api/patients/${id}`, opt);
export const addPatient         = (data)     => request("/api/patients",     { method: "POST",   body: JSON.stringify(data) });
export const updatePatient      = (id, data) => request(`/api/patients/${id}`, { method: "PUT",  body: JSON.stringify(data) });
export const deletePatient      = (id)       => request(`/api/patients/${id}`, { method: "DELETE" });
export const getPatientQuestions = (id)      => request(`/api/patients/${id}/questions`);
export const getHindsightLog    = (id)       => request(`/api/patients/${id}/hindsight-log`);
export const manageMonitoring   = (id, data) => request(`/api/patients/${id}/monitoring`, { method: "POST", body: JSON.stringify(data) });
export const getRecoveryReport  = (id)       => request(`/api/patients/${id}/report`);
export const generateRecoveryReport = (id)   => request(`/api/patients/${id}/report/generate`, { method: "POST" });

// Hindsight Intelligence & Milestone Summary API
export const getHindsightFeed   = (limit = 12) => request(`/api/patients/hindsight-feed?limit=${limit}`);
export const getMilestoneSummary = (id, day)   => {
  const q = day ? `?day=${day}` : "";
  return request(`/api/patients/${id}/milestone-summary${q}`);
};

// WhatsApp Feedback & Summary Triggers
export const triggerWhatsApp = (patientId, customMessage) =>
  request("/api/sms/whatsapp-trigger", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, custom_message: customMessage })
  });

export const sendWhatsAppSummary = (patientId, milestoneDay, summaryText) =>
  request("/api/sms/whatsapp-summary", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, milestone_day: milestoneDay, summary_text: summaryText })
  });

// Stats API
export const getStats           = ()         => request("/api/stats");

// Check-ins & Longitudinal Recovery API
export const getCheckins        = (patientId) => request(`/api/checkins/${patientId}`);
export const submitCheckin      = (data, opt) => request("/api/checkins",        { method: "POST", body: JSON.stringify(data), ...opt });
export const reviewCheckin      = (data)      => request("/api/checkins/review", { method: "POST", body: JSON.stringify(data) });

// Alerts API
export const getAlerts          = (params)   => {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/api/alerts${query}`);
};
export const getAlertCounts     = ()         => request("/api/alerts/count");
export const reviewAlert        = (id, data) => request(`/api/alerts/${id}/review`, { method: "POST", body: JSON.stringify(data) });