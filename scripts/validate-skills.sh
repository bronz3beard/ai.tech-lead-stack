#!/bin/bash

# scripts/validate-skills.sh
# Validates that AI Skill files (.md) have the required frontmatter and fields.

set -e

# Support both individual files (from lint-staged) or default to all skills
FILES=${@:-.ai/skills/*.md}

EXIT_CODE=0

for file in $FILES; do
  # Skip if file doesn't exist (glob might return literal if no matches)
  [[ -f "$file" ]] || continue

  echo "Checking $file..."

  # Check for frontmatter start (using -- to avoid grep option error)
  if ! head -n 1 "$file" | grep -q -- "---"; then
    echo "::error file=$file,line=1::Missing Frontmatter (---)"
    echo "Error: Missing Frontmatter in $file"
    EXIT_CODE=1
  fi

  # Check for 'name' field in frontmatter
  if ! grep -q "^name:" "$file"; then
     echo "::error file=$file::Missing 'name' field in frontmatter"
     echo "Error: Missing 'name' in $file"
     EXIT_CODE=1
  fi
done

if [ $EXIT_CODE -ne 0 ]; then
  exit 1
fi

echo "All skills validated successfully."
