#!/bin/bash
# -----------------------------------------------------------------------------
# Script: validate-scripts.sh
# Description: Sanitizes the scripts directory by ensuring all tool scripts 
#              have the appropriate executable permissions.
# Usage: ./scripts/validate-scripts.sh
# 
# Outputs: GitHub Actions compatible error annotations for non-executable files.
# -----------------------------------------------------------------------------

# Exit on error
set -e

# Tracking variable for overall script status
EXIT_CODE=0

# Iterate through all files in the scripts directory
for script in scripts/*; do
  # Skip directories; only process regular files
  [[ -f "$script" ]] || continue

  # Verify if the 'executable' bit is set for the current user
  if [[ ! -x "$script" ]]; then
    # Output GitHub Actions error format for CI integration
    echo "::error file=$script::Script is not executable. Run 'chmod +x $script'"
    echo "Error: $script is not executable."
    EXIT_CODE=1
  fi
done

# Final check: Fail the script if any file was invalid
if [ $EXIT_CODE -ne 0 ]; then
  exit 1
fi

echo "All scripts verified as executable."
