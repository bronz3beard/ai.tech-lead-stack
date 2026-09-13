#!/bin/bash
# tech-lead-stack installer

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
    cat <<'USAGE'
Usage: ./install.sh --link [options] [target_path]

Options:
  --ide <mode>       auto | cursor | continue | claude-code | cline | gemini | none
                     (default: auto)
  --ide-only         Configure the IDE surface only. Skips project linking,
                     dependency installs, gh auth, and the RTK pre-flight.
                     Use this to add an IDE to an already-linked project.
  --mcp-name <name>  Name to register the MCP server under (default: tech-lead-stack).
                     Set this if you run the stack behind a different gate.
  --domains <list>   Comma-separated skill domains to expose: eng,pm,hr
                     (default: all three).
USAGE
}

if [[ "${1:-}" != "--link" ]]; then
    usage
    exit 1
fi
shift

IDE_MODE="auto"
IDE_ONLY=false
MCP_SERVER_NAME="tech-lead-stack"
DOMAINS="eng,pm,hr"
TARGET_DIR=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ide)
            if [[ -z "${2:-}" ]]; then
                echo "Error: --ide requires a value (auto, cursor, continue, claude-code, cline, gemini, or none)."
                exit 1
            fi
            IDE_MODE="$2"
            shift 2
            ;;
        --ide-only)
            IDE_ONLY=true
            shift
            ;;
        --mcp-name)
            if [[ -z "${2:-}" ]]; then
                echo "Error: --mcp-name requires a value."
                exit 1
            fi
            MCP_SERVER_NAME="$2"
            shift 2
            ;;
        --domains)
            if [[ -z "${2:-}" ]]; then
                echo "Error: --domains requires a value (comma-separated: eng,pm,hr)."
                exit 1
            fi
            DOMAINS="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            TARGET_DIR=$(realpath "$1")
            shift
            ;;
    esac
done

[[ -z "$TARGET_DIR" ]] && TARGET_DIR=$(realpath ".")

case "$IDE_MODE" in
    auto|cursor|continue|claude-code|cline|gemini|none) ;;
    *)
        echo "Error: --ide must be auto, cursor, continue, claude-code, cline, gemini, or none (got: $IDE_MODE)"
        exit 1
        ;;
esac

for _domain in ${DOMAINS//,/ }; do
    case "$_domain" in
        eng|pm|hr) ;;
        *)
            echo "Error: --domains entries must be eng, pm, or hr (got: $_domain)"
            exit 1
            ;;
    esac
done

# NOTE on the trailing `*) return 1`: a bash `case` with no matching branch
# exits 0, so without it these detectors returned "true" for every unrelated
# --ide value (e.g. --ide cursor also installed Continue).
should_install_cursor_skills() {
    case "$IDE_MODE" in
        cursor) return 0 ;;
        auto)
            if [[ -n "${CURSOR_TRACE_ID:-}" ]] || [[ -n "${CURSOR_AGENT:-}" ]]; then
                return 0
            fi
            return 1
            ;;
        *) return 1 ;;
    esac
}

should_install_continue() {
    case "$IDE_MODE" in
        continue) return 0 ;;
        auto)
            if [[ -d "$HOME/.continue" ]] || [[ -d "$TARGET_DIR/.continue" ]] || [[ -n "${VSCODE_IPC_HOOK_CLI:-}" ]]; then
                return 0
            fi
            return 1
            ;;
        *) return 1 ;;
    esac
}

should_install_claude_code() {
    case "$IDE_MODE" in
        claude-code) return 0 ;;
        auto)
            # CLAUDECODE / CLAUDE_CODE_ENTRYPOINT are set inside a Claude Code
            # session. VSCODE_IPC_HOOK_CLI is deliberately NOT used: it is set by
            # any VS Code terminal and is already claimed by the Continue detector.
            if [[ -n "${CLAUDECODE:-}" ]] || [[ -n "${CLAUDE_CODE_ENTRYPOINT:-}" ]] || [[ -d "$HOME/.claude" ]]; then
                return 0
            fi
            return 1
            ;;
        *) return 1 ;;
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
    merge_mcp_json "Cursor" "$HOME/.cursor/mcp.json" "yes"
}

