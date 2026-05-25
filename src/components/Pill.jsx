import { C } from "../constants.js";

export default function Pill({ children, active, onClick, color }) {
  const activeBg = color || C.accent;
  const activeBorder = color || C.accent;

  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 100,
        border: `1.5px solid ${active ? activeBorder : C.border}`,
        background: active ? activeBg : "transparent",
        color: active ? "#fff" : C.muted,
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
