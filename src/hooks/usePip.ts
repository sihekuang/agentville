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

      // Embed the /pip route as an iframe — it's a full Next.js page
      // with theme provider, PixiJS, and agent streaming built in.
      const pipDoc = pipWin.document;
      pipDoc.documentElement.style.height = "100%";
      pipDoc.body.style.margin = "0";
      pipDoc.body.style.overflow = "hidden";
      pipDoc.body.style.height = "100%";

      const iframe = pipDoc.createElement("iframe");
      iframe.src = "/pip";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.display = "block";
      pipDoc.body.appendChild(iframe);

      pipWin.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipActive(false);
      });

      setPipActive(true);
    }
  }, [backend, pipActive, setPipActive]);

  const deactivate = useCallback(async () => {
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
