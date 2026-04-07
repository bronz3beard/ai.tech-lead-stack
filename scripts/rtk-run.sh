#!/bin/bash
# -----------------------------------------------------------------------------
# Script: rtk-run.sh
# Description: Enhances the global 'rtk' (Run Tool Kit) binary with 'run' and 
#              'list' commands by parsing 'rtk.tools' from package.json.
#              Supports both project-local and Tech-Lead Stack global tools.
# 
# Usage: 
#   rtk run <tool_name> [args...] - Executes a defined tool
#   rtk list                     - Lists all available tools
#
# Requirements:
#   - Node.js (used for JSON parsing and path resolution)
#   - rtk global binary
# -----------------------------------------------------------------------------

# Use BASH_SOURCE to reliably find the script's directory even when called via alias/symlink
SCRIPT_PATH="${BASH_SOURCE[0]}"
if [ -z "$SCRIPT_PATH" ]; then
    SCRIPT_PATH=$(realpath "$0" 2>/dev/null || echo "$0")
fi
SCRIPT_DIR=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)
STACK_PKG="$SCRIPT_DIR/../package.json"

# --- Command: rtk run <tool_name> ---
if [[ "$1" == "run" ]]; then
    TOOL_NAME=$2
    
    # Help handling
    if [[ "$TOOL_NAME" == "--help" || "$TOOL_NAME" == "-h" ]]; then
        echo "📖 RTK Tool Runner"
        echo "Usage: rtk run <tool_name> [args...]"
        echo ""
        echo "Execute a tool from 'rtk.tools' (checks project and Tech-Lead Stack)."
        echo "Use 'rtk list' to see all available tools."
        exit 0
    fi

    # Validation
    if [[ -z "$TOOL_NAME" ]]; then
        echo "❌ Error: Please specify a tool name. Use 'rtk list' to see available tools."
        exit 1
    fi

    # Logic: Extract command from package.json using Node.js
    # Priority: 
    # 1. Current working directory package.json (Project-local tools)
    # 2. Tech-Lead Stack package.json (Global framework tools)
    CMD=$(node -e "
        let toolCmd;
        let isFromStack = false;
        
        // 1. Check local project
        try {
            const pkg = require(process.cwd() + '/package.json');
            toolCmd = pkg.rtk && pkg.rtk.tools && pkg.rtk.tools['$TOOL_NAME'];
        } catch (e) {}

        // 2. Check Tech-Lead Stack (Fallback)
        if (!toolCmd) {
            try {
                const stackPkg = require('$STACK_PKG');
                toolCmd = stackPkg.rtk && stackPkg.rtk.tools && stackPkg.rtk.tools['$TOOL_NAME'];
                if (toolCmd) isFromStack = true;
            } catch (e) {}
        }
        
        if (toolCmd) {
            // Path Resolution Strategy:
            // If the tool is from the Stack, we must resolve its relative paths 
            // (like .scripts/ or templates/) to absolute paths relative to the Stack root.
            if (isFromStack) {
                const tlsRoot = require('path').resolve('$SCRIPT_DIR', '..');
                toolCmd = toolCmd.replace(/(^|\s)(\.ai\/|\.agents\/|\.?scripts\/|templates\/)/g, (match, prefix, path) => {
                    return prefix + tlsRoot + '/' + path;
                });
            }
            console.log(toolCmd);
        } else {
            process.exit(1);
        }
    " 2>/dev/null)

    if [[ $? -ne 0 || -z "$CMD" ]]; then
        echo "❌ Diagnosis: Tool '$TOOL_NAME' not found in package.json 'rtk.tools' section."
        echo "👉 Action: Check 'rtk list' for available commands or add it to your project root package.json."
        exit 1
    fi

    # Execution Phase
    echo "🚀 Executing RTK tool: $TOOL_NAME"
    
    # Argument handling: Pass everything after the tool name
    TOOL_ARGS="${@:3}"
    
    # Optimization: Use 'eval' for simple 'cat' commands to avoid subshell overhead,
    # otherwise use 'rtk sh -c' to benefit from rtk's token-saving output compression.
    if [[ "$CMD" == cat* ]]; then
        eval "$CMD $TOOL_ARGS"
    else
        rtk sh -c "$CMD $TOOL_ARGS"
    fi

# --- Command: rtk list ---
elif [[ "$1" == "list" ]]; then
    echo "📋 Available Agent Skills & Tools:"
    
    # Logic: Merge and display tools from both local and stack package.json
    node -e "
        let tools = {};
        
        // Load Stack tools
        try {
            const stackPkg = require('$STACK_PKG');
            if (stackPkg.rtk && stackPkg.rtk.tools) {
                Object.assign(tools, stackPkg.rtk.tools);
            }
        } catch (e) {}

        // Load and override with local project tools
        try {
            const localPkg = require(process.cwd() + '/package.json');
            if (localPkg.rtk && localPkg.rtk.tools) {
                Object.assign(tools, localPkg.rtk.tools);
            }
        } catch (e) {}

        // Pretty print results
        if (Object.keys(tools).length > 0) {
            Object.entries(tools).forEach(([name, cmd]) => {
                console.log('  - ' + name.padEnd(15) + ' -> ' + cmd);
            });
        } else {
            console.log('  (No tools defined in package.json)');
        }
    " 2>/dev/null

# --- Proxy: All other rtk commands ---
else
    # Allow rtk-run.sh to act as a transparent wrapper for other rtk commands 
    # (e.g., rtk chat, rtk help)
    rtk "$@"
fi
