# CLAUDE.md

Neon Cube Run: 지오메트리 대시 스타일 원터치 리듬 러너. 바닐라 JS + Canvas 2D, 의존성 없음. 사용자에게는 한국어로 답한다.

## 명령어
- `npm run verify`: 모든 레벨이 완주 가능한지 확인한다. 실패하면 exit code 1. **레벨, 물리값, 히트박스를 바꿨으면 반드시 실행한다.**
- `npm run build`: `src/` → `index.html`. `index.html`은 생성물이므로 직접 편집하지 말고 `src/`를 고친 뒤 빌드한다.

## 구조
- `src/core.js`: 순수 로직 (DOM 없음). 브라우저와 Node(verify) 양쪽에서 쓰인다. 마지막 줄의 `module.exports`는 빌드할 때 제거된다.
  - `K`: 전체 속도 배율 (현재 0.75). speed와 jumpV는 K, 중력 g는 K²로 같이 스케일하므로 **점프 궤적(거리·높이)은 K와 무관하게 유지된다.** 속도를 바꿀 때는 K만 바꾼다. speed만 바꾸면 점프 거리가 달라져 레벨이 깨진다.
  - `CFG.inset / sw / sh`: 큐브 여백, 가시 판정 폭과 높이. 판정을 일부러 관대하게 잡아 두었다.
  - `step(s, dt, hold, L)`: dt를 4개의 서브스텝으로 나눠 처리. 게임 루프는 1/120초 고정 스텝.
  - 오브젝트 타입: `s` 가시, `b` 블록, `p` 점프 패드, `k` 가시 공(원형 판정), `L` 레이저(플레이어 x가 `[x, x+len]`이고 높이가 `[y0, y1]`과 겹치면 사망. `warn`은 경고를 시작하는 거리).
  - 오브젝트 배열은 x 기준으로 정렬되어 있어야 한다 (충돌 루프가 일찍 break함).
- `src/ui.js`: IIFE 하나에 렌더링(`draw`, `drawBoss`, `spikyBall`), 입력, WebAudio 신스(`basslines`, `schedule`, `sfx`), 메뉴(`pick`, `showMenu`, `start`), 루프(`frame`)가 들어 있다.
  - 타일 픽셀 크기 `T`는 화면 크기에서 계산한다. 월드 좌표에서 화면 좌표로는 `X()`, `Y()`로 바꾼다.
  - 최고 기록은 localStorage `ncr-best-<레벨인덱스>`에 저장한다 (try/catch로 감쌈).
  - `window.claude?.hot` 관련 코드는 claude.ai 아티팩트 뷰어용 핫리로드 훅이다. 일반 브라우저에서는 아무 일도 하지 않으므로 지워도 된다.
- `src/shell.html`: 단일 다크 테마. 색 토큰은 `:root`에 있고, ui.js의 `COL` 객체와 값을 맞춰 둔다.

## 레벨 추가 체크리스트
1. `core.js`에 `buildLevelN()`을 작성하고 `LEVELS`에 추가한다 (`name`, `end`, `boss` 필드 포함).
2. `shell.html`에 레벨 버튼(`data-lv`, `id="bN"`)을 추가한다.
3. `ui.js`의 `basslines`와 `bests` 초기 배열 길이를 늘린다.
4. `npm run verify` → `npm run build`

## 원칙
- 모바일 터치가 기본 입력이다. 버튼에서 `pointerdown`이 일어나면 `stopPropagation`해서 점프로 번지지 않게 한다.
- `prefers-reduced-motion`이 켜져 있으면 흔들림, 비트 펄스, 괴물 흔들림을 끈다.
- 오디오는 첫 사용자 입력 이후에만 시작한다 (`initAudio`).
