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

// Resize image on canvas for better OCR accuracy (larger = better for text)
function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1800;
      let { width, height } = img;
      // Scale up small images; scale down huge ones
      if (width < MAX && height < MAX) {
        const scale = Math.min(MAX / Math.max(width, height), 2);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      } else if (width > MAX || height > MAX) {
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
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = objectUrl;
  });
}

const MONTH_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function parseReceiptText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Vendor: first line with 3+ consecutive letters (usually store name at top)
  const vendor = lines.find((l) => /[a-zA-Z]{3,}/.test(l)) || "";

  // Date extraction — try several common receipt formats
  let date = todayStr();
  for (const line of lines) {
    let m;

    // MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY
    m = line.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (m) {
      const yr = m[3].length === 2 ? "20" + m[3] : m[3];
      const candidate = `${yr}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      if (isValidReceiptDate(candidate)) { date = candidate; break; }
    }

    // YYYY-MM-DD
    m = line.match(/\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/);
    if (m) {
      const candidate = `${m[1]}-${m[2]}-${m[3]}`;
      if (isValidReceiptDate(candidate)) { date = candidate; break; }
    }

    // "May 24, 2025" or "24 May 2025"
    m = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
    if (!m) m = line.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i);
    if (m) {
      const isMonthFirst = isNaN(parseInt(m[1]));
      const monthKey = (isMonthFirst ? m[1] : m[2]).toLowerCase().slice(0, 3);
      const month = MONTH_MAP[monthKey];
      const day = isMonthFirst ? m[2] : m[1];
      const yr = isMonthFirst ? m[3] : m[3];
      if (month) {
        const candidate = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (isValidReceiptDate(candidate)) { date = candidate; break; }
      }
    }
  }

  // Total amount — look near "total" label first, then fall back to largest amount
  let total = 0;
  const amountRe = /\$?\s*(\d{1,4}\.\d{2})\b/;

  // Find the "total" line (exclude "subtotal", "total items", etc.)
  const totalIdx = lines.findIndex(
    (l) => /\btotal\b/i.test(l) && !/sub.?total|total\s+(item|qty|quantity)/i.test(l)
  );
  if (totalIdx !== -1) {
    for (let i = totalIdx; i < Math.min(totalIdx + 3, lines.length); i++) {
      const m = lines[i].match(amountRe);
      if (m) { total = parseFloat(m[1]); break; }
    }
  }

  // Fallback: largest plausible dollar amount on the receipt
  if (!total) {
    for (const line of lines) {
      const m = line.match(amountRe);
      if (m) {
        const amt = parseFloat(m[1]);
        if (amt > total && amt < 10000) total = amt;
      }
    }
  }

  // Category: keyword heuristic against full text
  let category = "Other";
  if (/flour|sugar|butter|yeast|eggs|cream|salt|baking|grocery|food|farm|produce|dairy|ingredient|spice|cocoa|vanilla|milk/i.test(text)) {
    category = "Supplies/Ingredients";
  } else if (/\bbox\b|bag|wrap|label|container|kraft|twine|ribbon|packaging|tissue/i.test(text)) {
    category = "Packaging";
  } else if (/market|booth|vendor|stall|permit|entry fee|rental|space fee/i.test(text)) {
    category = "Market fees";
  } else if (/mixer|oven|pan|rack|tool|appliance|equipment|hardware|utensil|scale|thermometer/i.test(text)) {
    category = "Equipment";
  } else if (/print|design|ad|social|media|marketing|flyer|sign|banner|logo|photo/i.test(text)) {
    category = "Marketing";
  } else if (/gas|fuel|gallon|pump|shell|chevron|exxon|bp|76|arco|uber|lyft|transport|mileage|toll/i.test(text)) {
    category = "Transportation";
  }

  return { vendor, date, total, category };
}

function isValidReceiptDate(isoStr) {
  const d = new Date(isoStr + "T00:00:00");
  const now = new Date();
  return d instanceof Date && !isNaN(d) &&
    d <= now &&
    d >= new Date("2015-01-01");
}

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

    try {
      const canvas = await preprocessImage(file);

      // Lazy-load Tesseract to avoid bloating the initial bundle
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      if (!text.trim()) {
        setScanState({ status: "error", vendor: "", detail: "No text found — try a clearer photo" });
        return;
      }

      const parsed = parseReceiptText(text);
      setForm({
        date: parsed.date,
        category: parsed.category,
        amount: parsed.total > 0 ? String(Math.round(parsed.total * 100) / 100) : "",
        notes: parsed.vendor,
      });
      setScanState({ status: "done", vendor: parsed.vendor, detail: "" });
    } catch (err) {
      setScanState({ status: "error", vendor: "", detail: err.message || "Scan failed" });
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
    done: {
      bg: C.greenBg, border: C.greenBorder, color: C.green,
      text: `✓ Receipt scanned${scanState.vendor ? ` — ${scanState.vendor}` : ""}`,
    },
    error: { bg: C.redBg, border: C.redBorder, color: C.red, text: "✗ Scan failed" },
  }[scanState.status];

  const canSave = form.amount && parseFloat(form.amount) > 0;

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
          disabled={scanState.status === "scanning"}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: `1.5px solid ${C.border}`,
            background: "transparent",
            color: scanState.status === "scanning" ? C.muted : C.textMid,
            fontSize: 15,
            fontWeight: 500,
            cursor: scanState.status === "scanning" ? "default" : "pointer",
          }}
        >
          {scanState.status === "scanning" ? "Scanning…" : "📷 Scan Receipt"}
        </button>

        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: canSave ? C.accent : C.border,
            color: canSave ? "#fff" : C.muted,
            fontSize: 16,
            fontWeight: 700,
            cursor: canSave ? "pointer" : "default",
          }}
        >
          {saving ? "Saving…" : `Save Expense${canSave ? ` · ${fmt$(form.amount)}` : ""}`}
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
