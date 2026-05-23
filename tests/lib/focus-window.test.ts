import { describe, it, expect, vi } from "vitest";
import { buildFocusScript } from "@/lib/focus-window";

describe("buildFocusScript", () => {
  it("builds AppleScript for a terminal app", () => {
    const script = buildFocusScript({
      type: "terminal",
      name: "iTerm2",
      pid: 123,
      cwd: "/Users/test",
    });
    expect(script).toContain("iTerm2");
    expect(script).toContain("activate");
  });

  it("builds AppleScript for an IDE", () => {
    const script = buildFocusScript({
      type: "ide",
      name: "VS Code",
      pid: 456,
      cwd: "/Users/test/project",
    });
    expect(script).toContain("Visual Studio Code");
    expect(script).toContain("activate");
  });

  it("builds AppleScript for Terminal.app", () => {
    const script = buildFocusScript({
      type: "terminal",
      name: "Terminal",
      pid: 789,
      cwd: "/Users/test",
    });
    expect(script).toContain("Terminal");
    expect(script).toContain("activate");
  });
});
