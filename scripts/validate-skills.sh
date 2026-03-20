#!/bin/bash

# scripts/validate-skills.sh
# Validates that AI Skill files (.md) have the required frontmatter and fields.

set -e

# Support both individual files (from lint-staged) or default to all skills
if [ $# -eq 0 ]; then
  # Use an array to handle globbing safely
  files=(.ai/skills/*.md)
else
  files=("$@")
fi

EXIT_CODE=0

for file in "${files[@]}"; do
  # Skip if file doesn't exist (glob might return literal if no matches)
  [[ -f "$file" ]] || continue

  echo "Checking $file..."

  # Check for frontmatter start (must be the first line, allowing optional BOM or whitespace)
  # Using sed to get the first line and then grep to check for ---
  first_line=$(sed -n '1p' "$file")
  if [[ ! "$first_line" =~ ^[[:space:]]*--- ]]; then
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
