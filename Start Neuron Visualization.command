#!/bin/zsh
set -e

ROOT=${0:A:h}
cd "$ROOT"

PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
URL="http://127.0.0.1:${PORT}/#view=reconstructionPaper"
LOG="/tmp/neuron-visualization-${PORT}.log"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

sleep 0.8
open "$URL"

echo "Neuron Visualization is running at:"
echo "$URL"
echo
echo "Keep this window open while using the site. Press Control-C to stop."
wait "$SERVER_PID"
