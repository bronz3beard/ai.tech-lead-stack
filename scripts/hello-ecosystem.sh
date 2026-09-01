#!/bin/bash
set -e

# hello-ecosystem.sh - One-shot runbook to boot and verify the local ecosystem

# Default absolute paths
TLS_DIR="${TLS_DIR:-/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack}"
SLM_DIR="${SLM_DIR:-/Users/bz3b/Desktop/repos/small-language-model-gate}"
RELAY_DIR="${RELAY_DIR:-/Users/bz3b/Desktop/repos/voice-agent-relay}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Hello Ecosystem: Boot & Smoke Test ==="

# Helper for PASS/FAIL
run_step() {
  local step_name="$1"
  local cmd="$2"
  
  echo "=> Running: $step_name"
  # Use bash -c to evaluate the command string properly
  if bash -c "$cmd"; then
    echo -e "${GREEN}[PASS]${NC} $step_name\n"
  else
    echo -e "${RED}[FAIL]${NC} $step_name\n"
    exit 1
  fi
}

# 1. Check Ollama
run_step "Check Ollama reachable and models present" "curl -s http://127.0.0.1:11434/api/tags | grep -q 'qwen3.5:9b' && curl -s http://127.0.0.1:11434/api/tags | grep -q 'qwen2.5-coder:3b'"

# 2. Build TLS MCP
run_step "Build Tech-Lead Stack MCP" "cd $TLS_DIR && pnpm run mcp:build"

# 3. Build & test SLM Gate E2E Downstream
run_step "Build SLM Gate and run E2E TLS Downstream" "cd $SLM_DIR && pnpm run build && TLS_DIST=$TLS_DIR pnpm run e2e:tls-downstream"

# 4. SLM Gate Doctor
run_step "SLM Gate Doctor (Expect READY)" "cd $SLM_DIR && node dist/cli.js doctor | grep -q 'READY'"

# 5. Boot Relay and run smoke tests
run_step "Boot Relay & run smoke tests" "
  cd $RELAY_DIR
  
  # Start the relay in the background with the fast E2E model
  E2E_OLLAMA_MODEL=qwen2.5-coder:3b pnpm start > relay_e2e.log 2>&1 &
  RELAY_PID=\$!
  
  # Ensure relay shuts down if script exits unexpectedly
  trap 'kill -9 \$RELAY_PID 2>/dev/null || true' EXIT
  
  # Wait for server to be ready
  echo 'Waiting for Voice Relay server to boot...'
  for i in {1..15}; do
    if curl -s http://localhost:4601/health >/dev/null; then
      break
    fi
    sleep 1
  done
  
  # Run the smoke script
  if ./scripts/smoke.sh; then
    kill -9 \$RELAY_PID 2>/dev/null || true
    trap - EXIT
    true
  else
    echo -e \"\\n=== Relay Logs ===\"
    cat relay_e2e.log
    kill -9 \$RELAY_PID 2>/dev/null || true
    trap - EXIT
    false
  fi
"

echo -e "${GREEN}=== ECOSYSTEM SMOKE TEST: ALL PASSED ===${NC}"
