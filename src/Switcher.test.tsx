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

  it("closes when Escape is pressed", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    fireEvent.click(screen.getByRole("button", { name: /apps/i }));
    await screen.findByText("Smart Money Tracker");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Smart Money Tracker")).not.toBeInTheDocument();
    });
  });

  it("toggles closed when the pill is clicked again while open", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    const pill = screen.getByRole("button", { name: /apps/i });

    fireEvent.click(pill);
    await screen.findByText("Smart Money Tracker");
    expect(pill).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(pill);

    await waitFor(() => {
      expect(screen.queryByText("Smart Money Tracker")).not.toBeInTheDocument();
    });
    expect(pill).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes the sheet as a modal dialog and moves focus into it on open", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    fireEvent.click(screen.getByRole("button", { name: /apps/i }));
    await screen.findByText("Smart Money Tracker");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("leaves data-theme unset by default and sets it from the theme prop", async () => {
    const { container, rerender } = render(<AnimaliaSwitcher current="task-log" />);
    const root = container.querySelector(".animalia-switcher")!;
    expect(root).not.toHaveAttribute("data-theme");

    rerender(<AnimaliaSwitcher current="task-log" theme="dark" />);
    await waitFor(() =>
      expect(container.querySelector(".animalia-switcher")).toHaveAttribute("data-theme", "dark")
    );
  });

  it("warns when `current` matches no app in the loaded manifest", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<AnimaliaSwitcher current="not-a-real-app" />);

    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(warnSpy.mock.calls[0][0]).toContain('current="not-a-real-app"');
    warnSpy.mockRestore();
  });

  it("does not warn when `current` matches an app", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<AnimaliaSwitcher current="task-log" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /apps/i })).toBeInTheDocument());

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns focus to the pill when the sheet closes", async () => {
    render(<AnimaliaSwitcher current="task-log" />);
    const pill = screen.getByRole("button", { name: /apps/i });

    fireEvent.click(pill);
    await screen.findByText("Smart Money Tracker");
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(pill).toHaveFocus());
  });
});
