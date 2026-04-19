import React, { useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

function CustomerDetail({ customer, onBack, onUpdate }) {
  const [form, setForm] = useState({ ...customer });
  const [editing, setEditing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [memo, setMemo] = useState("");
  const [memos, setMemos] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/generic/activities`, {
      params: { q: customer["고객명"], size: 20 }
    }).then(r => setActivities(r.data.data || [])).catch(() => {});
  }, [customer]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSave = async () => {
    await axios.post(`${API}/api/customers/update`, form);
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
        <button className="detail-back" onClick={onBack}>&larr; 고객 목록</button>
        <h2>{form["고객명"]}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && <button className="add-btn" onClick={() => setEditing(true)}>수정</button>}
          {!editing && <button className="delete-btn" onClick={async () => {
            if (!window.confirm("정말 삭제하시겠습니까?")) return;
            await axios.delete(`${API}/api/customers/${customer["고객ID"]}`);
            onBack();
          }}>삭제</button>}
          {editing && <button className="modal-submit" onClick={handleSave}>저장</button>}
          {editing && <button className="modal-cancel" onClick={() => { setForm({ ...customer }); setEditing(false); }}>취소</button>}
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-sidebar">
          <div className="detail-section">
            <div className="detail-section-title">연관정보</div>
            <div className="detail-section-subtitle">영업활동 ({activities.length}건)</div>
            {activities.slice(0, 10).map((a, i) => (
              <div key={i} className="related-item">
                <div className="related-date">{a["영업활동일"]}</div>
                <div className="related-text">{a["활동분류"]} / {a["활동목적"]}</div>
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

        <div className="detail-main">
          <div className="detail-form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">고객 *</label>
                <input className="form-input" value={form["고객명"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("고객명", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">고객사</label>
                <input className="form-input" value={form["고객사"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("고객사", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">부서</label>
                <input className="form-input" value={form["부서"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("부서", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">직책</label>
                <input className="form-input" value={form["직책"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("직책", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">휴대번호 *</label>
                <input className="form-input" value={form["휴대번호"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("휴대번호", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">유선번호</label>
                <input className="form-input" value={form["유선번호"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("유선번호", e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">메일 *</label>
                <input className="form-input" value={form["메일"] || ""} readOnly={!editing}
                  onChange={(e) => handleChange("메일", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">등급</label>
                {editing ? (
                  <select className="form-input" value={form["고객등급"] || ""} onChange={(e) => handleChange("고객등급", e.target.value)}>
                    <option value="">선택</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                ) : (
                  <input className="form-input" value={form["고객등급"] || ""} readOnly />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">키맨</label>
                {editing ? (
                  <select className="form-input" value={form["KeyMan"] || "N"} onChange={(e) => handleChange("KeyMan", e.target.value)}>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                ) : (
                  <input className="form-input" value={form["KeyMan"] || ""} readOnly />
                )}
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
        </div>
      </div>
    </div>
  );
}

export default CustomerDetail;
