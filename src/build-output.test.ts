import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Regression guard for two build bugs that already shipped once and are
 * invisible from unit tests of the source:
 *
 *  1. tsup hashed the copied stylesheet (dist/styles-XXXX.css), so the
 *     `./styles.css` export in package.json 404'd in every host app.
 *  2. The bundle shipped without a `"use client"` banner, so importing it from
 *     a Next.js App Router server layout crashed the host app.
 *
 * This builds from scratch and asserts on the real artefacts, so it runs on
 * every `npm test` rather than existing as a command someone remembers to run.
 */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");

describe("build output", () => {
  beforeAll(() => {
    execSync("npm run build", { cwd: projectRoot, stdio: "ignore" });
  }, 180_000);

  it("emits dist/styles.css under its unhashed name", () => {
    expect(existsSync(path.join(distDir, "styles.css"))).toBe(true);

    // A hashed copy (styles-ABC123.css) would silently break the
    // "./styles.css" subpath export, so require exactly one stylesheet.
    const stylesheets = readdirSync(distDir).filter((file) => file.endsWith(".css"));
    expect(stylesheets).toEqual(["styles.css"]);
  });

  it.each(["index.mjs", "index.js"])(
    'starts dist/%s with the "use client" banner',
    (file) => {
      const contents = readFileSync(path.join(distDir, file), "utf8");
      expect(contents.startsWith('"use client";')).toBe(true);
    }
  );
});
