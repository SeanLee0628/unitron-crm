import React, { useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:8002";

function CompanyDetail({ company, onBack, onUpdate }) {
  const [form, setForm] = useState({ ...company });
  const [editing, setEditing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [memo, setMemo] = useState("");
  const [memos, setMemos] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  useEffect(() => {
    // 소속 고객 조회
    axios.get(`${API}/api/customers`, {
      params: { company: company["고객사명"], size: 50 }
    }).then(r => setCustomers(r.data.data || [])).catch(() => {});

    // 연관 영업활동
    axios.get(`${API}/api/generic/activities`, {
      params: { q: company["고객사명"], size: 20 }
    }).then(r => setActivities(r.data.data || [])).catch(() => {});
  }, [company]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSave = async () => {
    await axios.post(`${API}/api/companies/update`, form);
    setEditing(false);
    if (onUpdate) onUpdate();
  };

  const addComment = () => {
    if (!comment.trim()) return;
    const now = new Date();
    const ts = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setComments([...comments, { text: comment, date: ts, author: form["담당자"] || "나" }]);
    setComment("");
  };

  const addMemo = () => {
    if (!memo.trim()) return;
    const now = new Date();
    const ts = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setMemos([...memos, { text: memo, date: ts, author: form["담당자"] || "나" }]);
    setMemo("");
  };

  return (
    <div className="detail-page">
      <div className="detail-topbar">
        <button className="detail-back" onClick={onBack}>&larr; 고객사 목록</button>
        <h2>{form["고객사명"]}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ai-btn" onClick={async () => {
            setBriefingLoading(true);
            try {
              const res = await axios.post(`${API}/api/ai/briefing`, { company_name: company["고객사명"] });
              setBriefing(res.data.error ? null : res.data.briefing);
            } catch { }
            setBriefingLoading(false);
          }} disabled={briefingLoading}>
            {briefingLoading ? "생성 중..." : "AI 브리핑"}
          </button>
          {!editing && <button className="add-btn" onClick={() => setEditing(true)}>수정</button>}
          {editing && <button className="modal-submit" onClick={handleSave}>저장</button>}
          {editing && <button className="modal-cancel" onClick={() => { setForm({ ...company }); setEditing(false); }}>취소</button>}
        </div>
      </div>

      <div className="detail-layout">
        {/* 왼쪽 사이드바 */}
        <div className="detail-sidebar">
          <div className="detail-section">
            <div className="detail-section-title">연관정보</div>
            <div className="detail-section-subtitle">영업활동 ({activities.length}건)</div>
            {activities.slice(0, 10).map((a, i) => (
              <div key={i} className="related-item">
                <div className="related-date">{a["영업활동일"]}</div>
                <div className="related-text">{a["활동분류"]} / {a["활동목적"]}</div>
                <div className="related-text" style={{ color: "#aaa" }}>{a["고객"]} / {a["담당자"]}</div>
              </div>
            ))}
            {activities.length === 0 && <div className="related-empty">표시할 정보가 없습니다</div>}
          </div>

          <div className="detail-section">
            <div className="detail-section-title">의견 ({comments.length})</div>
            {comments.map((c, i) => (
              <div key={i} className="comment-item">
                <div className="comment-author">{c.author} <span>{c.date}</span></div>
                <div className="comment-text">{c.text}</div>
              </div>
            ))}
            <div className="comment-input-wrap">
              <input className="comment-input" placeholder="의견을 입력하세요" value={comment}
                onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} />
              <button className="comment-send" onClick={addComment}>전송</button>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">메모 ({memos.length})</div>
            {memos.map((m, i) => (
              <div key={i} className="comment-item">
                <div className="comment-author">{m.author} <span>{m.date}</span></div>
                <div className="comment-text">{m.text}</div>
              </div>
            ))}
            <div className="comment-input-wrap">
              <input className="comment-input" placeholder="메모를 입력하세요" value={memo}
                onChange={(e) => setMemo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMemo()} />
              <button className="comment-send" onClick={addMemo}>전송</button>
            </div>
          </div>
        </div>

        {/* 오른쪽 메인 */}
        <div className="detail-main">
          {briefing && (
            <div className="ai-briefing-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>AI 브리핑</h3>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }} onClick={() => setBriefing(null)}>&times;</button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{briefing}</div>
            </div>
          )}
          <div className="detail-form">
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">고객사 *</label>
                <input className="form-input" value={form["고객사명"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("고객사명", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">구분</label>
                {editing ? (
                  <select className="form-input" value={form["고객사 구분"] || ""} onChange={(e) => handleChange("고객사 구분", e.target.value)}>
                    <option value="고객사">고객사</option>
                    <option value="잠재고객">잠재고객</option>
                    <option value="파트너">파트너</option>
                  </select>
                ) : (
                  <input className="form-input" value={form["고객사 구분"] || ""} readOnly />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">등급</label>
                {editing ? (
                  <select className="form-input" value={form["고객사 등급"] || ""} onChange={(e) => handleChange("고객사 등급", e.target.value)}>
                    <option value="A등급">A등급</option>
                    <option value="B등급">B등급</option>
                    <option value="C등급">C등급</option>
                    <option value="D등급">D등급</option>
                  </select>
                ) : (
                  <input className="form-input" value={form["고객사 등급"] || ""} readOnly />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">진행상태</label>
                {editing ? (
                  <select className="form-input" value={form["진행상태"] || ""} onChange={(e) => handleChange("진행상태", e.target.value)}>
                    <option value="진행중">진행중</option>
                    <option value="보류">보류</option>
                    <option value="중단">중단</option>
                  </select>
                ) : (
                  <input className="form-input" value={form["진행상태"] || ""} readOnly />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">매출 (년)</label>
                <input className="form-input" value={form["매출금액"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("매출금액", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">사원수</label>
                <input className="form-input" value={form["사원수"] || 0} readOnly={!editing}
                  onChange={(e) => handleChange("사원수", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">사업자번호</label>
                <input className="form-input" value={form["사업자번호"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("사업자번호", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">유선번호</label>
                <input className="form-input" value={form["유선번호"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("유선번호", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">팩스번호</label>
                <input className="form-input" value={form["팩스번호"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("팩스번호", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">웹사이트</label>
                <input className="form-input" value={form["웹사이트"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("웹사이트", e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">주소</label>
                <input className="form-input" value={form["주소"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("주소", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">담당자</label>
                <input className="form-input" value={form["담당자"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("담당자", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">등록일</label>
                <input className="form-input" value={form["등록일"] || ""} readOnly />
              </div>
            </div>
          </div>

          {/* 소속 고객 목록 */}
          <div style={{ marginTop: 20, background: "#fff", borderRadius: 8, padding: 16 }}>
            <div className="detail-section-title">고객 ({customers.length})</div>
            {customers.map((c, i) => (
              <div key={i} className="related-customer" style={{ marginBottom: 8 }}>
                <div className="related-customer-name">{c["고객명"]} / {c["직책"] || "-"}</div>
                <div className="related-customer-info">{c["부서"] || "-"}</div>
                <div className="related-customer-info">{c["휴대번호"] || ""} {c["메일"] ? `/ ${c["메일"]}` : ""}</div>
              </div>
            ))}
            {customers.length === 0 && <div className="related-empty">소속 고객이 없습니다</div>}
          </div>

          {/* 영업활동 타임라인 */}
          <div style={{ marginTop: 20, background: "#fff", borderRadius: 8, padding: 16 }}>
            <div className="detail-section-title">영업활동 내역 ({activities.length})</div>
            {activities.map((a, i) => {
              const content = a["활동내용"];
              const hasContent = content && content !== "None" && content !== "nan";
              return (
                <div key={i} className="timeline-item">
                  <div className="timeline-header">
                    <span className="timeline-badge">{a["진행상태"] === "완료" ? "영업활동 완료" : a["진행상태"] || "활동"}</span>
                    <span className="timeline-date">{a["영업활동일"]}</span>
                  </div>
                  <div className="timeline-meta">
                    {a["고객사"]} / {a["고객"]} / {a["담당자"]}
                  </div>
                  <div className="timeline-meta">
                    {a["활동분류"]} / {a["활동목적"]}
                  </div>
                  {hasContent && (
                    <div className="timeline-content">{content}</div>
                  )}
                </div>
              );
            })}
            {activities.length === 0 && <div className="related-empty">영업활동 내역이 없습니다</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyDetail;
