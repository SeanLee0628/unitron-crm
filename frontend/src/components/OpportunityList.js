import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import OpportunityDetail from "./OpportunityDetail";

const API = process.env.REACT_APP_API_URL || "http://localhost:8002";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
};
const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
};

const EMPTY_FORM = {
  opp_name: "",
  company_name: "",
  customer_name: "",
  status: "진행중",
  expected_revenue: 0,
  expected_margin_pct: 0,
  expected_margin_amt: 0,
  revenue_type: "상품매출",
  biz_type: "",
  detail: "",
  process: "기본영업프로세스",
  stage: "기회인지",
  category: "인지",
  success_pct: 0,
  start_date: today(),
  end_date: nextMonth(),
  address: "",
  manager: "",
  source: "",
  note: "",
};

const STAGE_CATEGORY = {
  "기회인지": "인지",
  "제안": "제안",
  "협상": "협상",
  "계약": "계약",
};

function OpportunityList() {
  const [data, setData] = useState({ data: [], total: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [manager, setManager] = useState("");
  const [managers, setManagers] = useState([]);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedOpp, setSelectedOpp] = useState(null);
  const fileRef = useRef();

  const fetchData = async (p = 1) => {
    const res = await axios.get(`${API}/api/opportunities`, {
      params: { q: search, status, stage, manager, page: p, size: 50 },
    });
    setData(res.data);
    setPage(p);
  };

  useEffect(() => {
    fetchData();
    axios.get(`${API}/api/managers`).then((r) => setManagers(r.data.managers));
  }, []);

  const handleSearch = () => { fetchData(1); };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await axios.post(`${API}/api/opportunities/upload`, formData);
    fetchData(1);
  };

  const handleFormChange = (field, value) => {
    const updated = { ...form, [field]: value };
    if (field === "stage") {
      updated.category = STAGE_CATEGORY[value] || "";
    }
    if (field === "expected_revenue" || field === "expected_margin_pct") {
      const rev = field === "expected_revenue" ? Number(value) : Number(updated.expected_revenue);
      const pct = field === "expected_margin_pct" ? Number(value) : Number(updated.expected_margin_pct);
      updated.expected_margin_amt = Math.round(rev * pct / 100);
    }
    setForm(updated);
  };

  const handleSubmit = async () => {
    if (!form.opp_name) { alert("영업기회명을 입력하세요"); return; }
    await axios.post(`${API}/api/opportunities/create`, form);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    fetchData(1);
  };

  const statusColor = (s) => {
    if (s === "진행중") return "#2e7d32";
    if (s === "종료(성공)") return "#1565c0";
    if (s === "종료(실패)") return "#c62828";
    return "#666";
  };

  const totalPages = Math.ceil(data.total / 50);

  // 디테일 뷰
  if (selectedOpp) {
    return (
      <OpportunityDetail
        opportunity={selectedOpp}
        onBack={() => { setSelectedOpp(null); fetchData(page); }}
        onUpdate={() => fetchData(page)}
      />
    );
  }

  return (
    <>
      <aside className="crm-sidebar">
        <div className="sidebar-title">검색조건</div>
        <input
          className="sidebar-input"
          placeholder="검색어 (영업기회, 고객사, 고객명)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <select className="sidebar-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">진행상태(전체)</option>
          <option value="진행중">진행중</option>
          <option value="종료(성공)">종료(성공)</option>
          <option value="종료(실패)">종료(실패)</option>
        </select>
        <select className="sidebar-select" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">단계(전체)</option>
          <option value="기회인지">기회인지</option>
          <option value="제안">제안</option>
          <option value="협상">협상</option>
          <option value="계약">계약</option>
        </select>
        <select className="sidebar-select" value={manager} onChange={(e) => { setManager(e.target.value); }}>
          <option value="">담당자(전체)</option>
          {managers.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button className="sidebar-btn" onClick={handleSearch}>검색</button>

        <div className="upload-section">
          <button className="upload-btn" onClick={() => fileRef.current.click()}>
            Excel 업로드
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={handleUpload} />
        </div>
      </aside>

      <section className="crm-content">
        <div className="content-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>( 검색결과 : <strong>{data.total}</strong> 건 )</span>
          <button className="add-btn" onClick={() => setShowForm(true)}>+ 영업기회 추가</button>
        </div>

        {/* 영업기회 추가 폼 */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>영업기회 추가</h2>
                <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">영업기회명 *</label>
                  <input className="form-input" value={form.opp_name} onChange={(e) => handleFormChange("opp_name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">고객사</label>
                  <input className="form-input" value={form.company_name} onChange={(e) => handleFormChange("company_name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">고객 *</label>
                  <input className="form-input" value={form.customer_name} onChange={(e) => handleFormChange("customer_name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">진행상태</label>
                  <select className="form-input" value={form.status} onChange={(e) => handleFormChange("status", e.target.value)}>
                    <option value="진행중">진행중</option>
                    <option value="종료(성공)">종료(성공)</option>
                    <option value="종료(실패)">종료(실패)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">예상매출</label>
                  <input className="form-input" type="number" value={form.expected_revenue} onChange={(e) => handleFormChange("expected_revenue", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">예상이익률 (%)</label>
                  <input className="form-input" type="number" value={form.expected_margin_pct} onChange={(e) => handleFormChange("expected_margin_pct", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">예상이익금액</label>
                  <input className="form-input" type="number" value={form.expected_margin_amt} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">매출구분 *</label>
                  <select className="form-input" value={form.revenue_type} onChange={(e) => handleFormChange("revenue_type", e.target.value)}>
                    <option value="상품매출">상품매출</option>
                    <option value="서비스매출">서비스매출</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">사업유형</label>
                  <select className="form-input" value={form.biz_type} onChange={(e) => handleFormChange("biz_type", e.target.value)}>
                    <option value="">선택하세요</option>
                    <option value="국내">국내</option>
                    <option value="해외">해외</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">상세</label>
                  <select className="form-input" value={form.detail} onChange={(e) => handleFormChange("detail", e.target.value)}>
                    <option value="">선택하세요</option>
                    <option value="기업">기업</option>
                    <option value="관공서">관공서</option>
                    <option value="민간">민간</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">프로세스 *</label>
                  <select className="form-input" value={form.process} onChange={(e) => handleFormChange("process", e.target.value)}>
                    <option value="기본영업프로세스">기본영업프로세스</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">단계</label>
                  <select className="form-input" value={form.stage} onChange={(e) => handleFormChange("stage", e.target.value)}>
                    <option value="기회인지">기회인지</option>
                    <option value="제안">제안</option>
                    <option value="협상">협상</option>
                    <option value="계약">계약</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">카테고리</label>
                  <input className="form-input" value={form.category} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">성공확률 (%)</label>
                  <input className="form-input" type="number" value={form.success_pct} onChange={(e) => handleFormChange("success_pct", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">영업시작일</label>
                  <input className="form-input" value={form.start_date} onChange={(e) => handleFormChange("start_date", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">영업종료일</label>
                  <input className="form-input" value={form.end_date} onChange={(e) => handleFormChange("end_date", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">담당자</label>
                  <input className="form-input" value={form.manager} onChange={(e) => handleFormChange("manager", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">인지경로</label>
                  <select className="form-input" value={form.source} onChange={(e) => handleFormChange("source", e.target.value)}>
                    <option value="">선택하세요</option>
                    <option value="웹사이트">웹사이트</option>
                    <option value="소개">소개</option>
                    <option value="전시회">전시회</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="form-group form-full">
                  <label className="form-label">주소</label>
                  <input className="form-input" value={form.address} onChange={(e) => handleFormChange("address", e.target.value)} />
                </div>
                <div className="form-group form-full">
                  <label className="form-label">비고</label>
                  <textarea className="form-textarea" value={form.note} onChange={(e) => handleFormChange("note", e.target.value)} rows={3} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-cancel" onClick={() => setShowForm(false)}>취소</button>
                <button className="modal-submit" onClick={handleSubmit}>저장</button>
              </div>
            </div>
          </div>
        )}

        <div className="card-grid">
          {data.data.map((o) => (
            <div className="customer-card" key={o["영업기회ID"]} onClick={() => setSelectedOpp(o)} style={{ cursor: "pointer" }}>
              <div className="card-top">
                <div className="card-info">
                  <div className="card-name">{o["영업기회"]}</div>
                  <div className="card-company">{o["고객사"]} - {o["고객명"]}</div>
                </div>
              </div>
              <div className="card-middle">
                <div className="card-manager">{o["담당자"]}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="card-date">{o["시작일"]} ~ {o["종료일"]}</span>
                  <span className="card-badge" style={{ background: statusColor(o["진행상태"]) }}>
                    {o["진행상태"]}
                  </span>
                </div>
              </div>
              <div className="card-bottom" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>단계: {o["단계"] || "-"} | 성공확률: {o["성공확률(%)"] || 0}%</span>
                <span>예상매출: {(o["예상매출"] || 0).toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {page > 1 && <button className="page-btn" onClick={() => fetchData(page - 1)}>&lt;</button>}
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              const start = Math.max(1, page - 5);
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button key={p} className={`page-btn ${p === page ? "active" : ""}`} onClick={() => fetchData(p)}>
                  {p}
                </button>
              );
            })}
            {page < totalPages && <button className="page-btn" onClick={() => fetchData(page + 1)}>&gt;</button>}
          </div>
        )}
      </section>
    </>
  );
}

export default OpportunityList;
