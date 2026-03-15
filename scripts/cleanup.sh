#!/bin/bash
# tech-lead-stack cleanup
# Usage: ./scripts/cleanup.sh [target_path]

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET_DIR=$(realpath "${1:-.}")

echo "🧹 Starting cleanup in: $TARGET_DIR"

# List of files/folders to remove (Only if they are symlinks or specific RTK configs)
PATHS_TO_CLEAN=(
    ".ai"
    "scripts"
    "rtk.json"
    ".github/PULL_REQUEST_TEMPLATE.md"
)

for item in "${PATHS_TO_CLEAN[@]}"; do
    FILE_PATH="$TARGET_DIR/$item"
    
    if [ -L "$FILE_PATH" ]; then
        echo "🗑️ Removing symlink: $item"
        rm "$FILE_PATH"
    elif [ -f "$FILE_PATH" ] && [[ "$item" == "rtk.json" ]]; then
        echo "🗑️ Removing RTK config: $item"
        rm "$FILE_PATH"
    fi
done

# Optional: Remove empty .github folder if it was created by us
if [ -d "$TARGET_DIR/.github" ] && [ -z "$(ls -A "$TARGET_DIR/.github")" ]; then
    echo "📂 Removing empty .github directory"
    rmdir "$TARGET_DIR/.github"
fi

echo "✨ Project cleaned. AI environment reset."