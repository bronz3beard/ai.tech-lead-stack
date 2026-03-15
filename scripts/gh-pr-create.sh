#!/bin/bash
# @tool pr-creator
# @description Creates a GitHub PR using gh-cli via rtk.
# @param title - The title of the PR
# @param body - The markdown body of the PR

set -e

TITLE="${1:-}"
BODY="${2:-}"

if [ -z "$TITLE" ] || [ -z "$BODY" ]; then
    echo "{\"status\": \"error\", \"message\": \"Missing title or body\"}"
    exit 1
fi

# RTK provides clear context, reducing the need for agent 'pre-talk'
gh pr create --title "$TITLE" --body "$BODY" --draft --base main

if [ $? -eq 0 ]; then
    echo "{\"status\": \"success\", \"message\": \"PR Created\"}"
else
    echo "{\"status\": \"error\", \"message\": \"PR Creation Failed\"}"
    exit 1
fi