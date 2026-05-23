import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveHostApp,
  parseIdeLockFiles,
  identifyAppFromProcessName,
} from "@/lib/host-app";

describe("identifyAppFromProcessName", () => {
  it("identifies iTerm2", () => {
    expect(identifyAppFromProcessName("iTerm2")).toEqual({
      type: "terminal",
      name: "iTerm2",
    });
  });

  it("identifies VS Code", () => {
    expect(identifyAppFromProcessName("Electron")).toEqual(null);
    expect(identifyAppFromProcessName("Code Helper (Renderer)")).toEqual({
      type: "ide",
      name: "VS Code",
    });
  });

  it("identifies Terminal.app", () => {
    expect(identifyAppFromProcessName("Terminal")).toEqual({
      type: "terminal",
      name: "Terminal",
    });
  });

  it("identifies Warp", () => {
    expect(identifyAppFromProcessName("Warp")).toEqual({
      type: "terminal",
      name: "Warp",
    });
  });

  it("returns null for unknown process", () => {
    expect(identifyAppFromProcessName("node")).toBeNull();
  });
});

describe("parseIdeLockFiles", () => {
  it("parses IDE lock file content", () => {
    const lockContent = JSON.stringify({
      workspaceFolders: ["/Users/test/my-project"],
      pid: 99999,
      ideName: "VS Code",
      transport: "ws",
      authToken: "fake-token",
    });

    const result = parseIdeLockFiles([{ port: 61035, content: lockContent }]);
    expect(result).toHaveLength(1);
    expect(result[0].ideName).toBe("VS Code");
    expect(result[0].pid).toBe(99999);
    expect(result[0].workspaceFolders).toContain("/Users/test/my-project");
  });
});
