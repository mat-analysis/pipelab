#!/usr/bin/env bash
# Run pipelab locally: sets up the venv, starts the MLflow UI (port 5000)
# and the pipelab server (port 8000).
set -euo pipefail

cd "$(dirname "$0")"

WORKDIR="./workdir"
PORT=8000
MLFLOW_PORT=5000
RELOAD=""

usage() {
    echo "Usage: ./run.sh [--workdir DIR] [--port PORT] [--mlflow-port PORT] [--reload]"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --workdir) WORKDIR="$2"; shift 2 ;;
        --port) PORT="$2"; shift 2 ;;
        --mlflow-port) MLFLOW_PORT="$2"; shift 2 ;;
        --reload) RELOAD="--reload"; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

WORKDIR="$(cd "$WORKDIR" && pwd)"

# ── Virtual environment ───────────────────────────────────────────────────────
if [[ ! -x .venv/bin/python ]]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

if ! .venv/bin/python -c "import pipelab" >/dev/null 2>&1; then
    echo "Installing pipelab (editable)..."
    .venv/bin/pip install -e .
fi

# ── MLflow UI (background) ────────────────────────────────────────────────────
MLFLOW_PID=""
cleanup() {
    if [[ -n "$MLFLOW_PID" ]] && kill -0 "$MLFLOW_PID" 2>/dev/null; then
        echo "Stopping MLflow UI (pid $MLFLOW_PID)..."
        kill "$MLFLOW_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Note: use 127.0.0.1 (not localhost) — on macOS, AirPlay may answer localhost:5000.
echo "Starting MLflow UI on http://127.0.0.1:$MLFLOW_PORT (store: $WORKDIR/mlruns)"
.venv/bin/mlflow ui \
    --backend-store-uri "$WORKDIR/mlruns" \
    --port "$MLFLOW_PORT" \
    >/dev/null 2>&1 &
MLFLOW_PID=$!

# ── pipelab server (foreground) ─────────────────────────────────────────────────
echo "Starting pipelab on http://localhost:$PORT (workdir: $WORKDIR)"
.venv/bin/pipelab serve --workdir "$WORKDIR" --port "$PORT" $RELOAD
