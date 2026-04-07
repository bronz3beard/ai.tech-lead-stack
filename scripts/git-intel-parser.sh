#!/bin/bash
# -----------------------------------------------------------------------------
# Script: git-intel-parser.sh
# Description: Extracts development cultural patterns and git workflow metadata
#              from the repository's history to inform AI agent intelligence.
# Usage: ./scripts/git-intel-parser.sh
#
# Outputs: A summary of merge strategies, commit structures, and naming conventions.
# -----------------------------------------------------------------------------

echo "🔍 Parsing Git Culture..."

# 1. Identify Merge Strategy
# Determines if the project uses merge commits (GitFlow/GitHub Flow) 
# or prefers a linear history (Rebase-heavy/Trunk-based).
MERGE_COMMITS=$(git log --merges -n 20 --oneline | wc -l)
if [ "$MERGE_COMMITS" -gt 5 ]; then
    STRATEGY="Merge-heavy (likely GitFlow or GitHub Flow)"
else
    STRATEGY="Rebase-heavy (likely Trunk-based Development)"
fi

# 2. Extract Commit Prefixes (Conventional Commits check)
# Scans the last 50 commits to identify common prefixes (fix, feat, chore, etc.)
# used to determine if the project follows Conventional Commits.
PREFIXES=$(git log -n 50 --pretty=format:"%s" | cut -d':' -f1 | sort | uniq -c | sort -nr | head -n 5)

# 3. Analyze Branch Naming Patterns
# Inspects local and remote branch names to identify prefixing conventions 
# (e.g., feature/, bugfix/, hotfix/).
BRANCHES=$(git branch -a | grep -v 'remotes' | sed 's/*//' | sed 's/ //g' | grep '/' | cut -d'/' -f1 | sort | uniq -c | sort -nr)

# 4. Check for Commit Body Structure
# Checks if recent commits include bodies/footers or are restricted to single-line titles.
SAMPLE_BODY=$(git log -n 1 --pretty=format:"%b")
if [ -z "$SAMPLE_BODY" ]; then
    STRUCTURE="Single-line title (Flat)"
else
    STRUCTURE="Multi-line (Title/Body/Footer pattern detected)"
fi

# -----------------------------------------------------------------------------
# Report Generation for Agent Consumption
# -----------------------------------------------------------------------------
echo "--- GIT CULTURE DATA ---"
echo "Merge Strategy: $STRATEGY"
echo "Detected Commits Structure: $STRUCTURE"
echo "Top Commit Prefixes:"
echo "$PREFIXES"
echo "Common Branch Prefixes:"
echo "$BRANCHES"
echo "--- END REPORT ---"