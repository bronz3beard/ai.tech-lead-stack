#!/bin/bash
# -----------------------------------------------------------------------------
# Script: gh-pr-create.sh
# Description: Automates the creation of GitHub Pull Requests using the GitHub CLI (gh).
#              Designed to be called by AI agents via the RTK (Run Tool Kit).
# 
# Usage: ./scripts/gh-pr-create.sh "<title>" "<body_file>" "[base_branch]" "[head_branch]"
#
# Parameters:
#   1: title      - The title of the PR (Required)
#   2: body_file  - The path to the markdown-formatted description of the PR (Required)
#   3: base       - The target base branch (Optional, defaults to 'main')
#   4: head       - The head branch to open the PR from (Optional, defaults to current branch)
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated.
# -----------------------------------------------------------------------------

# Argument extraction with fallback defaults
TITLE="${1:-}"
BODY_FILE="${2:-}"
BASE="${3:-main}"
HEAD="${4:-}"

# Validate mandatory arguments
if [ -z "$TITLE" ] || [ -z "$BODY_FILE" ]; then
    echo '{"status": "error", "message": "Missing mandatory title or body_file arguments."}'
    return 1 2>/dev/null || exit 1
fi

if [ ! -f "$BODY_FILE" ]; then
    echo '{"status": "error", "message": "Body file not found."}'
    return 1 2>/dev/null || exit 1
fi

# Determine head branch if not provided
if [ -z "$HEAD" ]; then
    HEAD=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ -z "$HEAD" ]; then
        echo '{"status": "error", "message": "Could not determine head branch."}'
        return 1 2>/dev/null || exit 1
    fi
fi

echo "🚀 Creating draft PR: $TITLE" >&2

# Base command
CMD=(gh pr create --title "$TITLE" --body-file "$BODY_FILE" --draft --base "$BASE" --head "$HEAD")

# Execute GitHub CLI and capture output
OUTPUT=$("${CMD[@]}" 2>&1)
EXIT_CODE=$?

# Final status reporting
if [ $EXIT_CODE -eq 0 ]; then
    # gh pr create returns the PR URL on stdout on success
    PR_URL=$(echo "$OUTPUT" | grep -o 'https://github.com/.*')

    # Attempt to extract PR number from URL
    PR_NUMBER=""
    if [[ "$PR_URL" =~ /pull/([0-9]+) ]]; then
        PR_NUMBER="${BASH_REMATCH[1]}"
    fi

    echo "{\"status\": \"success\", \"message\": \"Draft PR created successfully.\", \"url\": \"$PR_URL\", \"number\": \"$PR_NUMBER\"}"
else
    # Output the error to stderr and return the JSON contract to stdout
    echo "GitHub CLI failed:" >&2
    echo "$OUTPUT" >&2
    echo '{"status": "error", "message": "GitHub CLI failed to create the PR."}'
    return 1 2>/dev/null || exit 1
fi
