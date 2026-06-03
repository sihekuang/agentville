import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  resolveHostApp,
  parseIdeLockFiles,
  identifyAppFromProcessName,
  clearHostAppCache,
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

describe("resolveHostApp", () => {
  let ideDir: string;
  let sessionCounter = 0;

  /** A unique session id per case so the module-level cache never bleeds across tests. */
  const nextSession = () => `session-${sessionCounter++}`;

  beforeEach(() => {
    clearHostAppCache();
    ideDir = fs.mkdtempSync(path.join(os.tmpdir(), "ide-locks-"));
  });

  /** Write a single IDE lock file into the temp ide dir. */
  const writeLock = (port: number, lock: Record<string, unknown>) => {
    fs.writeFileSync(path.join(ideDir, `${port}.lock`), JSON.stringify(lock));
  };

  const WEBSTORM_PID = 32549;

  it("does NOT attribute a Warp session to an IDE that merely has the folder open", () => {
    // WebStorm has the project open (writes a lock), but the session actually
    // runs in Warp — its parent chain does not include WebStorm's pid.
    writeLock(56609, {
      workspaceFolders: ["/Users/daniel/Documents/Projects/where-is-my-lego"],
      pid: WEBSTORM_PID,
      ideName: "WebStorm",
      transport: "ws",
      authToken: "x",
    });

    const deps = {
      getParentPids: () => [31311, 27228, 26995], // claude -> -zsh -> Warp -> Warp
      getProcessName: (pid: number) =>
        ({
          31311: "-zsh",
          27228: "/Applications/Warp.app/Contents/MacOS/stable",
          26995: "/Applications/Warp.app/Contents/MacOS/stable",
        })[pid] ?? null,
    };

    const result = resolveHostApp(
      37635,
      "/Users/daniel/Documents/Projects/where-is-my-lego",
      nextSession(),
      ideDir,
      deps,
    );

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Warp");
    expect(result!.type).toBe("terminal");
  });

  it("attributes to the IDE when the session actually descends from it", () => {
    writeLock(56609, {
      workspaceFolders: ["/Users/daniel/Documents/Projects/where-is-my-lego"],
      pid: WEBSTORM_PID,
      ideName: "WebStorm",
      transport: "ws",
      authToken: "x",
    });

    const deps = {
      getParentPids: () => [36582, WEBSTORM_PID], // claude -> zsh -> WebStorm
      getProcessName: (pid: number) =>
        ({
          36582: "/bin/zsh",
          [WEBSTORM_PID]: "/Users/daniel/Applications/WebStorm.app/Contents/MacOS/webstorm",
        })[pid] ?? null,
    };

    const result = resolveHostApp(
      38431,
      "/Users/daniel/Documents/Projects/where-is-my-lego/web",
      nextSession(),
      ideDir,
      deps,
    );

    expect(result).not.toBeNull();
    expect(result!.name).toBe("WebStorm");
    expect(result!.type).toBe("ide");
    expect(result!.pid).toBe(WEBSTORM_PID);
  });

  it("falls back to the IDE lock by cwd when the process chain is uninformative", () => {
    // No recognizable terminal/IDE in the parent chain (e.g. re-parented to init),
    // but an IDE has the folder open — best remaining guess is that IDE.
    writeLock(56609, {
      workspaceFolders: ["/Users/daniel/Documents/Projects/where-is-my-lego"],
      pid: WEBSTORM_PID,
      ideName: "WebStorm",
      transport: "ws",
      authToken: "x",
    });

    const deps = {
      getParentPids: () => [4242],
      getProcessName: () => "node", // no .app, unrecognizable
    };

    const result = resolveHostApp(
      99999,
      "/Users/daniel/Documents/Projects/where-is-my-lego",
      nextSession(),
      ideDir,
      deps,
    );

    expect(result).not.toBeNull();
    expect(result!.name).toBe("WebStorm");
    expect(result!.type).toBe("ide");
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
