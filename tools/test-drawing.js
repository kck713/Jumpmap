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
  for (const [a, b, c, e] of [[300, 262, 379, 265], [300, 296, 379, 299], [300, 262, 303, 299], [376, 262, 379, 299]]) P.rect(a, b, c, e, BLACK); // 속이 빈 상자 (2칸 높이, 한 칸 = 20px)
  P.rect(562, 282, 584, 299, RED);           // 가시 (2~3칸)
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
  // 칸 고치기: 격자를 바꾸고 gridColumns로 다시 만들면 레벨에 반영된다
  const g2 = a.g.slice(); for (let i = 0; i < g2.length; i++) if (g2[i] === 2) g2[i] = 0;   // 가시 지우기
  g2[3 * a.nc + 30] = 1;                                                                    // 떠 있는 블록 하나 칠하기
  const L2 = C.columnsToLevel([C.gridColumns(g2, a.nc, a.nr)]);
  check(!L2.objs.some(o => o.t === 's') && L2.objs.some(o => o.t === 'b' && o.y === 3 && o.h === 1), '칸 고치기 → 가시 사라지고 떠 있는 블록 생김');
  check(L.colX[0].filter(x => x !== null).length > 0 && L.colX[0].every((x, i, xs) => x === null || xs.slice(0, i).every(y => y === null || y < x)), '열 → 레벨 x 대응표(colX)가 순서대로');
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
  check(f.ok && f.fixes > 0 && f.L.objs.some(o => o.t === 'b'), `자동 변환으로 완주 가능 (${f.fixes}번 수정, 벽은 남음)`);
  const wall = f.L.objs.find(o => o.t === 'b'), kinds = f.changes.map(c => c.t).join(',');
  check(f.changes.some(c => c.t === 'pad') && wall.h >= 3, `벽 앞에 점프 패드를 놓아 벽을 ${wall.h}칸 높이로 살림 (${kinds})`);
}

{ // 연필 지그재그 = 가시, 블록 아래 지그재그 = 매달린 가시
  const P = paper();
  P.rect(0, 300, 959, 305, BLACK);
  // 이빨 폭 6px짜리 연필 지그재그 (실제 사진에서 칸 하나에 이빨 2~3개 정도)
  const zig = (x0, x1, yBase, amp) => {
    let py = yBase;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) % 6, y = yBase + Math.round(amp * (t < 3 ? t / 3 : (6 - t) / 3));
      P.rect(x, Math.min(y, py), x + 1, Math.max(y, py), BLACK); py = y;
    }
  };
  zig(400, 520, 299, -18);                                       // 바닥 지그재그
  P.rect(600, 160, 760, 163, BLACK); P.rect(600, 200, 760, 203, BLACK); P.rect(600, 160, 603, 203, BLACK); P.rect(757, 160, 760, 203, BLACK); // 떠 있는 상자
  zig(600, 760, 204, 16);                                        // 상자 아래 이빨
  const L = C.columnsToLevel([C.analyzeDrawing(P.d, P.w, P.h).cols]);
  const up = L.objs.filter(o => o.t === 's' && !o.d), down = L.objs.filter(o => o.t === 's' && o.d);
  check(up.length >= 3 && up.every(o => o.y === 0), `바닥 지그재그 → 가시 ${up.length}개`);
  check(down.length >= 3 && down.every(o => o.y > 2), `상자 아래 지그재그 → 매달린 가시 ${down.length}개`);
  const back = C.decodeLevel(C.encodeLevel(L));
  check(back && back.objs.filter(o => o.d).length === down.length, '매달린 가시도 링크로 왕복');
}

{ // 사진 속 종이 찾기: 회색 배경 위에 기울어진 흰 종이
  const W = 600, H = 800, d = new Uint8ClampedArray(W * H * 4);
  const inPaper = (x, y) => { const u = (x - 300) * Math.cos(.1) + (y - 400) * Math.sin(.1), v = -(x - 300) * Math.sin(.1) + (y - 400) * Math.cos(.1); return Math.abs(u) < 220 && Math.abs(v) < 150; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, p = inPaper(x, y), v = p ? 235 : 180 + ((x * 7 + y * 13) % 15); d[i] = v; d[i + 1] = v; d[i + 2] = p ? v - 5 : v - 10; d[i + 3] = 255; }
  const q = C.findPaper(d, W, H);
  const pw = q && (C.dist(q[0], q[1]) + C.dist(q[3], q[2])) / 2, ph = q && (C.dist(q[0], q[3]) + C.dist(q[1], q[2])) / 2;
  check(q && Math.abs(pw - 440) < 20 && Math.abs(ph - 300) < 20, `종이 크기 ${pw && pw.toFixed(0)}×${ph && ph.toFixed(0)} (정답 440×300)`);
  check(C.findPaper(new Uint8ClampedArray(W * H * 4).fill(240), W, H) === null, '사진 전체가 종이면 null');
  const vg = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = 238 - 40 * (((x / W) - .5) ** 2 + ((y / H) - .5) ** 2); vg[i] = vg[i + 1] = vg[i + 2] = v; vg[i + 3] = 255; }
  check(C.findPaper(vg, W, H) === null, '조명이 고르지 않아도 종이가 꽉 찬 사진은 자르지 않음');
}

{ // 빈 그림, 잘못된 링크
  const P = paper();
  check(C.analyzeDrawing(P.d, P.w, P.h) === null, '빈 종이는 null');
  for (const bad of ['', '2~a~10~', '1~a~99999~', '1~a~50~b1.2', '1~a~50~x1.0', '1~%E0~50~', '1~a~50~s1.0__s2.0'])
    check(C.decodeLevel(bad) === null, `잘못된 링크 거부: "${bad}"`);
}
process.exit(fail ? 1 : 0);