setup_continue() {
    local config_file="$HOME/.continue/config.yaml"

    mkdir -p "$(dirname "$config_file")"
    if [[ ! -f "$config_file" ]]; then
        echo "models: []" > "$config_file"
    fi

    echo "   - Merging tech-lead-stack into Continue config..."

    # 1. Safely merge mcpServers to avoid duplicate root keys
    if grep -q "tech-lead-stack:" "$config_file" 2>/dev/null; then
        echo "   - tech-lead-stack MCP server already present in Continue config."
    else
        # Use awk to inject into existing mcpServers key, or append if missing
        SOURCE_DIR="$SOURCE_DIR" awk '
        BEGIN { mcp_done=0; }
        /^mcpServers:/ {
            print $0
            print "  tech-lead-stack:"
            print "    command: npm"
            print "    args:"
            print "      - --prefix"
            print "      - \"" ENVIRON["SOURCE_DIR"] "\""
            print "      - --silent"
            print "      - run"
            print "      - mcp:start"
            mcp_done=1
            next
        }
        { print }
        END {
            if (mcp_done == 0) {
                print "mcpServers:"
                print "  tech-lead-stack:"
                print "    command: npm"
                print "    args:"
                print "      - --prefix"
                print "      - \"" ENVIRON["SOURCE_DIR"] "\""
                print "      - --silent"
                print "      - run"
                print "      - mcp:start"
            }
        }
        ' "$config_file" > /tmp/continue_config.yaml && mv /tmp/continue_config.yaml "$config_file"
        echo "   ✅ Added tech-lead-stack MCP server to Continue config."
    fi

    # 2. Symlink workflows into ~/.continue/prompts/
    #    Continue v2.0.0 reliably reads .prompt files here, allowing single-source execution.
    local prompts_dir="$HOME/.continue/prompts"
    mkdir -p "$prompts_dir"

    echo "   - Symlinking workflows to $prompts_dir..."
    local count=0
    for wf in "$SOURCE_DIR/.agents/workflows/"*.md; do
        if [[ -f "$wf" ]]; then
            local wf_name
            wf_name=$(basename "$wf" .md)
            local dest_file="$prompts_dir/$wf_name.prompt"
            ln -sfn "$wf" "$dest_file"
            count=$((count + 1))
        fi
    done
    echo "   ✅ Linked $count Continue prompts. Re-run install if you move the tech-lead-stack repo."

    echo "   ✅ Configured Continue globally."
}

# --- Claude Code -------------------------------------------------------------
# Claude Code reads user-scope slash commands from ~/.claude/commands/<ns>/<cmd>.md
# and they surface as /<ns>:<cmd>. Everything below is generated from
# .ai/agent-surfaces.json so no client-specific knowledge leaks into the repo's
# skills or workflows — those stay agent-agnostic and this adapter translates.

CLAUDE_COMMANDS_DIR="$HOME/.claude/commands/tls"
CLAUDE_CONFIG_FILE="$HOME/.claude.json"

# --- Run report --------------------------------------------------------------
# Every adapter records what it did. Without this the output is a scroll of
# echoes with no verdict, and a failure part-way through is invisible.
CONFIGURED=()
SKIPPED=()
NEXT_STEPS=()

record_ok()   { CONFIGURED+=("$1"); }
record_skip() { SKIPPED+=("$1"); [[ -n "${2:-}" ]] && NEXT_STEPS+=("$2"); }

