"""
RP-AI Interview Assistant - Cross-Platform One-Command Launcher & Tunnel Manager.

Usage:
    python start.py          -> Launch backend and frontend locally (http://localhost:5173)
    python start.py --share  -> Launch locally AND create a public HTTPS tunnel for remote live access
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

IS_WINDOWS = sys.platform.startswith("win")
PYTHON_BIN = BACKEND_DIR / "venv" / ("Scripts" if IS_WINDOWS else "bin") / ("python.exe" if IS_WINDOWS else "python3")
UVICORN_BIN = BACKEND_DIR / "venv" / ("Scripts" if IS_WINDOWS else "bin") / ("uvicorn.exe" if IS_WINDOWS else "uvicorn")

processes: list[subprocess.Popen] = []


def cleanup(signum=None, frame=None):
    print("\n\033[33m🛑 Shutting down all servers and tunnels...\033[0m")
    for p in processes:
        try:
            if IS_WINDOWS:
                p.terminate()
            else:
                p.send_signal(signal.SIGTERM)
        except Exception:
            pass
    sys.exit(0)


def main():
    share_mode = "--share" in sys.argv or "-s" in sys.argv

    print("\033[1;36m")
    print("  ╔═══════════════════════════════════════════════════════════════╗")
    print("  ║             RP-AI Interview Assistant - Launcher              ║")
    print("  ╚═══════════════════════════════════════════════════════════════╝")
    print("\033[0m")

    # Check venv
    if not UVICORN_BIN.exists():
        print(f"\033[33m⚠️  Backend virtual environment not found at {UVICORN_BIN}\033[0m")
        print("   Please create it in backend/venv first.")
        sys.exit(1)

    # Check node_modules
    if not (FRONTEND_DIR / "node_modules").exists():
        print("\033[33m📦 Installing frontend packages...\033[0m")
        npm_cmd = "npm.cmd" if IS_WINDOWS else "npm"
        subprocess.run([npm_cmd, "install"], cwd=FRONTEND_DIR, check=True)

    # Register exit handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # Start FastAPI Backend
    print("🚀 \033[1mStarting FastAPI Backend\033[0m on http://localhost:8000...")
    backend_proc = subprocess.Popen(
        [str(UVICORN_BIN), "app.main:app", "--port", "8000", "--reload"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    processes.append(backend_proc)

    # Start Vite Frontend
    print("🎨 \033[1mStarting Vite Frontend\033[0m on http://localhost:5173...")
    npm_cmd = "npm.cmd" if IS_WINDOWS else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    processes.append(frontend_proc)

    time.sleep(2.0)

    print("\n\033[1;32m✅ Local App is Live & Ready!\033[0m")
    print("   👉 \033[1mLocal Browser UI:\033[0m   http://localhost:5173")
    print("   👉 \033[1mAPI Documentation:\033[0m  http://localhost:8000/docs\n")

    # If --share is requested, start a public HTTPS tunnel
    if share_mode:
        print("\033[1;35m🌐 Initializing Secure Public Tunnel (Live Access from Anywhere)...\033[0m")
        try:
            import urllib.request
            ip_pass = urllib.request.urlopen("https://loca.lt/mytunnelpassword", timeout=3).read().decode('utf-8').strip()
            print(f"   🔑 \033[33mNote for first-time visitors:\033[0m If loca.lt prompts for a Tunnel Password, enter: \033[1;32m{ip_pass}\033[0m\n")
        except Exception:
            pass
        
        npx_cmd = "npx.cmd" if IS_WINDOWS else "npx"
        tunnel_proc = subprocess.Popen(
            [npx_cmd, "localtunnel", "--port", "5173"],
            cwd=str(ROOT_DIR),
        )
        processes.append(tunnel_proc)


    print("\033[1mPress [Ctrl + C] anytime to stop all servers.\033[0m\n")

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
