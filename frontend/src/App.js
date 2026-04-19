import React, { useState, useRef, useEffect } from "react";
import AuthPage from "./components/AuthPage";
import CustomerList from "./components/CustomerList";
import CompanyList from "./components/CompanyList";
import OpportunityList from "./components/OpportunityList";
import GenericList from "./components/GenericList";
import Placeholder from "./components/Placeholder";
import AIReport from "./components/AIReport";
import Dashboard from "./components/Dashboard";
import "./App.css";

const SALES_MGMT = ["영업활동", "잠재고객", "제안", "견적", "계약", "매출", "고객지원"];
const SALES_TOOLS = ["채터", "영업보고", "영업공지", "회의록", "일일", "제품자료", "영업보고현황"];

// 영업관리 메뉴 → DB 테이블 매핑
const MGMT_TABLE_MAP = {
  "영업활동": "activities",
  "제안": "proposals",
  "견적": "estimates",
  "계약": "contracts",
  "매출": "revenues",
  "고객지원": "supports",
};

function Dropdown({ label, items, activeTab, setActiveTab, parentKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const isActive = items.some((item) => activeTab === `${parentKey}_${item}`);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="nav-dropdown" ref={ref}>
      <button
        className={`nav-item ${isActive ? "active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {label} ▾
      </button>
      {open && (
        <div className="dropdown-menu">
          {items.map((item) => (
            <button
              key={item}
              className={`dropdown-item ${activeTab === `${parentKey}_${item}` ? "active" : ""}`}
              onClick={() => { setActiveTab(`${parentKey}_${item}`); setOpen(false); }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("crm_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleLogout = () => {
    localStorage.removeItem("crm_user");
    setUser(null);
  };

  if (!user) {
    return <AuthPage onLogin={setUser} />;
  }

  const getPageTitle = () => {
    if (activeTab.startsWith("mgmt_")) return activeTab.replace("mgmt_", "");
    if (activeTab.startsWith("tools_")) return activeTab.replace("tools_", "");
    return null;
  };

  const getMgmtTable = () => {
    const title = getPageTitle();
    return title ? MGMT_TABLE_MAP[title] : null;
  };

  return (
    <div className="crm-app">
      <header className="crm-header">
        <div className="header-logo">Unitrontech</div>
        <nav className="header-nav">
          <button
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            대시보드
          </button>
          <button
            className={`nav-item ${activeTab === "opportunities" ? "active" : ""}`}
            onClick={() => setActiveTab("opportunities")}
          >
            영업기회
          </button>
          <button
            className={`nav-item ${activeTab === "companies" ? "active" : ""}`}
            onClick={() => setActiveTab("companies")}
          >
            고객사
          </button>
          <button
            className={`nav-item ${activeTab === "customers" ? "active" : ""}`}
            onClick={() => setActiveTab("customers")}
          >
            고객
          </button>
          <Dropdown label="영업관리" items={SALES_MGMT} activeTab={activeTab} setActiveTab={setActiveTab} parentKey="mgmt" />
          <Dropdown label="영업도구" items={SALES_TOOLS} activeTab={activeTab} setActiveTab={setActiveTab} parentKey="tools" />
        </nav>
        <div className="header-right">
          <button className="ai-report-select" onClick={() => setActiveTab("ai_report_team")}>
            AI 영업보고서
          </button>
          <span className="header-user">{user.name}</span>
          <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <main className="crm-main">
        {activeTab === "dashboard" && <Dashboard user={user} />}
        {activeTab === "opportunities" && <OpportunityList />}
        {activeTab === "companies" && <CompanyList />}
        {activeTab === "customers" && <CustomerList />}

        {activeTab.startsWith("mgmt_") && getMgmtTable() && (
          <GenericList tableName={getMgmtTable()} title={getPageTitle()} key={activeTab} />
        )}

        {activeTab === "mgmt_잠재고객" && <Placeholder title="잠재고객" />}

        {activeTab === "ai_report_team" && <AIReport user={user} />}
        {activeTab.startsWith("tools_") && <Placeholder title={getPageTitle()} />}
      </main>
    </div>
  );
}

export default App;
