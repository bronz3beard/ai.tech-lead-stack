#!/bin/bash
set -e

# Default paths
TLS_DIR="${TLS_DIR:-/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack}"
SLM_DIR="${SLM_DIR:-/Users/bz3b/Desktop/repos/small-language-model-gate}"
RELAY_DIR="${RELAY_DIR:-/Users/bz3b/Desktop/repos/voice-agent-relay}"

echo "=== Hello Ecosystem ==="

# 1. Ollama reachable and models present
echo -n "1. Checking Ollama and models... "
OLLAMA_RES=$(curl -s http://localhost:11434/api/tags || true)
if [ -z "$OLLAMA_RES" ]; then
    echo -e "\033[31mFAIL (Ollama not reachable)\033[0m"
    exit 1
fi
if ! echo "$OLLAMA_RES" | grep -q "qwen3.5:9b"; then
    echo -e "\033[31mFAIL (qwen3.5:9b not found)\033[0m"
    exit 1
fi
if ! echo "$OLLAMA_RES" | grep -q "qwen2.5-coder:3b"; then
    echo -e "\033[31mFAIL (qwen2.5-coder:3b not found)\033[0m"
    exit 1
fi
echo -e "\033[32mPASS\033[0m"

# 2. Build MCP server
echo -n "2. Building MCP server in TLS_DIR... "
cd "$TLS_DIR"
if pnpm run mcp:build >/dev/null 2>&1; then
    echo -e "\033[32mPASS\033[0m"
else
    echo -e "\033[31mFAIL\033[0m"
    exit 1
fi

# 3. Build SLM gate and run E2E
echo -n "3. Building SLM gate and running E2E... "
cd "$SLM_DIR"
if pnpm run build >/dev/null 2>&1 && TLS_DIST="$TLS_DIR/dist/mcp-server.mjs" pnpm run e2e:tls-downstream >/dev/null 2>&1; then
    echo -e "\033[32mPASS\033[0m"
else
    echo -e "\033[31mFAIL\033[0m"
    exit 1
fi

# 4. SLM gate doctor
echo -n "4. SLM gate doctor check... "
cd "$SLM_DIR"
if node dist/cli.js doctor | grep -q "READY"; then
    echo -e "\033[32mPASS\033[0m"
else
    echo -e "\033[31mFAIL\033[0m"
    exit 1
fi

# 5. Boot Relay and run checks
echo "5. Booting Relay and running checks..."
cd "$RELAY_DIR"
lsof -ti :4601 | xargs kill -9 2>/dev/null || true
sleep 1
pnpm start > relay_e2e_hello.log 2>&1 &
RELAY_PID=$!
sleep 5

HOST="http://localhost:4601"
T="my-secret-token"
FAIL=0

echo -n "   - Checking health... "
if curl -f -s "$HOST/health" >/dev/null; then echo -e "\033[32mPASS\033[0m"; else echo -e "\033[31mFAIL\033[0m"; FAIL=1; fi

echo -n "   - Checking skills... "
if curl -f -s -H "x-relay-token: $T" "$HOST/skills" >/dev/null; then echo -e "\033[32mPASS\033[0m"; else echo -e "\033[31mFAIL\033[0m"; FAIL=1; fi

echo -n "   - Checking projects... "
if curl -f -s -H "x-relay-token: $T" "$HOST/projects" >/dev/null; then echo -e "\033[32mPASS\033[0m"; else echo -e "\033[31mFAIL\033[0m"; FAIL=1; fi

echo -n "   - Checking command (iris)... "
if curl -f -s -H "x-relay-token: $T" -H 'content-type: application/json' -d '{"transcript":"what does this repo do","mode":"iris","backend":"local"}' "$HOST/command" >/dev/null; then echo -e "\033[32mPASS\033[0m"; else echo -e "\033[31mFAIL\033[0m"; FAIL=1; fi

kill -9 $RELAY_PID 2>/dev/null || true

if [ $FAIL -eq 1 ]; then
    echo -e "\n\033[31m=== SUMMARY: FAIL ===\033[0m"
    exit 1
fi

echo -e "\n\033[32m=== SUMMARY: ALL PASS ===\033[0m"
exit 0
