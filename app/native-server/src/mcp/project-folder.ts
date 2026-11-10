import { createHash } from 'crypto';
import * as path from 'path';
import {
  UNKNOWN_PROJECT_FOLDER,
  projectFolderNameFromCwd,
  type ProjectFolderDeps,
} from 'scalemaker-chrome-mcp-shared';

/**
 * scalemaker-chrome-mcp fork(2026-11-09): 세션 폴더명 계산에 쓰는 node 의존성.
 * 규칙 본문은 shared 의 `projectFolderNameFromCwd` 하나뿐이고, 여기서는 경로 함수와 sha256 만 넘긴다.
 */
export const nodeProjectFolderDeps: ProjectFolderDeps = {
  path,
  sha256Hex: (text: string) => createHash('sha256').update(text, 'utf8').digest('hex'),
};

/** 주어진 작업 폴더의 산출물 폴더명 (`<basename>-<hash8>`). */
export const projectFolderForCwd = (cwd: string, platform: string = process.platform): string =>
  projectFolderNameFromCwd(cwd, platform, nodeProjectFolderDeps);

/**
 * 이 stdio 프로세스(= Claude Code 세션 하나)의 산출물 폴더명.
 * Claude Code 는 stdio 서버를 세션 작업 폴더에서 띄우므로 `process.cwd()` 가 곧 그 폴더다.
 * cwd 를 못 읽으면(폴더가 지워짐 등) `기타`.
 */
export const currentProjectFolder = (): string => {
  try {
    return projectFolderForCwd(process.cwd());
  } catch {
    return UNKNOWN_PROJECT_FOLDER;
  }
};
