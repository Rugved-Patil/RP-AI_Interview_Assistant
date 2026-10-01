#!/usr/bin/env bash

# ==============================================================================
# RP-AI Interview Assistant - One-Command Launcher & Live Share
# ==============================================================================
# Usage:
#   ./run.sh          -> Starts backend & frontend locally (http://localhost:5173)
#   ./run.sh --share  -> Starts locally AND generates a public HTTPS URL (e.g. for Germany)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PYTHON_BIN="$BACKEND_DIR/venv/bin/python3"
UVICORN_BIN="$BACKEND_DIR/venv/bin/uvicorn"

SHARE_MODE=false
if [[ "$1" == "--share" || "$1" == "-s" ]]; then
  SHARE_MODE=true
fi

# Text styling
BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
MAGENTA="\033[35m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════════════════════════╗"
echo "  ║             RP-AI Interview Assistant - Launcher              ║"
echo "  ╚═══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Check for backend virtual environment
if [ ! -f "$UVICORN_BIN" ]; then
  echo -e "${YELLOW}⚠️  Backend virtual environment not found in backend/venv.${RESET}"
  echo -e "   Please create it using: cd backend && python3 -m venv venv && pip install -r requirements.txt"
  exit 1
fi

# Check for frontend node_modules
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo -e "${YELLOW}📦 Installing frontend dependencies (first time run)...${RESET}"
  (cd "$FRONTEND_DIR" && npm install)
fi

# Cleanup child processes on exit
cleanup() {
  echo -e "\n${YELLOW}🛑 Shutting down backend, frontend, and tunnels...${RESET}"
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$FRONTEND_PID" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [ -n "$TUNNEL_PID" ]; then kill "$TUNNEL_PID" 2>/dev/null || true; fi
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo -e "🚀 ${BOLD}Starting FastAPI Backend${RESET} on http://localhost:8000..."
(cd "$BACKEND_DIR" && "$UVICORN_BIN" app.main:app --port 8000 --reload) > /dev/null 2>&1 &
BACKEND_PID=$!

echo -e "🎨 ${BOLD}Starting Vite Frontend${RESET} on http://localhost:5173..."
(cd "$FRONTEND_DIR" && npm run dev) > /dev/null 2>&1 &
FRONTEND_PID=$!

# Wait for frontend server to become responsive
sleep 2

echo ""
echo -e "${GREEN}✅ Local App is Live!${RESET}"
echo -e "   👉 Local Browser UI: ${BOLD}http://localhost:5173${RESET}"
echo -e "   👉 API Documentation: ${CYAN}http://localhost:8000/docs${RESET}"
echo ""

# Handle --share tunnel mode
if [ "$SHARE_MODE" = true ]; then
  echo -e "${MAGENTA}🌐 Initializing Secure Public Tunnel (Live Access from Germany / Anywhere)...${RESET}"
  echo -e "   (Anyone with this link can use your live app and test data in their browser)"
  echo ""

  if command -v cloudflared &> /dev/null; then
    echo -e "   ${CYAN}⚡ Using Cloudflare Tunnel (Zero-password instant link)${RESET}"
    cloudflared tunnel --url http://localhost:5173 &
    TUNNEL_PID=$!
  else
    # Fetch tunnel IP password for localtunnel
    IP_PASS=$(curl -s https://loca.lt/mytunnelpassword 2>/dev/null || curl -s https://api.ipify.org 2>/dev/null || echo "Your Public IP")
    echo -e "   ${CYAN}⚡ Using Localtunnel${RESET}"
    if [ -n "$IP_PASS" ]; then
      echo -e "   🔑 ${YELLOW}Note for first-time visitors:${RESET} If loca.lt prompts for a Tunnel Password, enter: ${BOLD}${GREEN}$IP_PASS${RESET}"
      echo ""
    fi
    npx localtunnel --port 5173 &
    TUNNEL_PID=$!
  fi
fi



echo -e "${BOLD}Press [Ctrl + C] anytime to stop all servers.${RESET}"
echo ""

# Keep script running and wait for background processes
wait
