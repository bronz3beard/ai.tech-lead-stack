#!/bin/bash
# -----------------------------------------------------------------------------
# Script: gh-pr-create.sh
# Description: Automates the creation of GitHub Pull Requests using the GitHub CLI (gh).
#              Designed to be called by AI agents via the RTK (Run Tool Kit).
# 
# Usage: ./scripts/gh-pr-create.sh "<title>" "<body>" "[base_branch]" "[assignee]" "[labels]"
#
# Parameters:
#   1: title    - The title of the PR (Required)
#   2: body     - The markdown-formatted description of the PR (Required)
#   3: base     - The target base branch (Optional, defaults to 'main')
#   4: assignee - The GitHub username to assign (Optional)
#   5: labels   - Comma-separated list of labels to apply (Optional)
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated.
# -----------------------------------------------------------------------------

# Exit immediately if any command fails
set -e

# Argument extraction with fallback defaults
TITLE="${1:-}"
BODY="${2:-}"
BASE="${3:-main}"
ASSIGNEE="${4:-}"
LABELS="${5:-}"

# Validate mandatory arguments
if [ -z "$TITLE" ] || [ -z "$BODY" ]; then
    # Return JSON error for cleaner AI agent parsing
    echo "{\"status\": \"error\", \"message\": \"Missing mandatory 'title' or 'body' arguments.\"}"
    exit 1
fi

echo "🚀 Creating draft PR: $TITLE" >&2

# Build the base command
CMD=(gh pr create --title "$TITLE" --body "$BODY" --draft --base "$BASE")

# Append optional flags if provided
if [ -n "$ASSIGNEE" ]; then
    echo "👤 Assigning to: $ASSIGNEE" >&2
    CMD+=("--assignee" "$ASSIGNEE")
fi

if [ -n "$LABELS" ]; then
    echo "🏷️ Applying labels: $LABELS" >&2
    CMD+=("--label" "$LABELS")
fi

# Execute GitHub CLI
"${CMD[@]}"

# Final status reporting
if [ $? -eq 0 ]; then
    echo "{\"status\": \"success\", \"message\": \"Draft PR created successfully.\"}"
else
    echo "{\"status\": \"error\", \"message\": \"GitHub CLI failed to create the PR.\"}"
    exit 1
fi