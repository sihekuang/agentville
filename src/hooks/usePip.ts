"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import {
  PIP_CONFIG,
  getElectronAPI,
  type PipBackend,
  type ElectronPipAPI,
} from "@/lib/pip-types";

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
  if (getElectronAPI()) return "electron";
  if ("documentPictureInPicture" in window) return "browser";
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
    const api = getElectronAPI() as ElectronPipAPI;
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
      getElectronAPI()?.pipActivate();
    } else if (backend === "browser") {
      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: PIP_CONFIG.WIDTH,
          height: PIP_CONFIG.HEIGHT,
        });
        pipWindowRef.current = pipWin;

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

        pipWin.addEventListener("pagehide", () => {
          if (store.getState().pipActive) {
            pipWindowRef.current = null;
            setPipActive(false);
          }
        });

        setPipActive(true);
      } catch (err) {
        console.error("[PIP] Failed to open browser PIP window:", err);
      }
    }
  }, [backend, pipActive, setPipActive]);

  const deactivate = useCallback(async () => {
    if (!store.getState().pipActive) return;

    if (backend === "electron") {
      getElectronAPI()?.pipDeactivate();
    } else if (backend === "browser") {
      const win = pipWindowRef.current;
      pipWindowRef.current = null;
      setPipActive(false);
      setTimeout(() => win?.close(), PIP_CONFIG.REDOCK_DELAY_MS);
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
