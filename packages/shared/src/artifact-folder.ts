/**
 * scalemaker-chrome-mcp fork: 확장이 저장하는 산출물을 Claude 세션별 폴더로 가른다.
 *
 * 저장 위치: `Downloads/_claude/<세션 폴더명>/YYYY-MM-DD/<파일>`
 *
 * 왜 필요한가 (2026-11-09 사용자 지시):
 *   예전에는 모든 세션의 산출물이 `Downloads/mcp-screenshots/<날짜>/` 한 곳에 섞였다.
 *   여러 Claude 세션이 동시에 돌고, 세션 종료 훅(~/.claude/hooks/move_claude_downloads.py)이
 *   `_claude/<세션 폴더명>/` 을 찾아 옮긴다. 그래서 폴더명 규칙은 **이 파일 하나** 에만 두고
 *   훅의 `folder_name` 과 글자 하나까지 같아야 한다(project-folder-vectors.json 이 못 박는다).
 *
 * 폴더명 규칙 (`projectFolderNameFromCwd`, 2026-11-09 사용자 결정: "세션을 연 폴더"):
 *   p = path.resolve(cwd); `\\?\` 로 시작하면 4글자를 떼고; p = path.normalize(p);
 *   길이가 3보다 길면 끝의 `\` 를 지우고; 유니코드 NFC 로 맞춘다.
 *   hash = sha256(utf8(p 를 소문자로)) 의 16진수 앞 8자 (윈도우가 아니면 소문자로 바꾸지 않는다)
 *   base = basename(p) 에서 `< > : " / \ | ? *` 와 제어문자(0x00-0x1F)를 `_` 로 바꾸고,
 *          앞뒤의 공백·마침표를 지우고, 앞 60자(유니코드 코드포인트)만 남긴 뒤 끝의 공백·마침표를
 *          한 번 더 지운다. 비면 `기타`.
 *   이름 = `${base}-${hash}`
 *
 * 이 파일은 확장(브라우저)에도 묶이므로 node 모듈을 직접 import 하지 않는다. 경로 함수와
 * sha256 은 호출자(브리지)가 넘긴다.
 */

/** 다운로드 폴더 기준, 확장이 만드는 모든 산출물의 최상위 폴더. */
export const CLAUDE_ARTIFACT_ROOT = '_claude';

/** 세션 폴더를 알 수 없을 때(예약 실행·직접 HTTP 호출 등) 쓰는 폴더. */
export const UNKNOWN_PROJECT_FOLDER = '기타';

/** stdio 브리지가 모든 tools/call 인자에 싣는 세션 폴더명 키. */
export const MCP_PROJECT_ARG = '_mcpProject';

/** 폴더명 앞부분(basename)의 최대 길이 (유니코드 코드포인트 수). */
export const PROJECT_BASE_MAX_CODE_POINTS = 60;

/** 폴더명 끝의 `-<sha256 앞 8자>`. */
const PROJECT_HASH_SUFFIX = /-([0-9a-f]{8})$/;

// eslint-disable-next-line no-control-regex
const FORBIDDEN_FOLDER_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const LEADING_SPACES_AND_DOTS = /^[ .]+/;
const TRAILING_SPACES_AND_DOTS = /[ .]+$/;

/** 브리지가 넘기는 경로 함수 (node `path.win32` / `path.posix` 와 같은 모양). */
export interface ProjectFolderPathApi {
  resolve(...paths: string[]): string;
  normalize(path: string): string;
  basename(path: string): string;
}

export interface ProjectFolderDeps {
  /** node 의 `path` 모듈. 플랫폼에 맞춰 `.win32` 또는 `.posix` 를 고른다. */
  path: { win32: ProjectFolderPathApi; posix: ProjectFolderPathApi };
  /** UTF-8 문자열의 sha256 16진수 문자열. */
  sha256Hex(text: string): string;
}

/**
 * 폴더명 앞부분(basename) 정리 — 훅의 `folder_name` 과 같은 순서.
 * 금지 문자를 `_` 로 → 앞뒤 공백·마침표 제거 → 앞 60 코드포인트 → 끝 공백·마침표 다시 제거 →
 * 비면 `기타`.
 */
export function sanitizeProjectBaseName(raw: unknown): string {
  if (typeof raw !== 'string') return UNKNOWN_PROJECT_FOLDER;
  const replaced = raw
    .replace(FORBIDDEN_FOLDER_CHARS, '_')
    .replace(LEADING_SPACES_AND_DOTS, '')
    .replace(TRAILING_SPACES_AND_DOTS, '');
  const limited = Array.from(replaced).slice(0, PROJECT_BASE_MAX_CODE_POINTS).join('');
  return limited.replace(TRAILING_SPACES_AND_DOTS, '') || UNKNOWN_PROJECT_FOLDER;
}

/** 훅의 `normalized_path` 와 같은 정규화. */
function normalizedPath(cwd: string, api: ProjectFolderPathApi): string {
  let p = api.resolve(cwd);
  if (p.startsWith('\\\\?\\')) p = p.slice(4);
  p = api.normalize(p);
  if (p.length > 3) p = p.replace(/\\+$/, '');
  return p.normalize('NFC');
}

/**
 * 세션 작업 폴더(cwd)에서 산출물 폴더명 `<basename>-<hash8>` 을 만든다.
 *
 * @param cwd       세션 작업 폴더 (브리지 프로세스의 `process.cwd()`)
 * @param platform  `process.platform`. `win32` 이면 `path.win32` 를 쓰고 해시 입력을 소문자로 바꾼다.
 * @param deps      node `path` 모듈과 sha256 함수
 */
export function projectFolderNameFromCwd(
  cwd: string,
  platform: string,
  deps: ProjectFolderDeps,
): string {
  const windows = platform === 'win32';
  const api = windows ? deps.path.win32 : deps.path.posix;
  const p = normalizedPath(cwd, api);
  const hash = deps.sha256Hex(windows ? p.toLowerCase() : p).slice(0, 8);
  return `${sanitizeProjectBaseName(api.basename(p))}-${hash}`;
}

/**
 * 받은 값이 이 규칙이 만든 모양인지 본다 — `기타` 그대로이거나,
 * `<정리해도 그대로인 앞부분>-<16진수 8자>`.
 */
export function isProjectFolderName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === UNKNOWN_PROJECT_FOLDER) return true;
  const match = PROJECT_HASH_SUFFIX.exec(value);
  if (!match) return false;
  const base = value.slice(0, value.length - match[0].length);
  return base.length > 0 && sanitizeProjectBaseName(base) === base;
}

/**
 * 폴더명을 쓸 수 없을 때 대신 쓸 폴더. 끝에 `-<16진수 8자>` 가 있으면 `기타-<그 8자>`,
 * 없으면 `기타`. 세션 종료 훅이 `기타-<hash>` 도 찾는다.
 */
export function fallbackProjectFolder(value: unknown): string {
  if (typeof value !== 'string') return UNKNOWN_PROJECT_FOLDER;
  const match = PROJECT_HASH_SUFFIX.exec(value);
  return match ? `${UNKNOWN_PROJECT_FOLDER}-${match[1]}` : UNKNOWN_PROJECT_FOLDER;
}
