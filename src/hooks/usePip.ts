"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agents";

type PipBackend = "electron" | "browser";

interface ElectronAPI {
  pipActivate: () => void;
  pipDeactivate: () => void;
  onPipActivated: (callback: () => void) => () => void;
  onPipDeactivated: (callback: () => void) => () => void;
}

export interface UsePipResult {
  supported: boolean;
  backend: PipBackend | null;
  active: boolean;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  toggle: () => Promise<void>;
}

function getBackend(): PipBackend | null {
  if (typeof window === "undefined") return null;
  if ("electronAPI" in window && (window as any).electronAPI?.pipActivate) {
    return "electron";
  }
  if ("documentPictureInPicture" in window) {
    return "browser";
  }
  return null;
}

export function usePip(): UsePipResult {
  const pipActive = useAgentStore((s) => s.pipActive);
  const setPipActive = useAgentStore((s) => s.setPipActive);
  const store = useAgentStore;
  const pipWindowRef = useRef<Window | null>(null);
  const backend = getBackend();

  useEffect(() => {
    if (backend !== "electron") return;
    const api = (window as any).electronAPI as ElectronAPI;
    const offActivated = api.onPipActivated(() => setPipActive(true));
    const offDeactivated = api.onPipDeactivated(() => setPipActive(false));
    return () => {
      offActivated();
      offDeactivated();
    };
  }, [backend, setPipActive]);

  const activate = useCallback(async () => {
    // Read current state directly from store to avoid stale closure issues
    if (store.getState().pipActive) return;

    if (backend === "electron") {
      const api = (window as any).electronAPI as ElectronAPI;
      api.pipActivate();
    } else if (backend === "browser") {
      const pipWin = await (window as any).documentPictureInPicture.requestWindow({
        width: 400,
        height: 300,
      });
      pipWindowRef.current = pipWin;

      for (const sheet of document.styleSheets) {
        try {
          if (sheet.href) {
            const link = pipWin.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pipWin.document.head.appendChild(link);
          } else if (sheet.cssRules) {
            const style = pipWin.document.createElement("style");
            for (const rule of sheet.cssRules) {
              style.textContent += rule.cssText;
            }
            pipWin.document.head.appendChild(style);
          }
        } catch {
          // CORS stylesheet — skip
        }
      }

      if (document.documentElement.classList.contains("dark")) {
        pipWin.document.documentElement.classList.add("dark");
      }

      window.dispatchEvent(
        new CustomEvent("pip:window-ready", { detail: { pipWindow: pipWin } })
      );

      pipWin.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipActive(false);
      });

      setPipActive(true);
    }
  }, [backend, pipActive, setPipActive]);

  const deactivate = useCallback(async () => {
    // Read current state directly from store to avoid stale closure issues
    if (!store.getState().pipActive) return;

    if (backend === "electron") {
      const api = (window as any).electronAPI as ElectronAPI;
      api.pipDeactivate();
    } else if (backend === "browser") {
      pipWindowRef.current?.close();
      pipWindowRef.current = null;
      setPipActive(false);
    }
  }, [backend, pipActive, setPipActive]);

  const toggle = useCallback(async () => {
    // Read current state directly from store to avoid stale closure issues
    if (store.getState().pipActive) {
      await deactivate();
    } else {
      await activate();
    }
  }, [store, activate, deactivate]);

  return {
    supported: backend !== null,
    backend,
    active: pipActive,
    activate,
    deactivate,
    toggle,
  };
}
