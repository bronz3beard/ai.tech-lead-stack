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
                     Also forces the name baked into Claude Code slash commands
                     as mcp__<name>__<tool>, disabling the auto-detection below.

                     You rarely need this. If a proxy (slm-gate, or any gateway
                     that forwards to this checkout) is already registered with
                     Claude Code, the installer detects it and names the proxy
                     in the generated slash commands, because that is where the
                     tools actually appear. Pass --mcp-name only to override
                     that, or to register a second, deliberately-named server.
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
# The name TLS REGISTERS ITSELF under. Correct for a standalone install and
# never auto-changed: a user installing the stack on its own gets tools called
# mcp__tech-lead-stack__*. The name slash commands must NAME is a separate
# question when a proxy fronts the stack — see resolve_command_server_name().
#
# MCP_NAME_EXPLICIT tracks whether the name was CHOSEN or merely defaulted. A
# chosen name is never second-guessed by the proxy auto-detection further down;
# a defaulted one is. An exported MCP_SERVER_NAME counts as chosen, so a proxy
# setup can be scripted without repeating the flag. Note install.sh does not
# read .env — export it in your shell, or pass --mcp-name.
if [[ -n "${MCP_SERVER_NAME:-}" ]]; then
    MCP_NAME_EXPLICIT=true
else
    MCP_SERVER_NAME="tech-lead-stack"
    MCP_NAME_EXPLICIT=false
fi
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
            MCP_NAME_EXPLICIT=true
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
WARNINGS=()
NEXT_STEPS=()

record_ok()   { CONFIGURED+=("$1"); }
record_skip() { SKIPPED+=("$1"); [[ -n "${2:-}" ]] && NEXT_STEPS+=("$2"); }
# Distinct from record_skip: the step was attempted and failed, but the failure
# is non-fatal and the install still succeeded. A warning carries its own
# explanation and remedy so the report is readable without scrolling back up to
# the log — a bare one-line warning is what made these look like hard failures.
# Usage: record_warn <title> [why] [how-to-fix]
record_warn() {
    local title="$1" why="${2:-}" fix="${3:-}"
    local block="     • $title"
    [[ -n "$why" ]] && block+=$'\n'"       Why:    $why"
    [[ -n "$fix" ]] && block+=$'\n'"       Fix:    $fix"
    [[ -n "$fix" ]] && block+=$'\n'"       Impact: optional — the install is complete and usable without this."
    WARNINGS+=("$block")
}

