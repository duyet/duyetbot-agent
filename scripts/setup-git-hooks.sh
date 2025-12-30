#!/bin/bash
# Setup Git hooks for autonomous AI development

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

echo "Setting up Git hooks for duyetbot-agent development..."
echo ""

# Create commit-msg hook
echo "Installing commit-msg hook..."
cat > "$HOOKS_DIR/commit-msg" << 'EOF'
#!/bin/bash
# Ensure co-author is included in commits

COMMIT_MSG_FILE=$1
REQUIRED_CO_AUTHOR="Co-Authored-By: duyetbot <duyetbot@users.noreply.github.com>"

if ! grep -q "$REQUIRED_CO_AUTHOR" "$COMMIT_MSG_FILE"; then
    echo "" >> "$COMMIT_MSG_FILE"
    echo "$REQUIRED_CO_AUTHOR" >> "$COMMIT_MSG_FILE"
fi
EOF

chmod +x "$HOOKS_DIR/commit-msg"
echo "✓ commit-msg hook installed"
echo ""

# Create pre-commit hook for quality gates
echo "Installing pre-commit hook..."
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Run quality checks before commit

set -e

echo "Running pre-commit checks..."

# Run type-check on staged TypeScript files
if git diff --cached --name-only | grep -q '\.ts$'; then
    echo "→ Type checking..."
    bun run type-check || {
        echo "❌ Type check failed. Fix errors before committing."
        exit 1
    }
fi

# Run linter on staged files
if git diff --cached --name-only | grep -qE '\.(ts|tsx|js|jsx)$'; then
    echo "→ Linting..."
    bun run lint || {
        echo "❌ Lint failed. Fix issues before committing."
        exit 1
    }
fi

echo "✅ All checks passed"
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "✓ pre-commit hook installed"
echo ""

# Create post-commit hook for Ralph state updates
echo "Installing post-commit hook..."
cat > "$HOOKS_DIR/post-commit" << 'EOF'
#!/bin/bash
# Update Ralph state after each commit

set -e

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
RALPH_STATE="$PROJECT_ROOT/.ralph-state.json"

if [ -f "$RALPH_STATE" ]; then
    # Increment iteration counter
    ITERATION=$(jq '.iteration + 1' "$RALPH_STATE")
    jq ".iteration = $ITERATION | .last_commit = \"$(git rev-parse HEAD)\" | .last_commit_at = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$RALPH_STATE" > "$RALPH_STATE.tmp"
    mv "$RALPH_STATE.tmp" "$RALPH_STATE"

    # Stage and commit the updated state
    git add "$RALPH_STATE" 2>/dev/null || true
fi
EOF

chmod +x "$HOOKS_DIR/post-commit"
echo "✓ post-commit hook installed"
echo ""

echo "✅ All Git hooks installed successfully!"
echo ""
echo "Active hooks:"
echo "  • commit-msg - Auto-adds duyetbot co-author"
echo "  • pre-commit - Runs type-check and lint"
echo "  • post-commit - Updates Ralph state"
echo ""
echo "The hooks ensure every commit follows autonomous AI development standards."
