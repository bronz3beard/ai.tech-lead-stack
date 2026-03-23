#!/bin/bash
# tech-lead-stack installer

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [[ "${1:-}" != "--link" ]]; then
    echo "Usage: ./install.sh --link [--ide auto|cursor|none] [target_path]"
    exit 1
fi
shift

IDE_MODE="auto"
TARGET_DIR=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ide)
            if [[ -z "${2:-}" ]]; then
                echo "Error: --ide requires a value (auto, cursor, or none)."
                exit 1
            fi
            IDE_MODE="$2"
            shift 2
            ;;
        *)
            TARGET_DIR=$(realpath "$1")
            shift
            ;;
    esac
done

[[ -z "$TARGET_DIR" ]] && TARGET_DIR=$(realpath ".")

case "$IDE_MODE" in
    auto|cursor|none) ;;
    *)
        echo "Error: --ide must be auto, cursor, or none (got: $IDE_MODE)"
        exit 1
        ;;
esac

should_install_cursor_skills() {
    case "$IDE_MODE" in
        cursor) return 0 ;;
        none) return 1 ;;
        auto)
            if [[ -n "${CURSOR_TRACE_ID:-}" ]] || [[ -n "${CURSOR_AGENT:-}" ]]; then
                return 0
            fi
            return 1
            ;;
    esac
}

