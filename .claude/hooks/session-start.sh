#!/bin/bash
#
# Claude Code Session Start Hook
# Automatically sets up the development environment when a new session starts
#

set -e

echo "🚀 Setting up development environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 Installing dependencies..."
  npm install
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Install git hooks
echo ""
echo "🔧 Setting up git hooks..."
npm run prepare-hooks
echo -e "${GREEN}✓ Git hooks installed${NC}"

echo ""
echo -e "${GREEN}✅ Development environment ready!${NC}"
echo ""
