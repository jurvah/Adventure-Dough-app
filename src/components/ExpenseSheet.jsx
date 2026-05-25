import { useState, useRef } from "react";
import Sheet from "./Sheet.jsx";
import Pill from "./Pill.jsx";
import { C, EXPENSE_CATS, todayStr, fmt$ } from "../constants.js";
import { db, addDoc, collection, serverTimestamp } from "../firebase.js";

const INIT = () => ({
  date: todayStr(),
  category: EXPENSE_CATS[0],
  amount: "",
  notes: "",
});

export default function ExpenseSheet({ open, onClose }) {
  const [form, setForm] = useState(INIT());
  const [scanState, setScanState] = useState({ status: "idle", vendor: "", detail: "" });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  function reset() {
    setForm(INIT());
    setScanState({ status: "idle", vendor: "", detail: "" });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleScan(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setScanState({ status: "scanning", vendor: "", detail: "" });

    let base64;
    try {
      base64 = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) {
              height = Math.round((height * MAX) / width);
              width = MAX;
            } else {
              width = Math.round((width * MAX) / height);
              height = MAX;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75).split(",")[1]);
        };
        img.onerror = () => reject(new Error("Could not load image"));
        img.src = objectUrl;
      });
    } catch (err) {
      setScanState({ status: "error", vendor: "", detail: "Image load failed: " + err.message });
      return;
    }

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: "image/jpeg", data: base64 },
                },
                {
                  type: "text",
                  text: 'Receipt. Reply ONLY raw JSON, no markdown:\n{"vendor":"","date":"YYYY-MM-DD","total":0.00,"category":""}\nCategories: Supplies/Ingredients, Packaging, Market fees, Equipment, Marketing, Transportation, Other',
                },
              ],
            },
          ],
        }),
      });

      const body = await resp.json();
      if (!resp.ok || body.error) {
        setScanState({
          status: "error",
          vendor: "",
          detail: body.error?.message || `HTTP ${resp.status}`,
        });
        return;
      }

      const raw = body.content?.find((b) => b.type === "text")?.text || "";
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) {
        setScanState({ status: "error", vendor: "", detail: "Unexpected response format" });
        return;
      }

      const parsed = JSON.parse(raw.slice(start, end + 1));
      setForm({
        date:
          parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : todayStr(),
        category: EXPENSE_CATS.includes(parsed.category) ? parsed.category : EXPENSE_CATS[0],
        amount: parsed.total > 0 ? String(Math.round(parsed.total * 100) / 100) : "",
        notes: parsed.vendor || "",
      });
      setScanState({ status: "done", vendor: parsed.vendor || "", detail: "" });
    } catch (err) {
      setScanState({ status: "error", vendor: "", detail: err.message || "Network error" });
    }
  }

  async function handleSave() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "transactions"), {
        type: "expense",
        date: form.date,
        category: form.category,
        amount: amt,
        notes: form.notes,
        createdAt: serverTimestamp(),
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  const scanBanner = {
    idle: null,
    scanning: { bg: "#e8f0fe", border: "#4285f4", color: "#1a5cad", text: "⏳ Reading receipt…" },
    done: { bg: C.greenBg, border: C.greenBorder, color: C.green, text: `✓ Receipt scanned${scanState.vendor ? ` — ${scanState.vendor}` : ""}` },
    error: { bg: C.redBg, border: C.redBorder, color: C.red, text: "✗ Scan failed" },
  }[scanState.status];

  return (
    <Sheet open={open} onClose={handleClose} title="Add Expense">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleScan}
      />

      {scanBanner && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${scanBanner.border}`,
            background: scanBanner.bg,
            color: scanBanner.color,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {scanBanner.text}
          {scanState.status === "error" && scanState.detail && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{scanState.detail}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {EXPENSE_CATS.map((cat) => (
              <Pill
                key={cat}
                active={form.category === cat}
                onClick={() => setForm((f) => ({ ...f, category: cat }))}
              >
                {cat}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Amount</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: C.muted }}>$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              style={{ ...inputStyle, paddingLeft: 32, fontSize: 24, fontWeight: 700 }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <input
            type="text"
            placeholder="Optional"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: `1.5px solid ${C.border}`,
            background: "transparent",
            color: C.textMid,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          📷 Scan Receipt
        </button>

        <button
          onClick={handleSave}
          disabled={!form.amount || parseFloat(form.amount) <= 0 || saving}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: !form.amount || parseFloat(form.amount) <= 0 ? C.border : C.accent,
            color: !form.amount || parseFloat(form.amount) <= 0 ? C.muted : "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: !form.amount || parseFloat(form.amount) <= 0 ? "default" : "pointer",
          }}
        >
          {saving ? "Saving…" : `Save Expense${form.amount && parseFloat(form.amount) > 0 ? ` · ${fmt$(form.amount)}` : ""}`}
        </button>
      </div>
    </Sheet>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: C.surface,
  fontSize: 16,
  color: C.text,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
};
