#!/bin/bash

# --- Git Intelligence Parser ---
# This script extracts cultural patterns from the git history for 
# the Codebase Intelligence skill.

echo "🔍 Parsing Git Culture..."

# 1. Identify Merge Strategy
MERGE_COMMITS=$(git log --merges -n 20 --oneline | wc -l)
if [ "$MERGE_COMMITS" -gt 5 ]; then
    STRATEGY="Merge-heavy (likely GitFlow or GitHub Flow)"
else
    STRATEGY="Rebase-heavy (likely Trunk-based Development)"
fi

# 2. Extract Commit Prefixes (Conventional Commits check)
PREFIXES=$(git log -n 50 --pretty=format:"%s" | cut -d':' -f1 | sort | uniq -c | sort -nr | head -n 5)

# 3. Analyze Branch Naming Patterns
BRANCHES=$(git branch -a | grep -v 'remotes' | sed 's/*//' | sed 's/ //g' | grep '/' | cut -d'/' -f1 | sort | uniq -c | sort -nr)

# 4. Check for Title/Body/Footer (Conventional structure)
SAMPLE_BODY=$(git log -n 1 --pretty=format:"%b")
if [ -z "$SAMPLE_BODY" ]; then
    STRUCTURE="Single-line title (Flat)"
else
    STRUCTURE="Multi-line (Title/Body/Footer pattern detected)"
fi

# --- Output Report for Agent Consumption ---
echo "--- GIT CULTURE DATA ---"
echo "Merge Strategy: $STRATEGY"
echo "Detected Commits Structure: $STRUCTURE"
echo "Top Commit Prefixes:"
echo "$PREFIXES"
echo "Common Branch Prefixes:"
echo "$BRANCHES"
echo "--- END REPORT ---"