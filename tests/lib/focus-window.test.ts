import { describe, it, expect } from "vitest";
import { resolveAppNames } from "@/lib/platform/macos";

describe("resolveAppNames", () => {
  it("maps VS Code to the correct app and process names", () => {
    const { appName, processName } = resolveAppNames("VS Code");
    expect(appName).toBe("Visual Studio Code");
    expect(processName).toBe("Code");
  });

  it("maps iTerm2 to itself for both names", () => {
    const { appName, processName } = resolveAppNames("iTerm2");
    expect(appName).toBe("iTerm2");
    expect(processName).toBe("iTerm2");
  });

  it("maps Terminal to itself for both names", () => {
    const { appName, processName } = resolveAppNames("Terminal");
    expect(appName).toBe("Terminal");
    expect(processName).toBe("Terminal");
  });

  it("maps Cursor to itself for both names", () => {
    const { appName, processName } = resolveAppNames("Cursor");
    expect(appName).toBe("Cursor");
    expect(processName).toBe("Cursor");
  });

  it("maps JetBrains IDEs correctly", () => {
    const { appName, processName } = resolveAppNames("IntelliJ IDEA");
    expect(appName).toBe("IntelliJ IDEA");
    expect(processName).toBe("IntelliJ IDEA");
  });

  it("passes unknown app names through unchanged", () => {
    const { appName, processName } = resolveAppNames("SomeNewApp");
    expect(appName).toBe("SomeNewApp");
    expect(processName).toBe("SomeNewApp");
  });
});
