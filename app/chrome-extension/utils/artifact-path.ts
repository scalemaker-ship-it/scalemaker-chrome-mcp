/**
 * scalemaker-chrome-mcp fork: 확장이 저장하는 모든 산출물의 경로를 여기 한 곳에서 만든다.
 *
 * 왜 필요한가:
 *   스크린샷·GIF·PDF·트레이스가 저마다 다른 규칙으로 파일명을 만들어 사용자 다운로드 폴더
 *   **루트** 에 그대로 쌓였다(2026-09-02 기준 250여 개). 사용자가 받은 파일과 도구가 만든
 *   파일이 한 곳에 섞여 구분도 정리도 안 됐다. 2026-09-02 에 `mcp-screenshots/<날짜>/` 로
 *   모았지만, 여러 Claude 세션이 동시에 돌면 그 폴더 안에서 다시 섞였다.
 *
 * 규칙(2026-11-09 사용자 지시):
 *   `_claude/<세션 폴더명>/YYYY-MM-DD/<kind>_<name>_<HHmmss>.<ext>`
 *   - 세션 폴더명은 stdio 브리지가 세션을 연 폴더(cwd)로 계산해 `_mcpProject` 인자로 싣는다.
 *     모양은 `<폴더 이름>-<경로 sha256 앞 8자>` 이고, 규칙 본문은 shared 의
 *     `projectFolderNameFromCwd` 하나뿐이다. 여기서는 받은 값이 그 모양인지
 *     (`isProjectFolderName`)와 크롬이 폴더 이름으로 받는지만 본다.
 *   - 쓸 수 없는 이름이면 고쳐 쓰지 않고 `기타-<hash8>` (해시가 없으면 `기타`) 로 보낸다.
 *     세션 종료 훅이 `<세션 폴더명>` 과 `기타-<hash8>` 을 모두 찾는다.
 *   - 브리지의 시작 시 자동 정리는 옛 `mcp-screenshots/` 만 본다(`_claude/` 는 건드리지 않는다).
 *   - 날짜·시각은 **로컬 시간**.
 *   - 크롬 다운로드 API 는 다운로드 폴더 기준 상대 경로에 하위 폴더를 허용한다.
 *   - `conflictAction: 'uniquify'` — 같은 초에 두 번 저장돼도 덮어쓰지 않는다.
 *
 * 경계:
 *   사용자가 `name` 에 경로 구분자를 넣어도 마지막 조각(basename)만 쓴다. `..` 도 한 조각일
 *   뿐이라 밖으로 나갈 수 없고, 허용 문자 밖은 밑줄로 바뀐다. 프로젝트 폴더명도 구분자가
 *   `_` 로 바뀌고 앞뒤 마침표가 지워지므로 한 조각을 넘지 못한다. 즉 어떤 입력이 와도 결과는
 *   항상 `_claude/<한 조각>/<날짜>/` 안이다.
 */
import {
  CLAUDE_ARTIFACT_ROOT,
  MCP_PROJECT_ARG,
  fallbackProjectFolder,
  isProjectFolderName,
} from 'scalemaker-chrome-mcp-shared';

/** 산출물 루트 폴더 (다운로드 폴더 기준 상대 경로). */
export const ARTIFACT_ROOT = CLAUDE_ARTIFACT_ROOT;

/**
 * 2026-11-09 이전의 산출물 루트. 브리지의 자동 정리 대상이고, 예전 실행 이력(예약 실패
 * 스크린샷 경로)이 아직 이 경로를 가리킬 수 있어 읽을 때만 쓴다.
 */
export const LEGACY_ARTIFACT_ROOT = 'mcp-screenshots';

