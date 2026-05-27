# Idle Prompt Hook Integration

## Problem

AgentVille currently has two agent states: **busy** (working) and **idle** (sleeping). Both come from the Claude Code session file's `status` field. When Claude finishes a response and waits at the input prompt, the session status flips to "idle" and the agent immediately falls asleep in the visualization — even though the session is still active and waiting for user input.

Users want to distinguish "waiting for your input" from "truly dormant." A session at the prompt should look active, not asleep.

## Solution

Use Claude Code's `idle_prompt` notification hook to write a signal file. AgentVille reads this signal during its polling loop to distinguish "waiting for input" from "dormant."

## State Model

Three states instead of two:

| Session status | Signal file | Result status | Result action | Visual |
|---|---|---|---|---|
| `"busy"` | n/a | busy | thinking/reading/etc. | Walking + action emote |
| `"idle"` | exists, < 5 min old | busy | waiting | Standing + `?` speech bubble |
| `"idle"` | missing or > 5 min old | idle | idle | Sleeping zzz |

When the signal file is fresh, we override the session's "idle" to "busy" with action "waiting." The agent stays visually active at the prompt until it goes truly dormant (signal ages out after 5 minutes of no `idle_prompt` re-fires).

## Hook Mechanism

### Signal file

- **Path**: `/tmp/agentville/idle-prompt-<session_id>`
- **Content**: Unix timestamp in milliseconds (e.g., `1748350800000`)
- **Lifecycle**: Written/overwritten each time `idle_prompt` fires. Ages out naturally; no explicit cleanup needed.

### Hook script (`scripts/idle-prompt-hook.sh`)

```bash
#!/usr/bin/env bash
read -r INPUT
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
[ -n "$SESSION_ID" ] && mkdir -p /tmp/agentville && date +%s000 > "/tmp/agentville/idle-prompt-${SESSION_ID}"
```

### Claude Code configuration (`~/.claude/settings.json`)

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "bash <path-to-agentville>/scripts/idle-prompt-hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## Code Changes

### 1. New file: `scripts/idle-prompt-hook.sh`

Hook script that reads JSON from stdin, extracts `session_id`, writes timestamp to `/tmp/agentville/idle-prompt-<session_id>`.

### 2. `src/lib/providers/types.ts`

Add `"waiting"` to `NormalizedAction` union type.

### 3. `src/lib/types.ts`

Add `"waiting"` to `AgentAction` union type.

### 4. `src/lib/providers/claude-code.ts`

In `buildDiscoveredAgent()`, after determining `session.status === "idle"`:

1. Check for `/tmp/agentville/idle-prompt-<session.sessionId>`
2. If file exists and timestamp is < 5 min old → set status to `"busy"`, action to `"waiting"`
3. Otherwise → keep status `"idle"`, action `"idle"`

Add a helper: `readIdlePromptSignal(sessionId: string): number | null` that reads the signal file and returns the timestamp or null.

### 5. `src/app/api/agents/stream/route.ts`

In `toLegacyAction()`, map `"waiting"` NormalizedAction to `"waiting"` AgentAction.

### 6. `src/components/scene/AgentSprite.tsx`

When action is `"waiting"`:
- Agent stands (not walking, not sleeping)
- Show `?` emote in speech bubble
- Add `"waiting"` to `formatAction()` → returns `❓`

### 7. `src/components/ui/StatusBadge.tsx`

No change needed — status is "busy" when waiting, so the existing green "Busy" badge applies.

## Testing

- Unit test: `readIdlePromptSignal()` returns timestamp from valid file, null from missing/stale file
- Unit test: `buildDiscoveredAgent()` returns status "busy" + action "waiting" when signal is fresh
- Manual test: configure hook, run Claude Code, verify agent shows "waiting" state after Claude responds
