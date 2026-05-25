import { useState, useEffect } from "react";
import Sheet from "./Sheet.jsx";
import { C } from "../constants.js";
import { db, doc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp, writeBatch } from "../firebase.js";

export default function ProductsSheet({ open, onClose, products, activeProductId, onActiveChange }) {
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRows(products.map((p) => ({ ...p, _delete: false })));
      setNewName("");
      setNewPrice("");
    }
  }, [open, products]);

  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function markDelete(id) {
    if (rows.filter((r) => !r._delete).length <= 1) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _delete: true } : r)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const row of rows) {
        const ref = doc(db, "products", row.id);
        if (row._delete) {
          batch.delete(ref);
        } else {
          batch.update(ref, { name: row.name, price: parseFloat(row.price) || 0 });
        }
      }

      if (newName.trim() && newPrice) {
        const newRef = doc(collection(db, "products"));
        batch.set(newRef, {
          name: newName.trim(),
          price: parseFloat(newPrice) || 0,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();

      const deletedActiveId = rows.find((r) => r._delete && r.id === activeProductId);
      if (deletedActiveId) {
        const remaining = rows.filter((r) => !r._delete);
        if (remaining.length > 0) onActiveChange(remaining[0].id);
      }

      onClose();
    } finally {
      setSaving(false);
    }
  }

  const visibleRows = rows.filter((r) => !r._delete);

  return (
    <Sheet open={open} onClose={onClose} title="Products">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows
          .filter((r) => !r._delete)
          .map((row) => (
            <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={row.name}
                onChange={(e) => updateRow(row.id, "name", e.target.value)}
                placeholder="Product name"
                style={{ ...inputStyle, flex: 2 }}
              />
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14 }}>$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={row.price}
                  onChange={(e) => updateRow(row.id, "price", e.target.value)}
                  placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: 24 }}
                />
              </div>
              <button
                onClick={() => markDelete(row.id)}
                disabled={visibleRows.length <= 1}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: `1.5px solid ${visibleRows.length <= 1 ? C.border : C.redBorder}`,
                  background: "transparent",
                  color: visibleRows.length <= 1 ? C.mutedLight : C.red,
                  fontSize: 18,
                  cursor: visibleRows.length <= 1 ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Add New</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Product name"
              style={{ ...inputStyle, flex: 2 }}
            />
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14 }}>$</span>
              <input
                type="number"
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                style={{ ...inputStyle, paddingLeft: 24 }}
              />
            </div>
            <div style={{ width: 36, flexShrink: 0 }} />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 8,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: C.accent,
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Products"}
        </button>
      </div>
    </Sheet>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: "#fff",
  fontSize: 15,
  color: C.text,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
};
