import { useState, useRef, useEffect } from "react";

const MARKET_FULL = "Columbia Falls Community Market";
const EXPENSE_CATS = ["Supplies/Ingredients","Packaging","Market fees","Equipment","Marketing","Transportation","Other"];
const INCOME_CATS = ["Online sales","Wholesale","Other income"];
const UNIT_QUICK = [1,2,3,5,10];
const DEFAULT_PRODUCTS = [{ id:"default", name:"Play dough", price:18 }];

const C = {
  bg:"#f7f4ef", surface:"#ffffff", border:"#e0dbd2", borderDark:"#c8c2b8",
  accent:"#1a1714", accentGold:"#b8860b",
  green:"#1a7a42", greenBg:"#eaf5ee", greenBorder:"#a8d9b8",
  red:"#b83232", redBg:"#fdf0f0", redBorder:"#e8b0b0",
  text:"#1a1714", textMid:"#4a4540", muted:"#8a837a", mutedLight:"#c8c2b8",
};

const fmt$ = n => "$" + Number(n||0).toFixed(2);
const fmtDate = d => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const uid = () => Math.random().toString(36).slice(2,9);

// Single consolidated storage key — faster single get/set on load and save.
// On first run with new code, migrates from the four old dd4:* keys.
async function loadStorageKey(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}

async function loadAllData() {
  const data = await loadStorageKey("dd4:data");
  if (data) return data;

  // Migration from old four-key layout
  const [tx, ms, prods, apid] = await Promise.all([
    loadStorageKey("dd4:tx"),
    loadStorageKey("dd4:ms"),
    loadStorageKey("dd4:products"),
    loadStorageKey("dd4:activeProduct"),
  ]);
  return {
    tx: tx || [],
    ms: ms || [],
    products: (prods && prods.length > 0) ? prods : DEFAULT_PRODUCTS,
    activeProductId: apid || DEFAULT_PRODUCTS[0].id,
  };
}

async function saveAllData(data) {
  try { await window.storage.set("dd4:data", JSON.stringify(data)); } catch {}
}

const inp = {
  width:"100%", padding:"14px 16px", borderRadius:12,
  border:`1.5px solid ${C.border}`, background:C.bg,
  color:C.text, fontSize:16, fontFamily:"'DM Sans',sans-serif",
  outline:"none", boxSizing:"border-box", WebkitAppearance:"none",
};

