# scalemaker-chrome-mcp-bridge

Node.js Native Messaging host that connects [Claude Code](https://claude.com/claude-code) (or any MCP client) to your live Chrome browser via the [scalemaker-chrome-mcp](https://github.com/scalemaker-ship-it/scalemaker-chrome-mcp) extension.

This is the **scalemaker-chrome-mcp fork** of `mcp-chrome-bridge`, adding Force Reconnect, a Playwright CDP fallback launcher, dynamic-port negotiation, and self-healing diagnostics.

## Install

```bash
npm install -g scalemaker-chrome-mcp-bridge
```

The postinstall step will:

1. Register the Chrome Native Messaging host (user-level, no sudo).
2. Download the matching Chrome extension to `~/Downloads/scalemaker-chrome-mcp-extension-v<version>/`.
3. Print the next-step instructions for loading the extension and wiring `scalemaker-chrome-mcp-stdio` into your `.mcp.json`.

## Wire into Claude Code

Paste this into Claude Code once after install:

> Register `scalemaker-chrome-mcp-stdio` in `.mcp.json` with `command: "node"`, `args: ["<npm root -g>/scalemaker-chrome-mcp-bridge/dist/mcp/mcp-server-stdio.js"]`, `env: { "CHROME_PORT": "12320" }`. Run `npm root -g` first to resolve the path. Preserve any existing servers.

Then run `/mcp` in Claude Code to confirm `scalemaker-chrome-mcp-stdio` is connected.

## Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `~/Downloads/scalemaker-chrome-mcp-extension-v<version>/`

The extension ID is fixed at `nnajikeoafggmklbngkablkamchfmcdg` via a pinned `manifest.key`, so every install gets the same ID.

## Diagnostics

```bash
scalemaker-chrome-mcp-bridge doctor        # health check
scalemaker-chrome-mcp-bridge doctor --fix  # attempt auto-repair
scalemaker-chrome-mcp-bridge report --copy # copy a diagnostic report to clipboard
```

## Supported platforms

| OS      | Chrome | Chromium |
| ------- | ------ | -------- |
| macOS   | ✓      | ✓        |
| Linux   | ✓      | ✓        |
| Windows | ✓      | ✓        |

## Links

- Source & issues: <https://github.com/scalemaker-ship-it/scalemaker-chrome-mcp>
- Releases: <https://github.com/scalemaker-ship-it/scalemaker-chrome-mcp/releases>
- Upstream: <https://github.com/hangwin/mcp-chrome>

## License

MIT
