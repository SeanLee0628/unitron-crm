import React, { useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

function AIReport({ user, defaultType = "personal" }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportType, setReportType] = useState(defaultType);

  const generateReport = async () => {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const res = await axios.post(`${API}/api/ai/report`, {
        type: reportType,
        name: user.name,
        department: user.department,
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setReport(res.data);
      }
    } catch (err) {
      setError("생성 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>AI 영업보고서</h2>
        <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
          {user.name} | {user.department}
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select className="sidebar-select" style={{ width: 200 }}
          value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="personal">내 보고서 ({user.name})</option>
          <option value="team">{user.department} 전체</option>
        </select>
        <button className="add-btn" onClick={generateReport} disabled={loading}>
          {loading ? "생성 중..." : "보고서 생성"}
        </button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {report && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{report.title}</h3>
            <span style={{ fontSize: 12, color: "#888" }}>활동 {report.activity_count}건 기반</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "#333" }}>
            {report.report}
          </div>
        </div>
      )}
    </div>
  );
}

export default AIReport;