setup_cursor_skills() {
    local manifest="$SOURCE_DIR/.ai/cursor-skills.manifest"
    if [[ ! -f "$manifest" ]]; then
        echo "⚠️  Cursor skills manifest not found at $manifest — skipping."
        return
    fi

    mkdir -p "$HOME/.cursor/skills"

    echo "🎯 Installing Cursor skills under $HOME/.cursor/skills (symlinks to this repo)..."
    local line dir rel src dest_dir count=0
    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "${line//[[:space:]]/}" ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        dir=$(echo "$line" | cut -d'|' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        rel=$(echo "$line" | cut -d'|' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        [[ -z "$dir" || -z "$rel" ]] && continue

        src="$SOURCE_DIR/$rel"
        if [[ ! -f "$src" ]]; then
            echo "   ⚠️  Missing source for Cursor skill '$dir': $src"
            continue
        fi

        dest_dir="$HOME/.cursor/skills/$dir"
        mkdir -p "$dest_dir"
        ln -sfn "$src" "$dest_dir/SKILL.md"
        echo "   ✅ $dir → $rel"
        count=$((count + 1))
    done < "$manifest"

    echo "   📌 Linked $count skill(s). Re-run install if you move the tech-lead-stack repo."
}

setup_cursor_mcp_environment() {
    local mcp_file="$HOME/.cursor/mcp.json"

    if ! command -v jq &> /dev/null; then
        echo "   ⚠️  jq not found — skipping Cursor MCP JSON merge."
        return
    fi

    mkdir -p "$(dirname "$mcp_file")"

    if [[ -f "$mcp_file" ]] && grep -q "tech-lead-stack" "$mcp_file" 2>/dev/null; then
        echo "   - Cursor MCP already references tech-lead-stack."
        return
    fi

    if [[ -f "$mcp_file" ]]; then
        jq --arg cmd "npm" \
           --arg prefix "$SOURCE_DIR" \
           '.mcpServers = (.mcpServers // {}) | .mcpServers["tech-lead-stack"] = {"command": $cmd, "args": ["--prefix", $prefix, "--silent", "run", "mcp:start"]}' \
           "$mcp_file" > /tmp/mcp_cursor_tls.json && mv /tmp/mcp_cursor_tls.json "$mcp_file"
    else
        jq -n --arg cmd "npm" \
           --arg prefix "$SOURCE_DIR" \
           '{mcpServers: {"tech-lead-stack": {"command": $cmd, "args": ["--prefix", $prefix, "--silent", "run", "mcp:start"]}}}' \
           > "$mcp_file"
    fi
    echo "   ✅ Added tech-lead-stack MCP server for Cursor: $mcp_file"
}

echo "🚀 Initializing Tech-Lead Stack..."
echo "   IDE mode: $IDE_MODE"

# 0. Smart Package Manager & Project Health Check
detect_manager() {
    if [[ -f "$TARGET_DIR/pnpm-lock.yaml" ]]; then echo "pnpm"
    elif [[ -f "$TARGET_DIR/yarn.lock" ]]; then echo "yarn"
    elif [[ -f "$TARGET_DIR/bun.lockb" ]]; then echo "bun"
    else echo "npm"
    fi
}

PKG_MANAGER=$(detect_manager)
echo "📦 Detected project manager: $PKG_MANAGER"

if [[ -f "$TARGET_DIR/package.json" ]]; then
    echo "🔍 Reviewing project health..."
    if ! node -e "try { require('$TARGET_DIR/package.json') } catch(e) { process.exit(1) }" &> /dev/null; then
        echo "⚠️  Warning: $TARGET_DIR/package.json appeared to be invalid."
        echo "   Proceeding with caution, but you might want to check it for syntax errors or invalid names."
    fi
fi

# Ensure stack's own dependencies are installed using the preferred manager
echo "🛠️ Ensuring Stack dependencies are installed with $PKG_MANAGER..."
(cd "$SOURCE_DIR" && "$PKG_MANAGER" install --quiet)

# 1. Symlinks (Robust & Non-Recursive)
mkdir -p "$TARGET_DIR/.github"

# helper for safe symlinking
safe_ln() {
   local src="$1"
   local dest="$2"
   # Don't symlink if source and target are identical
   if [[ "$(realpath "$src")" == "$(realpath "$dest" 2>/dev/null)" ]]; then
       echo "   - Skipping identical path: $dest"
       return
   fi
   ln -nfs "$src" "$dest"
}

echo "🔗 Linking components..."
safe_ln "$SOURCE_DIR/.ai" "$TARGET_DIR/.ai"
safe_ln "$SOURCE_DIR/.agents" "$TARGET_DIR/.agents"
cp "$SOURCE_DIR/templates/PULL_REQUEST_TEMPLATE.md" "$TARGET_DIR/.github/PULL_REQUEST_TEMPLATE.md"

# 2. Python Setup
echo "🐍 Ensuring Python dependencies are met..."
python3 -m pip install -r "$SOURCE_DIR/requirements.txt" --quiet

# 3. GitHub CLI Setup
echo "🛠️ Ensuring GitHub CLI (gh) is installed..."
if ! command -v gh &> /dev/null; then
    echo "   - GitHub CLI not found. Attempting to install via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install gh
    else
        echo "❌ Homebrew is required to auto-install gh on macOS. Please install gh manually: https://cli.github.com"
    fi
else
    echo "   - GitHub CLI is already installed."
fi

echo "🔐 Checking GitHub CLI authentication status..."
if ! gh auth status &> /dev/null; then
    echo "   ⚠️  Not authenticated with GitHub CLI."
    echo "   👉 Please open a NEW terminal window and run: gh auth login"
    echo "   ⏳ Waiting for successful authentication to continue..."
    
    while ! gh auth status &> /dev/null; do
        sleep 5
        echo -n "."
    done
    echo ""
    echo "   ✅ Successfully authenticated with GitHub!"
else
    echo "   - Already authenticated with GitHub."
fi

# 4. RTK Setup & Immediate Pre-Flight Check
if ! command -v rtk &> /dev/null; then
    echo "🛠️ Installing RTK via curl..."
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
fi

if command -v rtk &> /dev/null; then
    echo "🤖 Initializing RTK..."
    (cd "$TARGET_DIR" && rtk init)
    
    echo "📡 Running Mission Control Pre-Flight..."
    (cd "$TARGET_DIR" && bash "$SOURCE_DIR/scripts/rtk-run.sh" run mission-control)
else
    echo "❌ RTK setup failed. Please install it manually: https://rtk-ai.app"
fi

# 5. Generic MCP Configuration (Claude Desktop, etc.)
setup_mcp_environment() {
    # Check common configuration paths for various agents/IDEs
    local config_paths=(
        "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        "$HOME/.config/Claude/claude_desktop_config.json"
    )
    
    for config_file in "${config_paths[@]}"; do
        if [[ -f "$config_file" ]]; then
            echo "⚙️  Detected Agent configuration at: $config_file"
            
            # Check if server already exists
            if ! grep -q "tech-lead-stack" "$config_file"; then
                echo "   ✨ Adding tech-lead-stack to Agent tools..."
                
                if command -v jq &> /dev/null; then
                    local tmp_config="/tmp/mcp_config_tmp.json"
                    # Use --prefix instead of cwd for universal compatibility
                        jq --arg name "tech-lead-stack" \
                           --arg cmd "npm" \
                           --arg prefix "$SOURCE_DIR" \
                           '.mcpServers[$name] = {"command": $cmd, "args": ["--prefix", $prefix, "--silent", "run", "mcp:start"]}' \
                           "$config_file" > "$tmp_config" && mv "$tmp_config" "$config_file"
                    echo "   ✅ Successfully configured!"
                else
                    echo "   ⚠️  jq not found. Skipping automated JSON update to avoid corruption."
                fi
            else
                echo "   - Configuration already present."
            fi
        fi
    done
}
setup_mcp_environment

# 5b. Cursor: global skills (no files under TARGET_DIR) + MCP
if should_install_cursor_skills; then
    echo ""
    echo "🖱️  Cursor detected or --ide cursor: configuring global skills and MCP..."
    setup_cursor_skills
    setup_cursor_mcp_environment
elif [[ "$IDE_MODE" == "auto" ]]; then
    echo ""
    echo "💡 Skipping global Cursor skills (IDE mode auto; not in Cursor terminal). Use --ide cursor to install ~/.cursor/skills links."
fi

echo "✨ Initialization complete."
echo ""

# 6. Native Alias Automation
ALIAS_CMD="alias rtk='$SOURCE_DIR/scripts/rtk-run.sh'"
ALIAS_ADDED=false

add_alias_to_rc() {
    local rc_file="$1"
    if [[ -f "$rc_file" ]]; then
        # Check if this exact alias command is already in the file
        if ! grep -Fxq "$ALIAS_CMD" "$rc_file"; then
            echo "" >> "$rc_file"
            echo "# Tech-Lead Stack local RTK alias for $(pwd)" >> "$rc_file"
            echo "$ALIAS_CMD" >> "$rc_file"
            echo "   ✅ Added native 'rtk' alias to: $rc_file"
            ALIAS_ADDED=true
        else
            echo "   - Alias already exists in: $rc_file"
            ALIAS_ADDED=true
        fi
    fi
}

echo "⚙️ Configuring native shell commands..."
add_alias_to_rc "$HOME/.zshrc"
add_alias_to_rc "$HOME/.bashrc"

echo ""
echo "----------------------------------------------------------------"
echo "🚨 IMPORTANT: AGENT TELEMETRY CONFIGURATION 🚨"
echo "----------------------------------------------------------------"
echo "To track skill usage, add this to your Agent's MCP settings:"
echo ""
echo "{"
echo "  \"mcpServers\": {"
echo "    \"tech-lead-stack\": {"
echo "      \"command\": \"npm\","
echo "      \"args\": ["
echo "         \"--prefix\","
echo "         \"$SOURCE_DIR\","
echo "         \"--silent\","
echo "         \"run\","
echo "         \"mcp:start\""
echo "      ]"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "🔧 FIXED: \"Property cwd is not allowed\""
echo "We now use the --prefix flag inside the args list, which is"
echo "supported by all MCP clients including Antigravity."
echo ""
echo "Cursor users: install also merges this into ~/.cursor/mcp.json when --ide cursor or auto-detect runs."
echo "----------------------------------------------------------------"
echo ""

if [ "$ALIAS_ADDED" = true ]; then
    echo "💡 Tip: Restart your terminal or run \`source ~/.zshrc\` (or .bashrc) to use 'rtk run <tool>' natively!"
else
    echo "💡 Tip: We couldn't find your .zshrc or .bashrc. To use 'rtk run <tool>' natively, manually run:"
    echo "   $ALIAS_CMD"
fi
