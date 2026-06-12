"use client";

import { useEffect, useState } from "react";

/**
 * Current epoch ms, re-rendering the caller every `intervalMs`.
 *
 * For time-dependent display state (e.g. the ⏳ long-running marker) that
 * must change even when no agent data changes: the agent stream only emits
 * on diffs, so a quiet scene would otherwise never re-evaluate.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