print_report() {
    echo ""
    echo "────────────────────────────────────────────────────────────────"
    echo "  INSTALL REPORT"
    echo "────────────────────────────────────────────────────────────────"

    if [[ ${#CONFIGURED[@]} -gt 0 ]]; then
        echo ""
        echo "  ✅ Configured:"
        printf '     • %s\n' "${CONFIGURED[@]}"
    else
        echo ""
        echo "  ⚠️  Nothing was configured."
    fi

    if [[ ${#SKIPPED[@]} -gt 0 ]]; then
        echo ""
        echo "  ⏭️  Skipped:"
        printf '     • %s\n' "${SKIPPED[@]}"
    fi

    if [[ ${#NEXT_STEPS[@]} -gt 0 ]]; then
        echo ""
        echo "  👉 Next steps:"
        printf '     • %s\n' "${NEXT_STEPS[@]}"
    fi

    echo ""
    echo "────────────────────────────────────────────────────────────────"
}

# The surface index drives every adapter. Generate it rather than fail on it:
# the repo already requires Node and a package manager, so this is deterministic.
ensure_surface_index() {
    [[ -f "$SOURCE_DIR/.ai/agent-surfaces.json" ]] && return 0
    echo "   - Surface index missing; generating it..."
    if (cd "$SOURCE_DIR" && "$PKG_MANAGER" run generate:registry > /dev/null 2>&1); then
        echo "   ✅ Generated .ai/agent-surfaces.json"
        return 0
    fi
    echo "   ⚠️  Could not generate the surface index."
    record_skip "Surface index" "run: cd $SOURCE_DIR && $PKG_MANAGER run generate:registry"
    return 1
}

setup_claude_code_commands() {
    # Generation lives in Node, not jq + perl: Node 22 is already a hard
    # requirement of this repo, so the adapter has no extra dependencies to
    # probe for. The script stages and swaps atomically on its own.
    echo "   - Generating slash commands in $CLAUDE_COMMANDS_DIR (domains: $DOMAINS)..."

    local count
    if count=$(node "$SOURCE_DIR/scripts/generate-ide-commands.mjs" \
        --out "$CLAUDE_COMMANDS_DIR" \
        --server "$MCP_SERVER_NAME" \
        --domains "$DOMAINS" \
        --source "$SOURCE_DIR" \
        --agent claude-code); then
        echo "   ✅ Generated $count slash command(s). Invoke them as /tls:<name>."
        record_ok "Claude Code slash commands ($count) → $CLAUDE_COMMANDS_DIR"
        return 0
    fi

    echo "   ⚠️  Slash command generation failed — $CLAUDE_COMMANDS_DIR left untouched."
    record_skip "Claude Code slash commands" "generator failed; run: node scripts/generate-ide-commands.mjs --out $CLAUDE_COMMANDS_DIR --server $MCP_SERVER_NAME"
    return 1
}

setup_claude_code_mcp() {
    # Already reaching this checkout under any name? Leave it alone. The whole
    # server object is scanned, not just .args: a gate such as slm-gate reaches
    # the stack through an env var (DOWNSTREAM_MCP), and registering a second
    # server would duplicate every tool.
    if [[ -f "$CLAUDE_CONFIG_FILE" ]]; then
        local existing
        existing=$(node -e "
            const fs=require('fs');
            try {
              const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')||'{}');
              const s=c.mcpServers||{};
              console.log(Object.keys(s).filter(k=>JSON.stringify(s[k]).includes(process.argv[2])).join(', '));
            } catch {}
        " "$CLAUDE_CONFIG_FILE" "$SOURCE_DIR" 2>/dev/null)
        if [[ -n "$existing" ]]; then
            echo "   - Claude Code already reaches this checkout via: $existing."
            echo "     Leaving it alone. Pass --mcp-name to add a separate one deliberately."
            record_ok "Claude Code MCP (already present via $existing)"
            return 0
        fi
    fi

    # Preferred path: let the CLI own the file it also writes at runtime.
    if command -v claude &> /dev/null; then
        local server_json
        server_json=$(node -e "
            console.log(JSON.stringify({command:'npm',args:['--prefix',process.argv[1],'--silent','run','mcp:start']}));
        " "$SOURCE_DIR")
        if claude mcp add-json "$MCP_SERVER_NAME" "$server_json" --scope user > /dev/null 2>&1; then
            echo "   ✅ Registered '$MCP_SERVER_NAME' at user scope via the claude CLI."
            record_ok "Claude Code MCP → user scope (claude CLI)"
            return 0
        fi
        echo "   - claude CLI registration did not succeed; falling back to a direct merge."
    fi

    # Fallback. ~/.claude.json also holds account and session state, so the
    # shared helper backs it up and replaces it atomically.
    merge_mcp_json "Claude Code" "$CLAUDE_CONFIG_FILE" "yes"
}

setup_claude_code() {
    setup_claude_code_commands
    setup_claude_code_mcp
}

should_install_cline() {
    case "$IDE_MODE" in
        cline) return 0 ;;
        auto)
            local base
            [[ "$(uname)" == "Darwin" ]] && base="$HOME/Library/Application Support" || base="$HOME/.config"
            [[ -d "$base/Code/User/globalStorage/saoudrizwan.claude-dev" ]] && return 0
            return 1
            ;;
        *) return 1 ;;
    esac
}

should_install_gemini() {
    case "$IDE_MODE" in
        gemini) return 0 ;;
        auto) [[ -d "$HOME/.gemini" ]] && return 0; return 1 ;;
        *) return 1 ;;
    esac
}

# --- Shared MCP JSON merge ---------------------------------------------------
# Cursor, Cline, Gemini and Claude Desktop all take the same {mcpServers:{...}}
# shape. One helper, so a fix lands everywhere at once. Writes through a
# same-directory temp file so the replace is atomic.
merge_mcp_json() {
    local label="$1" file="$2" create_if_missing="${3:-yes}"

    if [[ ! -f "$file" && "$create_if_missing" != "yes" ]]; then
        record_skip "$label" "$label not installed; no config at $file"
        return 1
    fi

    local tmp="${file}.tmp.$$"
    mkdir -p "$(dirname "$file")"

    if [[ -f "$file" ]] && node -e "
        const fs=require('fs');
        try {
          const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')||'{}');
          const s=c.mcpServers||{};
          process.exit(Object.values(s).some(v=>JSON.stringify(v).includes(process.argv[2]))?0:1);
        } catch { process.exit(1); }
    " "$file" "$SOURCE_DIR" 2>/dev/null; then
        echo "   - $label already points at this checkout."
        record_ok "$label MCP (already present)"
        return 0
    fi

    if node -e "
        const fs=require('fs');
        const [file,name,prefix,tmp]=process.argv.slice(1);
        let c={};
        try { c=JSON.parse(fs.readFileSync(file,'utf8')||'{}'); } catch {}
        c.mcpServers=c.mcpServers||{};
        c.mcpServers[name]={command:'npm',args:['--prefix',prefix,'--silent','run','mcp:start']};
        fs.writeFileSync(tmp, JSON.stringify(c,null,2)+'\n');
    " "$file" "$MCP_SERVER_NAME" "$SOURCE_DIR" "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
        [[ -f "$file" ]] && cp "$file" "${file}.bak"
        mv "$tmp" "$file"
        echo "   ✅ Registered '$MCP_SERVER_NAME' for $label: $file"
        record_ok "$label MCP → $file"
        return 0
    fi

    rm -f "$tmp"
    echo "   ⚠️  Could not update $file"
    record_skip "$label" "merge the MCP block into $file by hand (see README)"
    return 1
}

# Cline stores MCP servers in the VS Code extension's globalStorage.
setup_cline() {
    local base
    if [[ "$(uname)" == "Darwin" ]]; then
        base="$HOME/Library/Application Support"
    else
        base="$HOME/.config"
    fi

    local found=1
    local variant
    for variant in "Code" "Code - Insiders" "VSCodium" "Cursor"; do
        local f="$base/$variant/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
        if [[ -d "$(dirname "$(dirname "$f")")" ]]; then
            merge_mcp_json "Cline ($variant)" "$f" "yes" && found=0
        fi
    done

    [[ $found -eq 0 ]] || record_skip "Cline" "Cline not detected; install the extension then re-run with --ide-only"
}

# Gemini CLI and Gemini Desktop share ~/.gemini/settings.json.
setup_gemini() {
    merge_mcp_json "Gemini (CLI/Desktop)" "$HOME/.gemini/settings.json" "yes"
}

# Claude Desktop keeps its MCP servers in a platform-specific config file.
# Auto-detected rather than flag-driven: configured only when already installed,
# never fabricated, hence create_if_missing=no.
setup_claude_desktop() {
    local config_file
    for config_file in \
        "$HOME/Library/Application Support/Claude/claude_desktop_config.json" \
        "$HOME/.config/Claude/claude_desktop_config.json"; do
        [[ -f "$config_file" ]] && merge_mcp_json "Claude Desktop" "$config_file" "no"
    done
}

run_ide_adapters() {
    ensure_surface_index

    if should_install_cursor_skills; then
        echo ""
        echo "🖱️  Cursor detected or --ide cursor: configuring global skills and MCP..."
        setup_cursor_skills
        setup_cursor_mcp_environment
    elif [[ "$IDE_MODE" == "auto" ]]; then
        echo ""
        echo "💡 Skipping global Cursor skills (IDE mode auto; not in Cursor terminal). Use --ide cursor to install ~/.cursor/skills links."
    fi

    if should_install_continue; then
        echo ""
        echo "🔄 Continue detected or --ide continue: configuring global Continue config..."
        setup_continue
    elif [[ "$IDE_MODE" == "auto" ]]; then
        echo ""
        echo "💡 Skipping global Continue config (IDE mode auto; not in VS Code/Continue). Use --ide continue to install to ~/.continue/config.yaml."
    fi

    if should_install_claude_code; then
        echo ""
        echo "🤖 Claude Code detected or --ide claude-code: configuring slash commands and MCP..."
        setup_claude_code
    elif [[ "$IDE_MODE" == "auto" ]]; then
        echo ""
        echo "💡 Skipping Claude Code setup (IDE mode auto; not detected). Use --ide claude-code to install to ~/.claude/commands/tls/."
    fi

    # Cline and Gemini are MCP-only: no slash commands, skills arrive via
    # get_skill. Both take the standard mcpServers shape, so both are automatic.
    if should_install_cline; then
        echo ""
        echo "🔌 Configuring Cline MCP..."
        setup_cline
    fi

    if should_install_gemini; then
        echo ""
        echo "✨ Configuring Gemini (CLI/Desktop) MCP..."
        setup_gemini
    fi

    # Always attempted: it no-ops unless Claude Desktop is actually installed.
    setup_claude_desktop
}

# --ide-only: configure the IDE surface and stop. Nothing is written inside the
# target project and no prerequisites are installed, so this is the cheap way to
# add an IDE to a project that was linked previously.
if [[ "$IDE_ONLY" == true ]]; then
    echo "🚀 Tech-Lead Stack: IDE surface only."
    echo "   IDE mode: $IDE_MODE | MCP name: $MCP_SERVER_NAME | Domains: $DOMAINS"
    run_ide_adapters
    print_report
    echo "✨ IDE configuration complete. No project files were modified."
    exit 0
fi

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
(cd "$SOURCE_DIR" && "$PKG_MANAGER" run mcp:build --quiet)

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

# Root-level AGENTS.md so Jules, Cursor, Copilot etc. read it automatically.
# Guard: never overwrite a real file — only create/refresh our own symlink.
if [[ -e "$TARGET_DIR/AGENTS.md" && ! -L "$TARGET_DIR/AGENTS.md" ]]; then
    echo "   - AGENTS.md already exists as a real file — leaving it alone."
else
    safe_ln "$SOURCE_DIR/.ai/agents.md" "$TARGET_DIR/AGENTS.md"
    echo "   ✅ Linked root AGENTS.md"
fi

cp "$SOURCE_DIR/templates/PULL_REQUEST_TEMPLATE.md" "$TARGET_DIR/.github/PULL_REQUEST_TEMPLATE.md"

if [[ ! -d "$TARGET_DIR/.github/workflows" ]]; then
    mkdir -p "$TARGET_DIR/.github/workflows"
fi

if [[ ! -f "$TARGET_DIR/.github/workflows/design-review-trigger.yml" ]]; then
    cp "$SOURCE_DIR/docs/github-action-example.yml" "$TARGET_DIR/.github/workflows/design-review-trigger.yml"
    echo "   ✅ Added GitHub Action for Design Review triggers"
else
    echo "   - GitHub Action design-review-trigger.yml already exists"
fi
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
    echo "   👉 Open a NEW terminal and run: gh auth login"
    echo "   ⏳ Waiting up to 2 minutes, then continuing without it..."

    # Bounded, not an unbounded `while`: auth depends on the user, so this is a
    # report-not-fix case. An unauthenticated machine must never hang the install.
    for _ in {1..24}; do
        gh auth status &> /dev/null && break
        sleep 5
        echo -n "."
    done
    echo ""

    if gh auth status &> /dev/null; then
        echo "   ✅ Successfully authenticated with GitHub!"
        record_ok "GitHub CLI authenticated"
    else
        echo "   ⚠️  Still not authenticated — continuing. PR and review tools will fail until you log in."
        record_skip "GitHub CLI authentication" "run: gh auth login"
    fi
else
    echo "   - Already authenticated with GitHub."
    record_ok "GitHub CLI authenticated"
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

# 4b. Antigravity Knowledge Items Bootstrap
echo "📚 Bootstrapping Antigravity Knowledge Items directory..."
mkdir -p "$HOME/.gemini/antigravity/knowledge"
echo "   ✅ Knowledge Items directory initialized: $HOME/.gemini/antigravity/knowledge"

# 4c. Reflexion Loop (✨ Special Feature) — key check
# The Reflexion Loop is the one non-agent-agnostic skill: it calls Gemini AND
# Claude directly. No new deps to install (it reuses @ai-sdk/* already in
# package.json and is exposed automatically via the MCP server). We only verify
# the keys so the feature is ready to use, and never block install if absent.
echo "✨ Checking Reflexion Loop (special feature) prerequisites..."
# Load the stack's .env if present so we can read keys.
[ -f "$SOURCE_DIR/.env" ] && set -a && . "$SOURCE_DIR/.env" && set +a
if [[ -n "${GEMINI_API_KEY:-}" && -n "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "   ✅ GEMINI_API_KEY + ANTHROPIC_API_KEY found — '/reflexion-loop' is ready."
else
    echo "   ℹ️  Reflexion Loop needs GEMINI_API_KEY and ANTHROPIC_API_KEY in your .env."
    echo "      Add them (see .env.example) to enable 'rtk run reflexion-loop' and the website page."
fi

# 5. IDE surfaces: Cursor, Continue, Claude Code, Cline, Gemini, Claude Desktop.
#    All global; nothing is written under TARGET_DIR. Same code path as --ide-only.
run_ide_adapters

print_report
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

cat <<'EOF'

✅ tech-lead-stack linked to this project.

⚙️  Reflexion-loop models are PER PROJECT. Set them in THIS project's MCP config
    "env" block (Antigravity → workspace MCP settings):

      "env": {
        "MODEL_PLANNER":     "claude-opus-4-6",
        "MODEL_IMPLEMENTER": "gemini-3.6-flash",
        "MODEL_AUDITOR":     "claude-sonnet-4-6",
        "MODEL_ADJUDICATOR": "claude-sonnet-4-6",
        "ANTHROPIC_API_KEY": "sk-ant-…",
        "GEMINI_API_KEY":    "…"
      }

    Omit a model (or its key) in projects where it isn't allowed.
    If unset, the loop falls back to defaults (planner=Gemini Flash,
    auditor+adjudicator=Claude Sonnet) — which may not be permitted here.
EOF

