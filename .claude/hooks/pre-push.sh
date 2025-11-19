#!/bin/bash
#
# Claude Code Pre-Push Hook
# Automatically runs linting and tests before git push operations
# If lint errors are found, attempts to auto-fix them
#

set -e

# Skip hook in test/CI environments to avoid recursion
if [ -n "$VITEST" ] || [ -n "$CI" ] || [ -n "$SKIP_HOOKS" ]; then
  exit 0
fi

echo "🔍 Running pre-push checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if we need to commit fixes
NEED_COMMIT=false

# Check 1: Linting
echo ""
echo "📝 Checking code style with Biome..."
if npm run lint 2>&1 | grep -q "Error"; then
  echo -e "${YELLOW}⚠️  Lint errors found. Attempting auto-fix...${NC}"
  npm run lint:fix

  # Check if there are uncommitted changes after fix
  if ! git diff --quiet; then
    echo -e "${GREEN}✓ Lint errors fixed automatically${NC}"
    NEED_COMMIT=true
  else
    echo -e "${GREEN}✓ Lint errors fixed (no file changes needed)${NC}"
  fi
else
  echo -e "${GREEN}✓ Lint check passed${NC}"
fi

# Check 2: Type checking (non-blocking, just a warning)
echo ""
echo "🔧 Running TypeScript type check..."
if npm run type-check; then
  echo -e "${GREEN}✓ Type check passed${NC}"
else
  echo -e "${YELLOW}⚠️  Type check has warnings (non-blocking)${NC}"
  echo "Consider fixing type errors when possible."
fi

# Check 3: Tests
echo ""
echo "🧪 Running tests..."
if npm test; then
  echo -e "${GREEN}✓ All tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  echo ""
  echo "Please fix failing tests before pushing."
  exit 1
fi

# If we fixed lint issues, prompt to commit
if [ "$NEED_COMMIT" = true ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Lint fixes were applied to your files.${NC}"
  echo "The following files were modified:"
  git diff --name-only
  echo ""
  echo "Please review and commit these changes before pushing:"
  echo "  git add -A"
  echo "  git commit -m 'chore: apply lint fixes'"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ All pre-push checks passed!${NC}"
echo ""
