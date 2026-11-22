# ⚫⚪ go.xcf.ai — online Go

🤖 **Made with [AgentiLoop Agent!](https://github.com/AgentiLoop/Agent)**, the autonomous AI agent for your Mac · 🌐 [agentiloop.ai](https://agentiloop.ai) · ▶️ **Play:** [go.xcf.ai](https://go.xcf.ai)

Play Go (baduk / weiqi) in the browser at **https://go.xcf.ai**. Built by [AgentiLoop Agent!](https://agentiloop.ai).

- **🤖 vs Computer:** play Black or White against a built-in heuristic player (captures, saving groups in atari, no self-atari, no filling its own eyes, 3rd/4th-line openings).
- **👥 Same screen:** two players take turns on one device, with undo.
- **🌐 Online:** create a room, share the `/r/<code>` link. The first two people to join play Black and White, everyone after that watches. Refresh or reconnect and you keep your color.
- 9×9, 13×13 and 19×19 boards. Area (Chinese) scoring with 6.5 komi, ko and suicide rules, two passes end the game, "Show area" overlay.

## How it's built

| Part | File | Runs on |
|---|---|---|
| Rules engine (captures, ko, suicide, scoring, computer player) | `public/engine.js` | Browser **and** Durable Object (same file) |
| Board UI (canvas, lobby, hot-seat, online client) | `public/index.html`, `app.js`, `style.css` | Browser |
| Room codes + static assets + WebSocket routing | `src/index.js` (`fetch`) | Cloudflare Worker |
| One online game per room, server-side move validation | `src/index.js` (`GoRoom`) | Durable Object (SQLite storage) |

No framework, no build step, no image files: the board and stones are drawn on a canvas.

## Run / test / deploy
```sh
npm install
npm run dev                         # http://localhost:8787
npm test                            # rules engine tests
node test/e2e.mjs http://localhost:8787   # two players + a spectator over WebSockets
npm run deploy                      # creates the go.xcf.ai custom domain
```
Sister site: [chess.xcf.ai](https://chess.xcf.ai).
