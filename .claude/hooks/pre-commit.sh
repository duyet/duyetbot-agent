#!/bin/bash
#
# Pre-Commit Hook for duyetbot-agent
# Runs fast checks on staged files before commit
#
# Checks:
# 1. Biome lint/format on staged files (with auto-fix)
# 2. No secrets or .env files committed
# 3. No debug statements in production code
# 4. No large files (>1MB)
# 5. Quick TypeScript check on small changesets
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

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

echo -e "${BLUE}🔍 Running pre-commit checks...${NC}"
echo ""

HAS_ERRORS=0

# ============================================
# Check 1: Biome lint/format on staged files
# ============================================
STAGED_CODE_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx|json|jsonc)$' || true)

if [ -n "$STAGED_CODE_FILES" ]; then
  echo -e "${BLUE}📝 Checking staged files with Biome...${NC}"

  # Run Biome check on staged files only (with auto-fix)
  if ! echo "$STAGED_CODE_FILES" | xargs biome check --write 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Biome found issues. Auto-fixing...${NC}"

    # Re-add fixed files to staging
    echo "$STAGED_CODE_FILES" | xargs git add 2>/dev/null || true
    echo -e "${GREEN}✓ Biome fixes applied and staged${NC}"
  else
    echo -e "${GREEN}✓ Biome check passed${NC}"
  fi
fi

# ============================================
# Check 2: No secrets or sensitive files
# ============================================
echo ""
echo -e "${BLUE}🔐 Checking for secrets...${NC}"

# Check for .env files (except examples)
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '\.env$|\.env\.[^example]' | grep -v '\.example' || true)
if [ -n "$ENV_FILES" ]; then
  echo -e "${RED}✗ ERROR: Attempting to commit .env files:${NC}"
  echo "$ENV_FILES"
  echo -e "${YELLOW}  Add these to .gitignore or use .env.example${NC}"
  HAS_ERRORS=1
fi

# Check for common secret patterns in staged content
PATTERNS=(
  "ANTHROPIC_API_KEY\s*=\s*sk-"
  "OPENAI_API_KEY\s*=\s*sk-"
  "TELEGRAM_BOT_TOKEN\s*=\s*[0-9]+:"
  "GITHUB_TOKEN\s*=\s*ghp_"
  "OPENROUTER_API_KEY\s*=\s*sk-"
  "AWS_SECRET_ACCESS_KEY\s*=\s*[A-Za-z0-9/+=]{40}"
  "password\s*[:=]\s*['\"][^'\"]{8,}['\"]"
)

SECRET_FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if git diff --cached -U0 | grep -qE "$pattern"; then
    echo -e "${RED}✗ ERROR: Potential secret detected matching pattern${NC}"
    SECRET_FOUND=1
    HAS_ERRORS=1
  fi
done

if [ $SECRET_FOUND -eq 0 ] && [ $HAS_ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ No secrets detected${NC}"
fi

# ============================================
# Check 3: No debug statements in production code
# ============================================
echo ""
echo -e "${BLUE}🐛 Checking for debug statements...${NC}"

# Exclude test files and CLI scripts from debug check
PROD_FILES=$(echo "$STAGED_CODE_FILES" | grep -v -E '\.test\.|\.spec\.|__tests__|__mocks__|\.config\.|^scripts/' || true)

if [ -n "$PROD_FILES" ]; then
  DEBUG_FOUND=0
  DEBUGGER_FOUND=0

  # Check for console.log (warning only - might be intentional)
  LOG_FILES=$(echo "$PROD_FILES" | xargs grep -l 'console\.log(' 2>/dev/null || true)
  if [ -n "$LOG_FILES" ]; then
    echo -e "${YELLOW}⚠️  WARNING: console.log() found in:${NC}"
    echo "$LOG_FILES" | head -5 | sed 's/^/    /'
    DEBUG_FOUND=1
  fi

  # Check for debugger statements (error - blocks execution)
  DEBUGGER_FILES=$(echo "$PROD_FILES" | xargs grep -l '^[[:space:]]*debugger' 2>/dev/null || true)
  if [ -n "$DEBUGGER_FILES" ]; then
    echo -e "${RED}✗ ERROR: debugger statement found in:${NC}"
    echo "$DEBUGGER_FILES" | head -5 | sed 's/^/    /'
    HAS_ERRORS=1
    DEBUGGER_FOUND=1
  fi

  if [ $DEBUG_FOUND -eq 0 ] && [ $DEBUGGER_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No debug statements found${NC}"
  fi
else
  echo -e "${GREEN}✓ No production files to check${NC}"
fi

# ============================================
# Check 4: No large files (>1MB)
# ============================================
echo ""
echo -e "${BLUE}📦 Checking file sizes...${NC}"

MAX_SIZE=1048576  # 1MB in bytes
LARGE_FILES_FOUND=0

for file in $STAGED_FILES; do
  if [ -f "$file" ]; then
    SIZE=$(wc -c < "$file" 2>/dev/null | tr -d ' ' || echo 0)
    if [ "$SIZE" -gt "$MAX_SIZE" ]; then
      SIZE_KB=$((SIZE / 1024))
      echo -e "${RED}✗ ERROR: $file is ${SIZE_KB}KB (max 1024KB)${NC}"
      HAS_ERRORS=1
      LARGE_FILES_FOUND=1
    fi
  fi
done

if [ $LARGE_FILES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✓ All files under size limit${NC}"
fi

# ============================================
# Check 5: TypeScript errors (quick check for small changesets)
# ============================================
TS_FILES=$(echo "$STAGED_CODE_FILES" | grep -E '\.tsx?$' || true)

if [ -n "$TS_FILES" ]; then
  echo ""
  echo -e "${BLUE}🔧 Quick TypeScript check...${NC}"

  FILE_COUNT=$(echo "$TS_FILES" | wc -l | tr -d ' ')

  if [ "$FILE_COUNT" -lt 10 ]; then
    # Quick check - full validation happens in pre-push
    if bun run type-check 2>&1 | grep -q "error TS"; then
      echo -e "${YELLOW}⚠️  TypeScript errors detected (will be caught in pre-push)${NC}"
    else
      echo -e "${GREEN}✓ TypeScript check passed${NC}"
    fi
  else
    echo -e "${YELLOW}⏭️  Skipping TS check (${FILE_COUNT} files - deferred to pre-push)${NC}"
  fi
fi

# ============================================
# Final result
# ============================================
echo ""
if [ $HAS_ERRORS -ne 0 ]; then
  echo -e "${RED}❌ Pre-commit checks failed!${NC}"
  echo -e "${YELLOW}💡 Fix the errors above or use 'git commit --no-verify' to skip${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Pre-commit checks passed!${NC}"
echo ""
