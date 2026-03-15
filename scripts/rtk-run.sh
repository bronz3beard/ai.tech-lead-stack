#!/bin/bash
# scripts/rtk-run.sh
# Enhances the global 'rtk' tool with 'run' and 'list' capabilities from package.json

# Requirement: node (available in this environment)

SCRIPT_PATH=$(realpath "$0" 2>/dev/null || echo "$0")
SCRIPT_DIR=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)
STACK_PKG="$SCRIPT_DIR/../package.json"

if [[ "$1" == "run" ]]; then
    TOOL_NAME=$2
    if [[ -z "$TOOL_NAME" ]]; then
        echo "❌ Error: Please specify a tool name. Use 'rtk list' to see available tools."
        exit 1
    fi

    # Extract command from package.json using node
    # Checks target project package.json first, falls back to tech-lead-stack package.json
    CMD=$(node -e "
        let toolCmd;
        try {
            const pkg = require(process.cwd() + '/package.json');
            toolCmd = pkg.rtk && pkg.rtk.tools && pkg.rtk.tools['$TOOL_NAME'];
        } catch (e) {}

        if (!toolCmd) {
            try {
                const stackPkg = require('$STACK_PKG');
                toolCmd = stackPkg.rtk && stackPkg.rtk.tools && stackPkg.rtk.tools['$TOOL_NAME'];
            } catch (e) {}
        }
        
        if (toolCmd) console.log(toolCmd);
        else process.exit(1);
    " 2>/dev/null)

    if [[ $? -ne 0 || -z "$CMD" ]]; then
        echo "❌ Error: Tool '$TOOL_NAME' not found in package.json rtk.tools section."
        exit 1
    fi

    echo "🚀 Executing RTK tool: $TOOL_NAME"
    # We execute with rtk prefixing to ensure token savings if the tool produces output
    # but we check if it's a 'cat' or 'node' command and decide whether to prefix
    if [[ "$CMD" == cat* ]]; then
        eval "$CMD"
    else
        rtk sh -c "$CMD"
    fi

elif [[ "$1" == "list" ]]; then
    echo "📋 Available Agent Skills & Tools:"
    node -e "
        let tools = {};
        try {
            const stackPkg = require('$STACK_PKG');
            if (stackPkg.rtk && stackPkg.rtk.tools) {
                Object.assign(tools, stackPkg.rtk.tools);
            }
        } catch (e) {}

        try {
            const localPkg = require(process.cwd() + '/package.json');
            if (localPkg.rtk && localPkg.rtk.tools) {
                Object.assign(tools, localPkg.rtk.tools);
            }
        } catch (e) {}

        if (Object.keys(tools).length > 0) {
            Object.entries(tools).forEach(([name, cmd]) => {
                console.log('  - ' + name.padEnd(15) + ' -> ' + cmd);
            });
        } else {
            console.log('  (No tools defined in package.json)');
        }
    " 2>/dev/null
else
    # Proxy all other commands directly to the global rtk binary
    rtk "$@"
fi