print_report() {
    echo ""
    echo "----------------------------------------------------------------"
    echo "  INSTALL REPORT"
    echo "----------------------------------------------------------------"

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

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo ""
        echo "  ⚠️  Warnings — none of these blocked the install."
        echo "      Everything above under 'Configured' is working. Each item below"
        echo "      is optional: act on it only if you want that specific capability."
        echo ""
        printf '%s\n\n' "${WARNINGS[@]}"
    fi

    if [[ ${#NEXT_STEPS[@]} -gt 0 ]]; then
        echo ""
        echo "  👉 Next steps:"
        printf '     • %s\n' "${NEXT_STEPS[@]}"
    fi

    # Verdict. "Green" is claimed only when nothing warned and nothing was
    # skipped; anything less says so plainly rather than implying a clean run.
    echo "----------------------------------------------------------------"
    if [[ ${#WARNINGS[@]} -eq 0 && ${#SKIPPED[@]} -eq 0 ]]; then
        echo "  ✅ VERDICT: fully successful — every step completed, nothing to act on."
    else
        echo "  ✅ VERDICT: install succeeded and the stack is usable."
        echo "     ${#WARNINGS[@]} warning(s), ${#SKIPPED[@]} skipped — optional, listed above with fixes."
        echo "     Nothing here needs to be fixed before you start using the stack."
    fi

    echo ""
    echo "----------------------------------------------------------------"
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
    echo "   ⚠️  Could not generate the surface index (.ai/agent-surfaces.json)."
    echo "      WHAT THIS AFFECTS: the index lists every skill/workflow surface."
    echo "      Without it, IDE adapters below may generate fewer commands than"
    echo "      expected. Already-installed commands keep working."
    record_warn "Surface index could not be generated" \
        "'$PKG_MANAGER run generate:registry' failed in $SOURCE_DIR, so IDE adapters had no surface list to read" \
        "cd $SOURCE_DIR && $PKG_MANAGER run generate:registry   (then re-run ./install.sh --link)"
    return 1
}

# The name slash commands must NAME. Defaults to the registration name and is
# re-resolved by resolve_command_server_name() before commands are generated.
COMMAND_SERVER_NAME="$MCP_SERVER_NAME"

# -----------------------------------------------------------------------------
# Why the command name is resolved separately from the registration name.
#
# A generated slash command does not call this stack. It instructs the agent to
# call a TOOL, by its fully-qualified MCP name: `mcp__<server>__get_skills`.
# That `<server>` is the name the CLIENT knows the server by — which is not
# always the name this stack registers itself under.
#
# Two topologies:
#
#   Direct (the default, and what most installs get). The client launches this
#   stack itself under `tech-lead-stack`, so tools appear as
#   `mcp__tech-lead-stack__get_skills`. Registration name and tool name agree
#   and this function changes nothing.
#
#   Behind a proxy. A gateway process is registered with the client instead,
#   and reaches this checkout downstream. The client never sees a server called
#   `tech-lead-stack` at all — the stack's tools are re-exported under the
#   PROXY's name, e.g. `mcp__slm-gate__get_skills`. Baking the default in that
#   topology writes 50+ commands naming a tool that exists in no session, and
#   the failure is silent: the agent simply cannot find the tool it was told to
#   call, and the command appears to do nothing.
#
# This is deliberately proxy-agnostic. Nothing here knows the string
# "slm-gate". The rule is "a registered server whose definition mentions THIS
# CHECKOUT'S PATH is serving this stack", which holds for any gateway that
# spawns or forwards to `dist/mcp-server.mjs` however it is configured —
# slm-gate does it through a DOWNSTREAM_MCP env var, another proxy might do it
# through argv or its own config file, and both are matched the same way.
#
# setup_claude_code_mcp() below already performs this exact detection to avoid
# registering a duplicate server. It computed the answer and discarded it; this
# function is that same fact, used for the other half of the install.
#
# Scope rule: only USER-scope servers count. Slash commands live in
# ~/.claude/commands/tls and apply to every project, so a gate registered for
# one project cannot be baked in globally without breaking the others. That
# case warns and keeps the default rather than guessing.
# -----------------------------------------------------------------------------
resolve_command_server_name() {
    COMMAND_SERVER_NAME="$MCP_SERVER_NAME"

    # An explicit --mcp-name is a decision, not a guess to be improved on.
    [[ "$MCP_NAME_EXPLICIT" == true ]] && return 0
    [[ -f "$CLAUDE_CONFIG_FILE" ]] || return 0

    # Prints one of: "" | "global <name>" | "ambiguous <a,b>" | "project <name>"
    local verdict scope name
    verdict=$(node -e "
        const fs = require('fs');
        try {
          const cfg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8') || '{}');
          const checkout = process.argv[2];
          const serves = (server) => JSON.stringify(server).includes(checkout);

          const user = Object.entries(cfg.mcpServers || {})
            .filter(([, v]) => serves(v))
            .map(([k]) => k);

          if (user.length === 1) { console.log('global ' + user[0]); }
          else if (user.length > 1) { console.log('ambiguous ' + user.join(',')); }
          else {
            // Nothing at user scope. Look for a project-scoped gate purely so we
            // can explain why we are not using it.
            for (const project of Object.values(cfg.projects || {})) {
              const hit = Object.entries(project.mcpServers || {})
                .filter(([, v]) => serves(v))
                .map(([k]) => k);
              if (hit.length > 0) { console.log('project ' + hit[0]); break; }
            }
          }
        } catch { /* unreadable config: fall through to the default */ }
    " "$CLAUDE_CONFIG_FILE" "$SOURCE_DIR" 2>/dev/null)

    scope="${verdict%% *}"
    name="${verdict#* }"
    [[ -z "$scope" ]] && return 0

    case "$scope" in
        global)
            [[ "$name" == "$COMMAND_SERVER_NAME" ]] && return 0
            COMMAND_SERVER_NAME="$name"
            echo "   - '$name' is already registered with Claude Code and reaches this checkout."
            echo "     Slash commands will call mcp__${name}__<tool>, which is where this"
            echo "     stack's tools actually appear. Pass --mcp-name to override."
            ;;
        ambiguous)
            echo "   ⚠️  More than one registered server reaches this checkout: $name"
            echo "      Not guessing which one exports the tools; using the default."
            record_warn "Slash commands named mcp__${COMMAND_SERVER_NAME}__ by default" \
                "several user-scope MCP servers ($name) reach $SOURCE_DIR, so the installer cannot tell which one re-exports its tools" \
                "./install.sh --link --ide-only --mcp-name <the server your client actually lists>"
            ;;
        project)
            echo "   ⚠️  '$name' reaches this checkout but is registered for one project only."
            echo "      Slash commands are global, so the default is used instead."
            record_warn "Slash commands named mcp__${COMMAND_SERVER_NAME}__ by default" \
                "'$name' serves this checkout but is project-scoped, and ~/.claude/commands/tls applies to every project" \
                "register '$name' at user scope (claude mcp add-json $name '<json>' --scope user), then re-run ./install.sh --link --ide-only"
            ;;
    esac
    return 0
}

setup_claude_code_commands() {
    # Generation lives in Node, not jq + perl: Node 22 is already a hard
    # requirement of this repo, so the adapter has no extra dependencies to
    # probe for. The script stages and swaps atomically on its own.
    echo "   - Generating slash commands in $CLAUDE_COMMANDS_DIR (domains: $DOMAINS)..."

    local count
    if count=$(node "$SOURCE_DIR/scripts/generate-ide-commands.mjs" \
        --out "$CLAUDE_COMMANDS_DIR" \
        --server "$COMMAND_SERVER_NAME" \
        --domains "$DOMAINS" \
        --source "$SOURCE_DIR" \
        --agent claude-code); then
        echo "   ✅ Generated $count slash command(s) calling mcp__${COMMAND_SERVER_NAME}__<tool>."
        echo "      Invoke them as /tls:<name>."
        record_ok "Claude Code slash commands ($count, tools: mcp__${COMMAND_SERVER_NAME}__) → $CLAUDE_COMMANDS_DIR"
        return 0
    fi

    echo "   ⚠️  Slash command generation failed — $CLAUDE_COMMANDS_DIR left untouched."
    echo "      WHAT THIS AFFECTS: /tls:<name> slash commands in Claude Code."
    echo "      Any previously generated commands still work — the generator stages"
    echo "      and swaps atomically, so nothing was half-written or corrupted."
    echo "      The MCP server is registered separately and is unaffected."
    record_warn "Claude Code slash commands not regenerated" \
        "generate-ide-commands.mjs exited non-zero; the existing command directory was left intact rather than partially overwritten" \
        "node $SOURCE_DIR/scripts/generate-ide-commands.mjs --out $CLAUDE_COMMANDS_DIR --server $COMMAND_SERVER_NAME --domains $DOMAINS --source $SOURCE_DIR --agent claude-code"
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
    # Order matters: commands must know whether a proxy fronts this checkout
    # before they are written, or they bake a tool name that does not exist.
    resolve_command_server_name
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
    echo "      WHAT THIS AFFECTS: $label will not see the tech-lead-stack tools."
    echo "      Your existing config was NOT modified — the merge writes to a temp"
    echo "      file and only swaps on success, so nothing was corrupted. Other"
    echo "      IDEs configured in this run are unaffected."
    echo "      Usually this means the file is not valid JSON, or is read-only."
    record_warn "$label MCP not registered" \
        "could not merge the server block into $file (invalid JSON or not writable); the file was left exactly as it was" \
        "check the file parses (node -e \"JSON.parse(require('fs').readFileSync('$file','utf8'))\"), then re-run ./install.sh --link --ide-only"
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
    # The registration name. The name slash commands call is resolved per-client
    # and reported by resolve_command_server_name() when it differs.
    echo "   IDE mode: $IDE_MODE | MCP registration name: $MCP_SERVER_NAME | Domains: $DOMAINS"
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

# 2. Python Setup
# Optional: only the Playwright-backed visual tools read requirements.txt, so a
# bad interpreter must degrade to a warning rather than dump a traceback that
# reads as a failed install.
#
# The common macOS failure: Homebrew's python@3.14 bottle links pyexpat against
# the *system* /usr/lib/libexpat.1.dylib, which does not export
# _XML_SetAllocTrackerActivationThreshold. Homebrew's own expat (1.12.4) does.
# Because the path is baked into the .so, `brew reinstall python@3.14` and
# `brew link --overwrite expat` do NOT fix it — verified on 3.14.6 and 3.14.7.
# Pointing dyld at the Homebrew expat is what actually works.
echo "🐍 Ensuring Python dependencies are met..."

# pip imports xmlrpc -> pyexpat while building its command table, so an
# interpreter with a broken expat extension fails every install despite
# `pip --version` looking fine. Probe both. $2, when set, is a dyld search path
# to try the probe under.
python_can_pip() {
    env ${2:+DYLD_LIBRARY_PATH="$2"} "$1" -m pip --version >/dev/null 2>&1 \
        && env ${2:+DYLD_LIBRARY_PATH="$2"} "$1" -c "import xml.parsers.expat" >/dev/null 2>&1
}

BREW_EXPAT_LIB=""
for _p in /opt/homebrew/opt/expat/lib /usr/local/opt/expat/lib; do
    [[ -d "$_p" ]] && BREW_EXPAT_LIB="$_p" && break
done

PY_BIN=""
PY_DYLD=""
for candidate in python3 python3.13 python3.12 python3.11; do
    command -v "$candidate" &>/dev/null || continue
    if python_can_pip "$candidate"; then
        PY_BIN="$candidate"
        break
    fi
    if [[ -n "$BREW_EXPAT_LIB" ]] && python_can_pip "$candidate" "$BREW_EXPAT_LIB"; then
        PY_BIN="$candidate"
        PY_DYLD="$BREW_EXPAT_LIB"
        echo "   - $candidate has the known Homebrew libexpat mismatch — working around it via $BREW_EXPAT_LIB."
        break
    fi
    echo "   - $candidate cannot run pip (broken stdlib extension) — trying the next interpreter."
done

# Deps go in a venv owned by this checkout, never system-wide. A venv sidesteps
# PEP 668 (which blocks system installs on Homebrew/Debian pythons by design),
# keeps the user's global site-packages untouched, and is removable with `rm -rf`.
# It is shared by every project linked to this stack, since the deps belong to
# the stack rather than to any consumer project.
VENV_DIR="$SOURCE_DIR/.venv"

if [[ -z "$PY_BIN" ]]; then
    echo "   ⚠️  No working Python 3 interpreter found — skipping Python dependencies."
    echo "      WHY THIS IS NOT A FAILURE: the stack's own tooling is Node-based."
    echo "      Every entry in rtk.tools runs via cat/bash/node/npx, so nothing you"
    echo "      invoke day to day needs Python. The install below is unaffected."
    echo "      IF YOU WANT PYTHON ANYWAY: install a working interpreter, e.g."
    echo "        brew install pyenv && pyenv install 3.12 && pyenv global 3.12"
    echo "      then re-run this installer. Note that on Homebrew python@3.14 a"
    echo "      reinstall does NOT help — the bad libexpat path is baked into"
    echo "      pyexpat.so, so a different interpreter is the only real fix."
    record_warn "Python dependencies not installed (no working interpreter)" \
        "no Python 3 on PATH could run pip; on macOS this is usually the Homebrew python@3.14 libexpat bug" \
        "install a working interpreter (e.g. pyenv install 3.12) and re-run ./install.sh --link"
else
    [[ "$PY_BIN" != "python3" ]] && echo "   - Using $PY_BIN (python3 is unusable)."
    PIP_LOG="$(mktemp "${TMPDIR:-/tmp}/tls-pip.XXXXXX")"

    # The venv inherits the base interpreter's stdlib, so a libexpat workaround
    # that the base needs applies to the venv's python too.
    PY_ENV=(env)
    [[ -n "$PY_DYLD" ]] && PY_ENV=(env DYLD_LIBRARY_PATH="$PY_DYLD")

    if [[ ! -x "$VENV_DIR/bin/python" ]] \
        && ! "${PY_ENV[@]}" "$PY_BIN" -m venv "$VENV_DIR" >"$PIP_LOG" 2>&1; then
        echo "   ⚠️  Could not create the virtualenv at $VENV_DIR — skipping Python deps."
        echo "      WHY THIS IS NOT A FAILURE: the stack's tooling is Node-based;"
        echo "      no rtk tool shells out to Python. Everything else installs normally."
        echo "      Last lines of the log:"
        tail -5 "$PIP_LOG" | sed 's/^/      | /'
        record_warn "Python virtualenv could not be created" \
            "$PY_BIN -m venv failed (see $PIP_LOG); often a missing python3-venv package on Debian/Ubuntu" \
            "install the venv module (e.g. apt install python3-venv), then re-run ./install.sh --link"
    elif "${PY_ENV[@]}" "$VENV_DIR/bin/pip" install -r "$SOURCE_DIR/requirements.txt" --quiet >"$PIP_LOG" 2>&1; then
        echo "   ✅ Python dependencies installed into $VENV_DIR"
        echo "      Activate with: source $VENV_DIR/bin/activate"
        record_ok "Python dependencies → $VENV_DIR"
        rm -f "$PIP_LOG"
    elif grep -q "Failed building wheel\|failed-wheel-build-for-install" "$PIP_LOG" 2>/dev/null; then
        # The pins in requirements.txt predate this interpreter, so a dependency
        # has no prebuilt wheel and pip falls back to compiling it from source.
        PY_VER="$("${PY_ENV[@]}" "$VENV_DIR/bin/python" -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null || echo "?")"
        echo "   ⚠️  A dependency has no prebuilt wheel for Python $PY_VER — skipping Python deps."
        echo "      WHY THIS IS NOT A FAILURE: the stack's tooling is Node-based;"
        echo "      no rtk tool shells out to Python. Everything else installs normally."
        echo "      WHAT HAPPENED: requirements.txt pins versions that predate Python"
        echo "      $PY_VER, so pip tried to compile from source and the build failed."
        echo "      The cleanest fix is an older interpreter, not a newer compiler:"
        echo "        python3.12 -m venv $VENV_DIR && $VENV_DIR/bin/pip install -r $SOURCE_DIR/requirements.txt"
        tail -5 "$PIP_LOG" | sed 's/^/      | /'
        record_warn "Python dependencies not installed (no wheel for Python $PY_VER)" \
            "requirements.txt pins versions older than Python $PY_VER, so a dependency had to build from source and failed; full log at $PIP_LOG" \
            "use an older interpreter: rm -rf $VENV_DIR && python3.12 -m venv $VENV_DIR && $VENV_DIR/bin/pip install -r $SOURCE_DIR/requirements.txt"
    else
        echo "   ⚠️  pip install failed inside the virtualenv — continuing without Python deps."
        echo "      WHY THIS IS NOT A FAILURE: the stack's tooling is Node-based;"
        echo "      no rtk tool shells out to Python. Everything else installs normally."
        echo "      Last lines of the log:"
        tail -5 "$PIP_LOG" | sed 's/^/      | /'
        record_warn "Python dependencies not installed (pip failed in venv)" \
            "the virtualenv exists but pip could not install requirements.txt; full log at $PIP_LOG" \
            "retry with: $VENV_DIR/bin/pip install -r $SOURCE_DIR/requirements.txt"
    fi
fi

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
        echo "   ⚠️  Still not authenticated — continuing."
        echo "      WHAT THIS AFFECTS: only the tools that call GitHub — PR creation,"
        echo "      PR review, and issue lookups. Skills, slash commands, MCP servers"
        echo "      and every local tool work normally without it."
        echo "      This is a credential you have to enter yourself, so the installer"
        echo "      cannot do it for you — it is not a bug in the install."
        record_warn "GitHub CLI not authenticated" \
            "gh is installed but has no credentials, and auth is interactive so the installer cannot complete it for you" \
            "run 'gh auth login' in any terminal — no need to re-run the installer afterwards"
    fi
else
    echo "   - Already authenticated with GitHub."
    record_ok "GitHub CLI authenticated"
fi

# 4. RTK Setup & Immediate Pre-Flight Check
# The RTK installer is pinned to the v0.50.0 tag's commit and hash-checked before
# it runs; RTK_VERSION pins the binary it downloads, which it checksum-verifies
# itself. To upgrade RTK, bump all three values together.
RTK_VERSION="v0.50.0"
RTK_INSTALLER_URL="https://raw.githubusercontent.com/rtk-ai/rtk/1d87b8e719ce0a50c223cd93ca64dd16921f9aec/install.sh"
RTK_INSTALLER_SHA256="d6eb73a772903e13ff34ee1be8a8b24e896ba9a978f20d2279a08b4083ea6f77"
if ! command -v rtk &> /dev/null; then
    echo "🛠️ Installing RTK ${RTK_VERSION}..."
    RTK_INSTALLER="$(mktemp "${TMPDIR:-/tmp}/rtk-install.XXXXXX")"
    if curl -fsSL "$RTK_INSTALLER_URL" -o "$RTK_INSTALLER"; then
        if command -v sha256sum &> /dev/null; then
            RTK_INSTALLER_ACTUAL="$(sha256sum "$RTK_INSTALLER" | awk '{print $1}')"
        else
            RTK_INSTALLER_ACTUAL="$(shasum -a 256 "$RTK_INSTALLER" | awk '{print $1}')"
        fi
        if [ "$RTK_INSTALLER_ACTUAL" = "$RTK_INSTALLER_SHA256" ]; then
            RTK_VERSION="$RTK_VERSION" sh "$RTK_INSTALLER"
        else
            echo "❌ RTK installer checksum mismatch (expected $RTK_INSTALLER_SHA256, got $RTK_INSTALLER_ACTUAL) — not running it."
        fi
    else
        echo "❌ Could not download the RTK installer."
    fi
    rm -f "$RTK_INSTALLER"
fi

if command -v rtk &> /dev/null; then
    echo "🤖 Initializing RTK..."
    (cd "$TARGET_DIR" && rtk init)
    
    echo "📡 Running Mission Control Pre-Flight..."
    # A fresh project has no .ai/.mission-alignment.json yet, so this check is
    # expected to decline on a first install. Report it as informational —
    # surfacing it as a failure alarms every new user for a non-problem.
    if ! (cd "$TARGET_DIR" && bash "$SOURCE_DIR/scripts/rtk-run.sh" run mission-control); then
        echo "   - Pre-flight declined, which is the expected result on a first install:"
        echo "     .ai/.mission-alignment.json is written by an agent the first time it"
        echo "     calls verify_mission_alignment, so it cannot exist yet. Nothing is"
        echo "     broken and no action is needed — it resolves itself on first agent use."
        record_warn "Mission Control pre-flight did not run" \
            "a fresh project has no .ai/.mission-alignment.json yet — it is written by an agent on its first skill call, so this is expected on a new install and not an error" \
            "nothing to do; it clears itself the first time an agent runs a stack skill in this project"
    fi
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

