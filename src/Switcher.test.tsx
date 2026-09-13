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

  it("does not render a tile for a manifest entry with a javascript: url", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "evil", name: "Evil App", url: "javascript:alert(1)", icon: "tag", tint: "pink", group: "Admin" },
          { id: "task-log", name: "Task Log", url: "https://animalia-task-log.vercel.app", icon: "clipboard", tint: "teal", group: "Daily" },
        ],
      })
    );

    render(<AnimaliaSwitcher current="task-log" />);
    fireEvent.click(screen.getByRole("button", { name: /apps/i }));

    await screen.findByText("Task Log");
    expect(screen.queryByText("Evil App")).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    errorSpy.mockRestore();
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
