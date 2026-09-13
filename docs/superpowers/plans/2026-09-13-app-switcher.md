# Animalia App Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared `@animalia/switcher` React component (floating pill → liquid-glass bottom sheet/side drawer) and install it into the clinic's staff web apps that have a local, git-tracked Next.js codebase, backed by a JSON manifest hosted on the existing `projects-dashboard` deployment.

**Architecture:** A standalone npm package (this repo, `animalia-app-switcher`) exports one component. Each host app installs it via a GitHub-based npm dependency and renders `<AnimaliaSwitcher current="<app-id>" />` once in its root layout. The component fetches `switcher-manifest.json` at runtime (with a bundled fallback and a `localStorage` cache) to get the list of destination apps, and needs no host-app code changes beyond that one line for future manifest edits.

**Tech Stack:** TypeScript, React (peer dependency only), `tsup` for building, Vitest + Testing Library for tests, plain CSS (no UI framework) shipped as `dist/styles.css`.

## Global Constraints

- Node 24 / npm — matches every target host app (`package-lock.json` present in each).
- The component ships zero runtime dependencies besides `react`/`react-dom` as peers.
- Must render correctly at ~390px width (staff use phones — project convention, see spec §8).
- Must respect `prefers-color-scheme` (light/dark tokens) and `prefers-reduced-motion`.
- Manifest is fetched at runtime, cached in `localStorage`, falls back to a bundled list on fetch failure — see spec §4.
- v1 is plain links, same-tab navigation, no cross-app auth/badges — see spec §5.
- Distributed as a GitHub npm dependency (`github:hazimazmi91-code/animalia-app-switcher#<tag>`) — no private registry exists, so no `npm publish` step.
- `fluid-rate-calculator` is Expo/React Native, not Next.js — per user decision (2026-09-13), embedding the pill inside it is deferred to a later plan. It still appears as a manifest *destination* (a link other apps can switch to), since that needs no code change in that repo.
- `kreloses-dashboard` and `shifts-biosecurity-profile` have no local, git-tracked source on this machine (per `projects-dashboard/src/lib/projects.ts`, both are "deployed straight via Vercel CLI — no GitHub repo"). They appear as manifest destinations but are **not** integration targets in this plan — see "Known gaps" at the end.

---

## File Structure

```
animalia-app-switcher/
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  src/
    index.ts          # public exports
    types.ts          # ManifestApp, ManifestGroup types
    manifest.ts        # fallback data + fetchManifest()
    manifest.test.ts
    icons.tsx          # inline SVG icon set
    Switcher.tsx        # AnimaliaSwitcher component
    Switcher.test.tsx
    styles.css          # liquid-glass + tile styles
```

---

### Task 1: Scaffold the package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`

**Interfaces:**
- Produces: an npm package building `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`, with `react`/`react-dom` as peer dependencies.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@animalia/switcher",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^25.0.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tsup": "^8.3.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  loader: { ".css": "copy" },
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
});
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: [],
    globals: true,
  },
});
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 6: Write a placeholder `src/index.ts`**

```ts
export {};
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: installs cleanly, creates `package-lock.json`.

- [ ] **Step 8: Verify build and test scripts run**

Run: `npm run build && npm test`
Expected: build produces `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`; `vitest run` reports "no test files found" (not yet an error at this step — later tasks add tests).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore src/index.ts package-lock.json
git commit -m "chore: scaffold @animalia/switcher package"
```

---

### Task 2: Manifest types, fallback data, and fetch logic

