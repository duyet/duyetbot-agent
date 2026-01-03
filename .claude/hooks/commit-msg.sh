#!/bin/bash
#
# Commit Message Hook for duyetbot-agent
# Validates semantic commit message format and ensures co-author
#
# Format: <type>: <description>
#         <type>(scope): <description>
#
# Types: feat, fix, docs, test, refactor, perf, chore, ci, style, build, wip
#
# Examples:
#   feat: add streaming support
#   fix(chat): resolve memory leak in chat loop
#   docs: update deployment guide
#

set -e

# Skip in CI or when explicitly disabled
if [ -n "$CI" ] || [ -n "$SKIP_HOOKS" ]; then
  exit 0
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Skip merge commits, squash commits, and fixup commits
if echo "$COMMIT_MSG" | head -1 | grep -qE "^(Merge|Revert|fixup!|squash!|amend!)"; then
  exit 0
fi

# Get first line (subject)
SUBJECT=$(echo "$COMMIT_MSG" | head -1)

# Valid commit types
TYPES="feat|fix|docs|test|refactor|perf|chore|ci|style|build|wip"

# Regex pattern for semantic commits
# Allows optional scope: feat(scope): description
PATTERN="^($TYPES)(\([a-z0-9-]+\))?: .+"

echo -e "${BLUE}📝 Validating commit message...${NC}"

HAS_ERRORS=0

# Check format
if ! echo "$SUBJECT" | grep -qE "$PATTERN"; then
  echo ""
  echo -e "${RED}❌ Invalid commit message format!${NC}"
  echo ""
  echo -e "Your message: ${YELLOW}$SUBJECT${NC}"
  echo ""
  echo -e "Expected format: ${GREEN}<type>: <description>${NC}"
  echo -e "                 ${GREEN}<type>(scope): <description>${NC}"
  echo ""
  echo -e "Valid types: ${BLUE}feat, fix, docs, test, refactor, perf, chore, ci, style, build, wip${NC}"
  echo ""
  echo "Examples:"
  echo -e "  ${GREEN}feat: add streaming support${NC}"
  echo -e "  ${GREEN}fix(chat): resolve memory leak${NC}"
  echo -e "  ${GREEN}docs: update deployment guide${NC}"
  echo ""
  HAS_ERRORS=1
fi

# Check subject length (should be < 72 chars for git log formatting)
SUBJECT_LENGTH=${#SUBJECT}
if [ "$SUBJECT_LENGTH" -gt 72 ]; then
  echo -e "${YELLOW}⚠️  WARNING: Subject line is $SUBJECT_LENGTH characters (recommended < 72)${NC}"
fi

# Auto-add co-author if missing (required by project)
REQUIRED_CO_AUTHOR="Co-Authored-By: duyetbot <duyetbot@users.noreply.github.com>"

if ! grep -q "Co-Authored-By:" "$COMMIT_MSG_FILE"; then
  echo -e "${BLUE}📎 Adding required co-author...${NC}"
  echo "" >> "$COMMIT_MSG_FILE"
  echo "$REQUIRED_CO_AUTHOR" >> "$COMMIT_MSG_FILE"
  echo -e "${GREEN}✓ Co-author added${NC}"
fi

# Final result
if [ $HAS_ERRORS -ne 0 ]; then
  echo -e "${YELLOW}💡 Use 'git commit --no-verify' to skip validation${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Commit message format valid${NC}"
echo ""
