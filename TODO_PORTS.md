# Todos: ports (orbit_match)

Added 2026-09-28. `AGENTS.md` now exists. Port follow-ups stay in this file. The `## Todos` section of `AGENTS.md` points here.

Decision 2026-10-10: the local Orbit Match static server listens on 8131. The script is `tools/serve-site.mjs` (a port argument or `ORBIT_MATCH_PORT` overrides 8131). 8130 remains the Jumpgate Starroute port in this note. The page does not hardcode 8130 or 8131. The peer URL comes from the query `?jumpgate=`, then localStorage, then `site/config.json`.

## Todos

### Ports: configurable, fallback, and the jumpgate_starroute peer (added 2026-09-28)

Current state (read from files on 2026-09-28; not run): orbit_match is a static site under `site/` (HTML/CSS/JS) with no server and no listen port in code. The only port reference is `BRIEF.md` line 91, `other_page = http://127.0.0.1:8080/app.html`, which points at the jumpgate_starroute page on 8080. jumpgate_starroute actually defaults to 8050 (`starroute/web/app.py`, `PTAH_PORT`), and 8050 also clashes with star_network (v3 Ptah, gamer_eye family, which keeps 8050-8119). Suggested pair: jumpgate_starroute 8130, orbit_match 8131 (Doug decides).

- [ ] Stop hardcoding the jumpgate_starroute URL. Read it from, in order: a URL query parameter (for example `?jumpgate=http://127.0.0.1:8130`), a saved setting (localStorage), a small config file in `site/` (for example `site/js/config.js`), then the default. Change the default from 8080 to the agreed jumpgate_starroute port (for example 8130), and update `BRIEF.md` line 91.
- [ ] If orbit_match gets a local server or dev-serve command, make its listen port config, not hardcoded. Precedence: CLI flag (`--port`), then env var (`ORBIT_MATCH_PORT`), then a config file entry, then the default. Default to jumpgate_starroute + 1 (for example 8131). Stay outside the gamer_eye block 8050-8119. Refuse the macOS AirPlay ports (5000, 6000, 7000, 7100).
- [ ] If that port is in use, fall back to alternatives the app picks (for example 8131, 8133, 8135, ...) or a user-supplied list (`--port-fallback` / `ORBIT_MATCH_PORT_FALLBACKS`). Prefer staying next to wherever jumpgate_starroute actually bound.
- [ ] Peer discovery: when no URL is set, try the port next to this page (own port - 1) on the same host, then the default. Check the peer with the jumpgate_starroute handshake (`GET /v1/provider` returns its product key and bound port). A static page cannot read `~/.jumpgate/ports/`; if a local server is added, it should read `~/.jumpgate/ports/jumpgate_starroute.json` and write `~/.jumpgate/ports/orbit_match.json` on start (remove it on clean exit).
- [ ] Show both ports clearly: in the page (for example a footer line `orbit_match on 127.0.0.1:8131; jumpgate_starroute peer: http://127.0.0.1:8130 (found via adjacent port)`), and as one startup line if a server is added. If the peer is missing, say so and say how to point at it.
- [ ] Document it in README.md and INTERCONNECT.md: default ports, the query parameter / setting / config file, fallback order, and how to point either app at the other by hand.
