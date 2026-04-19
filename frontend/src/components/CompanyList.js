import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CompanyDetail from "./CompanyDetail";

const API = process.env.REACT_APP_API_URL || "";

function CompanyList() {
  const [data, setData] = useState({ data: [], total: 0 });
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState("");
  const [manager, setManager] = useState("");
  const [managers, setManagers] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "고객사", grade: "C등급", status: "진행중", manager: "", address: "" });
  const [briefings, setBriefings] = useState({});
  const [briefingLoading, setBriefingLoading] = useState({});
  const fileRef = useRef();

  const fetchData = async (p = 1) => {
    const res = await axios.get(`${API}/api/companies`, {
      params: { q: search, grade, status, manager, page: p, size: 50 },
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
    await axios.post(`${API}/api/companies/upload`, formData);
    fetchData(1);
  };

  const handleCreate = async () => {
    if (!form.name) { alert("고객사명을 입력하세요"); return; }
    await axios.post(`${API}/api/companies/create`, form);
    setShowForm(false);
    setForm({ name: "", category: "고객사", grade: "C등급", status: "진행중", manager: "", address: "" });
    fetchData(1);
  };

  const totalPages = Math.ceil(data.total / 50);

  if (selectedCompany) {
    return (
      <CompanyDetail
        company={selectedCompany}
        onBack={() => { setSelectedCompany(null); fetchData(page); }}
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
          placeholder="검색어 (고객사명)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <select className="sidebar-select" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">등급(전체)</option>
          <option value="A등급">A등급</option>
          <option value="B등급">B등급</option>
          <option value="C등급">C등급</option>
          <option value="D등급">D등급</option>
        </select>
        <select className="sidebar-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">진행상태(전체)</option>
          <option value="진행중">진행중</option>
          <option value="보류">보류</option>
          <option value="중단">중단</option>
        </select>
        <select className="sidebar-select" value={manager} onChange={(e) => setManager(e.target.value)}>
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
          <button className="add-btn" onClick={() => setShowForm(true)}>+ 고객사 추가</button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
              <div className="modal-header">
                <h2>고객사 추가</h2>
                <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
              </div>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label className="form-label">고객사명 *</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">구분</label>
                  <select className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="고객사">고객사</option>
                    <option value="잠재고객">잠재고객</option>
                    <option value="파트너">파트너</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">등급</label>
                  <select className="form-input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                    <option value="A등급">A등급</option>
                    <option value="B등급">B등급</option>
                    <option value="C등급">C등급</option>
                    <option value="D등급">D등급</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">진행상태</label>
                  <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="진행중">진행중</option>
                    <option value="보류">보류</option>
                    <option value="중단">중단</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">담당자</label>
                  <input className="form-input" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
                </div>
                <div className="form-group form-full">
                  <label className="form-label">주소</label>
                  <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-cancel" onClick={() => setShowForm(false)}>취소</button>
                <button className="modal-submit" onClick={handleCreate}>저장</button>
              </div>
            </div>
          </div>
        )}

        <div className="card-grid">
          {data.data.map((c) => (
            <div className="company-card" key={c["고객사ID"]}>
              <div style={{ cursor: "pointer" }} onClick={() => setSelectedCompany(c)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="company-name">{c["고객사명"]}</div>
                  <button className="ai-btn" style={{ fontSize: 11, padding: "3px 10px" }} onClick={(e) => {
                    e.stopPropagation();
                    const id = c["고객사ID"];
                    setBriefingLoading(prev => ({ ...prev, [id]: true }));
                    axios.post(`${API}/api/ai/briefing`, { company_name: c["고객사명"] })
                      .then(res => setBriefings(prev => ({ ...prev, [id]: res.data.briefing || res.data.error })))
                      .catch(() => setBriefings(prev => ({ ...prev, [id]: "생성 실패" })))
                      .finally(() => setBriefingLoading(prev => ({ ...prev, [id]: false })));
                  }} disabled={briefingLoading[c["고객사ID"]]}>
                    {briefingLoading[c["고객사ID"]] ? "..." : "AI 브리핑"}
                  </button>
                </div>
                <div className="company-meta">
                  <span className="badge badge-grade">{c["고객사 등급"] || "-"}</span>
                  <span className={`badge ${c["진행상태"] === "진행중" ? "badge-status" : "badge-status-hold"}`}>
                    {c["진행상태"] || "-"}
                  </span>
                  {c["고객수"] > 0 && <span className="badge badge-grade">고객 {c["고객수"]}명</span>}
                </div>
                <div className="company-detail">
                  <span>담당: {c["담당자"] || "-"}</span>
                  <span>등록: {c["등록일"] || "-"}</span>
                </div>
                {c["주소"] && <div className="company-detail" style={{ marginTop: 4 }}>{c["주소"]}</div>}
              </div>
              {briefings[c["고객사ID"]] && (
                <div className="ai-briefing-box" style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 12 }}>AI 브리핑</strong>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14 }}
                      onClick={() => setBriefings(prev => { const n = { ...prev }; delete n[c["고객사ID"]]; return n; })}>&times;</button>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333" }}>{briefings[c["고객사ID"]]}</div>
                </div>
              )}
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

export default CompanyList;
