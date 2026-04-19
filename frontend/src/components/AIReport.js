import React, { useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

function AIReport({ user }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const res = await axios.post(`${API}/api/ai/team-report`, {
        department: user.department,
      });
      if (res.data.error) setError(res.data.error);
      else setReport(res.data);
    } catch (err) {
      setError("생성 실패: " + err.message);
    }
    setLoading(false);
  };

  const stageColors = {
    "기회인지": "#27ae60", "제품소개": "#2ecc71", "제안": "#f39c12",
    "초기견적": "#e67e22", "재견적": "#e74c3c", "협상": "#c0392b", "계약": "#8e44ad",
  };

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{user.department} 영업회의</h1>
          <p style={{ color: "#888", fontSize: 13, marginTop: 4 }}>AI 기반 주간 영업 현황 리포트</p>
        </div>
        <button className="add-btn" style={{ fontSize: 14, padding: "10px 24px" }} onClick={generate} disabled={loading}>
          {loading ? "생성 중..." : "회의자료 생성"}
        </button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {report && (
        <>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
            기간: {report.period} | 인원: {report.total_members}명
          </div>

          {/* 사원별 카드 */}
          {report.members.map((m, i) => (
            <div key={i} className="team-member-card">
              <div className="tm-header">
                <h3 className="tm-name">{m.name}</h3>
                <div className="tm-stats">
                  <span className="tm-stat">진행 <strong>{m.in_progress}</strong></span>
                  <span className="tm-stat tm-green">성공 <strong>{m.won}</strong></span>
                  <span className="tm-stat">성공률 <strong>{m.win_rate}%</strong></span>
                  <span className="tm-stat">주간활동 <strong>{m.week_activities}</strong></span>
                  {m.overdue > 0 && <span className="tm-stat tm-red">종료경과 <strong>{m.overdue}</strong></span>}
                  {m.inactive_customers > 0 && <span className="tm-stat tm-orange">미연락 <strong>{m.inactive_customers}</strong></span>}
                </div>
              </div>

              {/* 활동 분류 */}
              {Object.keys(m.act_types).length > 0 && (
                <div className="tm-act-types">
                  {Object.entries(m.act_types).map(([t, c]) => (
                    <span key={t} className="tm-act-badge">{t} {c}</span>
                  ))}
                </div>
              )}

              {/* 주요 영업기회 */}
              {m.top_opps.length > 0 && (
                <div className="tm-opps">
                  {m.top_opps.map((o, j) => (
                    <div key={j} className="tm-opp-item">
                      <span className="tm-opp-stage" style={{ background: stageColors[o.stage] || "#999" }}>{o.stage}</span>
                      <span>{o.name}</span>
                      <span style={{ color: "#999" }}>{o.company}</span>
                      <span style={{ color: "#e74c3c", fontWeight: 600 }}>{o.pct}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 주요 활동 */}
              {m.top_acts.length > 0 && (
                <div className="tm-acts">
                  {m.top_acts.map((a, j) => (
                    <div key={j} className="tm-act-item">
                      <span className="tm-act-date">{a.date}</span>
                      <span className="tm-act-badge">{a.type}</span>
                      <span>{a.company} {a.customer}</span>
                      {a.content && a.content !== "None" && <span style={{ color: "#999", fontSize: 11 }}>— {a.content}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* AI 요약 */}
          <div className="ai-briefing-box" style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>AI 분석 및 제언</h3>
            <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{report.ai_summary}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default AIReport;
