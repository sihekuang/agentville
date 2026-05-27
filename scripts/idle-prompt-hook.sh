#!/usr/bin/env bash
read -r INPUT
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
[ -n "$SESSION_ID" ] && mkdir -p /tmp/agentville && date +%s000 > "/tmp/agentville/idle-prompt-${SESSION_ID}"
