#!/bin/bash
# Local development script for duyetbot-web
# Starts both Next.js dev server and Wrangler dev server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting duyetbot-web local development...${NC}"

# Default Wrangler port
WRANGLER_PORT=${WRANGLER_PORT:-8787}
export WRANGLER_PORT

# Create logs directory
mkdir -p logs

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"

    # Kill tail if running
    if [ -n "$TAIL_PID" ]; then
        kill $TAIL_PID 2>/dev/null || true
    fi

    # Kill the Wrangler dev server
    if [ -n "$WRANGLER_PID" ]; then
        echo -e "${GREEN}Stopping Wrangler dev server (PID: $WRANGLER_PID)...${NC}"
        kill $WRANGLER_PID 2>/dev/null || true
    fi

    # Kill Next.js dev server
    if [ -n "$NEXT_PID" ]; then
        echo -e "${GREEN}Stopping Next.js dev server (PID: $NEXT_PID)...${NC}"
        kill $NEXT_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}All servers stopped.${NC}"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler not found. Install it with: bun add -D wrangler${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Start Wrangler dev server in background (using dev config without assets)
echo -e "${BLUE}Starting Wrangler dev server on port ${WRANGLER_PORT}...${NC}"
wrangler dev --local --port $WRANGLER_PORT --config wrangler.dev.toml > logs/wrangler.log 2>&1 &
WRANGLER_PID=$!

# Wait for Wrangler to be ready
echo -e "${YELLOW}Waiting for Wrangler to start...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:$WRANGLER_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}Wrangler is ready!${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}Timeout waiting for Wrangler to start. Check logs/wrangler.log${NC}"
        tail -50 logs/wrangler.log
        exit 1
    fi
    sleep 0.5
done

# Start Next.js dev server in background (using dev:ui to avoid recursion)
echo -e "${BLUE}Starting Next.js dev server on port 3002...${NC}"
bun run dev:ui > logs/nextjs.log 2>&1 &
NEXT_PID=$!

# Wait for Next.js to be ready (give it more time for initial compilation)
echo -e "${YELLOW}Waiting for Next.js to start...${NC}"
for i in {1..90}; do
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo -e "${GREEN}Next.js is ready!${NC}"
        break
    fi
    if [ $i -eq 90 ]; then
        echo -e "${RED}Timeout waiting for Next.js to start. Check logs/nextjs.log${NC}"
        echo -e "${YELLOW}--- Last 50 lines of nextjs.log ---${NC}"
        tail -50 logs/nextjs.log
        cleanup
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Both servers are running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  • Frontend: ${BLUE}http://localhost:3002${NC}"
echo -e "  • Backend API: ${BLUE}http://localhost:${WRANGLER_PORT}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Logs are being written to:"
echo -e "  • ${YELLOW}logs/wrangler.log${NC}"
echo -e "  • ${YELLOW}logs/nextjs.log${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Tail the logs in background (strip ANSI codes for cleaner output)
tail -f logs/wrangler.log logs/nextjs.log 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' &
TAIL_PID=$!

# Wait for either process to exit
wait $WRANGLER_PID $NEXT_PID

# If we get here, one of the processes exited
cleanup
