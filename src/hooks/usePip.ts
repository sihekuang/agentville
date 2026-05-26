"use client";

import { usePipContext, type PipContextValue } from "@/contexts/PipContext";
import type { PipBackend } from "@/lib/pip-types";

export interface UsePipResult {
  supported: boolean;
  backend: PipBackend | null;
  active: boolean;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  toggle: () => Promise<void>;
  focusMain: () => void;
}

export function usePip(): UsePipResult {
  const ctx = usePipContext();

  return {
    supported: ctx.supported,
    backend: ctx.backendName === "none" ? null : (ctx.backendName as PipBackend),
    active: ctx.active,
    activate: ctx.activate,
    deactivate: ctx.deactivate,
    toggle: ctx.toggle,
    focusMain: ctx.focusMain,
  };
}
