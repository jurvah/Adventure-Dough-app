import { useState, useEffect } from "react";
import Sheet from "../components/Sheet.jsx";
import Pill from "../components/Pill.jsx";
import { C, LEAD_STATUSES, fmt$, fmtDate } from "../constants.js";
import {
  db,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "../firebase.js";

let hapticsModule = null;
async function haptic() {
  try {
    if (!hapticsModule) hapticsModule = await import("@capacitor/haptics");
    await hapticsModule.Haptics.impact({ style: hapticsModule.ImpactStyle.Light });
  } catch {}
}

const CUST_INIT = () => ({
  name: "",
  phone: "",
  email: "",
  instagram: "",
  leadStatus: "lead",
  newsletterOptIn: false,
  tags: [],
  notes: "",
});

const FILTERS = ["All", "Leads", "Active", "Inactive", "Newsletter"];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(CUST_INIT());
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const q1 = query(collection(db, "customers"), orderBy("name"));
    const q2 = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const u1 = onSnapshot(q1, (s) => setCustomers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(q2, (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedId);

  function openCustomer(c) {
    setSelectedId(c.id);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      instagram: c.instagram || "",
      leadStatus: c.leadStatus || "lead",
      newsletterOptIn: c.newsletterOptIn || false,
      tags: c.tags || [],
      notes: c.notes || "",
    });
    setTagInput("");
    setConfirmDelete(false);
  }

  function closeDetail() {
    setSelectedId(null);
    setConfirmDelete(false);
  }

  function openNew() {
    setForm(CUST_INIT());
    setTagInput("");
    setShowNew(true);
  }

  function addTag(e) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, "");
      if (tag && !form.tags.includes(tag)) {
        setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
      }
      setTagInput("");
    }
  }

  function removeTag(tag) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }

  async function saveCustomer() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        leadStatus: form.leadStatus,
        newsletterOptIn: form.newsletterOptIn,
        tags: form.tags,
        notes: form.notes,
        updatedAt: serverTimestamp(),
      };
      if (selectedId) {
        await updateDoc(doc(db, "customers", selectedId), data);
        closeDetail();
      } else {
        await addDoc(collection(db, "customers"), {
          ...data,
          orderIds: [],
          createdAt: serverTimestamp(),
        });
        setShowNew(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer() {
    if (!selectedId) return;
    haptic();
    await deleteDoc(doc(db, "customers", selectedId));
    closeDetail();
  }

  function exportCSV() {
    const rows = [
      ["name", "phone", "email", "instagram", "leadStatus", "newsletterOptIn", "tags", "notes", "orderCount", "createdAt"],
      ...customers.map((c) => [
        c.name,
        c.phone || "",
        c.email || "",
        c.instagram || "",
        c.leadStatus || "",
        c.newsletterOptIn ? "yes" : "no",
        (c.tags || []).join("; "),
        c.notes || "",
        (c.orderIds || []).length,
        c.createdAt?.toDate?.().toISOString() || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "adventure-dough-customers.csv";
    a.click();
  }

  // Filter
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.instagram || "").toLowerCase().includes(q) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(q));

    const matchFilter =
      filter === "All" ||
      (filter === "Leads" && c.leadStatus === "lead") ||
      (filter === "Active" && c.leadStatus === "active") ||
      (filter === "Inactive" && c.leadStatus === "inactive") ||
      (filter === "Newsletter" && c.newsletterOptIn);

    return matchSearch && matchFilter;
  });

  function lastOrderDate(c) {
    if (!c.orderIds?.length) return null;
    const custOrders = orders.filter((o) => c.orderIds.includes(o.id));
    if (!custOrders.length) return null;
    return custOrders.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0]?.createdAt;
  }

  const statusColor = {
    lead: { bg: "#fff8e6", border: "#f0d080", text: C.accentGold },
    active: { bg: C.greenBg, border: C.greenBorder, text: C.green },
    inactive: { bg: "#f5f5f5", border: C.border, text: C.muted },
  };

  const CustomerForm = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle}>Name</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Phone</label>
        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Email</label>
        <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Optional" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Instagram</label>
        <input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@handle" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Lead Status</label>
        <div style={{ display: "flex", gap: 8 }}>
          {LEAD_STATUSES.map((s) => (
            <Pill key={s} active={form.leadStatus === s} onClick={() => setForm((f) => ({ ...f, leadStatus: s }))}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Pill>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Newsletter Opt-In</label>
        <button
          onClick={() => setForm((f) => ({ ...f, newsletterOptIn: !f.newsletterOptIn }))}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: "none",
            background: form.newsletterOptIn ? C.green : C.border,
            position: "relative",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <div style={{
            position: "absolute",
            top: 4,
            left: form.newsletterOptIn ? 24 : 4,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }} />
        </button>
      </div>

      <div>
        <label style={labelStyle}>Tags</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {form.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "4px 10px",
                borderRadius: 100,
                background: C.surface,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                color: C.textMid,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tag}
              <button onClick={() => removeTag(tag)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={addTag}
          placeholder="Add tag, press Enter"
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

      {selectedId && (
        <div>
          <label style={labelStyle}>Order History</label>
          {(selectedCustomer?.orderIds || []).length === 0 ? (
            <div style={{ fontSize: 14, color: C.muted }}>No orders yet</div>
          ) : (
            orders
              .filter((o) => (selectedCustomer?.orderIds || []).includes(o.id))
              .map((o) => (
                <div key={o.id} style={{ fontSize: 14, color: C.textMid, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  {fmtDate(o.createdAt)} · {fmt$(o.total)} · {o.status}
                </div>
              ))
          )}
        </div>
      )}

      <button
        onClick={saveCustomer}
        disabled={!form.name.trim() || saving}
        style={{
          padding: "14px 20px",
          borderRadius: 12,
          border: "none",
          background: form.name.trim() ? C.accent : C.border,
          color: form.name.trim() ? "#fff" : C.muted,
          fontSize: 16,
          fontWeight: 700,
          cursor: form.name.trim() ? "pointer" : "default",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {selectedId && (
        <button
          onClick={() => {
            if (confirmDelete) { deleteCustomer(); }
            else setConfirmDelete(true);
          }}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: `1.5px solid ${C.redBorder}`,
            background: confirmDelete ? C.red : C.redBg,
            color: confirmDelete ? "#fff" : C.red,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {confirmDelete ? "Tap again to confirm delete" : "Delete Customer"}
        </button>
      )}
    </div>
  );

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{filtered.length} customer{filtered.length !== 1 ? "s" : ""}</div>
        <button
          onClick={exportCSV}
          style={{ fontSize: 13, color: C.accentGold, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Export CSV
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customers…"
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Pill>
        ))}
      </div>

      {/* List */}
      {filtered.map((c) => {
        const sc = statusColor[c.leadStatus] || statusColor.inactive;
        const lastOrder = lastOrderDate(c);
        return (
          <div
            key={c.id}
            onClick={() => openCustomer(c)}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{c.name}</div>
              <span style={{
                padding: "3px 10px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                background: sc.bg,
                border: `1px solid ${sc.border}`,
                color: sc.text,
              }}>
                {c.leadStatus || "lead"}
              </span>
            </div>
            {(c.tags || []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {c.tags.map((t) => (
                  <span key={t} style={{ padding: "2px 8px", borderRadius: 100, background: "#f0ede8", fontSize: 12, color: C.muted }}>{t}</span>
                ))}
              </div>
            )}
            {lastOrder && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Last order: {fmtDate(lastOrder)}</div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ color: C.muted, fontSize: 14, padding: "24px 0", textAlign: "center" }}>No customers found</div>
      )}

      {/* FAB */}
      <button
        onClick={openNew}
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

      {/* Detail sheet */}
      <Sheet open={!!selectedId} onClose={closeDetail} title={selectedCustomer?.name || "Customer"}>
        {CustomerForm}
      </Sheet>

      {/* New customer sheet */}
      <Sheet open={showNew} onClose={() => setShowNew(false)} title="New Customer">
        {CustomerForm}
      </Sheet>
    </div>
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
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: "#fff",
  fontSize: 15,
  color: C.text,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
};
