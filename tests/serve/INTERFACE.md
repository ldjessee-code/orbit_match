# Orbit Match tailnet interface

`test/serve-site.test.js` is the contract. Node built-ins only. Listen on `127.0.0.1` only.

## tools/serve-site.mjs

Keep `server.listen(port, '127.0.0.1')`. Do not bind `0.0.0.0`, `::`, or a tailnet address.

Before `listen`, GET `http://127.0.0.1:<port>/healthz` with a short timeout.

- Connection refused: this process is the one that should listen.
- HTTP 200 and a body that contains `orbit-match`: write `already running` to stdout and exit 0. Do not listen.
- Any other answer, including a timeout: write `not Orbit Match` to stderr and exit non-zero. Do not listen and do not pick another port.

Host check, case-insensitive, on every response including `/healthz`. Allow only:

- `localhost`
- `127.0.0.1`
- `pc.tail67a118.ts.net`
- any of those plus `:` and a decimal port

Anything else is 403 with a fixed sentence, not an echo of the header.

`GET /healthz` on an allowed host returns 200 and JSON `{"ok":true,"app":"orbit-match"}`. It is not a file in `site/`.

## tools/start-orbit-match.ps1

This file does not exist yet. It runs `node tools/serve-site.mjs` on port 8131 unless `ORBIT_MATCH_PORT` or an argument sets the port. It probes `http://127.0.0.1:<port>/healthz` first. A healthy Orbit Match exits 0. A foreign holder exits non-zero. It never says `next free port` and it never moves to another port. The node process stays in the foreground so a logon task can restart it.
