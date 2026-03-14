#!/bin/bash
# tech-lead-stack installer

SOURCE_DIR=$(pwd)
TARGET_DIR=$(realpath "${2:-.}")

if [[ "$1" == "--link" ]]; then
    echo "🚀 Initializing Tech-Lead Stack..."

    # 1. Symlinks (Robust & Non-Recursive)
    mkdir -p "$TARGET_DIR/.github"
    
    # helper for safe symlinking
    safe_ln() {
       local src="$1"
       local dest="$2"
       # Don't symlink if source and target are identical
       if [[ "$(realpath -m "$src")" == "$(realpath -m "$dest")" ]]; then
           echo "   - Skipping identical path: $dest"
           return
       fi
       ln -nfs "$src" "$dest"
    }

    echo "🔗 Linking components..."
    safe_ln "$SOURCE_DIR/.ai" "$TARGET_DIR/.ai"
    safe_ln "$SOURCE_DIR/scripts" "$TARGET_DIR/scripts"
    safe_ln "$SOURCE_DIR/templates/PULL_REQUEST_TEMPLATE.md" "$TARGET_DIR/.github/PULL_REQUEST_TEMPLATE.md"

    # 2. Python Setup
    echo "🐍 Ensuring Python dependencies are met..."
    python3 -m pip install -r "$SOURCE_DIR/requirements.txt" --quiet

    # 3. RTK Setup & Immediate Pre-Flight Check
    if ! command -v rtk &> /dev/null; then
        echo "🛠️ Installing RTK via curl..."
        curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
    fi

    if command -v rtk &> /dev/null; then
        echo "🤖 Initializing RTK..."
        (cd "$TARGET_DIR" && rtk init)
        
        echo "📡 Running Mission Control Pre-Flight..."
        (cd "$TARGET_DIR" && rtk run mission-control)
    else
        echo "❌ RTK setup failed. Please install it manually: https://rtk-ai.app"
    fi

    echo "✨ Initialization complete."
    echo ""
    echo "💡 Tip: To use 'rtk run <tool>' natively in this project, run:"
    echo "   alias rtk='$(pwd)/scripts/rtk-run.sh'"
else
    echo "Usage: ./install.sh --link [target_path]"
    exit 1
fi