export type WasteStreamStyle = {
  key: string;
  label: string;
  color: string;
  textColor: string;
  chipClass: string;
};

const WASTE_STREAM_STYLES: Record<string, WasteStreamStyle> = {
  general: {
    key: "general",
    label: "General Waste",
    color: "#111827",
    textColor: "#ffffff",
    chipClass: "bg-slate-950 text-white",
  },
  mixed_recycling: {
    key: "mixed_recycling",
    label: "Mixed Recycling",
    color: "#22c55e",
    textColor: "#052e16",
    chipClass: "bg-green-500 text-green-950",
  },
  cardboard: {
    key: "cardboard",
    label: "Cardboard",
    color: "#2563eb",
    textColor: "#ffffff",
    chipClass: "bg-blue-600 text-white",
  },
  glass: {
    key: "glass",
    label: "Glass",
    color: "#94a3b8",
    textColor: "#0f172a",
    chipClass: "bg-slate-300 text-slate-950",
  },
  food: {
    key: "food",
    label: "Food",
    color: "#92400e",
    textColor: "#ffffff",
    chipClass: "bg-amber-800 text-white",
  },
  paper: {
    key: "paper",
    label: "Paper",
    color: "#ffffff",
    textColor: "#111827",
    chipClass: "border border-slate-300 bg-white text-slate-950",
  },
};

function normaliseWasteStreamKey(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getWasteStreamStyle(value: string): WasteStreamStyle {
  const normalised = normaliseWasteStreamKey(value);

  if (["general", "general_waste", "black_bag"].includes(normalised)) return WASTE_STREAM_STYLES.general;
  if (["mixed_recycling", "dry_mixed_recycling", "dmr", "recycling", "dry_mixed", "mixed_recycle"].includes(normalised)) {
    return WASTE_STREAM_STYLES.mixed_recycling;
  }
  if (["cardboard", "card", "card_board"].includes(normalised)) return WASTE_STREAM_STYLES.cardboard;
  if (["glass", "glass_waste"].includes(normalised)) return WASTE_STREAM_STYLES.glass;
  if (["food", "food_waste"].includes(normalised)) return WASTE_STREAM_STYLES.food;
  if (["paper", "paper_waste"].includes(normalised)) return WASTE_STREAM_STYLES.paper;

  return {
    key: normalised || "unknown",
    label: value || "Unknown",
    color: "#64748b",
    textColor: "#ffffff",
    chipClass: "bg-slate-500 text-white",
  };
}

export function wasteStreamLabel(value: string) {
  return getWasteStreamStyle(value).label;
}

export function wasteStreamSortOrder(value: string) {
  const key = getWasteStreamStyle(value).key;
  const order = ["general", "mixed_recycling", "cardboard", "glass", "food", "paper"];
  const index = order.indexOf(key);
  return index === -1 ? 99 : index;
}
