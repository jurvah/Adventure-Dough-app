import { useState, useEffect } from "react";
import Record from "./tabs/Record.jsx";
import Orders from "./tabs/Orders.jsx";
import Customers from "./tabs/Customers.jsx";
import Treasury from "./tabs/Treasury.jsx";
import { C } from "./constants.js";
import {
  db,
  auth,
  signInAnonymously,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "./firebase.js";

const TABS = ["Record", "Orders", "Customers", "Treasury"];

export default function App() {
  const [tab, setTab] = useState("Record");
  const [online, setOnline] = useState(navigator.onLine);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeProductId, setActiveProductId] = useState(null);

  // Online/offline status
  useEffect(() => {
    const up = () => setOnline(true);
    const dn = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, []);

  // Anonymous auth + owner verification
  useEffect(() => {
    async function init() {
      try {
        const cred = await signInAnonymously(auth);
        const uid = cred.user.uid;
        const ownerRef = doc(db, "meta", "owner");
        const ownerSnap = await getDoc(ownerRef);
        if (!ownerSnap.exists()) {
          await setDoc(ownerRef, { uid });
        }
        setAuthReady(true);
      } catch (err) {
        setAuthError(err.message);
      }
    }
    init();
  }, []);

  // Products listener — shared across tabs
  useEffect(() => {
    if (!authReady) return;
    const q = query(collection(db, "products"), orderBy("createdAt"));
    const unsub = onSnapshot(q, async (snap) => {
      let prods = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (prods.length === 0) {
        // Seed default product on first run
        await addDoc(collection(db, "products"), {
          name: "Sourdough Loaf",
          price: 10,
          createdAt: serverTimestamp(),
        });
        return;
      }
      setProducts(prods);
      setActiveProductId((prev) => {
        if (prev && prods.find((p) => p.id === prev)) return prev;
        return prods[0]?.id || null;
      });
    });
    return unsub;
  }, [authReady]);

  if (authError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, padding: 32, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 8 }}>Firebase Error</div>
          <div style={{ fontSize: 14, color: C.muted }}>{authError}</div>
          <div style={{ fontSize: 13, color: C.mutedLight, marginTop: 12 }}>Check your .env.local file has valid Firebase credentials.</div>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg }}>
        <div style={{ fontSize: 16, color: C.muted }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", background: C.bg, position: "relative" }}>
      {/* Fixed header */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 520,
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 100,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: C.accent, letterSpacing: "-0.02em" }}>
          Adventure Dough
        </div>
        <div
          title={online ? "Online" : "Offline"}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: online ? C.green : C.mutedLight,
            transition: "background 0.3s",
          }}
        />
      </div>

      {/* Scrollable content */}
      <div style={{ paddingTop: 57, paddingBottom: 120, paddingLeft: 20, paddingRight: 20, minHeight: "100vh" }}>
        {tab === "Record" && (
          <Record
            products={products}
            activeProductId={activeProductId}
            onActiveChange={setActiveProductId}
          />
        )}
        {tab === "Orders" && <Orders products={products} />}
        {tab === "Customers" && <Customers />}
        {tab === "Treasury" && <Treasury />}
      </div>

      {/* Fixed bottom tab bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 520,
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 0 12px",
              border: "none",
              borderTop: `2px solid ${tab === t ? C.accentGold : "transparent"}`,
              background: "transparent",
              color: tab === t ? C.accentGold : C.muted,
              fontSize: 12,
              fontWeight: tab === t ? 700 : 400,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.1s",
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
