#!/bin/bash
# -----------------------------------------------------------------------------
# Script: validate-skills.sh
# Description: Validates that AI Skill files (.md) adhere to the required 
#              structure, specifically checking for YAML frontmatter and 
#              mandatory metadata fields (e.g., 'name', 'modes', 'surface').
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
  else
    cost_val=$(grep "^cost:" "$file" | sed 's/^cost:[[:space:]]*//' | tr -d '\r')
    if [[ ! "$cost_val" =~ ^~[0-9]+[[:space:]]+tokens$ ]]; then
      echo "::error file=$file::Invalid 'cost' format. Expected '~N tokens' but got '$cost_val'"
      echo "Error: Invalid 'cost' format in $file"
      EXIT_CODE=1
    fi
  fi

  # Check for 'modes' field in frontmatter
  if ! grep -q "^modes:" "$file"; then
     echo "::error file=$file::Missing 'modes' field in frontmatter"
     echo "Error: Missing 'modes' in $file"
     EXIT_CODE=1
  else
    modes_val=$(grep "^modes:" "$file" | sed 's/^modes:[[:space:]]*\[\(.*\)\]/\1/')
    modes_val=$(echo "$modes_val" | sed 's/[[:space:]]//g' | tr -d '\r')
    IFS=',' read -ra modes_arr <<< "$modes_val"
    for mode in "${modes_arr[@]}"; do
      if [[ "$mode" != "read-only" && "$mode" != "write" && "$mode" != "mcp" ]]; then
        echo "::error file=$file::Invalid mode '$mode' in 'modes' field. Must be 'read-only', 'write', or 'mcp'"
        echo "Error: Invalid 'modes' in $file"
        EXIT_CODE=1
      fi
    done
    if [[ ! ",${modes_val}," =~ ",read-only," ]]; then
      echo "::error file=$file::'modes' field must include 'read-only'"
      echo "Error: 'modes' missing 'read-only' in $file"
      EXIT_CODE=1
    fi
  fi

  # Check for 'surface' field in frontmatter
  if ! grep -q "^surface:" "$file"; then
     echo "::error file=$file::Missing 'surface' field in frontmatter"
     echo "Error: Missing 'surface' in $file"
     EXIT_CODE=1
  else
    surface_val=$(grep "^surface:" "$file" | sed 's/^surface:[[:space:]]*//' | tr -d '\r')
    if [[ "$surface_val" != "public" && "$surface_val" != "internal" ]]; then
      echo "::error file=$file::Invalid 'surface' value '$surface_val'. Must be 'public' or 'internal'"
      echo "Error: Invalid 'surface' in $file"
      EXIT_CODE=1
    fi
  fi

  # Check for 'kind' field in frontmatter
  if ! grep -q "^kind:" "$file"; then
     echo "::error file=$file::Missing 'kind' field in frontmatter"
     echo "Error: Missing 'kind' in $file"
     EXIT_CODE=1
  else
    kind_val=$(grep "^kind:" "$file" | sed 's/^kind:[[:space:]]*//' | tr -d '\r')
    if [[ "$kind_val" != "skill" && "$kind_val" != "orchestrator" && "$kind_val" != "policy" && "$kind_val" != "report" ]]; then
      echo "::error file=$file::Invalid 'kind' value '$kind_val'. Must be 'skill', 'orchestrator', 'policy', or 'report'"
      echo "Error: Invalid 'kind' in $file"
      EXIT_CODE=1
    fi
  fi

  # Check for 'domain' field in frontmatter
  if ! grep -q "^domain:" "$file"; then
     echo "::error file=$file::Missing 'domain' field in frontmatter"
     echo "Error: Missing 'domain' in $file"
     EXIT_CODE=1
  else
    domain_val=$(grep "^domain:" "$file" | sed 's/^domain:[[:space:]]*//' | tr -d '\r')
    if [[ "$domain_val" != "eng" && "$domain_val" != "product" && "$domain_val" != "hiring" && "$domain_val" != "shared" ]]; then
      echo "::error file=$file::Invalid 'domain' value '$domain_val'. Must be 'eng', 'product', 'hiring', or 'shared'"
      echo "Error: Invalid 'domain' in $file"
      EXIT_CODE=1
    fi
  fi

  # Check for 'ownership' field in frontmatter
  if ! grep -q "^ownership:" "$file"; then
     echo "::error file=$file::Missing 'ownership' field in frontmatter"
     echo "Error: Missing 'ownership' in $file"
     EXIT_CODE=1
  fi

  # Check for 'targets' field in frontmatter
  if ! grep -q "^targets:" "$file"; then
     echo "::error file=$file::Missing 'targets' field in frontmatter"
     echo "Error: Missing 'targets' in $file"
     EXIT_CODE=1
  fi

  # Check for 'phase' or 'spans'
  has_phase=false
  has_spans=false
  if grep -q "^phase:" "$file"; then
    has_phase=true
    phase_val=$(grep "^phase:" "$file" | sed 's/^phase:[[:space:]]*//' | tr -d '\r')
    valid_phases=("intent" "specify" "plan" "build" "maintain" "review" "scale" "deploy" "polish")
    is_valid_phase=false
    for valid_phase in "${valid_phases[@]}"; do
      if [[ "$phase_val" == "$valid_phase" ]]; then
        is_valid_phase=true
        break
      fi
    done
    if [ "$is_valid_phase" = false ]; then
      echo "::error file=$file::Invalid 'phase' value '$phase_val'."
      echo "Error: Invalid 'phase' in $file"
      EXIT_CODE=1
    fi
  fi

  if grep -q "^spans:" "$file"; then
    has_spans=true
  fi

  if [ "$has_phase" = false ] && [ "$has_spans" = false ]; then
     echo "::error file=$file::Missing 'phase' or 'spans' field in frontmatter"
     echo "Error: Missing 'phase' or 'spans' in $file"
     EXIT_CODE=1
  fi

done

echo "🔍 Checking registry drift..."
if ! ./node_modules/.bin/tsx packages/core/scripts/generate-skill-registry.ts --check; then
  echo "::error::Skill registry (manifest or README) is out of sync. Please run 'npm run generate:registry'"
  echo "Error: Skill registry drift detected."
  EXIT_CODE=1
fi

# Final exit based on validation results
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Skill validation failed."
  exit 1
fi

echo "✅ All skills validated successfully."