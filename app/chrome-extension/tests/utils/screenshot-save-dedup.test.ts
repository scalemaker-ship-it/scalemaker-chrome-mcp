/**
 * scalemaker-chrome-mcp fork — chrome_screenshot 이중 저장 회귀 테스트.
 *
 * 배경: `savePng` 기본값이 `true` 라, `saveToDownloads:true` 를 filename 과 함께 부르면
 * (savePng 를 명시적으로 꺼주지 않는 한) saveToDownloads 경로와 레거시 savePng 경로가
 * **둘 다** `saveArtifactToDownloads` 를 호출해 다운로드 폴더에 파일이 두 개
 * (하나는 filename 반영, 하나는 이 도구의 `name` 파라미터로 이름 없는 것) 생겼다.
 *
 * 계약: 한 번의 chrome_screenshot 호출은 저장을 최대 한 번만 한다.
 *  - saveToDownloads:true 면 그 경로(filename 반영)로 한 번만 저장한다(savePng 값과 무관).
 *  - savePng:true 만이면(saveToDownloads 가 없거나 false) 기존 경로로 한 번만 저장한다.
 *  - 둘 다 false 면 저장하지 않는다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    withSession: vi.fn(async (_tabId: number, _owner: string, fn: () => Promise<unknown>) => fn()),
    sendCommand: vi.fn(async () => ({})),
  },
}));

vi.mock('@/utils/screenshot-context', () => ({
  screenshotContextManager: { setContext: vi.fn() },
}));

vi.mock('@/utils/activation-guard', () => ({ activateTab: vi.fn(async () => undefined) }));

vi.mock('@/utils/mcp-window-manager', () => ({ isMcpWindow: vi.fn(async () => false) }));

vi.mock('@/utils/adaptive-wait', () => ({
  sleep: vi.fn(async () => undefined),
  waitForFramePaint: vi.fn(async () => undefined),
  waitForHelperReady: vi.fn(async () => undefined),
}));

vi.mock('@/utils/log-redact', () => ({ redactedArgsForLog: vi.fn((a: unknown) => a) }));

const saveArtifactToDownloads = vi.fn(async (options: { name?: string }) => ({
  downloadId: 1,
  filename: `_claude/기타/2026-09-06/screenshot_${options?.name || ''}_101010.png`,
  fullPath: 'C:/Users/user/Downloads/_claude/기타/2026-09-06/x.png',
}));

vi.mock('@/utils/artifact-path', async (importOriginal) => ({
  // 2026-11-09: 프로젝트 폴더 해석(artifactProjectOf)은 실제 구현을 쓴다.
  ...(await importOriginal<typeof import('@/utils/artifact-path')>()),
  saveArtifactToDownloads: (...args: unknown[]) => (saveArtifactToDownloads as any)(...args),
}));

vi.mock('@/utils/image-utils', () => ({
  canvasToDataURL: vi.fn(),
  createImageBitmapFromUrl: vi.fn(),
  cropAndResizeImage: vi.fn(),
  stitchImages: vi.fn(),
  MODEL_INPUT_MAX_LONG_EDGE: 1568,
  prepareImageForModelInput: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
    originalWidth: 800,
    originalHeight: 600,
    scale: 1,
  })),
}));

const NORMAL_TAB_URL = 'https://example.com/page';

async function loadTool() {
  vi.resetModules();
  saveArtifactToDownloads.mockClear();

  (globalThis as any).chrome.scripting = { executeScript: vi.fn(async () => undefined) };
  (globalThis as any).chrome.tabs.get = vi.fn(async (id: number) => ({
    id,
    url: NORMAL_TAB_URL,
    title: 'Tab',
    windowId: 1,
    active: true,
  }));
  (globalThis as any).chrome.tabs.sendMessage = vi.fn(async () => ({ success: true }));
  (globalThis as any).chrome.tabs.captureVisibleTab = vi.fn(
    async () => 'data:image/png;base64,Zg==',
  );

  const mod = await import('@/entrypoints/background/tools/browser/screenshot');
  const { cdpSessionManager } = await import('@/utils/cdp-session-manager');
  (cdpSessionManager.sendCommand as any).mockImplementation(
    async (_tabId: number, method: string) => {
      if (method === 'Page.getLayoutMetrics') {
        return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } };
      }
      if (method === 'Page.captureScreenshot') {
        return { data: 'ZmFrZS1wbmc=' };
      }
      return {};
    },
  );

  return { tool: mod.screenshotTool };
}

describe('chrome_screenshot — savePng/saveToDownloads 이중 저장 회귀', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filename 이 있을 때: saveToDownloads:true (savePng 기본값 true) 면 저장은 1회, filename 을 반영한다', async () => {
    const { tool } = await loadTool();

    const result = await tool.execute({
      name: 'after-popup',
      tabId: 1,
      saveToDownloads: true,
      filename: 'after-popup.png',
    } as any);

    expect(result.isError).toBe(false);
    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
    expect(saveArtifactToDownloads).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'after-popup.png' }),
    );
  });

  it('filename 이 없을 때: saveToDownloads:true (savePng 기본값 true) 여도 저장은 1회', async () => {
    const { tool } = await loadTool();

    const result = await tool.execute({
      name: 'after-popup',
      tabId: 1,
      saveToDownloads: true,
    } as any);

    expect(result.isError).toBe(false);
    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
  });

  it('savePng:false + saveToDownloads:true 도 저장은 1회', async () => {
    const { tool } = await loadTool();

    const result = await tool.execute({
      name: 'after-popup',
      tabId: 1,
      savePng: false,
      saveToDownloads: true,
      filename: 'after-popup.png',
    } as any);

    expect(result.isError).toBe(false);
    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
    expect(saveArtifactToDownloads).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'after-popup.png' }),
    );
  });

  it('savePng 기본값(true)만이면 saveToDownloads 없이도 여전히 1회 저장한다(레거시 경로)', async () => {
    const { tool } = await loadTool();

    const result = await tool.execute({
      name: 'after-popup',
      tabId: 1,
    } as any);

    expect(result.isError).toBe(false);
    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(1);
    expect(saveArtifactToDownloads).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'after-popup' }),
    );
  });

  it('두 저장 경로 모두 호출 인자의 _mcpProject 를 project 로 넘긴다 (2026-11-09)', async () => {
    const { tool } = await loadTool();

    await tool.execute({
      name: 'a',
      tabId: 1,
      saveToDownloads: true,
      _mcpProject: '알파남 - 부업',
    } as any);
    await tool.execute({ name: 'b', tabId: 1, _mcpProject: 'site, 2026' } as any);

    expect(saveArtifactToDownloads).toHaveBeenCalledTimes(2);
    expect(saveArtifactToDownloads).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ project: '알파남 - 부업' }),
    );
    expect(saveArtifactToDownloads).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ project: 'site, 2026' }),
    );
  });

  it('savePng:false 이고 saveToDownloads 도 없으면 저장하지 않는다', async () => {
    const { tool } = await loadTool();

    const result = await tool.execute({
      name: 'after-popup',
      tabId: 1,
      savePng: false,
    } as any);

    expect(result.isError).toBe(false);
    expect(saveArtifactToDownloads).not.toHaveBeenCalled();
  });
});
