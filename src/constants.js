export const C = {
  bg: "#f7f4ef",
  surface: "#ffffff",
  border: "#e0dbd2",
  borderDark: "#c8c2b8",
  accent: "#1a1714",
  accentGold: "#b8860b",
  green: "#1a7a42",
  greenBg: "#eaf5ee",
  greenBorder: "#a8d9b8",
  red: "#b83232",
  redBg: "#fdf0f0",
  redBorder: "#e8b0b0",
  text: "#1a1714",
  textMid: "#4a4540",
  muted: "#8a837a",
  mutedLight: "#c8c2b8",
};

export const MARKET_FULL = "Columbia Falls Community Market";
export const EXPENSE_CATS = [
  "Supplies/Ingredients",
  "Packaging",
  "Market fees",
  "Equipment",
  "Marketing",
  "Transportation",
  "Other",
];
export const INCOME_CATS = ["Online sales", "Wholesale", "Other income"];
export const UNIT_QUICK = [1, 2, 3, 5, 10];
export const LEAD_STATUSES = ["lead", "active", "inactive"];
export const ORDER_STATUSES = ["pending", "complete"];

export const fmt$ = (n) => "$" + Number(n || 0).toFixed(2);

export const fmtDate = (d) => {
  if (!d) return "";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const isOverdue = (d) => {
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d + "T00:00:00");
  return due < today;
};

export const isToday = (d) => {
  if (!d) return false;
  const today = new Date().toISOString().slice(0, 10);
  return d === today;
};

export const todayStr = () => new Date().toISOString().slice(0, 10);
