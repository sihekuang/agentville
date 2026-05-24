import { app, BrowserWindow, shell } from "electron";
import { fork, type ChildProcess } from "child_process";
import path from "path";
import net from "net";

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

const IS_DEV = !app.isPackaged;

function getResourcePath(...segments: string[]): string {
  if (IS_DEV) {
    return path.join(process.cwd(), ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        server.close(() => resolve(addr.port));
      } else {
        reject(new Error("Failed to get port"));
      }
    });
  });
}

async function startNextServer(port: number): Promise<void> {
  const serverPath = getResourcePath("standalone", "server.js");
  const scriptsDir = getResourcePath("scripts", "macos");

  return new Promise((resolve, reject) => {
    nextServer = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        ELECTRON_SCRIPTS_DIR: scriptsDir,
      },
      stdio: "pipe",
    });

    let resolved = false;

    nextServer.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      console.log("[next]", msg);
      if (!resolved && (msg.includes("Ready") || msg.includes("started"))) {
        resolved = true;
        resolve();
      }
    });

    nextServer.stderr?.on("data", (data: Buffer) => {
      console.error("[next]", data.toString());
    });

    nextServer.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    nextServer.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Next.js server exited with code ${code}`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 8000);
  });
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "AgentVille",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", async () => {
  const port = await findFreePort();
  await startNextServer(port);
  createWindow(port);
});

app.on("window-all-closed", () => {
  nextServer?.kill();
  app.quit();
});

app.on("before-quit", () => {
  nextServer?.kill();
});

app.on("activate", () => {
  if (mainWindow === null) {
    // Re-creating requires knowing the port; for v1 this is acceptable
  }
});
