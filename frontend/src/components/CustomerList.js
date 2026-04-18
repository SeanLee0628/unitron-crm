import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import CustomerDetail from "./CustomerDetail";

const API = process.env.REACT_APP_API_URL || "http://localhost:8002";

function CustomerList() {
  const [data, setData] = useState({ data: [], total: 0 });
  const [search, setSearch] = useState("");
  const [keyman, setKeyman] = useState("전체");
  const [manager, setManager] = useState("");
  const [managers, setManagers] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", dept: "", position: "", mobile: "", email: "", keyman: "N", manager: "" });
  const fileRef = useRef();

  const fetchData = async (p = 1) => {
    const res = await axios.get(`${API}/api/customers`, {
      params: { q: search, keyman, manager, page: p, size: 50 },
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
    await axios.post(`${API}/api/customers/upload`, formData);
    fetchData(1);
    axios.get(`${API}/api/managers`).then((r) => setManagers(r.data.managers));
  };

  const handleCreate = async () => {
    if (!form.name) { alert("고객명을 입력하세요"); return; }
    await axios.post(`${API}/api/customers/create`, form);
    setShowForm(false);
    setForm({ name: "", company: "", dept: "", position: "", mobile: "", email: "", keyman: "N", manager: "" });
    fetchData(1);
  };

  const totalPages = Math.ceil(data.total / 50);

  if (selectedCustomer) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        onBack={() => { setSelectedCustomer(null); fetchData(page); }}
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
          placeholder="검색어 (이름, 회사, 이메일)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <select className="sidebar-select" value={keyman} onChange={(e) => setKeyman(e.target.value)}>
          <option value="전체">키맨(전체)</option>
          <option value="Y">키맨(Y)</option>
          <option value="N">키맨(N)</option>
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
          <button className="add-btn" onClick={() => setShowForm(true)}>+ 고객 추가</button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
              <div className="modal-header">
                <h2>고객 추가</h2>
                <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">고객명 *</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">고객사</label>
                  <input className="form-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">부서</label>
                  <input className="form-input" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">직책</label>
                  <input className="form-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">휴대번호 *</label>
                  <input className="form-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">메일 *</label>
                  <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">키맨</label>
                  <select className="form-input" value={form.keyman} onChange={(e) => setForm({ ...form, keyman: e.target.value })}>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">담당자</label>
                  <input className="form-input" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
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
            <div className="customer-card" key={c["고객ID"]} onClick={() => setSelectedCustomer(c)} style={{ cursor: "pointer" }}>
              <div className="card-top">
                <div className="card-avatar">&#128100;</div>
                <div className="card-info">
                  <div className="card-name">
                    {c["고객명"]}
                    <span>( {c["부서"] || "-"} / {c["직책"] || "-"} )</span>
                  </div>
                  <div className="card-company">{c["고객사"]}</div>
                </div>
              </div>
              <div className="card-middle">
                <div className="card-manager">{c["담당자"]}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {c["영업활동일"] && <span className="card-date">({c["영업활동일"]})</span>}
                  {c["KeyMan"] === "Y" && <span className="card-badge card-keyman">KeyMan</span>}
                </div>
              </div>
              <div className="card-bottom">
                {c["메일"] || ""}{c["메일"] && c["휴대번호"] ? " | " : ""}{c["휴대번호"] || ""}
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

export default CustomerList;
