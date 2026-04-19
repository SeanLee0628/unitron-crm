import React, { useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

const STAGES = ["기회인지", "제품소개", "제안", "초기견적", "재견적", "협상", "계약"];
const STAGE_CATEGORY = { "기회인지": "인지", "제안": "제안", "협상": "협상", "계약": "계약" };

function OpportunityDetail({ opportunity, onBack, onUpdate }) {
  const [form, setForm] = useState({ ...opportunity });
  const [activities, setActivities] = useState([]);
  const [relatedCustomer, setRelatedCustomer] = useState(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // 연관 영업활동 조회
    if (opportunity["고객사"]) {
      axios.get(`${API}/api/generic/activities`, {
        params: { q: opportunity["고객명"] || opportunity["고객사"], size: 20 }
      }).then(r => setActivities(r.data.data || [])).catch(() => {});
    }
    // 연관 고객 조회
    if (opportunity["고객명"]) {
      axios.get(`${API}/api/customers`, {
        params: { q: opportunity["고객명"], size: 1 }
      }).then(r => {
        if (r.data.data?.length > 0) setRelatedCustomer(r.data.data[0]);
      }).catch(() => {});
    }
  }, [opportunity]);

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value };
    if (field === "단계") {
      updated["카테고리"] = STAGE_CATEGORY[value] || value;
    }
    setForm(updated);
  };

  const handleSave = async () => {
    await axios.post(`${API}/api/opportunities/update`, form);
    setEditing(false);
    if (onUpdate) onUpdate();
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    const now = new Date();
    const ts = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setComments([...comments, { text: comment, date: ts, author: form["담당자"] || "나" }]);
    setComment("");
  };

  const currentStageIdx = STAGES.indexOf(form["단계"]);

  return (
    <div className="detail-page">
      {/* 상단 바 */}
      <div className="detail-topbar">
        <button className="detail-back" onClick={onBack}>&larr; 영업기회 목록</button>
        <h2>{form["영업기회"]}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && <button className="add-btn" onClick={() => setEditing(true)}>수정</button>}
          {!editing && <button className="delete-btn" onClick={async () => {
            if (!window.confirm("정말 삭제하시겠습니까?")) return;
            await axios.delete(`${API}/api/opportunities/${opportunity["영업기회ID"]}`);
            onBack();
          }}>삭제</button>}
          {editing && <button className="modal-submit" onClick={handleSave}>저장</button>}
          {editing && <button className="modal-cancel" onClick={() => { setForm({ ...opportunity }); setEditing(false); }}>취소</button>}
        </div>
      </div>

      <div className="detail-layout">
        {/* 왼쪽: 사이드 정보 */}
        <div className="detail-sidebar">
          <div className="detail-section">
            <div className="detail-section-title">연관정보</div>
            <div className="detail-section-subtitle">영업활동 ({activities.length}건)</div>
            {activities.slice(0, 5).map((a, i) => (
              <div key={i} className="related-item">
                <div className="related-date">{a["영업활동일"]}</div>
                <div className="related-text">{a["활동분류"]} / {a["활동목적"]}</div>
              </div>
            ))}
            {activities.length === 0 && <div className="related-empty">표시할 정보가 없습니다</div>}
          </div>

          <div className="detail-section">
            <div className="detail-section-title">연관고객 ({relatedCustomer ? 1 : 0})</div>
            {relatedCustomer && (
              <div className="related-customer">
                <div className="related-customer-name">{relatedCustomer["고객사"]} / {relatedCustomer["고객명"]}</div>
                <div className="related-customer-info">{relatedCustomer["부서"]} / {relatedCustomer["직책"]}</div>
                <div className="related-customer-info">{relatedCustomer["휴대번호"]} / {relatedCustomer["메일"]}</div>
              </div>
            )}
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
              <input
                className="comment-input"
                placeholder="의견을 입력하세요"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <button className="comment-send" onClick={handleAddComment}>전송</button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 메인 컨텐츠 */}
        <div className="detail-main">
          {/* 프로세스 파이프라인 */}
          <div className="pipeline">
            {STAGES.map((s, i) => (
              <div
                key={s}
                className={`pipeline-stage ${i <= currentStageIdx ? "active" : ""} ${i === currentStageIdx ? "current" : ""}`}
                onClick={() => editing && handleChange("단계", s)}
              >
                <div className="pipeline-dot" />
                <div className="pipeline-label">{s}</div>
              </div>
            ))}
          </div>

          {/* 폼 */}
          <div className="detail-form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">영업기회명 *</label>
                <input className="form-input" value={form["영업기회"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("영업기회", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">고객사</label>
                <input className="form-input" value={form["고객사"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("고객사", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">고객 *</label>
                <input className="form-input" value={form["고객명"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("고객명", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">진행상태</label>
                {editing ? (
                  <select className="form-input" value={form["진행상태"] || ""} onChange={(e) => handleChange("진행상태", e.target.value)}>
                    <option value="진행중">진행중</option>
                    <option value="종료(성공)">종료(성공)</option>
                    <option value="종료(실패)">종료(실패)</option>
                  </select>
                ) : (
                  <input className="form-input" value={form["진행상태"] || ""} readOnly />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">예상매출</label>
                <input className="form-input" type="number" value={form["예상매출"] || 0} readOnly={!editing}
                  onChange={(e) => handleChange("예상매출", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">성공확률 (%)</label>
                <input className="form-input" type="number" value={form["성공확률(%)"] || 0} readOnly={!editing}
                  onChange={(e) => handleChange("성공확률(%)", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">단계</label>
                {editing ? (
                  <select className="form-input" value={form["단계"] || ""} onChange={(e) => handleChange("단계", e.target.value)}>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={form["단계"] || ""} readOnly />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">담당자</label>
                <input className="form-input" value={form["담당자"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("담당자", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">시작일</label>
                <input className="form-input" value={form["시작일"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("시작일", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">종료일</label>
                <input className="form-input" value={form["종료일"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("종료일", e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">비고</label>
                <textarea className="form-textarea" rows={8} value={form["비고"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("비고", e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpportunityDetail;
