# Changelog

## 0.3.0

- Add **Animalia Tools** (`animalia-tools`, https://animalia-tools.vercel.app) to the bundled `FALLBACK_MANIFEST`, Clinical group, visible to everyone.
- The legacy Dosage Calc and Fluid Rate Calc entries are unchanged. The manifest format has no "legacy"/"replaced" flag, so they are not marked.
- Admin-only gating is unchanged (Supplier Pricelist, Smart Money Tracker, Finance OS).
- Note: the live app list is fetched at runtime from the hosted manifest; see README.

## 0.2.1

- Default desktop pill to bottom-right instead of top-right.

## 0.2.0

- Add role-based visibility: `adminOnly` manifest apps and the `isAdmin` prop.

## 0.1.6

- Stop following `prefers-color-scheme`; pass `theme="dark"` explicitly if a host app needs it.

## 0.1.5 and earlier

See git history and tags.
