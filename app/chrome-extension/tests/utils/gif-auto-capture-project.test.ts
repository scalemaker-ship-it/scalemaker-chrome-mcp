/**
 * scalemaker-chrome-mcp fork(2026-11-09, Codex 교차 검토 1번): GIF 자동 캡처의 프로젝트 폴더.
 *
 * 자동 캡처 메타데이터는 전역 슬롯 하나다. 그래서 stop 은 "마지막으로 auto_start 된 녹화"
 * 를 멈춘다. 저장 폴더는 stop 을 부른 세션이 아니라 그 녹화를 시작한 세션의 폴더여야 한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveArtifactToDownloads = vi.fn(async (_options: Record<string, unknown>) => ({
  downloadId: 1,
  filename: '_claude/x/2026-11-09/gif_090507.gif',
}));

vi.mock('@/utils/artifact-path', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/artifact-path')>()),
  saveArtifactToDownloads: (options: Record<string, unknown>) => saveArtifactToDownloads(options),
}));

const active = new Set<number>();
/** 설정하면 stopAutoCapture 가 이 약속이 풀릴 때까지 멈춘다 (교차 실행 재현용). */
let stopGate: Promise<void> | null = null;
let onStopEntered: (() => void) | null = null;
vi.mock('@/entrypoints/background/tools/browser/gif-auto-capture', () => ({
  startAutoCapture: vi.fn(async (tabId: number) => {
    active.add(tabId);
    return { success: true };
  }),
  stopAutoCapture: vi.fn(async (tabId: number) => {
    active.delete(tabId);
    onStopEntered?.();
    if (stopGate) await stopGate;
    return {
      success: true,
      gifData: new Uint8Array([71, 73, 70]),
      frameCount: 2,
      durationMs: 100,
      actions: [],
    };
  }),
  isAutoCaptureActive: vi.fn((tabId: number) => active.has(tabId)),
  getAutoCaptureStatus: vi.fn(() => ({ active: false })),
  captureFrameOnAction: vi.fn(),
  captureInitialFrame: vi.fn(async () => undefined),
}));

describe('chrome_gif_recorder auto_capture — 프로젝트 폴더', () => {
  beforeEach(() => {
    active.clear();
    stopGate = null;
    onStopEntered = null;
    saveArtifactToDownloads.mockClear();
    const chromeAny = globalThis.chrome as unknown as { tabs: { get: unknown } };
    chromeAny.tabs.get = vi.fn(async (id: number) => ({
      id,
      windowId: 1,
      url: 'https://example.com/',
      active: true,
    }));
  });

  it('stop 은 녹화를 시작한 세션의 프로젝트 폴더에 저장한다', async () => {
    const { gifRecorderTool } = await import('@/entrypoints/background/tools/browser/gif-recorder');

    const started = await gifRecorderTool.execute({
      action: 'auto_start',
      tabId: 11,
      _mcpProject: 'starter-project',
    } as never);
    expect(started.isError).toBe(false);

    const stopped = await gifRecorderTool.execute({
      action: 'stop',
      _mcpProject: 'other-session',
    } as never);
    expect(stopped.isError).toBe(false);

    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
    expect(saveArtifactToDownloads).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'gif', project: 'starter-project' }),
    );
  });

  it('A 의 stop 이 기다리는 사이 B 가 auto_start 해도 A 는 A 폴더, B 의 녹화는 그대로 (Codex 교차 검토 1번)', async () => {
    const { gifRecorderTool } = await import('@/entrypoints/background/tools/browser/gif-recorder');

    const startedA = await gifRecorderTool.execute({
      action: 'auto_start',
      tabId: 21,
      filename: 'a-gif',
      _mcpProject: 'proj-a-0a1b2c3d',
    } as never);
    expect(startedA.isError).toBe(false);

    let release!: () => void;
    stopGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      onStopEntered = resolve;
    });

    // A 의 stop 이 stopAutoCapture 안에서 멈춘다.
    const stopA = gifRecorderTool.execute({
      action: 'stop',
      _mcpProject: 'proj-a-0a1b2c3d',
    } as never);
    await entered;
    stopGate = null;
    onStopEntered = null;

    // 그 사이 B 가 다른 탭에서 자동 캡처를 시작한다.
    const startedB = await gifRecorderTool.execute({
      action: 'auto_start',
      tabId: 22,
      filename: 'b-gif',
      _mcpProject: 'proj-b-1a2b3c4d',
    } as never);
    expect(startedB.isError).toBe(false);

    release();
    const stoppedA = await stopA;
    expect(stoppedA.isError).toBe(false);
    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
    expect(saveArtifactToDownloads.mock.calls[0][0]).toMatchObject({
      kind: 'gif',
      name: 'a-gif',
      project: 'proj-a-0a1b2c3d',
    });

    // B 의 메타데이터가 살아 있어 B 의 stop 이 B 의 녹화를 B 폴더에 저장한다.
    const stoppedB = await gifRecorderTool.execute({
      action: 'stop',
      _mcpProject: 'proj-b-1a2b3c4d',
    } as never);
    expect(stoppedB.isError).toBe(false);
    expect(JSON.parse((stoppedB.content[0] as { text: string }).text)).toMatchObject({
      success: true,
      tabId: 22,
      mode: 'auto_capture',
    });
    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(2);
    expect(saveArtifactToDownloads.mock.calls[1][0]).toMatchObject({
      kind: 'gif',
      name: 'b-gif',
      project: 'proj-b-1a2b3c4d',
    });
  });
});
