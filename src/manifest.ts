import type { ManifestApp } from "./types";

const CACHE_KEY = "animalia-switcher-manifest";

// Same 9 apps as the hosted manifest (spec §6) — used on first paint and
// whenever the network/manifest host is unreachable and there's no cache yet.
export const FALLBACK_MANIFEST: ManifestApp[] = [
  { id: "task-log", name: "Task Log", url: "https://animalia-task-log.vercel.app", icon: "clipboard", tint: "teal", group: "Daily" },
  { id: "xray-share-web", name: "X-ray Share", url: "https://xray-share-web.vercel.app", icon: "scan", tint: "pink", group: "Clinical" },
  { id: "fluid-rate", name: "Fluid Rate Calc", url: "https://fluid-rate-calculator.vercel.app", icon: "droplet", tint: "lavender", group: "Clinical" },
  { id: "dosage-calc", name: "Dosage Calc", url: "https://dosage-calculator-mu.vercel.app", icon: "capsule", tint: "peach", group: "Clinical" },
  { id: "shifts-biosecurity", name: "Shifts & Biosecurity", url: "https://shifts-biosecurity-profile.vercel.app", icon: "shield", tint: "teal", group: "Clinical" },
  { id: "kreloses", name: "Kreloses Dashboard", url: "https://kreloses-dashboard.vercel.app", icon: "chart-bar", tint: "pink", group: "Admin" },
  { id: "pricelist", name: "Supplier Pricelist", url: "https://animalia-supplier-pricelist.vercel.app", icon: "tag", tint: "lavender", group: "Admin" },
  { id: "money", name: "Smart Money Tracker", url: "https://smart-money-tracker-ecru.vercel.app", icon: "wallet", tint: "peach", group: "Admin" },
  { id: "finance-os", name: "Finance OS", url: "https://animalia-finance-os.vercel.app", icon: "ledger", tint: "teal", group: "Admin" },
];

function readCache(): ManifestApp[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ManifestApp[]) : null;
  } catch {
    return null;
  }
}

function writeCache(apps: ManifestApp[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(apps));
  } catch {
    // localStorage unavailable (private browsing, quota) — safe to ignore.
  }
}

export async function fetchManifest(manifestUrl: string): Promise<ManifestApp[]> {
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    const apps = (await res.json()) as ManifestApp[];
    writeCache(apps);
    return apps;
  } catch {
    return readCache() ?? FALLBACK_MANIFEST;
  }
}
