"use client";

// Flag-gated debug overlay for the PiP hover-expand feature. Renders nothing
// unless debug is enabled (see src/lib/pip-debug.ts). When on, it surfaces the
// hook/resizer log lines plus mouse enter/leave and the live PiP window size, so
// the feature can be diagnosed from inside the (console-less) PiP window.

import { useEffect, useState } from "react";
import { isPipDebugEnabled, setPipDebugSink } from "@/lib/pip-debug";

export function PipHoverDebug() {
  const [enabled, setEnabled] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!isPipDebugEnabled()) return;
    setEnabled(true);

    const push = (m: string) => {
      const t = new Date();
      const ts =
        `${String(t.getSeconds()).padStart(2, "0")}.` +
        `${String(t.getMilliseconds()).padStart(3, "0")}`;
      setLog((l) => [...l.slice(-9), `${ts} ${m}`]);
    };
    setPipDebugSink(push);

    const cleanups: Array<() => void> = [() => setPipDebugSink(null)];
    const attach = (label: string, doc: Document) => {
      const onEnter = () => push(`${label} ENTER`);
      const onLeave = () => push(`${label} LEAVE`);
      doc.documentElement.addEventListener("mouseenter", onEnter);
      doc.documentElement.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        doc.documentElement.removeEventListener("mouseenter", onEnter);
        doc.documentElement.removeEventListener("mouseleave", onLeave);
      });
    };

    attach("doc", document);
    try {
      if (window.top && window.top !== window.self) {
        attach("top", window.top.document);
      }
    } catch {
      /* cross-origin top — ignore */
    }

    // Poll the actual PiP window size to confirm resizes land.
    let last = "";
    const poll = setInterval(() => {
      const cur = `${window.outerWidth}x${window.outerHeight}`;
      if (cur !== last) {
        last = cur;
        push(`size: ${cur}`);
      }
    }, 150);
    cleanups.push(() => clearInterval(poll));

    push("debug ready");
    return () => cleanups.forEach((c) => c());
  }, []);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.82)",
        color: "#39ff14",
        font: "10px/1.3 monospace",
        padding: "4px 6px",
        pointerEvents: "none",
        whiteSpace: "pre",
        maxWidth: "100%",
      }}
    >
      {log.length ? log.join("\n") : "pip debug…"}
    </div>
  );
}