/** 파일명 한 조각의 최대 길이 — 긴 페이지 제목이 그대로 들어오는 것을 막는다. */
export const ARTIFACT_NAME_MAX_LENGTH = 60;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 로컬 날짜 폴더명 `YYYY-MM-DD` */
export function artifactDateFolder(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 로컬 시각 접미사 `HHmmss` */
export function artifactTimeSuffix(now: Date = new Date()): string {
  return `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
}

/**
 * 파일명 한 조각을 안전하게 만든다.
 * 경로 구분자가 있으면 마지막 조각만 남기므로 상위 폴더로 나갈 수 없다.
 */
function sanitizeSegment(raw: string): string {
  const basename = raw.replace(/\\/g, '/').split('/').pop() ?? '';
  return basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^[._-]+/, '')
    .replace(/_{2,}/g, '_')
    .slice(0, ARTIFACT_NAME_MAX_LENGTH)
    .replace(/[._-]+$/, '');
}

function sanitizeExt(raw: string): string {
  const cleaned = raw
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return cleaned || 'bin';
}

/* ------------------------------------------------------------------ *
 * 프로젝트 폴더명
 * ------------------------------------------------------------------ */

/*
 * 아래 판정은 크로미움 소스(2026-11 main)를 옮긴 것이다.
 *   net/base/filename_util_icu.cc       IsSafePortablePathComponent
 *   base/i18n/file_util_icu.cc          IsFilenameLegal (illegal_anywhere_ / illegal_at_ends_ /
 *                                       윈도우 CouldBeInvalidShortName)
 *   base/files/file_util.cc             IsReservedNameOnWindows
 *   net/base/filename_util_internal.cc  IsShellIntegratedExtension
 * 공유 규칙(`projectFolderNameFromCwd`)이 이미 바꾸는 문자는 다시 볼 필요가 없지만, 이 함수는
 * 규칙 밖의 값도 받으므로 전부 본다. 놓친 경우는 `saveArtifactToDownloads` 가
 * "Invalid filename" 실패를 보고 `기타-<hash8>` 로 한 번 더 시도한다.
 */

/** 어디에 있어도 거부: `" * / : < > ? \ |`, 제어문자(Cc), 서식 문자(Cf), 비문자. */
const CHROME_ILLEGAL_ANYWHERE = /["*/:<>?\\|\p{Cc}\p{Cf}\u{FDD0}-\u{FDEF}]/u;
/** 맨 앞·맨 끝에 오면 거부: 유니코드 공백, 마침표, 물결표. */
const CHROME_ILLEGAL_AT_ENDS = /^[\p{White_Space}.~]|[\p{White_Space}.~]$/u;
/** 8.3 짧은 이름에 쓸 수 없는 문자 (윈도우 CouldBeInvalidShortName). */
const SHORT_NAME_ILLEGAL = /[\p{White_Space}"\\/[\]:+|<>=;?,*]/u;
/** 윈도우 장치 이름. 마지막 공백·마침표를 뗀 이름 전체 또는 첫 마침표 앞부분과 비교한다. */
const WINDOWS_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
  'clock$',
]);
const WINDOWS_MAGIC_NAMES = new Set(['desktop.ini', 'thumbs.db', 'conin$', 'conout$']);
/** 셸이 자동으로 실행·해석하는 확장자. */
const SHELL_INTEGRATED_EXTENSIONS = new Set(['local', 'lnk', 'scf', 'url']);

function hasNonCharacter(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code & 0xfffe) === 0xfffe) return true;
  }
  return false;
}

/**
 * 윈도우: `~` 가 들어 있고 8.3 짧은 이름 모양이면 거부된다 (VFAT 짧은 이름과 헷갈릴 수 있음).
 * 길이는 UTF-16 단위 12 이하, 짧은 이름 금지 문자가 없고, 마침표가 없으면 8자 이하, 있으면
 * 하나뿐이고 앞부분 1~8자·뒷부분 3자 이하. 사용자 PC 가 윈도우라 플랫폼과 무관하게 적용한다.
 */
function couldBeInvalidShortName(value: string): boolean {
  if (value.length > 12 || !value.includes('~') || SHORT_NAME_ILLEGAL.test(value)) return false;
  const firstDot = value.indexOf('.');
  if (firstDot < 0) return value.length <= 8;
  if (firstDot !== value.lastIndexOf('.')) return false;
  return firstDot > 0 && firstDot <= 8 && firstDot + 4 >= value.length;
}

function isReservedNameOnWindows(value: string): boolean {
  const trimmed = value.toLowerCase().replace(/[ .]+$/, '');
  const firstDot = trimmed.indexOf('.');
  const prefix = firstDot >= 0 ? trimmed.slice(0, firstDot) : trimmed;
  return (
    WINDOWS_DEVICE_NAMES.has(trimmed) ||
    WINDOWS_DEVICE_NAMES.has(prefix) ||
    WINDOWS_MAGIC_NAMES.has(trimmed)
  );
}

/** 마지막 마침표 뒤 (크롬이 확장자로 보는 부분). */
function lastExtensionOf(value: string): string {
  const dot = value.lastIndexOf('.');
  return dot > 0 ? value.slice(dot + 1).toLowerCase() : '';
}

/** 크롬 `chrome.downloads.download` 가 이 경로 조각(폴더 이름)을 받아들이는지 미리 본다. */
export function isChromeSafeDownloadSegment(segment: string): boolean {
  if (typeof segment !== 'string' || segment.length === 0) return false;
  if (CHROME_ILLEGAL_ANYWHERE.test(segment)) return false;
  if (CHROME_ILLEGAL_AT_ENDS.test(segment)) return false;
  if (hasNonCharacter(segment)) return false;
  if (couldBeInvalidShortName(segment)) return false;
  if (isReservedNameOnWindows(segment)) return false;
  const ext = lastExtensionOf(segment);
  if (SHELL_INTEGRATED_EXTENSIONS.has(ext)) return false;
  if (ext.startsWith('{') && ext.endsWith('}')) return false;
  return true;
}

