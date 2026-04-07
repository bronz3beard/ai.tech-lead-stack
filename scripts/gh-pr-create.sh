#!/bin/bash
# -----------------------------------------------------------------------------
# Script: gh-pr-create.sh
# Description: Automates the creation of GitHub Pull Requests using the GitHub CLI (gh).
#              Designed to be called by AI agents via the RTK (Run Tool Kit).
# 
# Usage: ./scripts/gh-pr-create.sh "<title>" "<body>" "[base_branch]"
#
# Parameters:
#   1: title - The title of the PR (Required)
#   2: body  - The markdown-formatted description of the PR (Required)
#   3: base  - The target base branch (Optional, defaults to 'main')
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

# Validate mandatory arguments
if [ -z "$TITLE" ] || [ -z "$BODY" ]; then
    # Return JSON error for cleaner AI agent parsing
    echo "{\"status\": \"error\", \"message\": \"Missing mandatory 'title' or 'body' arguments.\"}"
    exit 1
fi

# Execute GitHub CLI to create the PR
# Strategy: Creates the PR as a 'draft' by default to allow for final verification
gh pr create --title "$TITLE" --body "$BODY" --draft --base "$BASE"

# Final status reporting
if [ $? -eq 0 ]; then
    echo "{\"status\": \"success\", \"message\": \"Draft PR created successfully.\"}"
else
    echo "{\"status\": \"error\", \"message\": \"GitHub CLI failed to create the PR.\"}"
    exit 1
fi