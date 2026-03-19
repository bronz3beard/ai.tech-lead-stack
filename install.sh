#!/bin/bash
# tech-lead-stack installer

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET_DIR=$(realpath "${2:-.}")

if [[ "$1" == "--link" ]]; then
    echo "🚀 Initializing Tech-Lead Stack..."

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

    echo "✨ Initialization complete."
    echo ""

    # 5. Native Alias Automation
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

    if [ "$ALIAS_ADDED" = true ]; then
        echo ""
        echo "💡 Tip: Restart your terminal or run \`source ~/.zshrc\` (or .bashrc) to use 'rtk run <tool>' natively!"
    else
        echo "💡 Tip: We couldn't find your .zshrc or .bashrc. To use 'rtk run <tool>' natively, manually run:"
        echo "   $ALIAS_CMD"
    fi
else
    echo "Usage: ./install.sh --link [target_path]"
    exit 1
fi