/**
 * 받은 세션 폴더명을 저장에 쓸 폴더명으로 정한다.
 *
 * 고쳐 쓰지 않는다. 세션 종료 훅은 규칙 결과 그대로의 이름(또는 `기타-<hash8>`)을 찾기 때문에,
 * 고친 이름에 저장하면 훅이 못 찾는다. 그래서 규칙이 만든 모양이고(`isProjectFolderName`)
 * 크롬이 받는 이름일 때만 그대로 쓰고, 나머지는 `fallbackProjectFolder` 로 보낸다
 * (끝에 `-<16진수 8자>` 가 있으면 `기타-<그 8자>`, 없으면 `기타`).
 * 예: `con.old-1a2b3c4d` 는 규칙 결과지만 첫 마침표 앞이 윈도우 장치 이름(con)이라 크롬이
 * 거부하므로 `기타-1a2b3c4d`.
 */
export function resolveArtifactProjectFolder(project: unknown): string {
  if (isProjectFolderName(project) && isChromeSafeDownloadSegment(project)) return project;
  return fallbackProjectFolder(project);
}

/**
 * 세션 id → 프로젝트 폴더명.
 *
 * 브리지는 바깥 호출에만 `_mcpProject` 를 싣는다. batch·shortcut·흐름 실행이 안에서 부르는
 * 도구에는 `_mcpSessionId` 만 다시 실린다(실행 컨텍스트 키는 step 이 정하지 못한다). 그래서
 * 바깥 호출이 들어올 때 세션 id 와 폴더명을 기억해 두고, 안쪽 호출은 세션 id 로 찾는다.
 * 서비스 워커가 다시 뜨면 비지만, 다음 바깥 호출이 다시 채운다.
 */
const SESSION_PROJECT_LIMIT = 256;
const sessionProjects = new Map<string, string>();
/** `setArtifactProjectForSession` 으로 실행기가 직접 정하는 세션 id. 호출 인자로는 바꾸지 못한다. */
const runnerOwnedSessions = new Set<string>();

function storeSessionProject(sessionId: string, project: string): void {
  sessionProjects.delete(sessionId);
  sessionProjects.set(sessionId, project);
  while (sessionProjects.size > SESSION_PROJECT_LIMIT) {
    const oldest = sessionProjects.keys().next().value;
    if (oldest === undefined) break;
    sessionProjects.delete(oldest);
  }
}

function readStringArg(args: unknown, key: string): string | undefined {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
}

/** 도구 호출 인자에 세션 id 와 프로젝트가 함께 있으면 기억한다 (handleCallTool 입구에서 부른다). */
export function rememberArtifactProject(args: unknown): void {
  const sessionId = readStringArg(args, '_mcpSessionId');
  const project = readStringArg(args, MCP_PROJECT_ARG);
  if (!sessionId || !project || runnerOwnedSessions.has(sessionId)) return;
  storeSessionProject(sessionId, project);
}

/**
 * 실행기가 세션 id 하나의 폴더를 직접 정한다. 문자열이면 그 값, 아니면 지운다(저장 시 `기타`).
 *
 * 예약 실행은 MCP 호출이 아니라 알람이 띄우므로 handleCallTool 이 기억할 값이 없다. 실행기가
 * 실행마다 예약 레코드의 폴더를 예약 세션 id(`scheduled`)에 걸고, 안쪽 도구 호출은 다른
 * 세션처럼 세션 id 로 찾는다. 한 번 이렇게 정한 세션 id 는 호출 인자(`_mcpProject`)로
 * 덮어쓰지 못한다.
 */
export function setArtifactProjectForSession(sessionId: string, project: unknown): void {
  runnerOwnedSessions.add(sessionId);
  sessionProjects.delete(sessionId);
  if (typeof project === 'string' && project) storeSessionProject(sessionId, project);
}

/**
 * 이 호출의 산출물을 어느 프로젝트 폴더에 둘지. 인자의 `_mcpProject` 가 먼저, 없으면 세션
 * id 로 기억한 값. 둘 다 없으면 undefined (저장 시 `기타`).
 */
export function artifactProjectOf(args: unknown): string | undefined {
  const explicit = readStringArg(args, MCP_PROJECT_ARG);
  if (explicit) return explicit;
  const sessionId = readStringArg(args, '_mcpSessionId');
  return sessionId ? sessionProjects.get(sessionId) : undefined;
}

