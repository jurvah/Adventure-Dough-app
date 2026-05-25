import { useState, useEffect } from "react";
import Sheet from "../components/Sheet.jsx";
import Pill from "../components/Pill.jsx";
import { C, fmt$, fmtDate, isOverdue, isToday, todayStr } from "../constants.js";
import {
  db,
  addDoc,
  updateDoc,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
} from "../firebase.js";

let hapticsModule = null;
async function haptic() {
  try {
    if (!hapticsModule) hapticsModule = await import("@capacitor/haptics");
    await hapticsModule.Haptics.impact({ style: hapticsModule.ImpactStyle.Light });
  } catch {}
}

const ITEM_INIT = () => ({ productId: "", productName: "", qty: 1, price: 0 });
const ORDER_INIT = () => ({
  customerName: "",
  customerContact: "",
  notes: "",
  dueDate: todayStr(),
  items: [ITEM_INIT()],
  linkedCustomerId: "",
});

export default function Orders({ products }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [expandedCompleted, setExpandedCompleted] = useState(new Set());
  const [form, setForm] = useState(ORDER_INIT());
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q1 = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const q2 = query(collection(db, "customers"), orderBy("name"));
    const u1 = onSnapshot(q1, (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(q2, (s) => setCustomers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const pending = orders
    .filter((o) => o.status === "pending")
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

  const completed = orders
    .filter((o) => o.status === "complete")
    .sort((a, b) => {
      const ta = b.completedAt?.toMillis?.() || 0;
      const tb = a.completedAt?.toMillis?.() || 0;
      return ta - tb;
    })
    .slice(0, 30);

  async function markComplete(order) {
    haptic();
    await updateDoc(doc(db, "orders", order.id), {
      status: "complete",
      completedAt: serverTimestamp(),
    });
  }

  function updateItem(idx, field, value) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "productId") {
        const p = products.find((x) => x.id === value);
        items[idx].productName = p?.name || "";
        items[idx].price = p?.price || 0;
      }
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, ITEM_INIT()] }));
  }

  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  const orderTotal = form.items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);

  async function saveOrder() {
    if (!form.customerName.trim() || form.items.length === 0) return;
    setSaving(true);
    try {
      const validItems = form.items.filter((i) => i.productName && i.qty > 0);
      const total = validItems.reduce((s, i) => s + i.qty * i.price, 0);
      const ref = await addDoc(collection(db, "orders"), {
        customerName: form.customerName.trim(),
        customerContact: form.customerContact.trim(),
        items: validItems,
        total,
        status: "pending",
        notes: form.notes,
        dueDate: form.dueDate,
        createdAt: serverTimestamp(),
        completedAt: null,
      });
      if (form.linkedCustomerId) {
        await updateDoc(doc(db, "customers", form.linkedCustomerId), {
          orderIds: arrayUnion(ref.id),
          updatedAt: serverTimestamp(),
        });
      }
      setForm(ORDER_INIT());
      setCustomerSearch("");
      setShowNew(false);
    } finally {
      setSaving(false);
    }
  }

  const filteredCustomers = customerSearch
    ? customers.filter((c) =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : [];

  return (
    <div>
      {/* Pending */}
      <section style={{ marginBottom: 28 }}>
        <div style={sectionHeader}>Pending ({pending.length})</div>
        {pending.length === 0 && (
          <div style={{ color: C.muted, fontSize: 14, padding: "12px 0" }}>No pending orders</div>
        )}
        {pending.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onMarkComplete={() => markComplete(order)}
          />
        ))}
      </section>

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div style={sectionHeader}>Completed ({completed.length})</div>
          {completed.map((order) => (
            <CompletedCard
              key={order.id}
              order={order}
              expanded={expandedCompleted.has(order.id)}
              onToggle={() =>
                setExpandedCompleted((s) => {
                  const n = new Set(s);
                  n.has(order.id) ? n.delete(order.id) : n.add(order.id);
                  return n;
                })
              }
            />
          ))}
        </section>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowNew(true)}
        style={{
          position: "fixed",
          bottom: 96,
          right: "max(20px, calc(50vw - 240px))",
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: C.accentGold,
          color: "#fff",
          fontSize: 28,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </button>

      {/* New Order Sheet */}
      <Sheet open={showNew} onClose={() => { setShowNew(false); setForm(ORDER_INIT()); setCustomerSearch(""); }} title="New Order">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Customer Name</label>
            <input
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="Name"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Contact (optional)</label>
            <input
              value={form.customerContact}
              onChange={(e) => setForm((f) => ({ ...f, customerContact: e.target.value }))}
              placeholder="Phone or email"
              style={inputStyle}
            />
          </div>

          {/* Customer link */}
          <div>
            <label style={labelStyle}>Link to Existing Customer</label>
            <input
              value={form.linkedCustomerId ? customers.find((c) => c.id === form.linkedCustomerId)?.name || "" : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setForm((f) => ({ ...f, linkedCustomerId: "" }));
              }}
              placeholder="Search by name…"
              style={inputStyle}
            />
            {filteredCustomers.length > 0 && !form.linkedCustomerId && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 4, overflow: "hidden" }}>
                {filteredCustomers.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, linkedCustomerId: c.id, customerName: f.customerName || c.name, customerContact: f.customerContact || c.phone || c.email || "" }));
                      setCustomerSearch(c.name);
                    }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, fontSize: 14, color: C.text }}
                  >
                    {c.name}
                    {c.phone && <span style={{ color: C.muted, marginLeft: 8 }}>{c.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <label style={labelStyle}>Items</label>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <select
                  value={item.productId}
                  onChange={(e) => updateItem(idx, "productId", e.target.value)}
                  style={{ ...inputStyle, flex: 2 }}
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {fmt$(p.price)}</option>
                  ))}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => updateItem(idx, "qty", Math.max(1, item.qty - 1))} style={smallBtn}>−</button>
                  <span style={{ minWidth: 28, textAlign: "center", fontSize: 15, fontWeight: 600 }}>{item.qty}</span>
                  <button onClick={() => updateItem(idx, "qty", item.qty + 1)} style={smallBtn}>+</button>
                </div>
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(idx)} style={{ ...smallBtn, color: C.red, borderColor: C.redBorder }}>×</button>
                )}
              </div>
            ))}
            <button
              onClick={addItem}
              style={{ fontSize: 14, color: C.accentGold, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0" }}
            >
              + Add item
            </button>
          </div>

          {orderTotal > 0 && (
            <div style={{ textAlign: "right", fontSize: 18, fontWeight: 700, color: C.accentGold }}>
              Total: {fmt$(orderTotal)}
            </div>
          )}

          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <button
            onClick={saveOrder}
            disabled={!form.customerName.trim() || saving}
            style={{
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: form.customerName.trim() ? C.accent : C.border,
              color: form.customerName.trim() ? "#fff" : C.muted,
              fontSize: 16,
              fontWeight: 700,
              cursor: form.customerName.trim() ? "pointer" : "default",
            }}
          >
            {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function OrderCard({ order, onMarkComplete }) {
  const [completing, setCompleting] = useState(false);

  const dateColor = isOverdue(order.dueDate)
    ? C.red
    : isToday(order.dueDate)
    ? C.accentGold
    : C.muted;

  return (
    <div
      style={{
        background: C.surface,
        border: `1.5px solid ${C.border}`,
        borderRadius: 14,
        padding: "16px",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{order.customerName}</div>
          {order.customerContact && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{order.customerContact}</div>
          )}
        </div>
        {order.dueDate && (
          <div style={{ fontSize: 13, fontWeight: 600, color: dateColor, textAlign: "right" }}>
            {isOverdue(order.dueDate) ? "Overdue · " : isToday(order.dueDate) ? "Today · " : ""}
            {fmtDate(order.dueDate)}
          </div>
        )}
      </div>

      {order.items?.map((item, i) => (
        <div key={i} style={{ fontSize: 14, color: C.textMid, marginBottom: 4 }}>
          {item.qty} × {item.productName} — {fmt$(item.qty * item.price)}
        </div>
      ))}

      <div style={{ fontSize: 16, fontWeight: 700, color: C.accentGold, marginTop: 8 }}>
        {fmt$(order.total)}
      </div>

      {order.notes && (
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6, fontStyle: "italic" }}>
          {order.notes}
        </div>
      )}

      <button
        onClick={async () => {
          setCompleting(true);
          await onMarkComplete();
          setCompleting(false);
        }}
        disabled={completing}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: `1.5px solid ${C.greenBorder}`,
          background: C.greenBg,
          color: C.green,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {completing ? "Marking…" : "✓ Mark complete"}
      </button>
    </div>
  );
}

function CompletedCard({ order, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: "#f9f9f8",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 8,
        cursor: "pointer",
        opacity: 0.75,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.green, fontSize: 16 }}>✓</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.textMid }}>{order.customerName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>{fmt$(order.total)}</span>
          <span style={{ fontSize: 12, color: C.mutedLight }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {order.items?.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: C.muted, marginBottom: 3 }}>
              {item.qty} × {item.productName} — {fmt$(item.qty * item.price)}
            </div>
          ))}
          {order.notes && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6, fontStyle: "italic" }}>
              {order.notes}
            </div>
          )}
          {order.completedAt && (
            <div style={{ fontSize: 12, color: C.mutedLight, marginTop: 6 }}>
              Completed {fmtDate(order.completedAt)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const sectionHeader = {
  fontSize: 13,
  fontWeight: 700,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 12,
};

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
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: "#fff",
  fontSize: 15,
  color: C.text,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
};

const smallBtn = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: `1.5px solid ${C.border}`,
  background: "transparent",
  color: C.text,
  fontSize: 16,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
