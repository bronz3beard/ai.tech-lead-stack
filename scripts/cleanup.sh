#!/bin/bash
# -----------------------------------------------------------------------------
# Script: cleanup.sh
# Description: Undoes a tech-lead-stack install.
#
#   By default this is PROJECT-ONLY: it unlinks the stack from one repository
#   and leaves the machine-wide setup alone. That is deliberate — one global
#   install (slash commands, MCP registrations) serves every linked project, so
#   unlinking one project must never unregister the others.
#
#   Pass --global to also remove the machine-wide state. That is opt-in and
#   previews by default; it needs --apply to actually delete anything.
#
# Usage: ./scripts/cleanup.sh [target_path] [--global] [--apply] [--dry-run]
# -----------------------------------------------------------------------------

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

TARGET_ARG=""
DO_GLOBAL=false
APPLY=true          # project-level clean applies by default, as it always has
GLOBAL_APPLY=false  # global clean previews unless --apply is given

usage() {
    cat <<'USAGE'
Usage: ./scripts/cleanup.sh [target_path] [options]

  target_path   Project to unlink (default: current directory).

Options:
  --global      Also remove machine-wide state: MCP registrations, generated
                slash commands, symlinked skills/prompts, and the shell alias.
                Previews only unless --apply is also passed.
  --apply       Perform the global removal instead of previewing it.
  --dry-run     Preview everything, including the project-level clean.
  -h, --help    Show this message.

By default only the given project is unlinked; the machine-wide install that
serves your other projects is left untouched.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --global)  DO_GLOBAL=true; shift ;;
        --apply)   GLOBAL_APPLY=true; shift ;;
        --dry-run) APPLY=false; GLOBAL_APPLY=false; shift ;;
        -h|--help) usage; exit 0 ;;
        --*)       echo "Error: unknown option $1"; usage; exit 1 ;;
        *)         TARGET_ARG="$1"; shift ;;
    esac
done

TARGET_DIR=$(realpath "${TARGET_ARG:-.}")

# --- Safety rails ------------------------------------------------------------
# Deleting from a home directory or a filesystem root is never what was meant.
# $HOME is resolved too: on macOS /var is a symlink to /private/var, so an
# unresolved comparison silently misses.
HOME_RESOLVED=$(realpath "$HOME" 2>/dev/null || echo "$HOME")
if [[ "$TARGET_DIR" == "$HOME_RESOLVED" || "$TARGET_DIR" == "$HOME" || "$TARGET_DIR" == "/" ]]; then
    echo "❌ Refusing to clean $TARGET_DIR — that is your home or filesystem root."
    exit 1
fi

# Running this inside tech-lead-stack itself would delete real tracked files
# (its own .github/PULL_REQUEST_TEMPLATE.md is a file, not a symlink).
if [[ -f "$TARGET_DIR/install.sh" && -d "$TARGET_DIR/.ai/skills" ]]; then
    echo "❌ $TARGET_DIR is the tech-lead-stack repository itself. Refusing to clean it."
    echo "   Run this from the project you want to unlink instead."
    exit 1
fi

REMOVED=()
KEPT=()
NEXT_STEPS=()

record_removed() { REMOVED+=("$1"); }
record_kept()    { KEPT+=("$1"); }

echo "🧹 Cleaning project: $TARGET_DIR"
[[ "$APPLY" == false ]] && echo "   (dry run — nothing will be deleted)"

