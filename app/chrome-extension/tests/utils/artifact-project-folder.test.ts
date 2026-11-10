/**
 * scalemaker-chrome-mcp fork(2026-11-09): 산출물을 Claude 세션별 폴더로 가르는 회귀.
 *
 *  1. 저장 경로는 `_claude/<세션 폴더명>/YYYY-MM-DD/`. 세션 폴더명은 `<폴더 이름>-<hash8>`.
 *  2. 확장은 받은 값을 고쳐 쓰지 않는다. 규칙이 만든 모양이고 크롬이 받는 이름만 그대로 쓴다
 *     (세션 종료 훅이 규칙 결과 그대로의 이름을 찾기 때문).
 *  3. 쓸 수 없으면 `기타-<hash8>` (해시가 없으면 `기타`). 훅이 `기타-<hash8>` 도 찾는다.
 *     미리 거르지 못한 경우에도 "Invalid filename" 실패를 보면 같은 대체 폴더로 한 번 더 시도한다.
 *  4. batch·shortcut·흐름 안쪽 호출은 세션 id 만 받으므로, 바깥 호출에서 기억한 폴더를 쓴다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  artifactFilename,
  artifactProjectOf,
  clearArtifactProjectsForTest,
  isChromeSafeDownloadSegment,
  rememberArtifactProject,
  resolveArtifactProjectFolder,
  saveArtifactToDownloads,
} from '../../utils/artifact-path';
import { prepareStepArgs } from '@/entrypoints/background/tools/browser/batch-runner';

const NOW = new Date(2026, 10, 9, 9, 5, 7);

interface DownloadCall {
  url: string;
  filename: string;
}

function installDownloads(download?: (options: DownloadCall) => Promise<number>): DownloadCall[] {
  const calls: DownloadCall[] = [];
  const chromeAny = globalThis.chrome as unknown as Record<string, unknown>;
  chromeAny.downloads = {
    download: vi.fn(async (options: DownloadCall) => {
      calls.push(options);
      return download ? download(options) : 77;
    }),
    search: vi.fn(async () => []),
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  };
  return calls;
}

describe('artifactFilename — 세션 폴더', () => {
  it('세션 폴더 아래 날짜 폴더에 둔다 (한글·공백·쉼표·하이픈 유지)', () => {
    expect(artifactFilename('screenshot', 'login', 'png', NOW, '당근, 소모임 운영-0cd65cbe')).toBe(
      '_claude/당근, 소모임 운영-0cd65cbe/2026-11-09/screenshot_login_090507.png',
    );
  });

  it('세션 폴더가 없으면 기타', () => {
    expect(artifactFilename('pdf', 'notice', 'pdf', NOW)).toBe(
      '_claude/기타/2026-11-09/pdf_notice_090507.pdf',
    );
    expect(artifactFilename('pdf', 'notice', 'pdf', NOW, '')).toBe(
      '_claude/기타/2026-11-09/pdf_notice_090507.pdf',
    );
  });

  it('경로를 빠져나가려는 값은 대체 폴더로 간다 (한 조각을 넘지 못한다)', () => {
    for (const evil of ['../../Windows', '..', 'a/b', 'a\\b', 'C:', ' padded ']) {
      const out = artifactFilename('gif', 'x', 'gif', NOW, evil);
      expect(out).toBe('_claude/기타/2026-11-09/gif_x_090507.gif');
    }
    // 해시가 붙어 있어도 앞부분이 규칙 결과가 아니면 기타-<hash8>
    expect(artifactFilename('gif', 'x', 'gif', NOW, '../../x-deadbeef')).toBe(
      '_claude/기타-deadbeef/2026-11-09/gif_x_090507.gif',
    );
  });
});

describe('resolveArtifactProjectFolder', () => {
  it('규칙이 만든 모양이고 크롬이 받는 값은 그대로 쓴다', () => {
    for (const name of [
      '검색형_예약파이프라인-8a905f84',
      'claude-7ef34abc',
      '가'.repeat(60) + '-db715a21',
      '기타-3dc8472e',
      '기타',
    ]) {
      expect(resolveArtifactProjectFolder(name), name).toBe(name);
    }
  });

  it('문자열이 아니거나 비면 기타', () => {
    expect(resolveArtifactProjectFolder(undefined)).toBe('기타');
    expect(resolveArtifactProjectFolder(42)).toBe('기타');
    expect(resolveArtifactProjectFolder('')).toBe('기타');
  });

  it('규칙이 만든 모양이 아니면 고치지 않고 대체 폴더 (해시가 있으면 기타-<hash8>)', () => {
    expect(resolveArtifactProjectFolder('web')).toBe('기타'); // 해시 없음
    expect(resolveArtifactProjectFolder('a<b-0123abcd')).toBe('기타-0123abcd');
    expect(resolveArtifactProjectFolder('.hidden-0123abcd')).toBe('기타-0123abcd');
    expect(resolveArtifactProjectFolder('가'.repeat(61) + '-0123abcd')).toBe('기타-0123abcd');
  });

  it('규칙 결과지만 크롬이 거부하는 이름은 기타-<hash8> (확장 대체 규칙)', () => {
    for (const name of [
      '~lead-1a2b3c4d', // 맨 앞 물결표
      'del\u007fete-1a2b3c4d', // 0x7F 제어문자
      'zero\u200bwidth-1a2b3c4d', // 폭 없는 공백(서식 문자)
      '\u3000wide-1a2b3c4d', // 앞의 전각 공백
      'con.old-1a2b3c4d', // 첫 마침표 앞이 장치 이름
      'NUL.backup-1a2b3c4d',
    ]) {
      expect(resolveArtifactProjectFolder(name), name).toBe('기타-1a2b3c4d');
    }
  });
});

describe('isChromeSafeDownloadSegment', () => {
  it('크롬이 거부하는 이름', () => {
    for (const name of [
      '~lead',
      'trail~',
      'my~proj', // 물결표 + 8.3 짧은 이름 모양 (윈도우)
      'ab~1.txt',
      'del\u007fete',
      'zero\u200bwidth',
      '\u3000wide',
      'con',
      'NUL.backup',
      'com1',
      'CONIN$',
      'desktop.ini',
      'tools.lnk',
      'app.local',
      'site.url',
      'cmd.scf',
      'x.{20d04fe0-3aea-1069-a2d8-08002b30309d}',
    ]) {
      expect(isChromeSafeDownloadSegment(name), name).toBe(false);
    }
  });

  it('보통 이름·한글·가운데 마침표는 통과한다', () => {
    expect(isChromeSafeDownloadSegment('next.js-app')).toBe(true);
    expect(isChromeSafeDownloadSegment('고객사 A, 2026')).toBe(true);
    expect(isChromeSafeDownloadSegment('console')).toBe(true); // con 으로 "시작" 만 하는 이름
    expect(isChromeSafeDownloadSegment('기타')).toBe(true);
  });

  it('물결표는 가운데 있고 8.3 짧은 이름 모양이 아니면 통과한다 (Codex 교차 검토 5번)', () => {
    expect(isChromeSafeDownloadSegment('my~project')).toBe(true); // 9자 이상, 마침표 없음
    expect(isChromeSafeDownloadSegment('a ~ b')).toBe(true); // 공백이 있어 짧은 이름이 아님
    expect(isChromeSafeDownloadSegment('ab~1.json')).toBe(true); // 확장자 4자
  });
});

describe('세션 id → 프로젝트 기억', () => {
  beforeEach(() => clearArtifactProjectsForTest());

  it('인자의 _mcpProject 가 먼저다', () => {
    rememberArtifactProject({ _mcpSessionId: 's1', _mcpProject: 'alpha' });
    expect(artifactProjectOf({ _mcpSessionId: 's1', _mcpProject: 'beta' })).toBe('beta');
  });

  it('안쪽 호출은 세션 id 로 바깥 호출의 폴더를 찾는다', () => {
    rememberArtifactProject({ _mcpSessionId: 's1', _mcpProject: 'alpha' });
    rememberArtifactProject({ _mcpSessionId: 's2', _mcpProject: 'beta' });
    expect(artifactProjectOf({ _mcpSessionId: 's1' })).toBe('alpha');
    expect(artifactProjectOf({ _mcpSessionId: 's2' })).toBe('beta');
    expect(artifactProjectOf({ _mcpSessionId: 'unknown' })).toBeUndefined();
    expect(artifactProjectOf({})).toBeUndefined();
    expect(artifactProjectOf(undefined)).toBeUndefined();
  });

  it('둘 중 하나라도 없으면 기억하지 않는다', () => {
    rememberArtifactProject({ _mcpSessionId: 's1' });
    rememberArtifactProject({ _mcpProject: 'alpha' });
    expect(artifactProjectOf({ _mcpSessionId: 's1' })).toBeUndefined();
  });

  it('같은 세션의 새 값으로 바뀌고, 256개를 넘으면 가장 오래된 것부터 잊는다', () => {
    rememberArtifactProject({ _mcpSessionId: 's0', _mcpProject: 'old' });
    rememberArtifactProject({ _mcpSessionId: 's0', _mcpProject: 'new' });
    expect(artifactProjectOf({ _mcpSessionId: 's0' })).toBe('new');
    for (let i = 1; i <= 256; i++) {
      rememberArtifactProject({ _mcpSessionId: `s${i}`, _mcpProject: `p${i}` });
    }
    expect(artifactProjectOf({ _mcpSessionId: 's0' })).toBeUndefined();
    expect(artifactProjectOf({ _mcpSessionId: 's1' })).toBe('p1');
    expect(artifactProjectOf({ _mcpSessionId: 's256' })).toBe('p256');
  });

  it('batch step 은 _mcpProject 를 정하지 못한다 — 지우고 세션 id 로 찾게 한다', () => {
    const stepArgs = prepareStepArgs({
      rawArgs: { selector: '#a', _mcpProject: 'someone-else' },
      toolName: 'chrome_screenshot',
      scope: {} as never,
      templatesEnabled: false,
      backgroundModeOn: false,
      mcpSessionId: 'outer',
    } as never);
    expect(stepArgs._mcpProject).toBeUndefined();
    expect(stepArgs._mcpSessionId).toBe('outer');

    rememberArtifactProject({ _mcpSessionId: 'outer', _mcpProject: 'mine' });
    expect(artifactProjectOf(stepArgs)).toBe('mine');
  });
});

describe('saveArtifactToDownloads — 프로젝트 폴더', () => {
  it('_claude/<프로젝트>/<날짜>/ 로 저장한다', async () => {
    const calls = installDownloads();
    const result = await saveArtifactToDownloads({
      url: 'data:image/png;base64,AAAA',
      kind: 'screenshot',
      name: 'shot',
      ext: 'png',
      project: '검색형_예약파이프라인-8a905f84',
      resolvePathDelayMs: 0,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].filename).toMatch(
      /^_claude\/검색형_예약파이프라인-8a905f84\/\d{4}-\d{2}-\d{2}\/screenshot_shot_\d{6}\.png$/,
    );
    expect(result.filename).toBe(calls[0].filename);
  });

  it('크롬이 "Invalid filename" 으로 거부하면 기타-<hash8> 로 한 번 더 시도한다', async () => {
    const calls = installDownloads(async (options) => {
      if (!options.filename.startsWith('_claude/기타-')) throw new Error('Invalid filename');
      return 9;
    });
    const result = await saveArtifactToDownloads({
      url: 'data:,x',
      kind: 'trace',
      ext: 'json',
      project: 'looks-fine-1a2b3c4d',
      resolvePathDelayMs: 0,
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].filename.startsWith('_claude/looks-fine-1a2b3c4d/')).toBe(true);
    expect(calls[1].filename.startsWith('_claude/기타-1a2b3c4d/')).toBe(true);
    // 같은 시각으로 다시 만든다 — 폴더만 바뀐다.
    expect(calls[1].filename.split('/').slice(2)).toEqual(calls[0].filename.split('/').slice(2));
    expect(result.downloadId).toBe(9);
    expect(result.filename).toBe(calls[1].filename);
  });

  it('다른 실패는 다시 시도하지 않고 그대로 던진다', async () => {
    const calls = installDownloads(async () => {
      throw new Error('Download canceled');
    });
    await expect(
      saveArtifactToDownloads({
        url: 'data:,x',
        kind: 'gif',
        ext: 'gif',
        project: 'p-1a2b3c4d',
      }),
    ).rejects.toThrow('Download canceled');
    expect(calls).toHaveLength(1);
  });

  it('이미 대체 폴더인데 거부되면 그대로 던진다 (무한 재시도 없음)', async () => {
    for (const project of [undefined, '기타-1a2b3c4d']) {
      const calls = installDownloads(async () => {
        throw new Error('Invalid filename');
      });
      await expect(
        saveArtifactToDownloads({ url: 'data:,x', kind: 'gif', ext: 'gif', project }),
      ).rejects.toThrow('Invalid filename');
      expect(calls).toHaveLength(1);
    }
  });
});
