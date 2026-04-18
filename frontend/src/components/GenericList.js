import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:8002";

// 폼에서 제외할 컬럼
const EXCLUDE_COLS = new Set(["변경자", "변경일", "등록자", "등록일"]);
// ID 컬럼 (자동 생성)
const isIdCol = (c) => c.endsWith("ID") || c === "id";
// 긴 텍스트 컬럼
const isLongText = (c) => ["비고", "내용", "활동내용", "계획내용", "활동목적", "주소"].includes(c);
// None/nan 정리
const cleanVal = (v) => {
  if (v === null || v === undefined || v === "None" || v === "nan" || v === "null") return "";
  return String(v);
};

function GenericList({ tableName, title }) {
  const [data, setData] = useState({ data: [], columns: [], total: 0 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const fileRef = useRef();

  const fetchData = async (p = 1) => {
    const res = await axios.get(`${API}/api/generic/${tableName}`, {
      params: { q: search, page: p, size: 50 },
    });
    setData(res.data);
    setPage(p);
  };

  useEffect(() => { fetchData(); setSelectedItem(null); }, [tableName]);

  const handleSearch = () => { fetchData(1); };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await axios.post(`${API}/api/generic/${tableName}/upload`, formData);
    fetchData(1);
  };

  const formCols = data.columns.filter(c => !EXCLUDE_COLS.has(c) && !isIdCol(c));

  const openAddForm = () => {
    const empty = {};
    formCols.forEach(c => { empty[c] = ""; });
    setForm(empty);
    setShowForm(true);
  };

  const handleCreate = async () => {
    // ID 자동 생성
    const idCol = data.columns.find(c => isIdCol(c));
    const record = { ...form };
    if (idCol) record[idCol] = String(Date.now()).slice(-7);
    record["등록일"] = new Date().toISOString().slice(0, 10);

    await axios.post(`${API}/api/generic/${tableName}/create`, record);
    setShowForm(false);
    fetchData(1);
  };

  const handleUpdate = async () => {
    await axios.post(`${API}/api/generic/${tableName}/update`, selectedItem);
    setEditing(false);
    fetchData(page);
  };

  const totalPages = Math.ceil(data.total / 50);
  const displayCols = data.columns.filter(c => !isIdCol(c) && !EXCLUDE_COLS.has(c)).slice(0, 8);

  // 디테일 뷰
  if (selectedItem) {
    const detailCols = data.columns.filter(c => !EXCLUDE_COLS.has(c));
    return (
      <div className="detail-page">
        <div className="detail-topbar">
          <button className="detail-back" onClick={() => { setSelectedItem(null); setEditing(false); }}>&larr; {title} 목록</button>
          <h2>{selectedItem[data.columns.find(c => c.includes("명") || c.includes("제목")) || data.columns[1]] || title}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {!editing && <button className="add-btn" onClick={() => setEditing(true)}>수정</button>}
            {editing && <button className="modal-submit" onClick={handleUpdate}>저장</button>}
            {editing && <button className="modal-cancel" onClick={() => setEditing(false)}>취소</button>}
          </div>
        </div>
        <div className="detail-layout">
          <div className="detail-main" style={{ flex: 1 }}>
            <div className="detail-form">
              <div className="form-grid">
                {detailCols.map(c => (
                  <div className={`form-group ${isLongText(c) ? "form-full" : ""}`} key={c}>
                    <label className="form-label">{c}</label>
                    {isLongText(c) ? (
                      <textarea className="form-textarea" rows={cleanVal(selectedItem[c]).length > 200 ? 12 : 5}
                        value={cleanVal(selectedItem[c])} readOnly={!editing || isIdCol(c)}
                        onChange={(e) => setSelectedItem({ ...selectedItem, [c]: e.target.value })} />
                    ) : (
                      <input className="form-input"
                        value={cleanVal(selectedItem[c])} readOnly={!editing || isIdCol(c)}
                        onChange={(e) => setSelectedItem({ ...selectedItem, [c]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside className="crm-sidebar">
        <div className="sidebar-title">{title}</div>
        <input
          className="sidebar-input"
          placeholder="검색어"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
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
          <button className="add-btn" onClick={openAddForm}>+ {title} 추가</button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{title} 추가</h2>
                <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
              </div>
              <div className="form-grid">
                {formCols.map(c => (
                  <div className={`form-group ${isLongText(c) ? "form-full" : ""}`} key={c}>
                    <label className="form-label">{c}</label>
                    {isLongText(c) ? (
                      <textarea className="form-textarea" rows={3} value={form[c] || ""}
                        onChange={(e) => setForm({ ...form, [c]: e.target.value })} />
                    ) : (
                      <input className="form-input" value={form[c] || ""}
                        onChange={(e) => setForm({ ...form, [c]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="modal-cancel" onClick={() => setShowForm(false)}>취소</button>
                <button className="modal-submit" onClick={handleCreate}>저장</button>
              </div>
            </div>
          </div>
        )}

        <div className="card-grid">
          {data.data.map((row, i) => {
            const secondCol = data.columns.find(c => c.includes("명") || c.includes("제목")) || data.columns[1];
            return (
              <div className="customer-card" key={i} onClick={() => setSelectedItem({ ...row })} style={{ cursor: "pointer" }}>
                <div className="card-top">
                  <div className="card-info">
                    <div className="card-name">{row[secondCol] || row[data.columns[0]] || "-"}</div>
                    <div className="card-company">
                      {row["고객사"] || row["고객사명"] || ""} {row["고객명"] ? `- ${row["고객명"]}` : ""}
                    </div>
                  </div>
                </div>
                <div className="card-middle">
                  <div className="card-manager">{row["담당자"] || row["접수자"] || "-"}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {row["진행상태"] && <span className="card-badge">{row["진행상태"]}</span>}
                    {row["상태"] && <span className="card-badge">{row["상태"]}</span>}
                    {row["등록일"] && <span className="card-date">({row["등록일"]})</span>}
                  </div>
                </div>
                <div className="card-bottom">
                  {displayCols.filter(c => c !== secondCol && c !== "고객사" && c !== "고객사명" && c !== "고객명" && c !== "담당자" && c !== "접수자" && c !== "진행상태" && c !== "상태" && c !== "등록일").map(c => {
                    const v = cleanVal(row[c]);
                    if (!v) return null;
                    const display = v.length > 40 ? v.slice(0, 40) + "..." : v;
                    return <span key={c} style={{ marginRight: 12 }}>{c}: {display}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {data.data.length === 0 && (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>데이터가 없습니다</div>
        )}

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

export default GenericList;
