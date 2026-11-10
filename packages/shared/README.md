# scalemaker-chrome-mcp-shared

Internal shared types, constants, and message contracts used by the [scalemaker-chrome-mcp](https://github.com/scalemaker-ship-it/scalemaker-chrome-mcp) Chrome extension and the [`scalemaker-chrome-mcp-bridge`](https://www.npmjs.com/package/scalemaker-chrome-mcp-bridge) Node.js Native Messaging host.

**Not intended for direct end-user consumption.** Public APIs are not guaranteed stable across minor versions — pin a specific version if you depend on it.

## Install

```bash
npm install scalemaker-chrome-mcp-shared
```

## Usage

```ts
import { TOOL_NAMES, NativeMessageType } from 'scalemaker-chrome-mcp-shared';
```

Subpath exports: `constants`, `types`, `tools`, `rr-graph`, `step-types`, `labels`, `node-spec`, `node-spec-registry`, `node-specs-builtin`, `agent-types`.

## Links

- Source & issues: <https://github.com/scalemaker-ship-it/scalemaker-chrome-mcp>
- Bridge package: <https://www.npmjs.com/package/scalemaker-chrome-mcp-bridge>

## License

MIT
