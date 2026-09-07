#!/bin/sh
# View Scale of Everything locally. ES modules need a real origin,
# so opening index.html directly from disk will not work.
cd "$(dirname "$0")"
(sleep 1; command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:8080/ || open http://127.0.0.1:8080/) 2>/dev/null &
echo "Serving at http://127.0.0.1:8080/  (Ctrl-C to stop)"
exec python3 -m http.server 8080
