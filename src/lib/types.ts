export interface AgentState {
  sessionId: string;
  pid: number;
  cwd: string;
  status: "busy" | "idle";
  currentAction: AgentAction;
  lastToolName: string | null;
  subagents: AgentState[];
  hostApp: HostApp | null;
  startedAt: number;
  recentActions: TranscriptEntry[];
}

export type AgentAction =
  | "thinking"
  | "tool:Read"
  | "tool:Edit"
  | "tool:Bash"
  | "tool:Write"
  | "tool:Agent"
  | "tool:other"
  | "writing"
  | "idle";

export interface HostApp {
  type: "terminal" | "ide";
  name: string;
  pid: number;
  cwd: string;
}

export interface TranscriptEntry {
  timestamp: number;
  type: "tool_use" | "thinking" | "text" | "subagent_start" | "subagent_stop";
  summary: string;
}

export interface StreamEvent {
  event: "agent-added" | "agent-removed" | "agent-updated";
  agent: AgentState;
}

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
  status: "busy" | "idle";
  updatedAt: number;
}

export interface RawIdeLock {
  workspaceFolders: string[];
  pid: number;
  ideName: string;
  transport: string;
  authToken: string;
}
