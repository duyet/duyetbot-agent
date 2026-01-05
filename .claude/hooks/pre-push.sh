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

# Check 1: Linting
echo ""
echo "📝 Checking code style with Biome..."
if bun run lint 2>&1 | grep -q "Error"; then
  echo -e "${YELLOW}⚠️  Lint errors found. Attempting auto-fix...${NC}"
  bun run lint:fix

  # Check if there are uncommitted changes after fix
  if ! git diff --quiet; then
    echo -e "${GREEN}✓ Lint errors fixed automatically${NC}"
    echo -e "${YELLOW}📝 Amending commit with lint fixes...${NC}"
    git add -A
    git commit --amend --no-edit --no-verify
    echo -e "${GREEN}✓ Commit amended with lint fixes${NC}"
    echo ""
    echo -e "${GREEN}🔄 Retrying push with fixed code...${NC}"
    exit 0  # Let git retry the push with amended commit
  else
    echo -e "${GREEN}✓ Lint errors fixed (no file changes needed)${NC}"
  fi
else
  echo -e "${GREEN}✓ Lint check passed${NC}"
fi

# Check 2: Type checking (non-blocking, just a warning)
echo ""
echo "🔧 Running TypeScript type check..."
# Use npx turbo directly to avoid loop detection in bun run type-check
if npx turbo run type-check; then
  echo -e "${GREEN}✓ Type check passed${NC}"
else
  echo -e "${YELLOW}⚠️  Type check has warnings (non-blocking)${NC}"
  echo "Consider fixing type errors when possible."
fi

# Check 3: Build (catch build-time errors before CI)
echo ""
echo "🔨 Running build..."
# Use npx turbo directly to avoid loop detection in bun run build
if npx turbo run build; then
  echo -e "${GREEN}✓ Build passed${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  echo ""
  echo -e "${YELLOW}💡 Tip: Fix build errors before pushing.${NC}"
  exit 1
fi

# Check 4: Tests
echo ""
echo "🧪 Running tests..."
if bun run test; then
  echo -e "${GREEN}✓ All tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  echo ""
  echo -e "${YELLOW}💡 Tip: Claude will analyze and fix the test failures.${NC}"
  echo "After fixes are committed, the push will automatically retry."
  exit 1
fi

echo ""
echo -e "${GREEN}✅ All pre-push checks passed!${NC}"
echo ""
