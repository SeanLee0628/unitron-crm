import React, { useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login, signup, verify
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [debugCode, setDebugCode] = useState("");

  const handleSignup = async () => {
    setError(""); setMessage("");
    try {
      const res = await axios.post(`${API}/api/auth/signup`, { email, name, password, department });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setMessage(res.data.message);
        if (res.data.debug_code) setDebugCode(res.data.debug_code);
        setMode("verify");
      }
    } catch (err) {
      setError("발송 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleVerify = async () => {
    setError(""); setMessage("");
    const res = await axios.post(`${API}/api/auth/verify`, { email, code });
    if (res.data.error) {
      setError(res.data.error);
    } else {
      setMessage(res.data.message);
      setMode("login");
      setDebugCode("");
    }
  };

  const handleLogin = async () => {
    setError(""); setMessage("");
    const res = await axios.post(`${API}/api/auth/login`, { email, password });
    if (res.data.error) {
      setError(res.data.error);
    } else {
      localStorage.setItem("crm_user", JSON.stringify(res.data.user));
      onLogin(res.data.user);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Unitrontech</h1>
          <span>CRM</span>
        </div>

        {mode === "login" && (
          <>
            <h2 className="auth-title">로그인</h2>
            <input className="auth-input" type="email" placeholder="이메일 (@unitrontech.com)"
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            <input className="auth-input" type="password" placeholder="비밀번호"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            <button className="auth-btn" onClick={handleLogin}>로그인</button>
            <div className="auth-link">
              계정이 없으신가요? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>회원가입</button>
            </div>
          </>
        )}

        {mode === "signup" && (
          <>
            <h2 className="auth-title">회원가입</h2>
            <input className="auth-input" type="email" placeholder="유니트론텍 이메일 (@unitrontech.com)"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="auth-input" type="text" placeholder="이름 (실명)"
              value={name} onChange={(e) => setName(e.target.value)} />
            <select className="auth-input" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">소속 선택</option>
              <option value="영업1실">영업1실</option>
              <option value="영업2실">영업2실</option>
              <option value="영업3실">영업3실</option>
              <option value="영업4실">영업4실</option>
              <option value="영업5실">영업5실</option>
              <option value="기타">기타</option>
            </select>
            <input className="auth-input" type="password" placeholder="비밀번호"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="auth-btn" onClick={handleSignup}>인증번호 발송</button>
            <div className="auth-link">
              이미 계정이 있으신가요? <button onClick={() => { setMode("login"); setError(""); setMessage(""); }}>로그인</button>
            </div>
          </>
        )}

        {mode === "verify" && (
          <>
            <h2 className="auth-title">이메일 인증</h2>
            <p className="auth-desc">{email}로 발송된 인증번호를 입력하세요</p>
            {debugCode && <p className="auth-debug">인증번호: <strong>{debugCode}</strong></p>}
            <input className="auth-input" type="text" placeholder="인증번호 6자리"
              value={code} onChange={(e) => setCode(e.target.value)} maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()} />
            <button className="auth-btn" onClick={handleVerify}>인증 확인</button>
            <div className="auth-link">
              <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>다시 발송</button>
            </div>
          </>
        )}

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-message">{message}</div>}
      </div>
    </div>
  );
}

export default AuthPage;
