"use client";

import { useMemo, type ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { PipProvider } from "@/contexts/PipContext";
import { detectBackend, type PipBackendAdapter } from "@/lib/pip-backend";
import { useHydratePersistedTheme } from "@/store/agents";

export interface ProvidersProps {
  children: ReactNode;
  pipBackend?: PipBackendAdapter;
}

export function Providers({ children, pipBackend }: ProvidersProps) {
  useHydratePersistedTheme();
  const backend = useMemo(() => pipBackend ?? detectBackend(), [pipBackend]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <PipProvider backend={backend}>{children}</PipProvider>
    </ThemeProvider>
  );
}