/** 테스트 전용 — 기억한 세션 프로젝트를 비운다. */
export function clearArtifactProjectsForTest(): void {
  sessionProjects.clear();
  runnerOwnedSessions.clear();
}

/**
 * 산출물 저장 경로를 만든다 — `_claude/<프로젝트>/YYYY-MM-DD/<kind>_<name>_<HHmmss>.<ext>`
 *
 * @param kind     도구 종류 (screenshot, gif, pdf, trace ...)
 * @param name     사용자가 준 이름 (선택). 경로 구분자가 있어도 basename 만 쓴다.
 * @param ext      확장자 (점은 있어도 없어도 된다)
 * @param now      테스트용 시각 주입
 * @param project  세션 폴더명 (보통 `artifactProjectOf(args)`). 쓸 수 없으면 `기타-<hash8>` 또는 `기타`.
 */
export function artifactFilename(
  kind: string,
  name?: string,
  ext = 'png',
  now: Date = new Date(),
  project?: string,
): string {
  const safeKind = sanitizeSegment(kind) || 'artifact';
  const safeExt = sanitizeExt(ext);

  let safeName = sanitizeSegment(typeof name === 'string' ? name : '');
  // 이름에 확장자가 이미 붙어 있으면 떼어낸다 (`shot.gif` → `shot`)
  safeName = safeName.replace(new RegExp(`\\.${safeExt}$`, 'i'), '');
  // kind 와 같은 이름이면 두 번 쓰지 않는다 (`screenshot_screenshot_...` 방지)
  if (safeName.toLowerCase() === safeKind.toLowerCase()) safeName = '';

  const stem = [safeKind, safeName, artifactTimeSuffix(now)].filter(Boolean).join('_');
  const folder = resolveArtifactProjectFolder(project);
  return `${ARTIFACT_ROOT}/${folder}/${artifactDateFolder(now)}/${stem}.${safeExt}`;
}

export interface ArtifactSaveResult {
  downloadId: number;
  /** 다운로드 폴더 기준 상대 경로 (요청한 값) */
  filename: string;
  /** 크롬이 실제로 쓴 절대 경로. 조회에 실패하면 없다. */
  fullPath?: string;
}

export interface ArtifactSaveOptions {
  /** data: 또는 blob: URL */
  url: string;
  kind: string;
  name?: string;
  ext: string;
  /**
   * 세션 폴더명 — 보통 `artifactProjectOf(args)`. 쓸 수 없으면 `기타-<hash8>` 또는 `기타`.
   * 저장하는 곳마다 일부러 정하게 하려고 선택 키가 아니라 필수 키(값은 undefined 허용)다.
   */
  project: string | undefined;
  /** 절대 경로 조회 전 대기 시간(ms). 0 이면 조회하지 않는다. */
  resolvePathDelayMs?: number;
}

function isInvalidFilenameError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid filename/i.test(message);
}

/**
 * 산출물을 다운로드 폴더의 `_claude/<프로젝트>/<날짜>/` 아래에 저장한다.
 *
 * 확장 안에서 `chrome.downloads.download` 를 직접 부르는 곳은 여기 하나뿐이어야 한다
 * (tests/utils/artifact-download-paths.test.ts 가 그물로 막는다).
 * 크롬이 세션 폴더명을 거부하면("Invalid filename") `기타-<hash8>`(해시가 없으면 `기타`)로
 * 한 번 더 시도한다.
 * 그 밖의 실패는 그대로 던진다 — 저장 실패를 도구가 어떻게 다룰지는 호출부가 정한다.
 */
export async function saveArtifactToDownloads(
  options: ArtifactSaveOptions,
): Promise<ArtifactSaveResult> {
  const now = new Date();
  const folder = resolveArtifactProjectFolder(options.project);
  const download = (target: string) =>
    chrome.downloads.download({
      url: options.url,
      filename: target,
      saveAs: false,
      conflictAction: 'uniquify',
    } as chrome.downloads.DownloadOptions);

  let filename = artifactFilename(options.kind, options.name, options.ext, now, folder);
  let downloadId: number;
  try {
    downloadId = await download(filename);
  } catch (error) {
    const fallback = fallbackProjectFolder(folder);
    if (folder === fallback || !isInvalidFilenameError(error)) throw error;
    filename = artifactFilename(options.kind, options.name, options.ext, now, fallback);
    downloadId = await download(filename);
  }

  const delay = options.resolvePathDelayMs ?? 100;
  if (delay <= 0) return { downloadId, filename };

  try {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const [item] = await chrome.downloads.search({ id: downloadId });
    if (item?.filename) return { downloadId, filename, fullPath: item.filename };
  } catch {
    // 절대 경로 조회 실패는 저장 실패가 아니다 — 상대 경로만 돌려준다.
  }
  return { downloadId, filename };
}
