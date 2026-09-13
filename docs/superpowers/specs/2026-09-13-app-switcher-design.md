# Animalia App Switcher — Design Spec

Status: **approved by user (mockup + design direction), pending final app list confirmation**
Date: 2026-09-13

## 1. Problem

Staff at Animalia Vet Clinic use several separate internal web apps (each its own
Next.js codebase, its own Vercel deployment, no shared session). There's currently
no fast way to jump between them mid-task other than bookmarks. The user wants a
switcher **embedded inside each app** (not a browser extension), fast to open
("senang nak bukak on the fly"), and visually premium ("canggih").

## 2. UI pattern

One floating trigger **pill** (small, translucent, shows current app's icon/tint),
position configurable per host app (default: bottom-left on phone, top-right on
desktop, to avoid colliding with a host app's own FAB/nav).

- **Phone (<768px):** tapping the pill opens a **bottom sheet** — 2-column grid of
  app tiles, drag handle, dismiss by tapping the backdrop or swiping down.
- **Desktop (≥768px):** tapping the pill opens a **360px right-side drawer** with
  the same grid. `Ctrl/Cmd+K` as a bonus trigger is phase 2, not MVP.

Same component; `matchMedia('(min-width: 768px)')` picks the presentation.
`position: fixed; z-index: 9999` so it floats over any host app's own header
without per-app layout changes.

Rejected alternatives (from Fable's comparison): a full slide-out side panel (eats
the phone screen), a FAB + radial menu (doesn't fit 7+ items, dated), a top-bar
dropdown (clashes with each app's own header).

## 3. Visual treatment — "liquid glass"

Validated via an interactive mockup (see `references/mockup-v2.html`, published as
a Claude Artifact during design).

- **Pill and sheet/drawer chrome** get a liquid-glass treatment: low blur (14–20px)
  + high saturation (160–180%) backdrop-filter, an inset specular highlight along
  the top-left edge and a darker inset shade bottom-right (not a flat 1px border),
  plus a thin gradient "sheen" pulled from the brand palette (pink → teal →
  lavender, not pure white) so it reads as "Animalia glass," not an Apple
  Control-Center knockoff.
- **App tiles stay solid pastel** (alternating teal/pink/lavender/peach tints,
  brand colors already in use across the clinic's apps) with just a faint inset
  top-left highlight line for family cohesion — translucent tiles were rejected
  because they'd muddy the tint and hurt icon/text contrast.
- Typography: **Baloo 2** for headings/tile names, **Nunito** for body text —
  matches the existing shared brand across Animalia staff apps.
- Open animation: sheet/drawer slides in (320ms, `cubic-bezier(0.32,0.72,0,1)`),
  tiles **stagger in** ~40ms apart (`translateY(8px)→0`, fade in).
- Active-app tile: raised, ringed in its own tint color, small "you're here" pill;
  tapping it just closes the sheet.
- Tap feedback: tile scale 0.96 on press; thin top progress bar after navigating,
  since switching apps is a real page load (not an SPA transition).
- Respects `prefers-color-scheme` (light/dark tokens defined for the glass
  surfaces too) and `prefers-reduced-motion` (drops stagger + specular motion,
  keeps a simple fade).
- One `backdrop-filter` per surface (pill, sheet/drawer) — never stacked per-tile,
  to avoid perf/jank on lower-end phones.

## 4. Cross-app distribution

Since the 7+ target apps are separate codebases/deployments with no shared build
pipeline:

- **Shared component**: a small package (`@animalia/switcher`, zero heavy deps)
  each app installs once and drops into its root layout:
  `<AnimaliaSwitcher current="task-log" />`. Updating the look/animation later =
  bump the package version, not touch 7 codebases.
- **App list lives outside the component**, as one JSON manifest fetched at
  runtime (cached in `localStorage`, `stale-while-revalidate`), with a bundled
  fallback list inside the package for first paint / offline. Adding, renaming,
  or retiring an app later = editing one JSON file, not redeploying every app.
- Manifest hosting: a static JSON file, `public/switcher-manifest.json`, added to
  the existing `projects-dashboard` deployment
  (`C:\Users\Administrator\Projects\projects-dashboard`), served at
  `https://projects-dashboard-cyan.vercel.app/switcher-manifest.json` — no new
  service, no API route, editable by hand and redeployed with that project's
  normal flow. Chosen over a route in `src/lib/projects.ts` because the switcher
  manifest is a different shape/purpose (staff-facing app list vs. Hazim's own
  dev-ops project list) and shouldn't need a dashboard rebuild for a manifest
  edit like a tint or group change.
- Rejected: copy-pasting the component into each repo (drifts within weeks), an
  iframe/web-component embed from a central service (CSP/cookie/auth pain for no
  real benefit at this scope).

## 5. Auth & scope

Each app has a different (or no) login/passcode gate and there's no shared
session across them. **v1 is plain links, same-tab navigation** — no cross-app
badges or notification counts (that would need shared SSO + a per-app API, real
work with no validated need yet).

## 6. App list (manifest content)

Pulled from the user's existing canonical project list
(`projects-dashboard/src/lib/projects.ts`), filtered to apps that are actually
staff-facing tools staff would switch between mid-task — **not** the public
marketing site, not Hazim's own dev-tooling dashboard, not backend-only
automation with no UI.

| id | name | url | tint | group |
|---|---|---|---|---|
| task-log | Task Log | https://animalia-task-log.vercel.app | teal | Daily |
| xray-share-web | X-ray Share | https://xray-share-web.vercel.app | pink | Clinical |
| fluid-rate | Fluid Rate Calc | https://fluid-rate-calculator.vercel.app | lavender | Clinical |
| dosage-calc | Dosage Calc | https://dosage-calculator-mu.vercel.app | peach | Clinical |
| shifts-biosecurity | Shifts & Biosecurity | https://shifts-biosecurity-profile.vercel.app | teal | Clinical |
| kreloses | Kreloses Dashboard | https://kreloses-dashboard.vercel.app | pink | Admin |
| pricelist | Supplier Pricelist | https://animalia-supplier-pricelist.vercel.app | lavender | Admin |
| money | Smart Money Tracker | https://smart-money-tracker-ecru.vercel.app | peach | Admin |

**Excluded, pending confirmation** — flagged for the user to correct before
implementation:
- `animalia-vet-sendayan-website` (animaliavet.net) — public marketing site, not
  an internal staff tool.
- `projects-dashboard` — the user's own dev-ops dashboard, not staff-facing.
- `animalia-finance-os` — unclear if staff use this directly or if it's
  backend-only infra behind Smart Money Tracker's integration.
- `convention-pricelist-app`, `Moghul91` (Force Feeding Calculator),
  `kreloses-automation` — unclear if these are active staff-facing tools for
  this clinic or separate/dormant projects.
- Old `xray-share` (pre-cloud-migration, `live: null` in projects.ts) — superseded
  by `xray-share-web`.

Groups (Daily / Clinical / Admin) are a first pass based on app purpose, not
validated with the user — cheap to change since it's just manifest data.

## 7. Phasing

- **MVP** (this spec's scope): shared package + manifest, sheet/drawer UI with
  liquid-glass chrome, installed into the 8 confirmed staff apps above.
- **Phase 2**: recent/most-used row (localStorage), `Ctrl/Cmd+K` on desktop,
  manifest-level `hidden`/`roles` filtering.
- **Phase 3** (only if wanted later): shared SSO + live per-app badge counts —
  explicitly out of scope for now, no shared identity system exists today.

## 8. Testing approach

- Component: unit tests for open/close state, keyboard focus trap in the
  sheet/drawer, manifest fetch/fallback logic.
- Visual/responsive: manual check at ~390px (phone) and desktop width per
  existing project convention (staff use phones — this project's own
  [[feedback_verify_at_phone_width]] rule applies).
- Per-app integration: after installing into each of the 8 apps, manually verify
  the pill doesn't collide with that app's existing header/FAB and that
  navigation lands on the right URL.