# --- Project-level removal ---------------------------------------------------
# Target list comes from scripts/lib/install-targets.mjs, the same file the
# installer reads, so a new adapter can never leave cleanup behind.
while IFS=$'\037' read -r kind rel source label; do
    [[ -z "$kind" ]] && continue
    file_path="$TARGET_DIR/$rel"

    case "$kind" in
        symlink)
            if [[ -L "$file_path" ]]; then
                echo "   🗑️  symlink: $label"
                [[ "$APPLY" == true ]] && rm "$file_path"
                record_removed "$label"
            elif [[ -e "$file_path" ]]; then
                echo "   - keeping $label (a real file, not our symlink)"
                record_kept "$label (real file, left alone)"
            fi
            ;;
        copy)
            if [[ -L "$file_path" ]]; then
                echo "   🗑️  symlink: $label"
                [[ "$APPLY" == true ]] && rm "$file_path"
                record_removed "$label"
            elif [[ -f "$file_path" ]]; then
                # Only remove a copy that still matches what we shipped, so a
                # customised template is never destroyed.
                if [[ -f "$SOURCE_DIR/$source" ]] && cmp -s "$file_path" "$SOURCE_DIR/$source"; then
                    echo "   🗑️  unmodified copy: $label"
                    [[ "$APPLY" == true ]] && rm "$file_path"
                    record_removed "$label"
                else
                    echo "   - keeping $label (locally modified)"
                    record_kept "$label (edited locally)"
                    NEXT_STEPS+=("delete $rel by hand if you no longer want it")
                fi
            fi
            ;;
        rtk)
            if [[ -f "$file_path" || -L "$file_path" ]]; then
                echo "   🗑️  RTK config: $label"
                [[ "$APPLY" == true ]] && rm "$file_path"
                record_removed "$label"
            fi
            ;;
    esac
done < <(node -e "
    import('$SOURCE_DIR/scripts/lib/install-targets.mjs').then(m => {
      for (const t of m.projectTargets) {
        process.stdout.write([t.kind, t.path, t.source || '', t.label].join('') + '\n');
      }
    });
" 2>/dev/null)

# Prune directories that our removals just emptied.
while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    full="$TARGET_DIR/$dir"
    if [[ -d "$full" && -z "$(ls -A "$full" 2>/dev/null)" ]]; then
        echo "   📂 removing empty directory: $dir"
        [[ "$APPLY" == true ]] && rmdir "$full"
        record_removed "$dir (empty)"
    fi
done < <(node -e "
    import('$SOURCE_DIR/scripts/lib/install-targets.mjs').then(m =>
      console.log(m.pruneIfEmpty.join('\n')));
" 2>/dev/null)

# --- Global removal (opt-in) -------------------------------------------------
if [[ "$DO_GLOBAL" == true ]]; then
    echo ""
    if [[ "$GLOBAL_APPLY" == true ]]; then
        echo "🌍 Removing machine-wide tech-lead-stack state..."
        node "$SOURCE_DIR/scripts/uninstall-global.mjs" --source "$SOURCE_DIR" --apply
        record_removed "machine-wide state (MCP registrations, slash commands, shell alias)"
        NEXT_STEPS+=("restart your IDE so it drops the removed MCP servers")
        NEXT_STEPS+=("open a new terminal so the removed rtk alias disappears")
    else
        echo "🌍 Machine-wide state that --apply would remove:"
        node "$SOURCE_DIR/scripts/uninstall-global.mjs" --source "$SOURCE_DIR"
        NEXT_STEPS+=("re-run with --global --apply to remove the items listed above")
    fi
else
    record_kept "machine-wide install (slash commands, MCP registrations) — serves your other projects"
    NEXT_STEPS+=("use --global to remove the machine-wide install as well")
fi

# --- Report ------------------------------------------------------------------
echo ""
echo "────────────────────────────────────────────────────────────────"
echo "  CLEANUP REPORT"
echo "────────────────────────────────────────────────────────────────"

if [[ ${#REMOVED[@]} -gt 0 ]]; then
    echo ""
    echo "  🗑️  Removed:"
    printf '     • %s\n' "${REMOVED[@]}"
else
    echo ""
    echo "  ℹ️  Nothing to remove — this project was not linked."
fi

if [[ ${#KEPT[@]} -gt 0 ]]; then
    echo ""
    echo "  ✅ Kept:"
    printf '     • %s\n' "${KEPT[@]}"
fi

if [[ ${#NEXT_STEPS[@]} -gt 0 ]]; then
    echo ""
    echo "  👉 Next steps:"
    printf '     • %s\n' "${NEXT_STEPS[@]}"
fi

echo ""
echo "────────────────────────────────────────────────────────────────"
[[ "$APPLY" == true ]] && echo "✨ Project unlinked." || echo "✨ Dry run complete — nothing was deleted."
