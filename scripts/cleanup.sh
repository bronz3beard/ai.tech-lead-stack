#!/bin/bash
# -----------------------------------------------------------------------------
# Script: cleanup.sh
# Description: Resets the project environment by removing AI-related symlinks,
#              configurations, and temporary templates added by Tech-Lead Stack.
# Usage: ./scripts/cleanup.sh [target_path]
# Parameters:
#   [target_path] - Optional path to the project root (defaults to current dir).
# -----------------------------------------------------------------------------

# Get the absolute path of the script directory for context if needed
SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# Resolve the target directory to cleanup (default to current working directory)
TARGET_DIR=$(realpath "${1:-.}")

echo "🧹 Starting cleanup in: $TARGET_DIR"

# List of files and folders candidate for removal
# These are typically symlinks to the Tech-Lead Stack or local RTK configs
PATHS_TO_CLEAN=(
    ".ai"
    ".agents"
    ".rtk"
    "scripts"
    "rtk.json"
    ".github/PULL_REQUEST_TEMPLATE.md"
)

# Iterate through defined paths and remove them if they meet specific criteria
for item in "${PATHS_TO_CLEAN[@]}"; do
    FILE_PATH="$TARGET_DIR/$item"
    
    # Priority 1: Remove symlinks (standard linking method for TLS)
    if [ -L "$FILE_PATH" ]; then
        echo "🗑️ Removing symlink: $item"
        rm "$FILE_PATH"
    
    # Priority 2: Remove the copied PR template if it exists as a regular file
    elif [ -f "$FILE_PATH" ] && [[ "$item" == ".github/PULL_REQUEST_TEMPLATE.md" ]]; then
        echo "🗑️ Removing copied template: $item"
        rm "$FILE_PATH"
    
    # Priority 3: Remove the local rtk.json configuration file
    elif [ -f "$FILE_PATH" ] && [[ "$item" == "rtk.json" ]]; then
        echo "🗑️ Removing RTK config: $item"
        rm "$FILE_PATH"
    fi
done

# Cleanup: Remove the .github folder only if it has become empty
if [ -d "$TARGET_DIR/.github" ] && [ -z "$(ls -A "$TARGET_DIR/.github")" ]; then
    echo "📂 Removing empty .github directory"
    rmdir "$TARGET_DIR/.github"
fi

echo "✨ Project cleaned. AI environment reset."