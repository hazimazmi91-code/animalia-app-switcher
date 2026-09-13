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
