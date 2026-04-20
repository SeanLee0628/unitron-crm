import React, { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from "recharts";

const API = process.env.REACT_APP_API_URL || "";

const COLORS = ["#27ae60", "#2ecc71", "#f39c12", "#e67e22", "#e74c3c", "#c0392b", "#8e44ad"];
const STATUS_COLORS = { "진행중": "#3498db", "종료(성공)": "#27ae60", "종료(실패)": "#e74c3c" };

function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("my");
  const [actPeriod, setActPeriod] = useState("monthly");
  const [alertFilter, setAlertFilter] = useState("all");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const params = view === "my" ? { manager: user.name, size: 500 } : { size: 500 };
        const [opps, custs, comps, acts] = await Promise.all([
          axios.get(`${API}/api/opportunities`, { params }),
          axios.get(`${API}/api/customers`, { params: view === "my" ? { manager: user.name, size: 500 } : { size: 500 } }),
          axios.get(`${API}/api/companies`, { params: view === "my" ? { manager: user.name, size: 500 } : { size: 500 } }),
          axios.get(`${API}/api/generic/activities`, { params: view === "my" ? { q: user.name, size: 500 } : { size: 500 } }),
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
        const stageData = Object.entries(stageCounts).map(([name, value], i) => ({
          name, value, fill: COLORS[i % COLORS.length]
        }));

        // 이번 주 종료 예정
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const wl = `${weekLater.getFullYear()}.${String(weekLater.getMonth()+1).padStart(2,"0")}.${String(weekLater.getDate()).padStart(2,"0")}`;
        const today = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`;
        const expiring = inProgress.filter(o => o["종료일"] && o["종료일"] <= wl);
        const overdue = inProgress.filter(o => o["종료일"] && o["종료일"] < today);

        // 담당자별 집계
        const managerStats = {};
        myOpps.forEach(o => {
          const m = o["담당자"] || "미지정";
          if (!managerStats[m]) managerStats[m] = { name: m, 진행중: 0, 성공: 0, 실패: 0, total: 0 };
          managerStats[m].total++;
          if (o["진행상태"] === "진행중") managerStats[m]["진행중"]++;
          else if (o["진행상태"] === "종료(성공)") managerStats[m]["성공"]++;
          else if (o["진행상태"] === "종료(실패)") managerStats[m]["실패"]++;
        });
        const managerData = Object.values(managerStats).sort((a, b) => b.total - a.total).slice(0, 10);

        // 활동 추이 (월별 + 주별)
        const actData = (acts.data.data || []);
        const monthCounts = {};
        const weekCounts = {};
        actData.forEach(a => {
          const d = a["영업활동일"] || "";
          const m = d.slice(0, 7);
          if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
          // 주별: YYYY.MM.DD → 해당 주 월요일 기준
          if (d.length >= 10) {
            const parts = d.split(".");
            if (parts.length === 3) {
              const dt = new Date(parts[0], parseInt(parts[1])-1, parseInt(parts[2]));
              const day = dt.getDay();
              const mon = new Date(dt);
              mon.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
              const wk = `${mon.getFullYear()}.${String(mon.getMonth()+1).padStart(2,"0")}.${String(mon.getDate()).padStart(2,"0")}`;
              weekCounts[wk] = (weekCounts[wk] || 0) + 1;
            }
          }
        });
        const actTrendMonthly = Object.entries(monthCounts).sort().slice(-6).map(([m, v]) => ({ label: m, 활동: v }));
        const actTrendWeekly = Object.entries(weekCounts).sort().slice(-8).map(([w, v]) => ({ label: w, 활동: v }));

        setStats({
          totalOpps: myOpps.length,
          inProgress: inProgress.length,
          won: won.length,
          lost: lost.length,
          winRate: (won.length + lost.length) > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0,
          totalCustomers: custs.data.total || 0,
          totalCompanies: comps.data.total || 0,
          totalActivities: acts.data.total || 0,
          stageData,
          expiring,
          overdue,
          managerData,
          actTrendMonthly,
          actTrendWeekly,
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    setLoading(true);
    fetchAll();
  }, [user, view]);

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 16 }}>로딩 중...</div>;
  if (!stats) return null;

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: "#f0f2f5" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e" }}>
            {view === "my" ? `${user.name}님의 영업 현황` : "전체 영업 현황"}
          </h1>
          <p style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
            {user.department} | {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 6, padding: 3, border: "1px solid #e5e5e5" }}>
          <button className={`dash-toggle ${view === "my" ? "active" : ""}`} onClick={() => setView("my")}>내 현황</button>
          <button className={`dash-toggle ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>전체</button>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="dash-cards">
        <div className="dash-card2">
          <div className="dc2-icon" style={{ background: "#3498db" }}>&#128188;</div>
          <div className="dc2-body">
            <div className="dc2-value">{stats.totalOpps}</div>
            <div className="dc2-label">영업기회</div>
          </div>
        </div>
        <div className="dash-card2">
          <div className="dc2-icon" style={{ background: "#27ae60" }}>&#9989;</div>
          <div className="dc2-body">
            <div className="dc2-value">{stats.won}</div>
            <div className="dc2-label">성공</div>
          </div>
        </div>
        <div className="dash-card2">
          <div className="dc2-icon" style={{ background: "#e74c3c" }}>&#10060;</div>
          <div className="dc2-body">
            <div className="dc2-value">{stats.lost}</div>
            <div className="dc2-label">실패</div>
          </div>
        </div>
        <div className="dash-card2">
          <div className="dc2-icon" style={{ background: stats.winRate >= 50 ? "#27ae60" : "#e67e22" }}>&#128200;</div>
          <div className="dc2-body">
            <div className="dc2-value">{stats.winRate}%</div>
            <div className="dc2-label">성공률</div>
          </div>
        </div>
        <div className="dash-card2">
          <div className="dc2-icon" style={{ background: "#8e44ad" }}>&#128101;</div>
          <div className="dc2-body">
            <div className="dc2-value">{stats.totalCustomers}</div>
            <div className="dc2-label">고객</div>
          </div>
        </div>
        <div className="dash-card2">
          <div className="dc2-icon" style={{ background: "#2c3e50" }}>&#127970;</div>
          <div className="dc2-body">
            <div className="dc2-value">{stats.totalCompanies}</div>
            <div className="dc2-label">고객사</div>
          </div>
        </div>
      </div>

      {/* 차트 Row 1 */}
      <div className="dash-chart-row">
        {/* 파이프라인 */}
        <div className="dash-chart-card" style={{ flex: 1 }}>
          <h3 className="dash-chart-title">파이프라인 현황</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.stageData} layout="vertical" margin={{ left: 60, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {stats.stageData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 차트 Row 2 */}
      <div className="dash-chart-row">
        {/* 활동 추이 */}
        <div className="dash-chart-card" style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 className="dash-chart-title" style={{ margin: 0 }}>영업활동 추이</h3>
            <div style={{ display: "flex", gap: 4, background: "#f5f5f5", borderRadius: 4, padding: 2 }}>
              <button className={`dash-toggle ${actPeriod === "monthly" ? "active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setActPeriod("monthly")}>월간</button>
              <button className={`dash-toggle ${actPeriod === "weekly" ? "active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setActPeriod("weekly")}>주간</button>
            </div>
          </div>
          {(() => {
            const trendData = actPeriod === "monthly" ? stats.actTrendMonthly : stats.actTrendWeekly;
            return trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="활동" stroke="#e74c3c" strokeWidth={3} dot={{ r: 5, fill: "#e74c3c" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ color: "#ccc", padding: 40, textAlign: "center" }}>데이터 없음</div>;
          })()}
        </div>

        {/* 긴급 알림 */}
        <div className="dash-chart-card" style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 className="dash-chart-title" style={{ margin: 0, color: "#e74c3c" }}>
              &#9888; 긴급 ({alertFilter === "overdue" ? stats.overdue.length : alertFilter === "expiring" ? stats.expiring.length : stats.overdue.length + stats.expiring.length})
            </h3>
            <div style={{ display: "flex", gap: 4, background: "#f5f5f5", borderRadius: 4, padding: 2 }}>
              <button className={`dash-toggle ${alertFilter === "all" ? "active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setAlertFilter("all")}>전체</button>
              <button className={`dash-toggle ${alertFilter === "overdue" ? "active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setAlertFilter("overdue")}>종료경과</button>
              <button className={`dash-toggle ${alertFilter === "expiring" ? "active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setAlertFilter("expiring")}>이번주</button>
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {(alertFilter === "all" || alertFilter === "overdue") && stats.overdue.map((o, i) => (
              <div key={`od-${i}`} className="dash-alert">
                <span className="dash-alert-tag" style={{ background: "#e74c3c" }}>종료경과</span>
                <span className="dash-alert-name">{o["영업기회"]}</span>
                <span className="dash-alert-sub">{o["고객사"]} | {o["종료일"]}</span>
              </div>
            ))}
            {(alertFilter === "all" || alertFilter === "expiring") && stats.expiring.map((o, i) => (
              <div key={`ex-${i}`} className="dash-alert">
                <span className="dash-alert-tag" style={{ background: "#e67e22" }}>이번주</span>
                <span className="dash-alert-name">{o["영업기회"]}</span>
                <span className="dash-alert-sub">{o["고객사"]} | {o["종료일"]}</span>
              </div>
            ))}
            {((alertFilter === "all" && stats.overdue.length + stats.expiring.length === 0) ||
              (alertFilter === "overdue" && stats.overdue.length === 0) ||
              (alertFilter === "expiring" && stats.expiring.length === 0)) &&
              <div style={{ color: "#ccc", padding: 20, textAlign: "center" }}>해당 항목 없음</div>}
          </div>
        </div>
      </div>

      {/* 담당자별 (전체 모드에서만) */}
      {view === "all" && stats.managerData.length > 0 && (
        <div className="dash-chart-card" style={{ marginTop: 16 }}>
          <h3 className="dash-chart-title">담당자별 영업기회</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.managerData} margin={{ left: 40, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="진행중" stackId="a" fill="#3498db" radius={[0, 0, 0, 0]} />
              <Bar dataKey="성공" stackId="a" fill="#27ae60" />
              <Bar dataKey="실패" stackId="a" fill="#e74c3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
