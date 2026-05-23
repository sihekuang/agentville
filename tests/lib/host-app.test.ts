import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveHostApp,
  parseIdeLockFiles,
  identifyAppFromProcessName,
} from "@/lib/host-app";

describe("identifyAppFromProcessName", () => {
  it("identifies iTerm2 from .app path", () => {
    expect(identifyAppFromProcessName("/Applications/iTerm2.app/Contents/MacOS/iTerm2")).toEqual({
      type: "terminal",
      name: "iTerm2",
    });
  });

  it("identifies VS Code from .app path", () => {
    expect(identifyAppFromProcessName("/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Renderer).app/Contents/MacOS/Code Helper (Renderer)")).toEqual({
      type: "terminal",
      name: "Visual Studio Code",
    });
  });

  it("identifies IntelliJ IDEA as IDE", () => {
    expect(identifyAppFromProcessName("/Applications/IntelliJ IDEA.app/Contents/MacOS/idea")).toEqual({
      type: "ide",
      name: "IntelliJ IDEA",
    });
  });

  it("identifies Terminal.app", () => {
    expect(identifyAppFromProcessName("/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal")).toEqual({
      type: "terminal",
      name: "Terminal",
    });
  });

  it("identifies Warp from .app path", () => {
    expect(identifyAppFromProcessName("/Applications/Warp.app/Contents/MacOS/stable")).toEqual({
      type: "terminal",
      name: "Warp",
    });
  });

  it("returns null for paths without .app", () => {
    expect(identifyAppFromProcessName("node")).toBeNull();
    expect(identifyAppFromProcessName("/usr/bin/zsh")).toBeNull();
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
