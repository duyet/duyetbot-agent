#!/usr/bin/env bash
# Trigger GitHub Actions Agent workflow locally using gh CLI
#
# Usage:
#   ./scripts/trigger-agent.sh "Fix the bug in authentication"
#   ./scripts/trigger-agent.sh "Add new feature" --model anthropic/claude-opus-4-20250514
#   ./scripts/trigger-agent.sh "Test task" --dry-run --task-source file
#   ./scripts/trigger-agent.sh "Work on existing task" --task-id github-123

set -e

# Default values
MODEL="anthropic/claude-sonnet-4-20250514"
TIMEOUT="60"
DRY_RUN="false"
TASK_SOURCE="all"
TASK_ID=""

# Parse arguments
TASK="$1"
shift

while [[ $# -gt 0 ]]; do
  case $1 in
    --model)
      MODEL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --task-source)
      TASK_SOURCE="$2"
      shift 2
      ;;
    --task-id)
      TASK_ID="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 <task> [options]"
      echo ""
      echo "Arguments:"
      echo "  task              Task description for the agent (required)"
      echo ""
      echo "Options:"
      echo "  --model MODEL     AI model to use (default: anthropic/claude-sonnet-4-20250514)"
      echo "  --timeout MIN     Timeout in minutes (default: 60)"
      echo "  --dry-run         Run without making real changes"
      echo "  --task-source SRC Task source: github-issues, file, memory, all (default: all)"
      echo "  --task-id ID      Specific task ID to run (overrides creating new issue)"
      echo "  -h, --help        Show this help message"
      echo ""
      echo "Available models:"
      echo "  - anthropic/claude-sonnet-4-20250514"
      echo "  - anthropic/claude-opus-4-20250514"
      echo "  - anthropic/claude-haiku-4-20250514"
      echo "  - google/gemini-2.5-flash"
      echo "  - google/gemini-2.5-pro"
      echo "  - openai/gpt-4o"
      echo "  - openai/gpt-4o-mini"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use -h or --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required argument
if [[ -z "$TASK" ]]; then
  echo "Error: Task description is required"
  echo "Usage: $0 <task> [options]"
  echo "Use -h or --help for usage information"
  exit 1
fi

# Get the repo from git
REPO=$(git config --get remote.origin.url | sed -E 's|git@github.com:([^/]+)/([^/]+).git|\1/\2|' | sed -E 's|https://github.com/([^/]+)/([^/]+).git|\1/\2|')

if [[ -z "$REPO" ]]; then
  echo "Error: Could not determine repository from git config"
  exit 1
fi

echo "🤖 Triggering GitHub Actions Agent workflow..."
echo "   Repository: $REPO"
echo "   Task: $TASK"
echo "   Model: $MODEL"
echo "   Timeout: ${TIMEOUT}min"
echo "   Dry Run: $DRY_RUN"
echo "   Task Source: $TASK_SOURCE"
if [[ -n "$TASK_ID" ]]; then
  echo "   Task ID: $TASK_ID"
fi
echo ""

# Build gh command
GH_CMD="gh workflow run github-actions-agent.yml \
  --repo $REPO \
  --ref $(git branch --show-current) \
  -f task=\"$TASK\" \
  -f model=\"$MODEL\" \
  -f timeout=\"$TIMEOUT\" \
  -f dry_run=$DRY_RUN \
  -f task_source=\"$TASK_SOURCE"

if [[ -n "$TASK_ID" ]]; then
  GH_CMD="$GH_CMD -f task_id=\"$TASK_ID\""
fi

GH_CMD="$GH_CMD\""

# Execute
eval $GH_CMD

# Get the run URL
RUN_ID=$(gh run list --repo $REPO --workflow=github-actions-agent.yml --limit 1 --json databaseId --jq '.[0].databaseId')

if [[ -n "$RUN_ID" ]]; then
  echo ""
  echo "✅ Workflow triggered successfully!"
  echo "   Run: https://github.com/$REPO/actions/runs/$RUN_ID"
  echo ""
  echo "View logs with:"
  echo "  gh run watch $RUN_ID --repo $REPO"
  echo ""
  echo "Or view in browser:"
  echo "  gh run view $RUN_ID --repo $REPO --web"
fi
