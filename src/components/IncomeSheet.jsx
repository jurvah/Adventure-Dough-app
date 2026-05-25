import { useState } from "react";
import Sheet from "./Sheet.jsx";
import Pill from "./Pill.jsx";
import { C, INCOME_CATS, todayStr, fmt$ } from "../constants.js";
import { db, addDoc, collection, serverTimestamp } from "../firebase.js";

const INIT = () => ({
  date: todayStr(),
  category: INCOME_CATS[0],
  amount: "",
  notes: "",
});

export default function IncomeSheet({ open, onClose }) {
  const [form, setForm] = useState(INIT());
  const [saving, setSaving] = useState(false);

  function handleClose() {
    setForm(INIT());
    onClose();
  }

  async function handleSave() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "transactions"), {
        type: "income",
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

  const canSave = form.amount && parseFloat(form.amount) > 0;

  return (
    <Sheet open={open} onClose={handleClose} title="Other Income">
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
            {INCOME_CATS.map((cat) => (
              <Pill
                key={cat}
                active={form.category === cat}
                onClick={() => setForm((f) => ({ ...f, category: cat }))}
                color={C.green}
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
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: canSave ? C.green : C.border,
            color: canSave ? "#fff" : C.muted,
            fontSize: 16,
            fontWeight: 700,
            cursor: canSave ? "pointer" : "default",
          }}
        >
          {saving ? "Saving…" : `Save Income${canSave ? ` · ${fmt$(form.amount)}` : ""}`}
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
