"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { detectBackend, type PipBackendAdapter } from "@/lib/pip-backend";

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

export function PipProvider({ children }: { children: ReactNode }) {
  const backendRef = useRef<PipBackendAdapter | null>(null);
  const [active, setActive] = useState(false);
  const [backendName, setBackendName] = useState("none");

  useEffect(() => {
    const backend = detectBackend();
    backendRef.current = backend;
    setBackendName(backend.name);

    const unsubscribe = backend.subscribe(
      () => setActive(true),
      () => setActive(false),
    );

    return unsubscribe;
  }, []);

  const activate = useCallback(async () => {
    if (active) return;
    try {
      await backendRef.current?.activate();
      if (backendRef.current?.name === "browser") {
        setActive(true);
      }
    } catch (err) {
      console.error("[PIP] Failed to activate:", err);
    }
  }, [active]);

  const deactivate = useCallback(async () => {
    if (!active) return;
    await backendRef.current?.deactivate();
    if (backendRef.current?.name === "browser") {
      setActive(false);
    }
  }, [active]);

  const toggle = useCallback(async () => {
    if (active) {
      await deactivate();
    } else {
      await activate();
    }
  }, [active, activate, deactivate]);

  const focusMain = useCallback(() => {
    backendRef.current?.focusMain();
  }, []);

  const value = useMemo<PipContextValue>(
    () => ({
      supported: backendName !== "none",
      backendName,
      active,
      activate,
      deactivate,
      toggle,
      focusMain,
    }),
    [backendName, active, activate, deactivate, toggle, focusMain],
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