**Files:**
- Create: `src/types.ts`
- Create: `src/manifest.ts`
- Test: `src/manifest.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks besides the package scaffold.
- Produces:
  - `type ManifestApp = { id: string; name: string; url: string; icon: string; tint: "teal" | "pink" | "lavender" | "peach"; group: string }`
  - `const FALLBACK_MANIFEST: ManifestApp[]`
  - `async function fetchManifest(manifestUrl: string): Promise<ManifestApp[]>` — tries `fetch(manifestUrl)`, caches the successful JSON result in `localStorage` under key `"animalia-switcher-manifest"`, and on any failure (network error, non-OK response, JSON parse error) returns the `localStorage` cache if present, else `FALLBACK_MANIFEST`.

- [ ] **Step 1: Write `src/types.ts`**

```ts
export interface ManifestApp {
  id: string;
  name: string;
  url: string;
  icon: string;
  tint: "teal" | "pink" | "lavender" | "peach";
  group: string;
}
```

- [ ] **Step 2: Write the failing tests in `src/manifest.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchManifest, FALLBACK_MANIFEST } from "./manifest";

describe("fetchManifest", () => {
  const manifestUrl = "https://projects-dashboard-cyan.vercel.app/switcher-manifest.json";
  const sample = [
    { id: "task-log", name: "Task Log", url: "https://animalia-task-log.vercel.app", icon: "clipboard", tint: "teal", group: "Daily" },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns and caches the fetched manifest on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sample,
    }));

    const result = await fetchManifest(manifestUrl);

    expect(result).toEqual(sample);
    expect(JSON.parse(localStorage.getItem("animalia-switcher-manifest")!)).toEqual(sample);
  });

  it("falls back to the localStorage cache when the fetch fails", async () => {
    localStorage.setItem("animalia-switcher-manifest", JSON.stringify(sample));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await fetchManifest(manifestUrl);

    expect(result).toEqual(sample);
  });

  it("falls back to the bundled FALLBACK_MANIFEST when there is no cache and the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await fetchManifest(manifestUrl);

    expect(result).toEqual(FALLBACK_MANIFEST);
  });

  it("falls back when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const result = await fetchManifest(manifestUrl);

    expect(result).toEqual(FALLBACK_MANIFEST);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- manifest.test.ts`
Expected: FAIL — `./manifest` module does not exist yet.

- [ ] **Step 4: Write `src/manifest.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- manifest.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/manifest.ts src/manifest.test.ts
git commit -m "feat: manifest fetch with localStorage cache and bundled fallback"
```

---

### Task 3: Icon set

**Files:**
- Create: `src/icons.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `const ICONS: Record<string, React.ReactNode>` keyed by the `icon` strings used in `FALLBACK_MANIFEST` (`clipboard`, `scan`, `droplet`, `capsule`, `shield`, `chart-bar`, `tag`, `wallet`, `ledger`), each a `<svg>` sized by its container (`width="100%" height="100%"`), `fill="none" stroke="currentColor"`.

- [ ] **Step 1: Write `src/icons.tsx`**

```tsx
export const ICONS: Record<string, React.ReactNode> = {
  clipboard: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <rect x="9" y="1.5" width="6" height="3" rx="1" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  droplet: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c3 4 6 7.5 6 11a6 6 0 11-12 0c0-3.5 3-7 6-11z" />
    </svg>
  ),
  capsule: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M12 8v8" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  ),
  "chart-bar": (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="12" rx="2" transform="rotate(-45 9 9)" />
      <circle cx="9" cy="9" r="1.2" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14" r="1.2" />
    </svg>
  ),
  ledger: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/icons.tsx
git commit -m "feat: inline SVG icon set for manifest apps"
```

---

### Task 4: Liquid-glass styles

**Files:**
- Create: `src/styles.css`

**Interfaces:**
- Consumes: nothing (pure CSS, class names consumed by `Switcher.tsx` in Task 5).
- Produces: the class names `.animalia-switcher-pill`, `.animalia-switcher-backdrop`, `.animalia-switcher-sheet` (mobile), `.animalia-switcher-drawer` (desktop), `.animalia-switcher-tile`, `.animalia-switcher-tile--here`, `.animalia-switcher-group-label`, plus tint modifiers `.tint-teal`/`.tint-pink`/`.tint-lavender`/`.tint-peach`.

- [ ] **Step 1: Write `src/styles.css`**, adapted from the approved mockup (`docs/superpowers/specs/references/mockup-v2.html`) — same tokens, same liquid-glass technique (low-blur + high-saturation `backdrop-filter`, inset specular/shade box-shadows, brand-tinted sheen), scoped under an `.animalia-switcher` root class instead of `body`, and switched from `position: absolute` (used in the mockup's device frames) to `position: fixed` so it works when embedded in a real page:

```css
.animalia-switcher {
  --as-teal: #2FA79A; --as-teal-ink: #063A34;
  --as-pink: #F0A8C6; --as-pink-ink: #5C1B36;
  --as-lavender: #B9A9E0; --as-lavender-ink: #2E2054;
  --as-peach: #F4B98A; --as-peach-ink: #4A2A0C;
  --as-surface: #FFFFFF; --as-muted: #5C716B; --as-border: #DCEAE5;
  --as-glass-hl: rgba(255,255,255,.85); --as-glass-sh: rgba(20,45,50,.12);
  --as-glass-bg-1: rgba(255,255,255,.6); --as-glass-bg-2: rgba(255,255,255,.22);
  --as-glass-border: rgba(255,255,255,.5);
  --as-glass-sheet-bg: rgba(255,255,255,.86);
  --as-glass-sheen: linear-gradient(135deg, rgba(240,168,198,.5), rgba(47,167,154,.35) 55%, rgba(185,169,224,.4));
  font-family: 'Baloo 2', 'Nunito', sans-serif;
}
@media (prefers-color-scheme: dark) {
  .animalia-switcher:not([data-theme="light"]) {
    --as-surface: #16221F; --as-muted: #91A8A1; --as-border: #263833;
    --as-glass-hl: rgba(255,255,255,.30); --as-glass-sh: rgba(0,0,0,.45);
    --as-glass-bg-1: rgba(255,255,255,.16); --as-glass-bg-2: rgba(255,255,255,.05);
    --as-glass-border: rgba(255,255,255,.2);
    --as-glass-sheet-bg: rgba(22,34,31,.9);
    --as-glass-sheen: linear-gradient(135deg, rgba(242,183,211,.28), rgba(79,204,189,.22) 55%, rgba(201,188,234,.22));
  }
}

.animalia-switcher-pill {
  position: fixed; z-index: 9999;
  display: flex; align-items: center; gap: 7px;
  background: linear-gradient(135deg, var(--as-glass-bg-1), var(--as-glass-bg-2));
  backdrop-filter: blur(14px) saturate(180%);
  -webkit-backdrop-filter: blur(14px) saturate(180%);
  border: 1px solid var(--as-glass-border);
  border-radius: 999px;
  padding: 10px 16px 10px 10px;
  box-shadow: inset 1.5px 1.5px 0 -0.5px var(--as-glass-hl), inset -1px -1px 0 -0.5px var(--as-glass-sh), 0 8px 20px -8px rgba(18,45,40,.25);
  cursor: pointer; font-weight: 600; font-size: 0.85rem; color: var(--as-teal-ink);
  transition: transform .15s ease; overflow: hidden; isolation: isolate;
}
.animalia-switcher-pill:active { transform: scale(.96); }
.animalia-switcher-pill--bottom-left { left: 16px; bottom: 16px; }
.animalia-switcher-pill--bottom-right { right: 16px; bottom: 16px; }
.animalia-switcher-pill--top-left { left: 16px; top: 16px; }
.animalia-switcher-pill--top-right { right: 16px; top: 16px; }

.animalia-switcher-backdrop {
  position: fixed; inset: 0; z-index: 9998;
  background: color-mix(in srgb, #0E1B18 32%, transparent);
  backdrop-filter: blur(6px) saturate(140%);
  opacity: 0; pointer-events: none;
  transition: opacity .32s cubic-bezier(.32,.72,0,1);
}
.animalia-switcher-backdrop--open { opacity: 1; pointer-events: auto; }

.animalia-switcher-sheet, .animalia-switcher-drawer {
  position: fixed; z-index: 9999;
  background: var(--as-glass-sheet-bg);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--as-glass-border);
  overflow-y: auto; transition: transform .32s cubic-bezier(.32,.72,0,1);
}
.animalia-switcher-sheet {
  left: 0; right: 0; bottom: 0; max-height: 72vh;
  border-radius: 22px 22px 0 0; border-bottom: none;
  box-shadow: inset 0 1.5px 0 -0.5px var(--as-glass-hl), 0 -12px 32px -12px rgba(10,30,26,.35);
  padding: 10px 14px 20px; transform: translateY(100%);
}
.animalia-switcher-sheet--open { transform: translateY(0); }
.animalia-switcher-drawer {
  top: 0; right: 0; bottom: 0; width: 360px; max-width: 88vw;
  border-left: 1px solid var(--as-glass-border);
  box-shadow: inset 1.5px 0 0 -0.5px var(--as-glass-hl), -16px 0 32px -16px rgba(10,30,26,.35);
  padding: 20px 16px; transform: translateX(100%);
}
.animalia-switcher-drawer--open { transform: translateX(0); }

.animalia-switcher-group-label {
  font-size: .68rem; letter-spacing: .1em; text-transform: uppercase;
  color: var(--as-muted); margin: 12px 2px 6px;
}
.animalia-switcher-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.animalia-switcher-tile {
  position: relative; border-radius: 14px; padding: 12px 12px 10px;
  display: flex; flex-direction: column; gap: 16px; border: 1px solid transparent;
  box-shadow: inset 1px 1px 0 -0.5px var(--as-glass-hl);
  cursor: pointer; text-align: left; text-decoration: none;
  opacity: 0; transform: translateY(8px);
  animation: as-tile-in .36s cubic-bezier(.22,1,.36,1) forwards;
}
.animalia-switcher-tile:active { transform: scale(.96); }
.animalia-switcher-tile--here { border-color: currentColor; }
@keyframes as-tile-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.animalia-switcher-tile .as-icon { width: 30px; height: 30px; border-radius: 9px; padding: 7px; }
.animalia-switcher-tile .as-name { font-weight: 600; font-size: .85rem; color: #16231F; }

.tint-teal { background: color-mix(in srgb, var(--as-teal) 22%, var(--as-surface)); color: var(--as-teal-ink); }
.tint-teal .as-icon { background: var(--as-teal); color: var(--as-teal-ink); }
.tint-pink { background: color-mix(in srgb, var(--as-pink) 26%, var(--as-surface)); color: var(--as-pink-ink); }
.tint-pink .as-icon { background: var(--as-pink); color: var(--as-pink-ink); }
.tint-lavender { background: color-mix(in srgb, var(--as-lavender) 26%, var(--as-surface)); color: var(--as-lavender-ink); }
.tint-lavender .as-icon { background: var(--as-lavender); color: var(--as-lavender-ink); }
.tint-peach { background: color-mix(in srgb, var(--as-peach) 26%, var(--as-surface)); color: var(--as-peach-ink); }
.tint-peach .as-icon { background: var(--as-peach); color: var(--as-peach-ink); }

@media (prefers-reduced-motion: reduce) {
  .animalia-switcher-sheet, .animalia-switcher-drawer, .animalia-switcher-backdrop, .animalia-switcher-pill {
    transition-duration: .01ms !important;
  }
  .animalia-switcher-tile { animation-duration: .01ms !important; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: liquid-glass stylesheet for the switcher"
```

---

### Task 5: The `AnimaliaSwitcher` component

**Files:**
- Create: `src/Switcher.tsx`
- Test: `src/Switcher.test.tsx`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `fetchManifest`, `ManifestApp` from Task 2; `ICONS` from Task 3; class names from Task 4's `styles.css`.
- Produces: `function AnimaliaSwitcher(props: { current: string; manifestUrl?: string; position?: "bottom-left" | "bottom-right" | "top-left" | "top-right" }): JSX.Element`. Default `manifestUrl` is `"https://projects-dashboard-cyan.vercel.app/switcher-manifest.json"`. Default `position` is `"bottom-left"` on viewports under 768px and `"top-right"` at 768px and above.

- [ ] **Step 1: Write the failing tests in `src/Switcher.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AnimaliaSwitcher } from "./Switcher";
import { FALLBACK_MANIFEST } from "./manifest";

describe("AnimaliaSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline in tests")));
  });

  it("is closed by default and opens on pill click", async () => {
    render(<AnimaliaSwitcher current="task-log" />);

    expect(screen.queryByText("Smart Money Tracker")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apps/i }));

    await waitFor(() => {
      expect(screen.getByText("Smart Money Tracker")).toBeInTheDocument();
    });
  });

  it("marks the current app's tile and doesn't link it", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    fireEvent.click(screen.getByRole("button", { name: /apps/i }));

    const hereTile = await screen.findByText("Task Log");
    expect(hereTile.closest("a")).toBeNull();
  });

  it("renders every other app as a link to its manifest url", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    fireEvent.click(screen.getByRole("button", { name: /apps/i }));

    const moneyTile = await screen.findByText("Smart Money Tracker");
    const link = moneyTile.closest("a");
    expect(link).toHaveAttribute(
      "href",
      FALLBACK_MANIFEST.find((a) => a.id === "money")!.url
    );
  });

  it("closes when the backdrop is clicked", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    fireEvent.click(screen.getByRole("button", { name: /apps/i }));
    await screen.findByText("Smart Money Tracker");

    fireEvent.click(screen.getByTestId("animalia-switcher-backdrop"));

    await waitFor(() => {
      expect(screen.queryByText("Smart Money Tracker")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Switcher.test.tsx`
Expected: FAIL — `./Switcher` module does not exist yet.

- [ ] **Step 3: Write `src/Switcher.tsx`**

```tsx
import { useEffect, useState } from "react";
import { fetchManifest, FALLBACK_MANIFEST } from "./manifest";
import type { ManifestApp } from "./types";
import { ICONS } from "./icons";
import "./styles.css";

export interface AnimaliaSwitcherProps {
  current: string;
  manifestUrl?: string;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

const DEFAULT_MANIFEST_URL = "https://projects-dashboard-cyan.vercel.app/switcher-manifest.json";

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function groupApps(apps: ManifestApp[]): [string, ManifestApp[]][] {
  const groups = new Map<string, ManifestApp[]>();
  for (const app of apps) {
    const list = groups.get(app.group) ?? [];
    list.push(app);
    groups.set(app.group, list);
  }
  return [...groups.entries()];
}

export function AnimaliaSwitcher({
  current,
  manifestUrl = DEFAULT_MANIFEST_URL,
  position,
}: AnimaliaSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<ManifestApp[]>(FALLBACK_MANIFEST);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    let cancelled = false;
    fetchManifest(manifestUrl).then((result) => {
      if (!cancelled) setApps(result);
    });
    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

  const resolvedPosition = position ?? (isDesktop ? "top-right" : "bottom-left");

  return (
    <div className="animalia-switcher">
      <button
        type="button"
        aria-label="Apps"
        className={`animalia-switcher-pill animalia-switcher-pill--${resolvedPosition}`}
        onClick={() => setOpen(true)}
      >
        <span className="as-icon" style={{ width: 22, height: 22, borderRadius: "50%" }}>
          {ICONS.clipboard}
        </span>
        Apps
      </button>

      <div
        data-testid="animalia-switcher-backdrop"
        className={`animalia-switcher-backdrop ${open ? "animalia-switcher-backdrop--open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <div
        className={
          isDesktop
            ? `animalia-switcher-drawer ${open ? "animalia-switcher-drawer--open" : ""}`
            : `animalia-switcher-sheet ${open ? "animalia-switcher-sheet--open" : ""}`
        }
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Switch app</div>
        {groupApps(apps).map(([group, groupItems]) => (
          <div key={group}>
            <div className="animalia-switcher-group-label">{group}</div>
            <div className="animalia-switcher-grid">
              {groupItems.map((app) => {
                const here = app.id === current;
                const Tile = here ? "div" : "a";
                return (
                  <Tile
                    key={app.id}
                    {...(here ? {} : { href: app.url })}
                    className={`animalia-switcher-tile tint-${app.tint} ${here ? "animalia-switcher-tile--here" : ""}`}
                  >
                    <span className="as-icon">{ICONS[app.icon]}</span>
                    <span className="as-name">{app.name}</span>
                  </Tile>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Switcher.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Export it from `src/index.ts`**

```ts
export { AnimaliaSwitcher } from "./Switcher";
export type { AnimaliaSwitcherProps } from "./Switcher";
export type { ManifestApp } from "./types";
```

- [ ] **Step 6: Run the full test suite and the build**

Run: `npm test && npm run build`
Expected: all tests pass; `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`, `dist/styles.css` are produced.

- [ ] **Step 7: Commit**

```bash
git add src/Switcher.tsx src/Switcher.test.tsx src/index.ts
git commit -m "feat: AnimaliaSwitcher component with pill, sheet/drawer, and tiles"
```

---

### Task 6: Publish the package to GitHub

**Files:** none (git remote + tag operations only).

**Interfaces:**
- Consumes: the built package from Task 5.
- Produces: a public GitHub repo `hazimazmi91-code/animalia-app-switcher` with a `v0.1.0` tag, installable elsewhere via `npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0`.

> **Confirm with the user before running Step 2** — it creates a new GitHub repository and pushes code to it, which is a visible, hard-to-fully-reverse action outside this local machine.

- [ ] **Step 1: Verify `gh` is authenticated**

Run: `gh auth status`
Expected: shows an authenticated account under `hazimazmi91-code` (or ask the user to run `gh auth login` first if not).

- [ ] **Step 2: Create the GitHub repo and push**

```bash
gh repo create hazimazmi91-code/animalia-app-switcher --public --source=. --remote=origin --push
```

Expected: repo created, `master` branch pushed, `origin` remote set.

- [ ] **Step 3: Tag the first release**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Expected: tag visible on GitHub.

---

### Task 7: Host the manifest on `projects-dashboard`

**Files:**
- Create: `C:\Users\Administrator\Projects\projects-dashboard\public\switcher-manifest.json`

**Interfaces:**
- Produces: a static file served at `https://projects-dashboard-cyan.vercel.app/switcher-manifest.json`, matching `ManifestApp[]` from the package's `src/types.ts` (Task 2).

- [ ] **Step 1: Write the manifest file**

```json
[
  { "id": "task-log", "name": "Task Log", "url": "https://animalia-task-log.vercel.app", "icon": "clipboard", "tint": "teal", "group": "Daily" },
  { "id": "xray-share-web", "name": "X-ray Share", "url": "https://xray-share-web.vercel.app", "icon": "scan", "tint": "pink", "group": "Clinical" },
  { "id": "fluid-rate", "name": "Fluid Rate Calc", "url": "https://fluid-rate-calculator.vercel.app", "icon": "droplet", "tint": "lavender", "group": "Clinical" },
  { "id": "dosage-calc", "name": "Dosage Calc", "url": "https://dosage-calculator-mu.vercel.app", "icon": "capsule", "tint": "peach", "group": "Clinical" },
  { "id": "shifts-biosecurity", "name": "Shifts & Biosecurity", "url": "https://shifts-biosecurity-profile.vercel.app", "icon": "shield", "tint": "teal", "group": "Clinical" },
  { "id": "kreloses", "name": "Kreloses Dashboard", "url": "https://kreloses-dashboard.vercel.app", "icon": "chart-bar", "tint": "pink", "group": "Admin" },
  { "id": "pricelist", "name": "Supplier Pricelist", "url": "https://animalia-supplier-pricelist.vercel.app", "icon": "tag", "tint": "lavender", "group": "Admin" },
  { "id": "money", "name": "Smart Money Tracker", "url": "https://smart-money-tracker-ecru.vercel.app", "icon": "wallet", "tint": "peach", "group": "Admin" },
  { "id": "finance-os", "name": "Finance OS", "url": "https://animalia-finance-os.vercel.app", "icon": "ledger", "tint": "teal", "group": "Admin" }
]
```

- [ ] **Step 2: Commit and push (triggers a Vercel deploy of `projects-dashboard`)**

```bash
cd /c/Users/Administrator/Projects/projects-dashboard
git add public/switcher-manifest.json
git commit -m "feat: host the app-switcher manifest as a static JSON file"
git push
```

- [ ] **Step 3: Verify it's live**

Run: `curl -s https://projects-dashboard-cyan.vercel.app/switcher-manifest.json`
Expected: the same JSON array, once the Vercel deploy finishes (check `vercel ls` or the dashboard if it 404s immediately).

---

### Task 8: Integrate into `animalia-task-log` (reference install)

**Files:**
- Modify: `C:\Users\Administrator\Projects\animalia-task-log\app\layout.tsx`
- Modify: `C:\Users\Administrator\Projects\animalia-task-log\package.json`

**Interfaces:**
- Consumes: `AnimaliaSwitcher` from `@animalia/switcher` (Task 6's published package).

- [ ] **Step 1: Install the package**

```bash
cd "/c/Users/Administrator/Projects/animalia-task-log"
npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0
```

- [ ] **Step 2: Edit `app/layout.tsx`**

Add the import at the top of the file:

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
```

Add `<AnimaliaSwitcher current="task-log" />` as the last child inside `<body>`, immediately after `{children}` (its styling is `position: fixed`, so it doesn't matter where else in the tree it sits — after `{children}` keeps it out of the way of any `key`-sensitive lists).

- [ ] **Step 3: Verify locally**

```bash
npm run dev
```

Open the app in a browser at both desktop width and a 390px-wide viewport (project convention — staff use phones). Confirm: the pill appears without overlapping the app's own header/nav, tapping it opens the sheet (phone) or drawer (desktop) with the liquid-glass treatment and the staggered tile animation, the "Task Log" tile is marked as current and isn't a link, and every other tile navigates to its manifest URL.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: add Animalia app switcher"
```

---

### Task 9: Integrate into `xray-share-web`

**Files:**
- Modify: `C:\Users\Administrator\Projects\xray-share-web\app\layout.tsx`
- Modify: `C:\Users\Administrator\Projects\xray-share-web\package.json`

- [ ] **Step 1: Install the package**

```bash
cd "/c/Users/Administrator/Projects/xray-share-web"
npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0
```

- [ ] **Step 2: Edit `app/layout.tsx`** — same pattern as Task 8 Step 2, with `current="xray-share-web"`:

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
```

```tsx
<AnimaliaSwitcher current="xray-share-web" />
```

- [ ] **Step 3: Verify locally** — same checklist as Task 8 Step 3, confirming the "X-ray Share" tile is marked current.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: add Animalia app switcher"
```

---

### Task 10: Integrate into `Dosage calculator`

**Files:**
- Modify: `C:\Users\Administrator\Projects\Dosage calculator\app\layout.tsx`
- Modify: `C:\Users\Administrator\Projects\Dosage calculator\package.json`

- [ ] **Step 1: Install the package**

```bash
cd "/c/Users/Administrator/Projects/Dosage calculator"
npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0
```

- [ ] **Step 2: Edit `app/layout.tsx`** — same pattern, with `current="dosage-calc"`:

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
```

```tsx
<AnimaliaSwitcher current="dosage-calc" />
```

- [ ] **Step 3: Verify locally** — same checklist as Task 8 Step 3, confirming the "Dosage Calc" tile is marked current.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: add Animalia app switcher"
```

---

### Task 11: Integrate into `smart-money-tracker`

**Files:**
- Modify: `C:\Users\Administrator\Projects\smart-money-tracker\src\app\layout.tsx`
- Modify: `C:\Users\Administrator\Projects\smart-money-tracker\package.json`

- [ ] **Step 1: Install the package**

```bash
cd "/c/Users/Administrator/Projects/smart-money-tracker"
npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0
```

- [ ] **Step 2: Edit `src/app/layout.tsx`** — same pattern, with `current="money"`:

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
```

```tsx
<AnimaliaSwitcher current="money" />
```

- [ ] **Step 3: Verify locally** — same checklist as Task 8 Step 3, confirming the "Smart Money Tracker" tile is marked current. This app has a passcode gate (per project notes) — verify the pill still renders correctly once past it.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: add Animalia app switcher"
```

---

### Task 12: Integrate into `animalia-finance-os`

**Files:**
- Modify: `C:\Users\Administrator\Projects\animalia-finance-os\src\app\layout.tsx`
- Modify: `C:\Users\Administrator\Projects\animalia-finance-os\package.json`

- [ ] **Step 1: Install the package**

```bash
cd "/c/Users/Administrator/Projects/animalia-finance-os"
npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0
```

- [ ] **Step 2: Edit `src/app/layout.tsx`** (the root layout — not `src/app/(dashboard)/layout.tsx`, which is a nested layout) — same pattern, with `current="finance-os"`:

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
```

```tsx
<AnimaliaSwitcher current="finance-os" />
```

- [ ] **Step 3: Verify locally** — same checklist as Task 8 Step 3, confirming the "Finance OS" tile is marked current.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: add Animalia app switcher"
```

---

### Task 13: Integrate into `supplier-pricelist-app`

**Files:**
- Modify: `C:\Users\Administrator\Documents\supplier-pricelist-app\app\layout.tsx`
- Modify: `C:\Users\Administrator\Documents\supplier-pricelist-app\package.json`

- [ ] **Step 1: Install the package**

```bash
cd "/c/Users/Administrator/Documents/supplier-pricelist-app"
npm install github:hazimazmi91-code/animalia-app-switcher#v0.1.0
```

- [ ] **Step 2: Edit `app/layout.tsx`** — same pattern, with `current="pricelist"`:

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
```

```tsx
<AnimaliaSwitcher current="pricelist" />
```

- [ ] **Step 3: Verify locally** — same checklist as Task 8 Step 3, confirming the "Supplier Pricelist" tile is marked current. This app has per-staff login (per project notes) — verify the pill still renders correctly once past it.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx package.json package-lock.json
git commit -m "feat: add Animalia app switcher"
```

---

## Known gaps (explicitly out of scope for this plan)

- **`fluid-rate-calculator`** — Expo/React Native, not a DOM/CSS environment the component can render in as-is. Per the user's 2026-09-13 decision, embedding is deferred to a follow-up plan; it already appears as a manifest destination (Task 7), so other apps can switch *to* it today.
- **`kreloses-dashboard`** and **`shifts-biosecurity-profile`** — no local, git-tracked source found on this machine; both are noted in `projects-dashboard/src/lib/projects.ts` as deployed straight via the Vercel CLI with no GitHub repo. They appear as manifest destinations (Task 7) but installing the pill *inside* them needs their source location found (or a repo created for them) first — a separate, smaller follow-up plan once that's sorted out.
