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

const LOG_PREFIX = "[animalia-switcher]";
const REQUIRED_STRING_FIELDS = ["id", "name", "url", "icon", "tint", "group"] as const;
const KNOWN_TINTS = ["teal", "pink", "lavender", "peach"];

/**
 * Only https: links are ever rendered as an href. A manifest edit that slipped
 * in a `javascript:` (or `data:`) URL would otherwise execute in every host app.
 */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Validates one manifest entry. Returns null (and logs why) if it's unusable. */
function validateApp(entry: unknown, index: number): ManifestApp | null {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    console.error(`${LOG_PREFIX} manifest entry ${index} is not an object — dropping it`, entry);
    return null;
  }

  const candidate = entry as Record<string, unknown>;
  const bad = REQUIRED_STRING_FIELDS.filter(
    (field) => typeof candidate[field] !== "string" || candidate[field] === ""
  );
  if (bad.length > 0) {
    console.error(
      `${LOG_PREFIX} manifest entry ${index} is missing or has non-string ${bad.join(", ")} — dropping it`,
      entry
    );
    return null;
  }

  if (!isHttpsUrl(candidate.url as string)) {
    console.error(
      `${LOG_PREFIX} manifest entry ${index} ("${candidate.id as string}") has a non-https url ${JSON.stringify(candidate.url)} — dropping it`
    );
    return null;
  }

  if (!KNOWN_TINTS.includes(candidate.tint as string)) {
    // Not fatal: the tile just renders untinted. Keep the app reachable.
    console.warn(
      `${LOG_PREFIX} manifest entry ${index} ("${candidate.id as string}") has unknown tint ${JSON.stringify(candidate.tint)} — expected one of ${KNOWN_TINTS.join(", ")}`
    );
  }

  return candidate as unknown as ManifestApp;
}

/**
 * Accepts today's bare-array manifest as well as a future `{ version, apps: [] }`
 * envelope. Individual bad entries are dropped; anything else returns null so the
 * caller can fall through to the cache/bundled fallback instead of white-screening.
 */
export function parseManifest(raw: unknown, source: string): ManifestApp[] | null {
  let entries: unknown[];

  if (Array.isArray(raw)) {
    entries = raw;
  } else if (raw !== null && typeof raw === "object" && Array.isArray((raw as { apps?: unknown }).apps)) {
    entries = (raw as { apps: unknown[] }).apps;
  } else {
    console.error(
      `${LOG_PREFIX} ${source} is not an array and has no \`apps\` array — got ${raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw}; ignoring it`
    );
    return null;
  }

  const apps: ManifestApp[] = [];
  entries.forEach((entry, index) => {
    const app = validateApp(entry, index);
    if (app) apps.push(app);
  });

  if (apps.length === 0) {
    console.error(`${LOG_PREFIX} ${source} contained no valid app entries; ignoring it`);
    return null;
  }

  return apps;
}

function readCache(): ManifestApp[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return parseManifest(JSON.parse(raw), "cached manifest");
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
    const apps = parseManifest(await res.json(), `manifest at ${manifestUrl}`);
    if (!apps) throw new Error("manifest failed validation");
    writeCache(apps);
    return apps;
  } catch {
    return readCache() ?? FALLBACK_MANIFEST;
  }
}
