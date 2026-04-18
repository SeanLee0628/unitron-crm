import React from "react";

function Placeholder({ title }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128679;</div>
        <h2 style={{ color: "#333", marginBottom: 8 }}>{title}</h2>
        <p>준비 중입니다</p>
      </div>
    </div>
  );
}

export default Placeholder;
