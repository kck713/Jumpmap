// 그림 → 맵 변환을 합성 이미지로 확인합니다. 실패하면 exit code 1.
const C = require('../src/core.js');
let fail = 0;
const check = (ok, msg) => { console.log((ok ? '✔ ' : '✘ ') + msg); if (!ok) fail++; };

// 흰 종이(960×320)에 그림 그리기
function paper(w = 960, h = 320) {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  const rect = (x0, y0, x1, y1, [r, g, b]) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  };
  return { d, w, h, rect };
}
const BLACK = [20, 20, 30], RED = [220, 50, 50], YELLOW = [250, 220, 40], SKY = [170, 210, 245];

{
  const P = paper();
  P.rect(0, 300, 959, 305, BLACK);           // 땅선 → 지워져야 함
  for (const [a, b, c, e] of [[300, 222, 379, 225], [300, 296, 379, 299], [300, 222, 303, 299], [376, 222, 379, 299]]) P.rect(a, b, c, e, BLACK); // 속이 빈 상자 (2칸 높이)
  P.rect(560, 262, 599, 299, RED);           // 가시
  P.rect(700, 290, 739, 299, YELLOW);        // 점프 패드
  P.rect(100, 40, 250, 150, SKY);            // 연한 하늘색 = 꾸미기
  P.rect(700, 30, 800, 120, [255, 232, 150]); // 연노랑 해 = 꾸미기
  P.rect(850, 30, 900, 80, YELLOW);          // 하늘의 진한 노랑 해 = 꾸미기
  const a = C.analyzeDrawing(P.d, P.w, P.h);
  check(a && a.bottom >= 296 && a.bottom <= 301, `땅선을 바닥으로 인식 (bottom=${a && a.bottom})`);
  const L = C.columnsToLevel([a.cols], 2, '테스트');
  const by = t => L.objs.filter(o => o.t === t);
  check(by('b').length === 1 && by('b')[0].h === 2 && by('b')[0].y === 0 && by('b')[0].w >= 2, '속이 빈 상자 → 꽉 찬 2칸 블록 하나 ' + JSON.stringify(by('b')));
  check(by('s').length >= 1 && by('s').every(o => o.y === 0), `빨강 → 바닥 가시 ${by('s').length}개`);
  check(by('p').length >= 1 && by('p').every(o => o.y === 0), `노랑 → 점프 패드 ${by('p').length}개`);
  check(!L.objs.some(o => o.y > 2), '연한 색 꾸미기는 무시');
  check(L.objs.every((o, i) => !i || L.objs[i - 1].x <= o.x), '오브젝트가 x 순으로 정렬됨');
  const r = C.solveLevel(L);
  check(!!r.path, '완주 가능' + (r.path ? ' · 점프 ' + r.path.length + '회' : ' · x≈' + r.far.toFixed(1)));
  const back = C.decodeLevel(C.encodeLevel(L));
  check(back && back.name === '테스트' && back.end === L.end && JSON.stringify(back.objs) === JSON.stringify(L.objs), '공유 링크 인코딩 왕복');
}

{ // 너무 높은 벽 → 자동 고치기
  const P = paper();
  P.rect(400, 60, 470, 299, BLACK);          // 6칸 높이 벽
  P.rect(0, 300, 959, 305, BLACK);
  const L = C.columnsToLevel([C.analyzeDrawing(P.d, P.w, P.h).cols]);
  const r = C.solveLevel(L);
  check(!r.path && r.dead, '6칸 벽은 깰 수 없음으로 판정');
  const f = C.autoFix(L);
  check(f.ok && f.fixes > 0 && f.L.objs.some(o => o.t === 'b'), `자동 고치기로 완주 가능 (${f.fixes}번 수정, 벽은 남음)`);
}

{ // 빈 그림, 잘못된 링크
  const P = paper();
  check(C.analyzeDrawing(P.d, P.w, P.h) === null, '빈 종이는 null');
  for (const bad of ['', '2~a~10~', '1~a~99999~', '1~a~50~b1.2', '1~a~50~x1.0', '1~%E0~50~', '1~a~50~s1.0__s2.0'])
    check(C.decodeLevel(bad) === null, `잘못된 링크 거부: "${bad}"`);
}
process.exit(fail ? 1 : 0);