function Sheet({ open, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 -4px 32px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 0" }}>
          <div style={{ width:36, height:4, borderRadius:2, background:C.border }} />
        </div>
        <div style={{ padding:"20px 24px 44px" }}>{children}</div>
      </div>
    </div>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 16px", borderRadius:100,
      border:`1.5px solid ${active ? C.accent : C.border}`,
      background: active ? C.accent : "transparent",
      color: active ? "#fff" : C.muted,
      fontSize:14, fontWeight: active ? 600 : 400,
      cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
      transition:"all 0.12s", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

const flatBtn = {
  flex:1, padding:"14px", borderRadius:14,
  border:`1.5px solid ${C.border}`, background:C.surface,
  color:C.textMid, fontFamily:"'DM Sans',sans-serif",
  fontSize:14, fontWeight:500, cursor:"pointer",
  boxShadow:"0 1px 3px rgba(0,0,0,0.05)", textAlign:"center",
};

export default function App() {
  const [tab, setTab] = useState("record");
  const [transactions, setTransactions] = useState([]);
  const [marketSales, setMarketSales] = useState([]);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [activeProductId, setActiveProductId] = useState(DEFAULT_PRODUCTS[0].id);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const [saleDate] = useState(new Date().toISOString().slice(0,10));
  const [units, setUnits] = useState(0);

  const [expSheet, setExpSheet] = useState(false);
  const [incSheet, setIncSheet] = useState(false);
  const [productsSheet, setProductsSheet] = useState(false);

  // idle | scanning | done | error
  const [scanState, setScanState] = useState({ status:"idle", detail:"", vendor:"" });

  const fileRef = useRef();

  const [expForm, setExpForm] = useState({ date:new Date().toISOString().slice(0,10), category:EXPENSE_CATS[0], amount:"", notes:"" });
  const [incForm, setIncForm] = useState({ date:new Date().toISOString().slice(0,10), category:INCOME_CATS[0], amount:"", notes:"" });

  // Load font once via effect instead of a <link> in the render tree
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap";
    document.head.appendChild(link);
  }, []);

  // Single storage get on mount — migrates old keys automatically
  useEffect(() => {
    async function init() {
      const data = await loadAllData();
      if (data.tx) setTransactions(data.tx);
      if (data.ms) setMarketSales(data.ms);
      if (data.products && data.products.length > 0) setProducts(data.products);
      if (data.activeProductId) setActiveProductId(data.activeProductId);
      setLoaded(true);
    }
    init();
  }, []);

  // Single storage set on change
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      await saveAllData({ tx: transactions, ms: marketSales, products, activeProductId });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    }, 500);
    return () => clearTimeout(t);
  }, [transactions, marketSales, products, activeProductId, loaded]);

  const activeProduct = products.find(p=>p.id===activeProductId) || products[0];
  const revenue = units * (activeProduct?.price || 0);
  const totalMarketRevenue = marketSales.reduce((s,e)=>s+e.revenue,0);
  const totalIncome = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const totalExpense = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const netProfit = totalMarketRevenue + totalIncome - totalExpense;

  function logSale() {
    if (units===0||!activeProduct) return;
    setMarketSales(prev=>[{ id:uid(), market:MARKET_FULL, date:saleDate, productName:activeProduct.name, unitsSold:units, pricePerUnit:activeProduct.price, revenue, createdAt:new Date().toISOString() }, ...prev]);
    setUnits(0);
  }

  function saveExpense() {
    if (!expForm.amount) return;
    setTransactions(prev=>[{ id:uid(), type:"expense", ...expForm, amount:parseFloat(expForm.amount), createdAt:new Date().toISOString() }, ...prev]);
    setExpSheet(false);
    setScanState({ status:"idle", detail:"", vendor:"" });
    setExpForm({ date:new Date().toISOString().slice(0,10), category:EXPENSE_CATS[0], amount:"", notes:"" });
  }

  function saveIncome() {
    if (!incForm.amount) return;
    setTransactions(prev=>[{ id:uid(), type:"income", ...incForm, amount:parseFloat(incForm.amount), createdAt:new Date().toISOString() }, ...prev]);
    setIncSheet(false);
    setIncForm({ date:new Date().toISOString().slice(0,10), category:INCOME_CATS[0], amount:"", notes:"" });
  }

  // Open the expense sheet immediately when a photo is picked, then run the
  // API call while the sheet is already visible. This avoids the timing problem
  // where opening the sheet after an async call caused iOS to dismiss it.
  async function handleScan(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Reset form and open sheet right away — user sees it immediately
    setExpForm({ date:new Date().toISOString().slice(0,10), category:EXPENSE_CATS[0], amount:"", notes:"" });
    setScanState({ status:"scanning", detail:"Reading receipt…", vendor:"" });
    setExpSheet(true);

    // Compress image in background
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
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75).split(",")[1]);
        };
        img.onerror = () => reject(new Error("Could not load image"));
        img.src = objectUrl;
      });
    } catch(err) {
      setScanState({ status:"error", detail:"Image load failed: " + err.message, vendor:"" });
      return;
    }

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "anthropic-dangerous-direct-browser-access":"true",
        },
        body:JSON.stringify({
          model:"claude-haiku-4-5-20251001",
          max_tokens:256,
          messages:[{
            role:"user",
            content:[
              { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:base64 } },
              { type:"text", text:'This is a receipt. Reply with ONLY raw JSON, nothing else:\n{"vendor":"","date":"YYYY-MM-DD","total":0.00,"category":"","notes":""}\nFor category use one of: Supplies/Ingredients, Packaging, Market fees, Equipment, Marketing, Transportation, Other' }
            ]
          }]
        })
      });

      const body = await resp.json();

      if (!resp.ok || body.error) {
        setScanState({ status:"error", detail:body.error?.message || `HTTP ${resp.status}`, vendor:"" });
        return;
      }

      const raw = body.content?.find(b=>b.type==="text")?.text || "";
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) {
        setScanState({ status:"error", detail:`Unexpected response: "${raw.slice(0,120)}"`, vendor:"" });
        return;
      }

      const parsed = JSON.parse(raw.slice(start, end+1));
      setExpForm({
        date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : new Date().toISOString().slice(0,10),
        category: EXPENSE_CATS.includes(parsed.category) ? parsed.category : EXPENSE_CATS[0],
        amount: parsed.total > 0 ? String(Math.round(parsed.total * 100) / 100) : "",
        notes: [parsed.vendor, parsed.notes].filter(Boolean).join(" — "),
      });
      setScanState({ status:"done", detail:"", vendor:parsed.vendor || "" });

    } catch(err) {
      setScanState({ status:"error", detail:err.message || "Network error", vendor:"" });
    }
  }

  function exportCSV() {
    const rows = [
      ["Type","Date","Product/Category","Units","Price/unit","Amount","Notes"],
      ...marketSales.map(s=>["sale",s.date,s.productName||s.market,s.unitsSold,s.pricePerUnit,s.revenue,""]),
      ...transactions.map(t=>[t.type,t.date,t.category,"","",t.amount,t.notes]),
    ];
    const csv = rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "adventure-dough.csv"; a.click();
  }

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:C.muted, fontFamily:"'DM Sans',sans-serif", fontSize:15 }}>Loading…</div>
    </div>
  );

  const RecordTab = () => (
    <div style={{ padding:"0 20px 120px" }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {products.map(p => (
          <button key={p.id} onClick={() => { setActiveProductId(p.id); setUnits(0); }} style={{
            padding:"9px 18px", borderRadius:100,
            border:`1.5px solid ${activeProductId===p.id ? C.accent : C.border}`,
            background: activeProductId===p.id ? C.accent : C.surface,
            color: activeProductId===p.id ? "#fff" : C.muted,
            fontSize:14, fontWeight: activeProductId===p.id ? 600 : 400,
            cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
            boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
          }}>
            {p.name} <span style={{ opacity:0.55, fontWeight:400 }}>· {fmt$(p.price)}</span>
          </button>
        ))}
        <button onClick={() => setProductsSheet(true)} style={{
          padding:"9px 16px", borderRadius:100,
          border:`1.5px solid ${C.border}`, background:C.surface,
          color:C.muted, fontSize:16, cursor:"pointer",
          boxShadow:"0 1px 3px rgba(0,0,0,0.06)", fontFamily:"'DM Sans',sans-serif",
        }}>Edit</button>
      </div>

      <div style={{ textAlign:"center", padding:"4px 0 28px" }}>
        <div style={{ fontSize:13, color:C.muted, fontFamily:"'DM Sans',sans-serif", marginBottom:28 }}>
          {fmtDate(saleDate)}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:28, marginBottom:16 }}>
          <button onClick={() => setUnits(u=>Math.max(0,u-1))} style={{
            width:72, height:72, borderRadius:"50%",
            border:`2px solid ${C.border}`, background:C.surface,
            color:C.text, fontSize:42, fontWeight:200, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 6px rgba(0,0,0,0.08)", lineHeight:1, paddingBottom:4,
          }}>−</button>
          <div>
            <div style={{ fontSize:100, fontWeight:800, color:C.text, fontFamily:"'DM Sans',sans-serif", lineHeight:1, letterSpacing:-5 }}>{units}</div>
            <div style={{ fontSize:14, color:C.muted, fontFamily:"'DM Sans',sans-serif", marginTop:6 }}>units</div>
          </div>
          <button onClick={() => setUnits(u=>u+1)} style={{
            width:72, height:72, borderRadius:"50%",
            border:`2px solid ${C.border}`, background:C.surface,
            color:C.text, fontSize:42, fontWeight:200, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 6px rgba(0,0,0,0.08)", lineHeight:1, paddingBottom:4,
          }}>+</button>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:22 }}>
          {UNIT_QUICK.map(n => (
            <button key={n} onClick={() => setUnits(u=>u+n)} style={{
              padding:"8px 16px", borderRadius:100, border:`1.5px solid ${C.border}`,
              background:C.surface, color:C.textMid, fontSize:14, cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif", fontWeight:500,
              boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
            }}>+{n}</button>
          ))}
        </div>
        <div style={{ fontSize:40, fontWeight:800, letterSpacing:-1, color:units>0?C.accentGold:C.mutedLight, fontFamily:"'DM Sans',sans-serif", transition:"color 0.2s" }}>
          {fmt$(revenue)}
        </div>
        <div style={{ fontSize:13, color:C.muted, fontFamily:"'DM Sans',sans-serif", marginTop:3 }}>
          {fmt$(activeProduct?.price||0)} per unit
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:28 }}>
        <button onClick={() => setUnits(0)} style={{
          padding:"15px 20px", borderRadius:14, border:`1.5px solid ${C.border}`,
          background:C.surface, color:C.muted, fontFamily:"'DM Sans',sans-serif",
          fontSize:15, cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
        }}>Clear</button>
        <button onClick={logSale} disabled={units===0} style={{
          flex:1, padding:"15px", borderRadius:14, border:"none",
          background:units===0?C.border:C.accent, color:units===0?C.muted:"#fff",
          fontSize:16, fontWeight:700, cursor:units===0?"not-allowed":"pointer",
          fontFamily:"'DM Sans',sans-serif", boxShadow:units===0?"none":"0 2px 8px rgba(0,0,0,0.18)",
        }}>{units>0?`Log sale · ${fmt$(revenue)}`:"Log sale"}</button>
      </div>

      <div style={{ height:1, background:C.border, marginBottom:16 }} />

      <div style={{ display:"flex", gap:8, marginBottom:32 }}>
        <button onClick={() => { setScanState({status:"idle",detail:"",vendor:""}); setExpForm({ date:new Date().toISOString().slice(0,10), category:EXPENSE_CATS[0], amount:"", notes:"" }); setExpSheet(true); }} style={flatBtn}>Add expense</button>
        <button onClick={() => fileRef.current?.click()} style={flatBtn}>Scan receipt</button>
        <button onClick={() => setIncSheet(true)} style={flatBtn}>Other income</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleScan} />

      {[
        ...marketSales.map(s=>({...s,_k:"sale",_ts:s.createdAt})),
        ...transactions.map(t=>({...t,_k:"tx",_ts:t.createdAt})),
      ].sort((a,b)=>new Date(b._ts)-new Date(a._ts)).slice(0,15).map(item =>
        item._k==="sale" ? (
          <div key={item.id} style={{ display:"flex", alignItems:"center", padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>{item.unitsSold} × {item.productName||"Play dough"}</div>
              <div style={{ fontSize:13, color:C.muted, fontFamily:"'DM Sans',sans-serif", marginTop:2 }}>{fmtDate(item.date)} · {fmt$(item.pricePerUnit)} each</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:16, fontWeight:700, color:C.green, fontFamily:"'DM Sans',sans-serif" }}>+{fmt$(item.revenue)}</span>
              <button onClick={()=>setMarketSales(p=>p.filter(s=>s.id!==item.id))} style={{ background:"none", border:"none", color:C.mutedLight, cursor:"pointer", fontSize:20, lineHeight:1, padding:"0 2px" }}>×</button>
            </div>
          </div>
        ) : (
          <div key={item.id} style={{ display:"flex", alignItems:"center", padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>{item.category}</div>
              <div style={{ fontSize:13, color:C.muted, fontFamily:"'DM Sans',sans-serif", marginTop:2 }}>{fmtDate(item.date)}{item.notes?" · "+item.notes:""}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:16, fontWeight:700, color:item.type==="income"?C.green:C.red, fontFamily:"'DM Sans',sans-serif" }}>{item.type==="income"?"+":"−"}{fmt$(item.amount)}</span>
              <button onClick={()=>setTransactions(p=>p.filter(t=>t.id!==item.id))} style={{ background:"none", border:"none", color:C.mutedLight, cursor:"pointer", fontSize:20, lineHeight:1, padding:"0 2px" }}>×</button>
            </div>
          </div>
        )
      )}
    </div>
  );

  const SummaryTab = () => (
    <div style={{ padding:"0 20px 120px" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:13, color:C.muted, fontFamily:"'DM Sans',sans-serif", marginBottom:6 }}>Net profit</div>
        <div style={{ fontSize:52, fontWeight:800, letterSpacing:-2, color:netProfit>=0?C.green:C.red, fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>{fmt$(netProfit)}</div>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:28 }}>
        {[{label:"Total revenue",val:fmt$(totalMarketRevenue+totalIncome),color:C.green},{label:"Total expenses",val:fmt$(totalExpense),color:C.red}].map(s=>(
          <div key={s.label} style={{ flex:1, background:C.surface, borderRadius:14, padding:"16px", border:`1px solid ${C.border}`, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color, fontFamily:"'DM Sans',sans-serif" }}>{s.val}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4, fontFamily:"'DM Sans',sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {marketSales.length>0&&(()=>{
        const byProduct={};
        marketSales.forEach(s=>{const k=s.productName||"Play dough";byProduct[k]=byProduct[k]||{revenue:0,units:0};byProduct[k].revenue+=s.revenue;byProduct[k].units+=s.unitsSold;});
        return <div style={{marginBottom:28}}>{Object.entries(byProduct).map(([name,d])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <div><div style={{fontSize:14,color:C.text,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{name}</div><div style={{fontSize:12,color:C.muted,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{d.units} units</div></div>
            <span style={{fontSize:14,color:C.green,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{fmt$(d.revenue)}</span>
          </div>
        ))}</div>;
      })()}
      {totalExpense>0&&<div style={{marginBottom:28}}>{EXPENSE_CATS.map(cat=>{const total=transactions.filter(t=>t.type==="expense"&&t.category===cat).reduce((s,t)=>s+t.amount,0);if(!total)return null;return(<div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:14,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{cat}</span><span style={{fontSize:14,color:C.red,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{fmt$(total)}</span></div>);})}</div>}
      <button onClick={exportCSV} style={{width:"100%",padding:"14px",borderRadius:12,border:`1.5px solid ${C.border}`,background:C.surface,color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:14,cursor:"pointer"}}>Export CSV</button>
    </div>
  );

  const ProductsSheet = () => {
    const [list, setList] = useState(() => products.map(p=>({...p})));
    const [newName, setNewName] = useState("");
    const [newPrice, setNewPrice] = useState("");

    function addProduct() {
      if (!newName.trim() || !newPrice) return;
      setList(prev=>[...prev,{ id:uid(), name:newName.trim(), price:parseFloat(newPrice) }]);
      setNewName(""); setNewPrice("");
    }

    function save() {
      const valid = list.filter(p=>p.name&&p.price>0);
      if (!valid.length) return;
      setProducts(valid);
      if (!valid.find(p=>p.id===activeProductId)) setActiveProductId(valid[0].id);
      setProductsSheet(false);
    }

    return (
      <Sheet open={productsSheet} onClose={() => setProductsSheet(false)}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif", marginBottom:4 }}>Products</div>
          {list.map((p,i) => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <input type="text" value={p.name} onChange={e => setList(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))} style={{ ...inp, flex:1 }} />
              <div style={{ position:"relative", flexShrink:0 }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:15, pointerEvents:"none" }}>$</span>
                <input type="number" inputMode="decimal" value={p.price} onChange={e => setList(prev=>prev.map((x,j)=>j===i?{...x,price:parseFloat(e.target.value)||0}:x))} style={{ ...inp, width:86, paddingLeft:24, fontSize:15, fontWeight:600 }} min="0" step="0.01" />
              </div>
              <button onClick={() => list.length > 1 && setList(prev=>prev.filter((_,j)=>j!==i))} style={{
                width:38, height:38, borderRadius:10, flexShrink:0,
                border:`1.5px solid ${list.length>1 ? C.redBorder : C.border}`,
                background: list.length>1 ? C.redBg : C.bg,
                color: list.length>1 ? C.red : C.mutedLight,
                cursor: list.length>1 ? "pointer" : "default",
                fontSize:18, display:"flex", alignItems:"center", justifyContent:"center",
              }}>×</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, alignItems:"center", paddingTop:4, borderTop:`1px solid ${C.border}`, marginTop:4 }}>
            <input type="text" placeholder="Product name" value={newName} onChange={e=>setNewName(e.target.value)} style={{ ...inp, flex:1 }} />
            <div style={{ position:"relative", flexShrink:0 }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:15, pointerEvents:"none" }}>$</span>
              <input type="number" inputMode="decimal" placeholder="0" value={newPrice} onChange={e=>setNewPrice(e.target.value)} style={{ ...inp, width:86, paddingLeft:24, fontSize:15 }} min="0" step="0.01" />
            </div>
            <button onClick={addProduct} style={{ width:38, height:38, borderRadius:10, flexShrink:0, border:`1.5px solid ${C.greenBorder}`, background:C.greenBg, color:C.green, cursor:"pointer", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          </div>
          <button onClick={save} style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background:C.accent, color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>Save</button>
        </div>
      </Sheet>
    );
  };

  const ExpenseSheet = () => (
    <Sheet open={expSheet} onClose={() => { setExpSheet(false); setScanState({status:"idle",detail:"",vendor:""}); }}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>Add expense</div>

        {/* Scan status banner — shown inside the sheet while/after scanning */}
        {scanState.status==="scanning" && (
          <div style={{ padding:"12px 14px", borderRadius:10, background:"#f0f4ff", border:"1px solid #c0cff0", color:C.textMid, fontSize:14, fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ display:"inline-block", animation:"spin 1s linear infinite", fontSize:16 }}>⏳</span>
            {scanState.detail || "Reading receipt…"}
          </div>
        )}
        {scanState.status==="done" && (
          <div style={{ padding:"12px 14px", borderRadius:10, background:C.greenBg, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>
            ✓ Receipt scanned{scanState.vendor?` — ${scanState.vendor}`:""}
          </div>
        )}
        {scanState.status==="error" && (
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <div style={{ padding:"12px 14px", borderRadius:10, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>
              Couldn't read receipt — fill in manually
            </div>
            {scanState.detail && <div style={{ fontSize:11, color:C.muted, fontFamily:"'DM Sans',sans-serif", padding:"0 2px" }}>{scanState.detail}</div>}
          </div>
        )}

        <input type="date" value={expForm.date} onChange={e=>setExpForm(f=>({...f,date:e.target.value}))} style={inp} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {EXPENSE_CATS.map(c=><Pill key={c} active={expForm.category===c} onClick={()=>setExpForm(f=>({...f,category:c}))}>{c}</Pill>)}
        </div>
        <input type="number" inputMode="decimal" placeholder="$0.00" value={expForm.amount} onChange={e=>setExpForm(f=>({...f,amount:e.target.value}))} style={{...inp,fontSize:26,fontWeight:700}} min="0" step="0.01" />
        <input type="text" placeholder="Notes" value={expForm.notes} onChange={e=>setExpForm(f=>({...f,notes:e.target.value}))} style={inp} />
        <button onClick={saveExpense} disabled={!expForm.amount} style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background:!expForm.amount?C.border:C.red, color:!expForm.amount?C.muted:"#fff", fontSize:16, fontWeight:700, cursor:!expForm.amount?"not-allowed":"pointer", fontFamily:"'DM Sans',sans-serif" }}>Save expense</button>
      </div>
    </Sheet>
  );

  const IncomeSheet = () => (
    <Sheet open={incSheet} onClose={() => setIncSheet(false)}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>Add other income</div>
        <input type="date" value={incForm.date} onChange={e=>setIncForm(f=>({...f,date:e.target.value}))} style={inp} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {INCOME_CATS.map(c=><Pill key={c} active={incForm.category===c} onClick={()=>setIncForm(f=>({...f,category:c}))}>{c}</Pill>)}
        </div>
        <input type="number" inputMode="decimal" placeholder="$0.00" value={incForm.amount} onChange={e=>setIncForm(f=>({...f,amount:e.target.value}))} style={{...inp,fontSize:26,fontWeight:700}} min="0" step="0.01" />
        <input type="text" placeholder="Notes" value={incForm.notes} onChange={e=>setIncForm(f=>({...f,notes:e.target.value}))} style={inp} />
        <button onClick={saveIncome} disabled={!incForm.amount} style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background:!incForm.amount?C.border:C.green, color:!incForm.amount?C.muted:"#fff", fontSize:16, fontWeight:700, cursor:!incForm.amount?"not-allowed":"pointer", fontFamily:"'DM Sans',sans-serif" }}>Save income</button>
      </div>
    </Sheet>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, maxWidth:520, margin:"0 auto" }}>
      <div style={{ padding:"52px 20px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>Adventure Dough</span>
        {saveStatus && <span style={{ fontSize:12, color:saveStatus==="saved"?C.green:C.muted, fontFamily:"'DM Sans',sans-serif" }}>{saveStatus==="saving"?"Saving…":"Saved"}</span>}
      </div>
      {tab==="record" && <RecordTab />}
      {tab==="summary" && <SummaryTab />}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:100, background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"center", boxShadow:"0 -2px 12px rgba(0,0,0,0.07)" }}>
        {[{id:"record",label:"Record"},{id:"summary",label:"Summary"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, maxWidth:200, padding:"14px 0 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:tab===t.id?700:400, color:tab===t.id?C.text:C.muted, borderTop:tab===t.id?`2px solid ${C.accentGold}`:"2px solid transparent" }}>{t.label}</button>
        ))}
      </div>
      <ExpenseSheet />
      <IncomeSheet />
      <ProductsSheet />
    </div>
  );
}
