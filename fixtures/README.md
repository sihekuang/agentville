# Test Fixtures

Sample data used by the unit and integration tests in `tests/`. Not loaded at runtime.

| File | What it is | Consumed by |
|---|---|---|
| `session-busy.json` | A Claude Code session-status file with `status: "busy"` | `tests/lib/sessions.test.ts`, `tests/integration/smoke.test.ts` |
| `session-idle.json` | Same shape as above, with `status: "idle"` (reserved for idle-state tests) | — |
| `ide-lock.json` | A `~/.claude/ide/<port>.lock` payload for IDE host-app resolution (reserved for host-app tests) | — |
| `transcript-sample.jsonl` | Sample Claude Code transcript JSONL covering `assistant` lines (thinking, text, tool_use) | `tests/lib/transcript.test.ts`, `tests/integration/smoke.test.ts` |
| `codex-rollout-sample.jsonl` | Codex v0.135 rollout: `session_meta` + reasoning + `exec_command` (read / execute / `apply_patch`) + `write_stdin` + `update_plan` + assistant message | `tests/lib/codex-rollout.test.ts`, `tests/integration/codex.test.ts` |
| `codex-rollout-legacy.jsonl` | Codex v0.39 legacy rollout using the older `shell` tool with `command: string[]` (back-compat coverage) | `tests/lib/codex-rollout.test.ts` |
