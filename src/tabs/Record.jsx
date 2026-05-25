import { useState, useEffect, useRef } from "react";
import Pill from "../components/Pill.jsx";
import ExpenseSheet from "../components/ExpenseSheet.jsx";
import IncomeSheet from "../components/IncomeSheet.jsx";
import ProductsSheet from "../components/ProductsSheet.jsx";
import { C, UNIT_QUICK, MARKET_FULL, fmt$, fmtDate } from "../constants.js";
import {
  db,
  addDoc,
  deleteDoc,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "../firebase.js";

let hapticsModule = null;
async function haptic() {
  try {
    if (!hapticsModule) hapticsModule = await import("@capacitor/haptics");
    await hapticsModule.Haptics.impact({ style: hapticsModule.ImpactStyle.Light });
  } catch {}
}

export default function Record({ products, activeProductId, onActiveChange }) {
  const [units, setUnits] = useState(0);
  const [recentSales, setRecentSales] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [showExpense, setShowExpense] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [logging, setLogging] = useState(false);

  const activeProduct = products.find((p) => p.id === activeProductId) || products[0];

  useEffect(() => {
    const q1 = query(collection(db, "marketSales"), orderBy("createdAt", "desc"), limit(20));
    const q2 = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(20));
    const unsub1 = onSnapshot(q1, (snap) => setRecentSales(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsub2 = onSnapshot(q2, (snap) => setRecentTx(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { unsub1(); unsub2(); };
  }, []);

  const revenue = units * (activeProduct?.price || 0);

  async function logSale() {
    if (!units || !activeProduct || logging) return;
    setLogging(true);
    try {
      await addDoc(collection(db, "marketSales"), {
        market: MARKET_FULL,
        date: new Date().toISOString().slice(0, 10),
        productId: activeProduct.id,
        productName: activeProduct.name,
        unitsSold: units,
        pricePerUnit: activeProduct.price,
        revenue: units * activeProduct.price,
        createdAt: serverTimestamp(),
      });
      haptic();
      setUnits(0);
    } finally {
      setLogging(false);
    }
  }

  // Merge and sort recent feed
  const feed = [
    ...recentSales.map((s) => ({ ...s, _type: "sale" })),
    ...recentTx.map((t) => ({ ...t, _type: "tx" })),
  ]
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    })
    .slice(0, 20);

  return (
    <div>
      {/* Product selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Product
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {products.map((p) => (
            <Pill
              key={p.id}
              active={p.id === activeProductId}
              onClick={() => { onActiveChange(p.id); setUnits(0); }}
            >
              {p.name} · {fmt$(p.price)}
            </Pill>
          ))}
          <Pill active={false} onClick={() => setShowProducts(true)}>Edit</Pill>
        </div>
      </div>

      {/* Unit counter */}
      <div
        style={{
          background: C.surface,
          borderRadius: 20,
          padding: "28px 20px 24px",
          marginBottom: 16,
          border: `1.5px solid ${C.border}`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 100, fontWeight: 800, lineHeight: 1, color: C.text, marginBottom: 4 }}>
          {units}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: revenue > 0 ? C.accentGold : C.mutedLight,
            marginBottom: 20,
            minHeight: 30,
          }}
        >
          {revenue > 0 ? fmt$(revenue) : ""}
        </div>

        {/* −/+ buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16 }}>
          <button
            onClick={() => setUnits((u) => Math.max(0, u - 1))}
            style={circleBtn}
          >
            −
          </button>
          <button
            onClick={() => setUnits((u) => u + 1)}
            style={{ ...circleBtn, background: C.accent, color: "#fff", border: "none" }}
          >
            +
          </button>
        </div>

        {/* Quick add */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {UNIT_QUICK.map((n) => (
            <button
              key={n}
              onClick={() => setUnits((u) => u + n)}
              style={{
                padding: "6px 12px",
                borderRadius: 100,
                border: `1.5px solid ${C.border}`,
                background: "transparent",
                color: C.textMid,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              +{n}
            </button>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setUnits(0)}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: `1.5px solid ${C.border}`,
              background: "transparent",
              color: C.muted,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
          <button
            onClick={logSale}
            disabled={units === 0 || logging}
            style={{
              flex: 2,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: units > 0 ? C.accentGold : C.border,
              color: units > 0 ? "#fff" : C.muted,
              fontSize: 15,
              fontWeight: 700,
              cursor: units > 0 ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            {logging ? "Logging…" : `Log sale · ${fmt$(revenue)}`}
          </button>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { label: "Add expense", onClick: () => setShowExpense(true) },
          { label: "Scan receipt", onClick: () => setShowExpense(true) },
          { label: "Other income", onClick: () => setShowIncome(true) },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 12,
              border: `1.5px solid ${C.border}`,
              background: C.surface,
              color: C.textMid,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              lineHeight: 1.3,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recent feed */}
      {feed.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Recent
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {feed.map((item) => (
              <SwipeRow
                key={item.id}
                item={item}
                onDelete={async () => {
                  haptic();
                  const col = item._type === "sale" ? "marketSales" : "transactions";
                  await deleteDoc(doc(db, col, item.id));
                }}
              />
            ))}
          </div>
        </div>
      )}

      <ExpenseSheet open={showExpense} onClose={() => setShowExpense(false)} />
      <IncomeSheet open={showIncome} onClose={() => setShowIncome(false)} />
      <ProductsSheet
        open={showProducts}
        onClose={() => setShowProducts(false)}
        products={products}
        activeProductId={activeProductId}
        onActiveChange={onActiveChange}
      />
    </div>
  );
}

function SwipeRow({ item, onDelete }) {
  const [tx, setTx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef(null);

  function onPointerDown(e) {
    startX.current = e.clientX;
  }

  function onPointerMove(e) {
    if (startX.current === null) return;
    const delta = Math.min(0, e.clientX - startX.current);
    setTx(delta);
  }

  async function onPointerUp() {
    if (tx < -80) {
      setDeleting(true);
      await onDelete();
    } else {
      setTx(0);
    }
    startX.current = null;
  }

  if (deleting) return null;

  const isSale = item._type === "sale";
  const amt = isSale ? item.revenue : item.amount;
  const isIncome = isSale || item.type === "income";
  const label = isSale
    ? `${item.unitsSold} × ${item.productName}`
    : item.category;
  const detail = isSale ? item.market : item.notes;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 10,
        background: C.surface,
        border: `1px solid ${C.border}`,
        marginBottom: 4,
      }}
    >
      {/* Delete bg */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: C.red,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Delete
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          transform: `translateX(${tx}px)`,
          transition: tx === 0 ? "transform 0.2s" : "none",
          background: C.surface,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          touchAction: "pan-y",
          cursor: "grab",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{label}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {fmtDate(item.date)}{detail ? ` · ${detail}` : ""}
          </div>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: isIncome ? C.green : C.red,
          }}
        >
          {isIncome ? "+" : "−"}{fmt$(amt)}
        </div>
      </div>
    </div>
  );
}

const circleBtn = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  border: `2px solid ${C.border}`,
  background: "transparent",
  color: C.text,
  fontSize: 32,
  fontWeight: 300,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
