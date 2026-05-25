import { useState, useEffect } from "react";
import { C, fmt$, fmtDate } from "../constants.js";
import { db, collection, onSnapshot, query, orderBy } from "../firebase.js";

export default function Treasury() {
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "marketSales"), orderBy("createdAt", "desc")), (s) =>
      setSales(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(query(collection(db, "transactions"), orderBy("createdAt", "desc")), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u3 = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (s) =>
      setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); };
  }, []);

  const totalMarketRevenue = sales.reduce((s, x) => s + (x.revenue || 0), 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
  const netProfit = totalMarketRevenue + totalIncome - totalExpense;
  const pendingOrdersValue = orders.filter((o) => o.status === "pending").reduce((s, o) => s + (o.total || 0), 0);

  // Sales by product
  const byProduct = {};
  for (const s of sales) {
    const name = s.productName || "Unknown";
    if (!byProduct[name]) byProduct[name] = { revenue: 0, units: 0 };
    byProduct[name].revenue += s.revenue || 0;
    byProduct[name].units += s.unitsSold || 0;
  }

  // Expenses by category
  const byCategory = {};
  for (const t of transactions.filter((t) => t.type === "expense")) {
    const cat = t.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += t.amount || 0;
  }

  function exportCSV() {
    const rows = [
      ["Type", "Date", "Product/Category", "Units", "Price/Unit", "Amount", "Notes"],
      ...sales.map((s) => ["sale", s.date, s.productName || "", s.unitsSold, s.pricePerUnit, s.revenue, ""]),
      ...transactions.map((t) => [t.type, t.date, t.category || "", "", "", t.amount, t.notes || ""]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "adventure-dough-treasury.csv";
    a.click();
  }

  const profitColor = netProfit >= 0 ? C.green : C.red;

  return (
    <div>
      {/* Net profit */}
      <div
        style={{
          background: C.surface,
          border: `1.5px solid ${C.border}`,
          borderRadius: 20,
          padding: "28px 24px",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Net Profit
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: profitColor, lineHeight: 1 }}>
          {netProfit < 0 ? "-" : ""}{fmt$(Math.abs(netProfit))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Revenue" value={fmt$(totalMarketRevenue + totalIncome)} bg={C.greenBg} border={C.greenBorder} color={C.green} />
        <StatCard label="Total Expenses" value={fmt$(totalExpense)} bg={C.redBg} border={C.redBorder} color={C.red} />
      </div>

      {/* Pending orders */}
      {pendingOrdersValue > 0 && (
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #f0d080",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: C.accentGold }}>Pending Orders</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.accentGold }}>{fmt$(pendingOrdersValue)}</div>
        </div>
      )}

      {/* Sales by product */}
      {Object.keys(byProduct).length > 0 && (
        <Section title="Sales by Product">
          {Object.entries(byProduct)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([name, { revenue, units }]) => (
              <Row key={name} label={name} sub={`${units} unit${units !== 1 ? "s" : ""}`} value={fmt$(revenue)} color={C.green} />
            ))}
        </Section>
      )}

      {/* Expenses by category */}
      {Object.keys(byCategory).length > 0 && (
        <Section title="Expenses by Category">
          {Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => (
              <Row key={cat} label={cat} value={fmt$(amt)} color={C.red} />
            ))}
        </Section>
      )}

      {/* Export */}
      <button
        onClick={exportCSV}
        style={{
          width: "100%",
          marginTop: 8,
          padding: "14px 20px",
          borderRadius: 12,
          border: `1.5px solid ${C.border}`,
          background: "transparent",
          color: C.textMid,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Export CSV
      </button>
    </div>
  );
}

function StatCard({ label, value, bg, border, color }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "16px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, sub, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
