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

  describe("shape validation", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    const respondWith = (body: unknown) =>
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));

    it("falls back and logs when the JSON is not an array", async () => {
      respondWith({ oops: "this is not a manifest" });

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(FALLBACK_MANIFEST);
      expect(errorSpy).toHaveBeenCalled();
      expect(localStorage.getItem("animalia-switcher-manifest")).toBeNull();
    });

    it("falls back and logs when the JSON is a bare string", async () => {
      respondWith("nope");

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(FALLBACK_MANIFEST);
      expect(errorSpy).toHaveBeenCalled();
    });

    it("drops a malformed entry but keeps the valid ones", async () => {
      respondWith([
        ...sample,
        { id: "broken", name: "Broken", url: "https://example.com" }, // no icon/tint/group
        { id: 42, name: "Numeric id", url: "https://example.com", icon: "tag", tint: "teal", group: "Admin" },
        "not-an-object",
      ]);

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(sample);
      expect(errorSpy).toHaveBeenCalledTimes(3);
    });

    it("accepts a { version, apps: [...] } envelope", async () => {
      respondWith({ version: 2, apps: sample });

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(sample);
      expect(JSON.parse(localStorage.getItem("animalia-switcher-manifest")!)).toEqual(sample);
    });

    it("falls back when every entry is malformed", async () => {
      respondWith([{ id: "only-an-id" }]);

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(FALLBACK_MANIFEST);
    });

    it("drops an entry whose url is not https and keeps the rest", async () => {
      const evil = {
        id: "evil",
        name: "Evil",
        url: "javascript:alert(1)",
        icon: "tag",
        tint: "pink",
        group: "Admin",
      };
      respondWith([evil, ...sample]);

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(sample);
      expect(result.some((a) => a.id === "evil")).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });

    it("drops http:// and data: urls too", async () => {
      respondWith([
        { ...sample[0], id: "insecure", url: "http://insecure.example.com" },
        { ...sample[0], id: "data-uri", url: "data:text/html,<script>1</script>" },
        ...sample,
      ]);

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(sample);
    });

    it("keeps an entry with an unknown tint but warns about it", async () => {
      const odd = { ...sample[0], id: "odd", tint: "chartreuse" };
      respondWith([odd]);

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual([odd]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("treats a non-boolean adminOnly as true (fail safe) and warns about it", async () => {
      const odd = { ...sample[0], id: "odd", adminOnly: "yes" };
      respondWith([odd]);

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual([{ ...odd, adminOnly: true }]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("ignores a corrupt localStorage cache and uses the bundled fallback", async () => {
      localStorage.setItem("animalia-switcher-manifest", JSON.stringify({ not: "a manifest" }));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      const result = await fetchManifest(manifestUrl);

      expect(result).toEqual(FALLBACK_MANIFEST);
    });
  });
});
