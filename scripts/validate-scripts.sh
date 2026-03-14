#!/bin/bash

# scripts/validate-scripts.sh
# Verifies that all files in the scripts/ directory are executable.

set -e

EXIT_CODE=0

for script in scripts/*; do
  # Skip directories
  [[ -f "$script" ]] || continue

  if [[ ! -x "$script" ]]; then
    echo "::error file=$script::Script is not executable. Run 'chmod +x $script'"
    echo "Error: $script is not executable."
    EXIT_CODE=1
  fi
done

if [ $EXIT_CODE -ne 0 ]; then
  exit 1
fi

echo "All scripts verified as executable."
