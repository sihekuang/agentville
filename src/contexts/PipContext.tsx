"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PipBackendAdapter } from "@/lib/pip-backend";

export interface PipContextValue {
  supported: boolean;
  backendName: string;
  active: boolean;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  toggle: () => Promise<void>;
  focusMain: () => void;
}

const PipContext = createContext<PipContextValue | null>(null);

export interface PipProviderProps {
  backend: PipBackendAdapter;
  children: ReactNode;
}

export function PipProvider({ backend, children }: PipProviderProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const unsubscribe = backend.subscribe(
      () => setActive(true),
      () => setActive(false),
    );
    return unsubscribe;
  }, [backend]);

  const activate = useCallback(async () => {
    if (active) return;
    try {
      await backend.activate();
      if (backend.name === "browser") {
        setActive(true);
      }
    } catch (err) {
      console.error("[PIP] Failed to activate:", err);
    }
  }, [active, backend]);

  const deactivate = useCallback(async () => {
    if (!active) return;
    await backend.deactivate();
    if (backend.name === "browser") {
      setActive(false);
    }
  }, [active, backend]);

  const toggle = useCallback(async () => {
    if (active) {
      await deactivate();
    } else {
      await activate();
    }
  }, [active, activate, deactivate]);

  const focusMain = useCallback(() => {
    backend.focusMain();
  }, [backend]);

  const value = useMemo<PipContextValue>(
    () => ({
      supported: backend.name !== "none",
      backendName: backend.name,
      active,
      activate,
      deactivate,
      toggle,
      focusMain,
    }),
    [backend.name, active, activate, deactivate, toggle, focusMain],
  );

  return <PipContext value={value}>{children}</PipContext>;
}

export function usePipContext(): PipContextValue {
  const ctx = useContext(PipContext);
  if (!ctx) {
    throw new Error("usePipContext must be used within a PipProvider");
  }
  return ctx;
}
