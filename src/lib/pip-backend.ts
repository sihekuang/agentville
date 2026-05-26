import { PIP_CONFIG, getElectronAPI } from "./pip-types";

export interface PipBackendAdapter {
  readonly name: string;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  focusMain(): void;
  subscribe(
    onActivated: () => void,
    onDeactivated: () => void,
  ): () => void;
}

export class ElectronPipBackend implements PipBackendAdapter {
  readonly name = "electron";

  activate(): Promise<void> {
    getElectronAPI()?.pipActivate();
    return Promise.resolve();
  }

  deactivate(): Promise<void> {
    getElectronAPI()?.pipDeactivate();
    return Promise.resolve();
  }

  focusMain(): void {
    getElectronAPI()?.pipFocusMain();
  }

  subscribe(onActivated: () => void, onDeactivated: () => void): () => void {
    const api = getElectronAPI();
    if (!api) return () => {};
    const offActivated = api.onPipActivated(onActivated);
    const offDeactivated = api.onPipDeactivated(onDeactivated);
    return () => {
      offActivated();
      offDeactivated();
    };
  }
}

export class BrowserPipBackend implements PipBackendAdapter {
  readonly name = "browser";
  private pipWindow: Window | null = null;

  async activate(): Promise<void> {
    const pipWin = await (window as any).documentPictureInPicture.requestWindow({
      width: PIP_CONFIG.WIDTH,
      height: PIP_CONFIG.HEIGHT,
    });
    this.pipWindow = pipWin;

    const pipDoc = pipWin.document;
    pipDoc.documentElement.style.height = "100%";
    pipDoc.body.style.margin = "0";
    pipDoc.body.style.overflow = "hidden";
    pipDoc.body.style.height = "100%";

    const iframe = pipDoc.createElement("iframe");
    iframe.src = PIP_CONFIG.PIP_ROUTE;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    pipDoc.body.appendChild(iframe);
  }

  deactivate(): Promise<void> {
    const win = this.pipWindow;
    this.pipWindow = null;
    setTimeout(() => win?.close(), PIP_CONFIG.REDOCK_DELAY_MS);
    return Promise.resolve();
  }

  focusMain(): void {
    // Browser PIP has no reliable way to focus the opener tab
  }

  subscribe(_onActivated: () => void, onDeactivated: () => void): () => void {
    const handler = () => {
      this.pipWindow = null;
      onDeactivated();
    };

    const checkWindow = () => {
      if (this.pipWindow) {
        this.pipWindow.addEventListener("pagehide", handler);
      }
    };

    const interval = setInterval(checkWindow, 100);
    checkWindow();

    return () => {
      clearInterval(interval);
      this.pipWindow?.removeEventListener("pagehide", handler);
    };
  }
}

export class NullPipBackend implements PipBackendAdapter {
  readonly name = "none";
  activate(): Promise<void> { return Promise.resolve(); }
  deactivate(): Promise<void> { return Promise.resolve(); }
  focusMain(): void {}
  subscribe(): () => void { return () => {}; }
}

export type PipBackendName = "electron" | "browser" | "none";

export function detectBackend(): PipBackendAdapter {
  if (typeof window === "undefined") return new NullPipBackend();
  if (getElectronAPI()) return new ElectronPipBackend();
  if ("documentPictureInPicture" in window) return new BrowserPipBackend();
  return new NullPipBackend();
}
