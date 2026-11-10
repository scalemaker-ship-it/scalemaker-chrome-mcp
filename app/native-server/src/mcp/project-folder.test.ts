import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  UNKNOWN_PROJECT_FOLDER,
  fallbackProjectFolder,
  isProjectFolderName,
  sanitizeProjectBaseName,
} from 'scalemaker-chrome-mcp-shared';
import { projectFolderForCwd } from './project-folder';

/**
 * scalemaker-chrome-mcp fork(2026-11-09) — 산출물 세션 폴더명 규칙 `<basename>-<hash8>`.
 *
 * 세션 종료 훅(~/.claude/hooks/move_claude_downloads.py 의 folder_name)이 같은 규칙으로
 * `Downloads/_claude/<폴더명>/` 을 찾는다. 한 글자만 달라도 훅이 파일을 못 찾으므로,
 * 훅 함수로 만든 기대값(project-folder-vectors.json, 21건)과 글자 단위로 같아야 한다.
 */

interface NameVector {
  cwd: string;
  expected: string;
}

const vectors: NameVector[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'project-folder-vectors.json'), 'utf8'),
);

describe('projectFolderNameFromCwd — 훅과 같은 결과 (win32)', () => {
  test('벡터 파일에 21건이 있다', () => {
    expect(vectors).toHaveLength(21);
  });

  test.each(vectors.map((v) => [v.cwd, v.expected] as const))('%s', (cwd, expected) => {
    expect(projectFolderForCwd(cwd, 'win32')).toBe(expected);
  });
});

describe('projectFolderNameFromCwd — POSIX', () => {
  test('path.posix 를 쓰고 해시 입력은 소문자로 바꾸지 않는다', () => {
    const lower = projectFolderForCwd('/home/u/web', 'linux');
    const upper = projectFolderForCwd('/home/u/WEB', 'linux');
    expect(lower).toMatch(/^web-[0-9a-f]{8}$/);
    expect(upper).toMatch(/^WEB-[0-9a-f]{8}$/);
    expect(lower.slice(-8)).not.toBe(upper.slice(-8));
  });

  test('루트 / 는 basename 이 비어 기타-<hash>', () => {
    expect(projectFolderForCwd('/', 'linux')).toMatch(/^기타-[0-9a-f]{8}$/);
  });
});

describe('sanitizeProjectBaseName', () => {
  test('금지 문자·제어문자는 _ , 앞뒤 공백·마침표 제거, 한글·공백·쉼표 유지', () => {
    expect(sanitizeProjectBaseName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitizeProjectBaseName('\u0000x\u001f')).toBe('_x_');
    expect(sanitizeProjectBaseName('  ..당근, 소모임 운영.. ')).toBe('당근, 소모임 운영');
  });

  test('앞 60 코드포인트만 남기고, 자른 끝의 공백·마침표도 지운다', () => {
    expect(sanitizeProjectBaseName('가'.repeat(70))).toBe('가'.repeat(60));
    expect(Array.from(sanitizeProjectBaseName('😀'.repeat(61)))).toHaveLength(60);
    expect(sanitizeProjectBaseName('a'.repeat(59) + ' b')).toBe('a'.repeat(59));
  });

  test('비거나 문자열이 아니면 기타', () => {
    expect(sanitizeProjectBaseName('')).toBe(UNKNOWN_PROJECT_FOLDER);
    expect(sanitizeProjectBaseName(' . ')).toBe(UNKNOWN_PROJECT_FOLDER);
    expect(sanitizeProjectBaseName(undefined)).toBe(UNKNOWN_PROJECT_FOLDER);
  });
});

describe('isProjectFolderName / fallbackProjectFolder', () => {
  test('규칙이 만든 모양만 받는다', () => {
    for (const v of vectors) expect(isProjectFolderName(v.expected)).toBe(true);
    expect(isProjectFolderName('기타')).toBe(true);
    expect(isProjectFolderName('web')).toBe(false); // 해시 없음
    expect(isProjectFolderName('a<b-0123abcd')).toBe(false); // 정리되지 않은 앞부분
    expect(isProjectFolderName('-0123abcd')).toBe(false); // 앞부분이 빔
    expect(isProjectFolderName('web-0123ABCD')).toBe(false); // 대문자 16진수
    expect(isProjectFolderName(42)).toBe(false);
  });

  test('해시가 있으면 기타-<hash>, 없으면 기타', () => {
    expect(fallbackProjectFolder('con-1a2b3c4d')).toBe('기타-1a2b3c4d');
    expect(fallbackProjectFolder('../../x-deadbeef')).toBe('기타-deadbeef');
    expect(fallbackProjectFolder('web')).toBe('기타');
    expect(fallbackProjectFolder(undefined)).toBe('기타');
  });
});
