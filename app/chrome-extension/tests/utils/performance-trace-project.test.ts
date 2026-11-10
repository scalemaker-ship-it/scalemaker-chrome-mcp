/**
 * scalemaker-chrome-mcp fork(2026-11-09, Codex 교차 검토 3번): 성능 트레이스의 산출물 폴더.
 *
 * 트레이스는 탭마다 하나이고, 시작과 멈춤을 다른 세션이 부를 수 있다. 저장 폴더는 멈춘
 * 세션이 아니라 트레이스를 시작한 세션의 폴더여야 한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveArtifactToDownloads = vi.fn(async (_options: Record<string, unknown>) => ({
  downloadId: 1,
  filename: '_claude/x/2026-11-09/trace_090507.json',
}));

vi.mock('@/utils/artifact-path', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/artifact-path')>()),
  saveArtifactToDownloads: (options: Record<string, unknown>) => saveArtifactToDownloads(options),
}));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    attach: vi.fn(async () => undefined),
    detach: vi.fn(async () => undefined),
    sendCommand: vi.fn(async (_tabId: number, method: string) =>
      method === 'Performance.getMetrics' ? { metrics: [] } : {},
    ),
  },
}));

type DebuggerListener = (source: { tabId?: number }, method: string, params?: unknown) => void;

describe('performance trace — 프로젝트 폴더', () => {
  const listeners: DebuggerListener[] = [];
  const chromeAny = globalThis.chrome as unknown as Record<string, any>;
  let originalDebugger: unknown;
  let originalGet: unknown;

  beforeEach(() => {
    listeners.length = 0;
    saveArtifactToDownloads.mockClear();
    originalDebugger = chromeAny.debugger;
    originalGet = chromeAny.tabs.get;
    chromeAny.debugger = {
      onEvent: {
        addListener: vi.fn((fn: DebuggerListener) => listeners.push(fn)),
        removeListener: vi.fn(),
      },
    };
    chromeAny.tabs.get = vi.fn(async (id: number) => ({
      id,
      windowId: 1,
      url: 'https://perf.example/',
      active: true,
    }));
  });

  afterEach(() => {
    chromeAny.debugger = originalDebugger;
    chromeAny.tabs.get = originalGet;
  });

  it('A 가 시작하고 B 가 멈춘 트레이스는 A 폴더에 저장한다', async () => {
    const { performanceStartTraceTool, performanceStopTraceTool } =
      await import('@/entrypoints/background/tools/browser/performance');

    const started = await performanceStartTraceTool.execute({
      tabId: 31,
      _mcpProject: 'proj-a-0a1b2c3d',
    } as never);
    expect(started.isError).toBe(false);
    expect(listeners).toHaveLength(1);

    // 트레이스가 끝났다는 신호 (자동 멈춤과 같은 경로).
    listeners[0]({ tabId: 31 }, 'Tracing.tracingComplete');

    const stopped = await performanceStopTraceTool.execute({
      tabId: 31,
      _mcpProject: 'proj-b-1a2b3c4d',
    } as never);
    expect(stopped.isError).toBe(false);

    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
    expect(saveArtifactToDownloads.mock.calls[0][0]).toMatchObject({
      kind: 'trace',
      project: 'proj-a-0a1b2c3d',
    });
  });
});
