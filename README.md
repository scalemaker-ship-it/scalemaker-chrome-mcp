# ScaleMaker Chrome MCP

> [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) 의 reliability fork — 5+ 개월 머지 안 된 핵심 PR 7개 흡수 + Force Reconnect + Diagnostic UI.
> 출처: [cw02326/auto-chrome-mcp](https://github.com/cw02326/auto-chrome-mcp) 1.14.0 (커밋 `c2dd596`)을 ScaleMaker 이름으로 바꾼 배포판입니다. 원본 라이선스(MIT, `LICENSE`)를 그대로 따릅니다.
> **stdio transport 강제** (HTTP 12306 안 씀). 웹스토어 등록 안 함 — npm + GitHub Release 사이드로드.

## 설치 — 한 줄

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/scalemaker-ship-it/scalemaker-chrome-mcp/main/install.ps1 | iex
```

**macOS / Linux**:

```bash
curl -fsSL https://raw.githubusercontent.com/scalemaker-ship-it/scalemaker-chrome-mcp/main/install.sh | bash
```

스크립트가 대신 해주는 것:

- ✅ 브리지 전역 설치 (`npm install -g scalemaker-chrome-mcp-bridge`)
- ✅ Native Messaging manifest 등록 + `doctor --fix` 자동 점검
- ✅ 클로드 코드에 `scalemaker-chrome-mcp-stdio` 등록 (전역 — 어느 폴더에서 실행해도 사용 가능)
- ✅ 최신 릴리스에서 확장 zip 내려받아 압축 해제 (+ 윈도우는 폴더와 `chrome://extensions` 자동 열기)

> Node.js 20+ 필요 — `node -v` 로 확인.

### 남은 2단계 — 여기서부터는 사람이 해야 합니다

**1. 크롬 확장 로드 (자동화 불가)**

`chrome://extensions` → 우측 상단 **개발자 모드** ON → **압축해제된 확장 프로그램을 로드** →
설치 스크립트가 열어 준 폴더 선택.

> 크롬 정책상 `chrome://extensions` 는 스크립트로 조작할 수 없습니다. **AI 도, 이 확장 자신도
> 대신 눌러 줄 수 없습니다.** 반드시 사람이 클릭해야 하는 유일한 단계입니다.

확장 ID = `nnajikeoafggmklbngkablkamchfmcdg` (모든 사용자 동일 — `manifest.key` 박제로 unpacked
load 시에도 `allowed_origins` 자동 일치).

**2. 클로드 코드 재시작**

껐다 켠 뒤 `/mcp` 입력 → `scalemaker-chrome-mcp-stdio` 가 보이면 성공입니다.

> 도구 목록은 MCP 서버가 시작할 때 한 번만 광고됩니다. 재시작 전에는 새 도구가 안 보입니다.

## 설치 — 직접 하고 싶다면

```bash
npm install -g scalemaker-chrome-mcp-bridge
```

postinstall 이 자동으로 처리하는 것:

- ✅ Native Messaging manifest 등록 (`com.scalemakerchromemcp.nativehost`)
- ✅ 확장 zip 다운로드 → `~/Downloads/scalemaker-chrome-mcp-extension-v<version>/`
- ✅ **클로드 코드가 설치돼 있으면** (`~/.claude/` 존재) 트러블슈팅 스킬도 설치 →
  `~/.claude/skills/scalemaker-chrome-mcp-doctor/SKILL.md`. 이후 "MCP 안 돼" 한 마디로 자동 진단·복구.
  (이 스킬은 **문제 해결용**입니다 — 설치 수단이 아닙니다.)

그 다음 클로드 코드에 등록:

```bash
# macOS / Linux
claude mcp add --scope user --transport stdio scalemaker-chrome-mcp-stdio \
  -e CHROME_PORT=12320 -- node "$(npm root -g)/scalemaker-chrome-mcp-bridge/dist/mcp/mcp-server-stdio.js"
```

```powershell
# Windows PowerShell
claude mcp add --scope user --transport stdio scalemaker-chrome-mcp-stdio `
  -e CHROME_PORT=12320 -- node "$((npm root -g).Trim())\scalemaker-chrome-mcp-bridge\dist\mcp\mcp-server-stdio.js"
```

마지막으로 위의 **남은 2단계**(확장 로드 + 클로드 코드 재시작)를 진행하면 됩니다.

> **자동 스킬 설치를 원하지 않으면:** `SCALEMAKER_CHROME_MCP_NO_SKILL=1 npm install -g scalemaker-chrome-mcp-bridge`
> 사용자 custom 스킬 (frontmatter `name` 이 다른 경우) 은 절대 덮어쓰지 않습니다.
> 같은 스킬이 이미 있으면 `scalemaker-chrome-mcp-version` 비교 후 새 버전일 때만 갱신합니다.

## 이 저장소 주소만 받고 설치를 맡은 AI 에이전트라면

사람이 "이 링크 보고 설치해줘" 라고 했다면, 순서는 이렇습니다:

1. 위 **한 줄 설치** 스크립트를 실행한다 (OS 에 맞는 쪽).
2. 확장 로드는 **대신 해줄 수 없다.** 위 1단계를 사람에게 그대로 안내하고 기다린다 —
   `chrome://extensions` 는 스크립트·자동화가 접근할 수 없다.
3. 사람이 확장을 로드했다고 하면, 클로드 코드 재시작을 안내한다. 재시작 전에는 도구가 안 보인다.
4. 확인: `scalemaker-chrome-mcp-bridge doctor` 가 모든 항목 OK 인지 본다 (12개 이상 — 설치된 브라우저 수와 OS 에 따라 늘어난다).
   `Connectivity` 만 실패하면 크롬이 꺼져 있거나 확장이 아직 로드되지 않은 것이다.

## 무간섭 모드 (v1.9.0 기본값)

기본 설정 그대로 쓰면 **MCP 가 브라우저를 쓰는 동안 사용자 화면은 아무것도 바뀌지 않는다.**

- MCP 작업 탭은 사용자 창이 아니라 별도의 **MCP 작업 창** 에 모인다. 그 창은 만들어진 직후
  최소화돼 바탕화면 작업 영역에 나타나지 않는다(작업 표시줄에는 남는다).
- 탭 활성화(`tabs.update({active:true})`)는 그 전용 창 안에서만 일어난다. 사용자가 보고 있는
  탭은 어떤 도구도 앞으로 끌어내지 않는다.
- OS 창 포커스는 기본적으로 가져오지 않는다. 창을 만들 때 포커스가 딸려오면 되돌려 놓는다.
- MCP 작업 탭은 창마다 하나씩 있는 초록색 탭 그룹 **"MCP"** 로 묶여, 사용자가 직접 연 탭과
  탭 스트립에서 바로 구분된다(팝업의 "작업 탭 그룹 표시" 토글로 끌 수 있다). 편입은 탭을
  활성화하거나 창 포커스를 바꾸지 않는다.
- 스크린샷·읽기·클릭·입력은 전부 보이지 않는 탭에서 정상 동작한다(CDP 경로).

**그래도 방해받는다면** 확장 팝업에서 두 가지를 확인한다.

1. **강제 포커스**. 켜져 있으면 도구 실행 때 크롬 창이 앞으로 나온다. 끄면 된다.
2. **전용 작업 창**. 기본은 꺼짐이다. 꺼져 있으면 사용자가 보고 있는 창에 백그라운드 탭을
   만든다(탭은 활성화하지 않지만 탭 목록이 늘어난다). 켜면 MCP 작업 탭이 별도 창으로 분리된다.

저장된 설정은 기본값보다 우선한다. 예전 버전에서 전용 작업 창을 켰던 사용자는 팝업의
**"무간섭 권장 설정으로 되돌리기"** 버튼으로 한 번에 권장값(현재 창에 새 탭)으로 맞출 수 있다.

사용자 화면을 실제로 바꾸는 예외 도구는 셋뿐이다. 정의상 사용자 대면 동작이라 게이트를 타지
않는다: `chrome_switch_tab`(탭을 앞으로 가져오라는 요청 자체), `chrome_request_element_selection`
(화면에서 요소를 고르게 함), `chrome_request_user_consent`(동의 창).

## 산출물 저장 위치와 자동 정리

스크린샷·GIF·PDF·성능 트레이스·예약 실행 기록은 그 도구를 부른 Claude 세션별 폴더에 쌓인다.

```
Downloads/_claude/<세션 폴더명>/YYYY-MM-DD/<종류>_<이름>_<HHmmss>.<확장자>
```

세션 폴더명은 stdio 브리지가 세션을 연 폴더(작업 폴더)로 정한다. 모양은
`<폴더 이름>-<경로 해시 8자>` 이고, 규칙은 `packages/shared/src/artifact-folder.ts` 의
`projectFolderNameFromCwd` 한 곳에 있다. 세션 종료 훅이 같은 규칙으로 폴더를 찾으므로
한 글자라도 달라지면 안 된다.

1. 작업 폴더 경로를 정규화한다. 윈도우는 절대 경로로 바꾸고, 앞의 `\\?\` 를 떼고,
   드라이브 루트가 아니면 끝의 `\` 를 지우고, 유니코드 NFC 로 맞춘다.
2. 해시는 그 경로(윈도우는 소문자로 바꾼 것)의 UTF-8 SHA-256 앞 8자(16진수 소문자).
3. 폴더 이름은 경로의 마지막 이름이다. `< > : " / \ | ? *` 와 제어문자(0x00-0x1F)는 `_` 로
   바꾸고, 앞뒤 공백·마침표를 지우고, 앞 60글자(코드포인트)만 쓰고, 자른 끝의 공백·마침표를
   다시 지운다. 비면 `기타`. 한글·공백·쉼표는 그대로 둔다.

같은 이름의 폴더가 여러 곳에 있어도 해시가 달라 섞이지 않는다. 예약 실행은 그 예약을 건
세션의 폴더에 저장된다(`chrome_shortcut action=schedule` 이 예약에 폴더명을 함께 남긴다).
이 기능 전에 만든 예약이나 사이드패널에서 새로 만든 예약처럼 건 세션이 없으면 `기타` 에
저장된다. 크롬이 세션 폴더명을 폴더로 받지 않으면 이름을 고쳐 쓰지 않고
`기타-<해시 8자>` 에 저장한다(훅이 이 폴더도 찾는다).

페이지에서 시작된 다운로드(작업 탭에서 링크를 눌러 받은 파일)는 옮기지 않는다. 사용자가 받은
파일과 확실히 가를 방법이 없기 때문이다.

날짜와 시각은 로컬 시간이다. 사용자가 `filename` 에 폴더 경로를 넣어도 마지막 이름만 쓰므로
이 폴더 밖으로는 저장되지 않는다. 같은 이름이 겹치면 크롬이 알아서 번호를 붙인다.

아래 자동 정리는 2026-11 이전 위치인 `Downloads/mcp-screenshots/` 만 본다. `_claude/` 는
건드리지 않는다(세션 종료 훅이 프로젝트로 옮긴다).

보관 기간이 지난 날짜 폴더는 **브리지가 시작할 때** 자동으로 정리된다. 기본값은 7일이 지나면
보관 폴더로 옮기는 것이고, 설정은 `~/.scalemaker-chrome-mcp/config.json` 에 둔다(파일이 없으면 기본값).

```json
{
  "artifactArchiveDir": "C:/PROJECTS/_작업물",
  "artifactRetentionDays": 7,
  "artifactCleanup": "archive"
}
```

- `artifactCleanup`: `archive`(기본, 보관 폴더로 이동) · `delete`(삭제) · `off`(정리 안 함)
- `artifactRetentionDays`: 며칠이 지나면 정리할지. 기본 7. 정확히 7일 된 폴더도 대상이다.
- `artifactArchiveDir`: 옮겨 둘 곳. 기본은 `~/scalemaker-chrome-mcp-archive`.
  실제 이동 위치는 `<보관 폴더>/YYYY-MM/YYYY-MM-DD/` 이고, 같은 이름이 있으면 접미사가 붙는다.

정리 대상은 `mcp-screenshots` 아래 **날짜 이름 폴더 안의 일반 파일** 뿐이다. 그 밖의 파일,
하위 폴더, 심볼릭 링크는 건드리지 않는다. 직접 돌려 보려면:

```bash
scalemaker-chrome-mcp-bridge artifacts            # 무엇이 정리될지만 보여준다 (변경 없음)
scalemaker-chrome-mcp-bridge artifacts --now      # 실제로 정리한다
```

마지막 실행 결과는 `~/.scalemaker-chrome-mcp/artifacts-last-run.json` 에 남는다.

## ⚠️ 사이트 권한 자동 허용 — 알아두세요

scalemaker-chrome-mcp 는 AI 자동화가 끊기지 않도록 Chrome 사이트 권한 prompt 를 **자동으로 처리**합니다 (v1.0.32+). 두 갈래로 동작:

| 권한                | 처리 시점                      | 효과                                                                                     |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Popups              | install 시 모든 사이트 일괄    | 모든 사이트의 `window.open()` 차단 안 됨                                                 |
| Notifications       | install 시 모든 사이트 일괄    | 알림 권한 prompt 안 뜸                                                                   |
| Clipboard           | install 시 모든 사이트 일괄    | 클립보드 읽기 prompt 안 뜸                                                               |
| Automatic downloads | install 시 모든 사이트 일괄    | 다중 파일 자동 다운로드 prompt 안 뜸                                                     |
| **Camera**          | **AI 사용 사이트만 누적 자동** | Chrome 정책상 일괄 불가. AI 가 사용한 사이트만 그 origin 영구 허용 (sticky)              |
| **Microphone**      | **AI 사용 사이트만 누적 자동** | 동일                                                                                     |
| **Geolocation**     | **AI 사용 사이트만 누적 자동** | v1.0.32+ 부터 민감 처리로 이동 (OS 권한 + 개인정보 보호). camera/mic 와 동일 모델로 통일 |

**민감 3종 작동 방식 (camera/microphone/geolocation):** AI 가 카메라/마이크/위치 정보를 쓰려고 하면 popup 토글을 확인 → 토글 ON 이면 즉시 그 사이트만 origin 단위로 영구 허용 (`chrome.contentSettings.X.set({primaryPattern:'https://example.com/*', setting:'allow'})`). 한 번 set 된 사이트는 브라우저 재시작 후에도 prompt 안 뜸. 사용자가 직접 `chrome://settings/content/{camera,microphone,location}` 갈 필요 없음.

**OS 레벨 권한은 사용자 직접 설정 필요:**

- macOS: `시스템 설정 > 개인정보 보호 및 보안 > 카메라/마이크/위치 서비스` → Google Chrome 토글 ON
- Windows: `설정 > 개인 정보 보호 > 카메라/마이크/위치` → Chrome 허용
- (OS 권한이 꺼져 있으면 Chrome 확장이 아무리 허용해도 디바이스/위치 접근 자체가 안 됨)

**AI 자동화 흐름 confirm 게이트:** popup 하단 "권한 설정" 의 토글 3개 (camera/microphone/geolocation) 는 AI 가 해당 기능을 쓸 때마다 사용자 confirm 을 받을지 결정합니다.

- **Default**: 토글 3개 전부 **ON** (install 시 초기화). 묻지 않고 즉시 사용.
- **OFF 로 내리면**: AI 가 해당 기능 호출 시 작은 confirm 창이 떠서 허용 여부를 묻습니다 (60초 timeout).
- 끄려면: 확장 아이콘 클릭 → popup 하단 "권한 설정" 섹션에서 토글 OFF.

> **보안 모델** — 비민감 4종 (popups/notifications/clipboard/autoDownload) 은 install 시 모든 사이트 일괄 허용이라 일반 사용자에게 위험할 수 있음. 민감 3종 (camera/microphone/geolocation) 은 AI 가 방문한 사이트에만 누적 추가되므로 사용자가 신뢰하지 않는 사이트엔 영향 없음 (그 사이트에 가지 않으면 추가 안 됨). 별도 Chrome 프로필 사용을 권장합니다.
>
> **opt-out:** 자동 권한 세팅을 원하지 않으면 설치 후 `chrome://settings/content` 에서 비민감 4종을 직접 default 로 되돌리세요. 민감 3종의 origin 별 누적 허용은 `chrome://settings/content/{camera,microphone,location}` 에서 사이트별로 삭제 가능.

## 왜 fork?

| 흡수한 upstream PR (5+ 개월 OPEN)                   | 효과                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| **#346** singleton transport 제거 → factory pattern | "已连接, 服务未启动" 노란불 해결 / 두 client 동시 연결 가능 |
| **#312** stale reconnect EOF handler                | 네트워크 잠시 끊김 후 자동 복구                             |
| **#302 + #304** STDIO session/parent cleanup        | parent 죽으면 zombie 0                                      |
| **#329** pagehide for Chrome 144+                   | 144 업데이트 후 streamable HTTP error 해결                  |
| **#338** partial (transport close cleanup)          | memory leak 방지                                            |
| **#313** `CHROME_MCP_HOST` env                      | LAN 노출 / 포트 충돌 회피                                   |

| Fork 신규                                            | 효과                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **⚡ 강제 재연결** 5단계 슈퍼버튼                    | drain → port free → spawn → handshake → MCP ping 자동. 사용자 `pkill` 수동 작업 0                      |
| **🔬 진단 리포트** + Self-Test                       | env / bridge process / Self-Test 5 케이스 / Copy as JSON                                               |
| **deterministic extension ID** (`manifest.key` 박제) | 모든 사용자 ID = `nnajikeoafggmklbngkablkamchfmcdg` → unpacked load 시에도 `allowed_origins` 자동 일치 |
| **stdio 강제 정책**                                  | HTTP 12306 안 씀. native messaging 기반 stdio 만                                                       |
| **Claude design tokens** (warm cream + coral)        | popup UI = Anthropic Claude 디자인 시스템                                                              |
| **한국어 patch**                                     | popup 의 UI 텍스트 한국어 (단축 도구·관리 메뉴 등 잡 기능은 제거)                                      |

(옵션) **Chrome Launcher + Playwright CDP 폴백** — `scalemaker-chrome-launcher` CLI 가 Chrome 을 `--remote-debugging-port=9222` 로 띄움. native messaging 끊겨도 CDP attach 로 도구 미러. 일반 사용엔 불필요.

## 진단 / 트러블슈팅

설치가 꼬였다면:

```bash
scalemaker-chrome-mcp-bridge doctor          # 상태 점검 (12개 이상, 브라우저 수·OS 에 따라 늘어남)
scalemaker-chrome-mcp-bridge doctor --fix    # 자동 복구
scalemaker-chrome-mcp-bridge report --copy   # 진단 리포트 (이슈 등록용)
```

브리지는 시작할 때 로컬 HTTP 인증 토큰을 `~/.scalemaker-chrome-mcp/auth-token` 에 (소유자만 읽기) 만들고, MCP stdio 프록시가 그 파일을 읽어 인증한다. 이 파일이 없거나 남에게 읽히면 `doctor` 의 "Bridge auth token" 항목이 알려 준다. 지우면 브리지가 다음 시작 때 새로 만든다.

옛 확장 + 새 브리지 조합에서는 팝업의 강제 재연결이 401 이 나므로 확장도 함께 올려야 한다. 확장은 브리지가 네이티브 메시지로 넘겨준 토큰을 붙여야 `/admin/*` 과 `/mcp` 를 쓸 수 있다.

## Upstream sync

매주 자동 검사 (`upstream-check.yml`) + 월 1회 정기 sync. 흡수한 PR 이 upstream 머지되면 retire issue 자동 생성. 정책 → [`docs/UPSTREAM_SYNC.md`](./docs/UPSTREAM_SYNC.md)

## 더 자세히

- 설계 → [`docs/DESIGN.md`](./docs/DESIGN.md) (33KB, 9 섹션)
- 흡수 PR 매트릭스 → [`UPSTREAM_DIFF.md`](./UPSTREAM_DIFF.md)
- 데일리 자동화 (예약 실행) → [`docs/DAILY-AUTOMATION-ko.md`](./docs/DAILY-AUTOMATION-ko.md)
- 강제 재연결 동작 → [`docs/FORCE_RECONNECT.md`](./docs/FORCE_RECONNECT.md)
- 회귀 케이스 → [`docs/REGRESSION_CASES.md`](./docs/REGRESSION_CASES.md)
- Playwright 폴백 → [`docs/PLAYWRIGHT_FALLBACK.md`](./docs/PLAYWRIGHT_FALLBACK.md)

## License

원본 MIT — [`LICENSE`](./LICENSE).
