"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { PipProvider } from "@/contexts/PipContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <PipProvider>{children}</PipProvider>
    </ThemeProvider>
  );
}
