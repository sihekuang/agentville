import type { HostApp } from "./providers/types";
export type { HostApp };

export interface RawSessionFile {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  procStart: string;
  version: string;
  peerProtocol: number;
  kind: string;
  entrypoint: string;
  status: "busy" | "idle" | "waiting" | "shell";
  updatedAt: number;
  waitingFor?: string;
}

export interface RawIdeLock {
  workspaceFolders: string[];
  pid: number;
  ideName: string;
  transport: string;
  authToken: string;
}
