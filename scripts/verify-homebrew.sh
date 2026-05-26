#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0
SKIP=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
skip() { echo "  SKIP: $1"; SKIP=$((SKIP + 1)); }

echo "=== AgentVille Homebrew Verification ==="
echo ""

# 1. Check formula file exists
echo "[1/8] Checking Homebrew formula..."
if [ -f "$PROJECT_DIR/homebrew/agentville.rb" ]; then
  pass "Formula file exists at homebrew/agentville.rb"
else
  fail "Formula file missing"
fi

# 2. Check bin launcher exists and is executable
echo "[2/8] Checking launcher script..."
if [ -f "$PROJECT_DIR/bin/agentville" ]; then
  pass "Launcher script exists at bin/agentville"
else
  fail "Launcher script missing"
fi

if [ -x "$PROJECT_DIR/bin/agentville" ]; then
  pass "Launcher script is executable"
else
  fail "Launcher script is not executable"
fi

# 3. Check default port is NOT 3000
echo "[3/8] Checking default port..."
DEFAULT_PORT=$(grep 'AGENTVILLE_PORT:-' "$PROJECT_DIR/bin/agentville" 2>/dev/null | sed 's/.*AGENTVILLE_PORT:-\([0-9]*\).*/\1/' || echo "")
if [ -n "$DEFAULT_PORT" ] && [ "$DEFAULT_PORT" != "3000" ]; then
  pass "Default port is $DEFAULT_PORT (not 3000)"
else
  fail "Default port is 3000 or not set"
fi

# 4. Check formula doesn't configure port 3000
echo "[4/8] Checking formula for port 3000 as a configured value..."
if grep -E '(PORT.*=.*3000|"3000"|:3000)' "$PROJECT_DIR/homebrew/agentville.rb" 2>/dev/null | grep -vq '#'; then
  fail "Formula configures port 3000"
else
  pass "Formula does not configure port 3000"
fi

# 5. Check package.json has bin entry
echo "[5/8] Checking package.json bin entry..."
if grep -q '"bin"' "$PROJECT_DIR/package.json"; then
  pass "package.json has bin entry"
else
  fail "package.json missing bin entry"
fi

# 6. Check start script uses AGENTVILLE_PORT
echo "[6/8] Checking start script port configuration..."
if grep -q 'AGENTVILLE_PORT' "$PROJECT_DIR/package.json"; then
  pass "package.json start script references AGENTVILLE_PORT"
else
  skip "package.json start script does not reference AGENTVILLE_PORT (uses bin/agentville instead)"
fi

# 7. Verify the app builds
echo "[7/8] Verifying app builds..."
cd "$PROJECT_DIR"
if npm run build > /dev/null 2>&1; then
  pass "App builds successfully"
else
  fail "App build failed"
fi

# 8. Verify the app starts on the correct port (quick smoke test)
echo "[8/8] Smoke testing app startup..."
TEST_PORT=4200
if [ -f "$PROJECT_DIR/.next/standalone/server.js" ]; then
  PORT=$TEST_PORT node "$PROJECT_DIR/.next/standalone/server.js" &
  SERVER_PID=$!

  # Wait for server to be ready
  READY=false
  for i in $(seq 1 15); do
    if curl -s "http://localhost:$TEST_PORT" > /dev/null 2>&1; then
      READY=true
      break
    fi
    sleep 1
  done

  if [ "$READY" = true ]; then
    RESPONSE=$(curl -s "http://localhost:$TEST_PORT")
    if echo "$RESPONSE" | grep -qi "agentville\|__next"; then
      pass "App responds on port $TEST_PORT"
    else
      fail "App responded but content doesn't look like AgentVille"
    fi

    # Verify port 3000 is NOT in use by our app
    if curl -s "http://localhost:3000" > /dev/null 2>&1; then
      # Something is on 3000, check if it's our server
      if kill -0 $SERVER_PID 2>/dev/null; then
        fail "App appears to also be listening on port 3000"
      else
        skip "Port 3000 is in use by another process (not ours)"
      fi
    else
      pass "Port 3000 is not in use by our app"
    fi
  else
    fail "App did not start within 15 seconds on port $TEST_PORT"
  fi

  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
else
  fail "Standalone server.js not found (build may have failed)"
fi

echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Skipped: $SKIP"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "VERIFICATION FAILED"
  exit 1
else
  echo "VERIFICATION PASSED"
  exit 0
fi
