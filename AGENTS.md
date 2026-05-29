<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture principles

Apply these to all code in this repo, regardless of which agent (Claude Code, Codex, …) is writing it.

## One uniform agent interface

Every agent — regardless of its source (Claude Code, Codex, future tools) — is represented by a **single shared interface**: `Agent` (`src/lib/providers/types.ts`), using the neutral `NormalizedAction` vocabulary. Do NOT introduce source-specific agent types in the store, UI, or API routes, and do NOT branch on a provider's name in consumer code. (The legacy, Claude-specific `AgentState`/`AgentAction` in `src/lib/types.ts` is deprecated and being removed — write new code against `Agent` only.)

`Agent.id` is `<provider>:<sessionId>` (e.g. `codex:019e74c2-…`). AgentVille **never generates** it — the raw `<sessionId>` is read from the underlying tool (Claude session file / Codex rollout filename) and the provider prefix is prepended via `makeAgentId`. Use `parseAgentId` to split it; the prefix lets the registry route id-based operations (e.g. focus) to the owning provider.

## Datasources are pluggable (Open/Closed)

A new agent source is added by implementing the `AgentProvider` interface (`src/lib/providers/provider.ts`) and registering it in `ProviderRegistry` (`src/lib/providers/registry.ts`) — **never** by modifying the stream route, store, or scene. Consumers depend on the `AgentProvider` / `Agent` abstractions, not on concrete providers.

## SOLID

- **S — Single responsibility:** keep enumeration, transcript parsing, action normalization, and host resolution in separate units. One module, one job; if a file grows to do several things, split it.
- **O — Open/closed:** extend behavior by adding a provider and registering it; don't edit existing consumers to special-case a source.
- **L — Liskov substitution:** every provider must be fully substitutable behind `AgentProvider`; consumer code must never inspect or switch on the provider name.
- **I — Interface segregation:** keep interfaces small and focused (`AgentProvider` stays thin). Don't force implementers to supply things a particular source doesn't have.
- **D — Dependency inversion:** high-level code depends on abstractions, not concretions. Inject side-effecting dependencies (process scans, PID-liveness checks, fs, clock) so units are testable with fixtures and no real processes — e.g. `discoverSessions(dir, isPidAlive)`.
