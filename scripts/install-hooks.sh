#!/bin/bash
#
# Install git hooks for quality checks
#

echo "Installing git hooks..."

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy pre-push hook
cp .claude/hooks/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push

echo "✓ Git pre-push hook installed successfully!"
echo ""
echo "The hook will run automatically before 'git push'."
echo "To bypass temporarily, use: git push --no-verify"
