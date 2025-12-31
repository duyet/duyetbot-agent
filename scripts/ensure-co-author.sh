#!/bin/bash
# Ensure all commits include the duyetbot co-author
# This should be installed as a Git hook: .git/hooks/commit-msg

set -e

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Required co-author string
REQUIRED_CO_AUTHOR="Co-Authored-By: duyetbot <duyetbot@users.noreply.github.com>"

# Check if commit message already includes co-author
if echo "$COMMIT_MSG" | grep -q "$REQUIRED_CO_AUTHOR"; then
    exit 0
fi

# If not, append it automatically
echo "" >> "$COMMIT_MSG_FILE"
echo "$REQUIRED_CO_AUTHOR" >> "$COMMIT_MSG_FILE"

# Notify user (optional, comment out for silent operation)
echo "✓ Automatically added duyetbot co-author" >&2

exit 0
