#!/bin/bash
#
# Claude Code Post-Bash Hook
# Triggers pre-push checks when git push commands are detected
#

# Get the bash command from $ARGUMENTS (passed by Claude Code)
BASH_COMMAND="${TOOL_CALL_COMMAND:-}"

# Check if this is a git push command
if [[ "$BASH_COMMAND" =~ ^git[[:space:]]+push ]]; then
  echo "🔍 Detected git push command, running pre-push checks..."
  # Run the pre-push checks
  exec "$(dirname "$0")/pre-push.sh"
fi

# For all other bash commands, just exit successfully
exit 0
