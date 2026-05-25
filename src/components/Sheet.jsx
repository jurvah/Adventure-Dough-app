import { useEffect } from "react";
import { C } from "../constants.js";

export default function Sheet({ open, onClose, children, title }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
        </div>
        {title && (
          <div style={{ padding: "16px 24px 0", fontSize: 18, fontWeight: 700, color: C.text }}>
            {title}
          </div>
        )}
        <div style={{ padding: "20px 24px 44px" }}>{children}</div>
      </div>
    </div>
  );
}
