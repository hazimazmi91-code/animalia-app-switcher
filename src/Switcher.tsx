import { useEffect, useRef, useState } from "react";
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchManifest(manifestUrl).then((result) => {
      if (!cancelled) setApps(result);
    });
    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

  // Escape closes the sheet/drawer — previously the backdrop was the only way out.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Move focus into the sheet when it opens, and back to the pill when it closes.
  useEffect(() => {
    if (open) {
      hasOpened.current = true;
      sheetRef.current?.focus();
    } else if (hasOpened.current) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const resolvedPosition = position ?? (isDesktop ? "top-right" : "bottom-left");

  return (
    <div className="animalia-switcher">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Apps"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`animalia-switcher-pill animalia-switcher-pill--${resolvedPosition}`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="as-icon" style={{ width: 22, height: 22, borderRadius: "50%" }}>
          {ICONS.clipboard}
        </span>
        Apps
      </button>

      <div
        data-testid="animalia-switcher-backdrop"
        aria-hidden="true"
        className={`animalia-switcher-backdrop ${open ? "animalia-switcher-backdrop--open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Switch app"
        aria-hidden={!open}
        tabIndex={-1}
        data-testid="animalia-switcher-sheet"
        className={
          isDesktop
            ? `animalia-switcher-drawer ${open ? "animalia-switcher-drawer--open" : ""}`
            : `animalia-switcher-sheet ${open ? "animalia-switcher-sheet--open" : ""}`
        }
      >
        {open && (
          <>
            <div className="animalia-switcher-title">Switch app</div>
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
          </>
        )}
      </div>
    </div>
  );
}
