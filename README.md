# @animalia/switcher

Floating "Apps" pill that opens an app switcher (bottom sheet on mobile, side drawer on desktop) for the Animalia clinic web apps.

## Install

Consumers install from git by tag (not published to npm):

```
npm install "@animalia/switcher@github:hazimazmi91-code/animalia-app-switcher#v0.3.0" --force
```

`package.json` has `"prepare": "npm run build"`, which is required for the git dependency to build itself on install. After installing, check that the lockfile's resolved commit actually changed (npm's git cache can serve a stale commit).

## Usage

```tsx
import { AnimaliaSwitcher } from "@animalia/switcher";
import "@animalia/switcher/styles.css";

<AnimaliaSwitcher current="task-log" isAdmin={session.isAdmin} />
```

## How the app list is delivered

- At runtime the component fetches `https://projects-dashboard-cyan.vercel.app/switcher-manifest.json` (source: `projects-dashboard/public/switcher-manifest.json`), caches it in localStorage, and falls back to the cache, then to the bundled `FALLBACK_MANIFEST` in `src/manifest.ts`.
- **Adding, removing or editing an app therefore does not need a package release or consumer redeploy**: edit the hosted manifest and deploy projects-dashboard. Keep `FALLBACK_MANIFEST` in sync by hand; it only matters for first paint and offline use.
- A package release is only needed for code changes (component, styles, new icons, manifest fields).

## Manifest entry format

`{ id, name, url (https only), icon, tint: teal|pink|lavender|peach, group, adminOnly? }`

- `icon` must be one of the built-in keys in `src/icons.tsx` (an unknown key renders a blank tile).
- `adminOnly: true` hides the tile unless `isAdmin` is set; the app the viewer is currently in always stays visible.
- There is no deprecated/legacy field. Retire an app by removing its entry.
- Tiles are grouped by `group`, in order of first appearance.

## Development

```
npm test
npm run build
```
