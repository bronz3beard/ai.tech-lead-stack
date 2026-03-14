#!/bin/bash
# tech-lead-stack installer

SOURCE_DIR=$(pwd)
TARGET_DIR=$(realpath "${2:-.}")

if [[ "$1" == "--link" ]]; then
    echo "🚀 Initializing Tech-Lead Stack..."

    # 1. Symlinks (Robust & Forced)
    mkdir -p "$TARGET_DIR/.github"
    ln -sf "$SOURCE_DIR/.ai" "$TARGET_DIR/.ai"
    ln -sf "$SOURCE_DIR/scripts" "$TARGET_DIR/scripts"
    ln -sf "$SOURCE_DIR/templates/PULL_REQUEST_TEMPLATE.md" "$TARGET_DIR/.github/PULL_REQUEST_TEMPLATE.md"

    # 2. Python Setup
    echo "🐍 Ensuring Python dependencies are met..."
    pip install -r "$SOURCE_DIR/requirements.txt" --quiet

    # 3. RTK Setup & Immediate Pre-Flight Check
    if command -v npx &> /dev/null; then
        echo "🤖 Initializing RTK..."
        (cd "$TARGET_DIR" && npx rtk init --yes)
        
        echo "📡 Running Mission Control Pre-Flight..."
        # We tell RTK to run the mission-control check immediately
        (cd "$TARGET_DIR" && npx rtk run mission-control)
    fi

    echo "✨ Initialization complete."
else
    echo "Usage: ./install.sh --link [target_path]"
    exit 1
fi