import React, { useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [opps, custs, comps, acts] = await Promise.all([
          axios.get(`${API}/api/opportunities`, { params: { manager: user.name, size: 200 } }),
          axios.get(`${API}/api/customers`, { params: { manager: user.name, size: 200 } }),
          axios.get(`${API}/api/companies`, { params: { manager: user.name, size: 200 } }),
          axios.get(`${API}/api/generic/activities`, { params: { q: user.name, size: 200 } }),
        ]);

        const myOpps = opps.data.data || [];
        const inProgress = myOpps.filter(o => o["진행상태"] === "진행중");
        const won = myOpps.filter(o => o["진행상태"] === "종료(성공)");
        const lost = myOpps.filter(o => o["진행상태"] === "종료(실패)");

        // 단계별 집계
        const stageCounts = {};
        inProgress.forEach(o => {
          const s = o["단계"] || "기타";
          stageCounts[s] = (stageCounts[s] || 0) + 1;
        });

        // 이번 주 종료 예정
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const wl = `${weekLater.getFullYear()}.${String(weekLater.getMonth()+1).padStart(2,"0")}.${String(weekLater.getDate()).padStart(2,"0")}`;
        const expiring = inProgress.filter(o => o["종료일"] && o["종료일"] <= wl);

        setStats({
          totalOpps: myOpps.length,
          inProgress: inProgress.length,
          won: won.length,
          lost: lost.length,
          winRate: myOpps.length > 0 ? Math.round(won.length / myOpps.length * 100) : 0,
          stageCounts,
          expiring,
          totalCustomers: custs.data.total || 0,
          totalCompanies: comps.data.total || 0,
          recentActivities: (acts.data.data || []).slice(0, 8),
          totalActivities: acts.data.total || 0,
        });
      } catch { }
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>로딩 중...</div>;
  if (!stats) return null;

  const stageColors = {
    "기회인지": "#27ae60", "제품소개": "#2ecc71", "제안": "#f39c12",
    "초기견적": "#e67e22", "재견적": "#e74c3c", "협상": "#c0392b", "계약": "#8e44ad",
  };

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>안녕하세요, {user.name}님</h1>
        <p style={{ color: "#888", fontSize: 13, marginTop: 4 }}>{user.department} | {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
      </div>

      {/* 핵심 지표 카드 */}
      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-card-label">내 영업기회</div>
          <div className="dash-card-value">{stats.totalOpps}</div>
          <div className="dash-card-sub">진행중 {stats.inProgress}</div>
        </div>
        <div className="dash-card dash-card-green">
          <div className="dash-card-label">성공</div>
          <div className="dash-card-value">{stats.won}</div>
          <div className="dash-card-sub">성공률 {stats.winRate}%</div>
        </div>
        <div className="dash-card dash-card-red">
          <div className="dash-card-label">실패</div>
          <div className="dash-card-value">{stats.lost}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">내 고객</div>
          <div className="dash-card-value">{stats.totalCustomers}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">내 고객사</div>
          <div className="dash-card-value">{stats.totalCompanies}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">영업활동</div>
          <div className="dash-card-value">{stats.totalActivities}</div>
        </div>
      </div>

      <div className="dash-row">
        {/* 파이프라인 */}
        <div className="dash-section" style={{ flex: 1 }}>
          <h3 className="dash-section-title">파이프라인 현황</h3>
          <div className="dash-pipeline">
            {Object.entries(stats.stageCounts).map(([stage, count]) => (
              <div key={stage} className="dash-pipe-item">
                <div className="dash-pipe-bar" style={{ background: stageColors[stage] || "#999", height: Math.max(count * 18, 24) }}>
                  {count}
                </div>
                <div className="dash-pipe-label">{stage}</div>
              </div>
            ))}
            {Object.keys(stats.stageCounts).length === 0 && (
              <div style={{ color: "#ccc", padding: 20 }}>진행 중인 영업기회가 없습니다</div>
            )}
          </div>
        </div>

        {/* 이번 주 종료 예정 */}
        <div className="dash-section" style={{ flex: 2, maxHeight: 300, overflowY: "auto" }}>
          <h3 className="dash-section-title" style={{ color: "#e74c3c" }}>이번 주 종료 예정 ({stats.expiring.length})</h3>
          {stats.expiring.map((o, i) => (
            <div key={i} className="dash-alert-item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{o["영업기회"]}</span>
                <span style={{ fontSize: 12, color: "#e74c3c", fontWeight: 700 }}>{o["성공확률(%)"]}%</span>
              </div>
              <div style={{ fontSize: 11, color: "#999" }}>{o["고객사"]} | {o["고객명"]} | 종료: {o["종료일"]}</div>
            </div>
          ))}
          {stats.expiring.length === 0 && <div style={{ color: "#ccc", fontSize: 13 }}>없음</div>}
        </div>
      </div>

      {/* 최근 영업활동 */}
      <div className="dash-section" style={{ marginTop: 16 }}>
        <h3 className="dash-section-title">최근 영업활동</h3>
        {stats.recentActivities.map((a, i) => (
          <div key={i} className="dash-activity-item">
            <span className="dash-act-date">{a["영업활동일"]}</span>
            <span className="dash-act-type">{a["활동분류"]}</span>
            <span className="dash-act-info">{a["고객사"]} {a["고객"]}</span>
          </div>
        ))}
        {stats.recentActivities.length === 0 && <div style={{ color: "#ccc", fontSize: 13, padding: 8 }}>최근 활동이 없습니다</div>}
      </div>
    </div>
  );
}

export default Dashboard;
