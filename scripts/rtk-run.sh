#!/bin/bash
# scripts/rtk-run.sh
# Enhances the global 'rtk' tool with 'run' and 'list' capabilities from package.json

# Requirement: node (available in this environment)

if [[ "$1" == "run" ]]; then
    TOOL_NAME=$2
    if [[ -z "$TOOL_NAME" ]]; then
        echo "❌ Error: Please specify a tool name. Use 'rtk list' to see available tools."
        exit 1
    fi

    # Extract command from package.json using node
    CMD=$(node -e "
        try {
            const pkg = require('./package.json');
            const toolCmd = pkg.rtk && pkg.rtk.tools && pkg.rtk.tools['$TOOL_NAME'];
            if (toolCmd) console.log(toolCmd);
            else process.exit(1);
        } catch (e) {
            process.exit(1);
        }
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
    echo "📋 Available Agent Skills & Tools (from package.json):"
    node -e "
        try {
            const pkg = require('./package.json');
            const tools = pkg.rtk && pkg.rtk.tools;
            if (tools) {
                Object.entries(tools).forEach(([name, cmd]) => {
                    console.log('  - ' + name.padEnd(15) + ' -> ' + cmd);
                });
            } else {
                console.log('  (No tools defined in package.json)');
            }
        } catch (e) {
            console.error('  (Error reading package.json)');
        }
    "
else
    # Proxy all other commands directly to the global rtk binary
    rtk "$@"
fi
