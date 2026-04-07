#!/bin/bash
# -----------------------------------------------------------------------------
# Script: validate-skills.sh
# Description: Validates that AI Skill files (.md) adhere to the required 
#              structure, specifically checking for YAML frontmatter and 
#              mandatory metadata fields (e.g., 'name').
# 
# Usage: 
#   ./scripts/validate-skills.sh [file1.md file2.md ...]
#
# Defaults:
#   If no files are provided, it validates all files in '.ai/skills/*.md'.
# -----------------------------------------------------------------------------

# Exit immediately if a command exits with a non-zero status
set -e

# Argument handling: Support specific files (e.g., from lint-staged) or default to all skills
if [ $# -eq 0 ]; then
  # Use an array to handle globbing safely and avoid issues if no files match
  files=(.ai/skills/*.md)
else
  # Use the provided file list from CLI arguments
  files=("$@")
fi

# Track validation status across multiple files
EXIT_CODE=0

# Iterate through each skill file for validation
for file in "${files[@]}"; do
  # Skip if the file doesn't exist (handles literal glob return if the directory is empty)
  [[ -f "$file" ]] || continue

  echo "🔍 Checking skill file: $file..."

  # 1. Frontmatter Start Validation
  # The file MUST start with '---' (allowing for optional leading BOM or whitespace)
  # This is critical for the parser to identify the metadata block.
  first_line=$(sed -n '1p' "$file")
  if [[ ! "$first_line" =~ ^[[:space:]]*--- ]]; then
    # Output GitHub Actions error annotation
    echo "::error file=$file,line=1::Missing YAML Frontmatter start marker (---)"
    echo "Error: Missing Frontmatter in $file"
    EXIT_CODE=1
  fi

  # 2. Mandatory Metadata Field: 'name'
  # The 'name' field is used as the primary identifier in the skill registry.
  if ! grep -q "^name:" "$file"; then
     # Output GitHub Actions error annotation
     echo "::error file=$file::Missing mandatory 'name' field in frontmatter"
     echo "Error: Missing 'name' in $file"
     EXIT_CODE=1
  fi

  # Check for 'description' field in frontmatter
  if ! grep -q "^description:" "$file"; then
     echo "::error file=$file::Missing 'description' field in frontmatter"
     echo "Error: Missing 'description' in $file"
     EXIT_CODE=1
  fi

  # Check for 'cost' field in frontmatter
  if ! grep -q "^cost:" "$file"; then
     echo "::error file=$file::Missing 'cost' field (token estimate) in frontmatter"
     echo "Error: Missing 'cost' in $file"
     EXIT_CODE=1
  fi
done

# Final exit based on validation results
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Skill validation failed."
  exit 1
fi

echo "✅ All skills validated successfully."
