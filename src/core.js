// ===== Core: level + physics (pure, testable) =====
const K = 0.75; // 전체 속도 배율 (1 = 원래 속도)
const CFG = { speed: 10.4 * K, g: 88 * K * K, jumpV: 20.5 * K, padV: 27 * K, inset: 0.06, sw: 0.15, sh: 0.55 };

function buildLevel1() {
  const o = [];
  const S = (x, y = 0) => o.push({ t: 's', x, y });
  const B = (x, w, h, y = 0) => o.push({ t: 'b', x, y, w, h });
  const J = (x, y = 0) => o.push({ t: 'p', x, y });
  // 1. 워밍업
  S(14);
  S(24); S(25);
  // 2. 블록 위로
  B(33, 4, 1); S(40);
  S(48); S(49); S(50);
  // 3. 계단
  B(58, 3, 1); B(61, 3, 2); B(64, 3, 3); S(68); S(69);
  // 4. 점프 패드 + 벽
  J(79); B(83, 3, 3); S(92); S(93);
  // 5. 기둥 건너기
  B(99, 2, 1); S(101); S(102); B(103, 2, 1); S(105); S(106); B(107, 2, 1);
  // 6. 블록 위 가시
  B(116, 6, 1); S(119, 1);
  // 7. 마무리
  S(129); S(130); S(131);
  B(139, 2, 1); B(143, 2, 2); S(147); S(148);
  S(156); S(157);
  return { objs: o.sort((a, b) => a.x - b.x), end: 166, name: '네온 시티', boss: false };
}

// ----- 레벨 2: 레이저 괴물 -----
// 레이저: x = 발사 시작 지점(플레이어 위치 기준), len = 발사 유지 거리, warn = 예고 거리, y0~y1 = 빔 높이
function buildLevel2() {
  const o = [];
  const S = (x, y = 0) => o.push({ t: 's', x, y });
  const B = (x, w, h, y = 0) => o.push({ t: 'b', x, y, w, h });
  const J = (x, y = 0) => o.push({ t: 'p', x, y });
  const K = (x, y = 0) => o.push({ t: 'k', x, y });            // 가시 공
  const LOW = x => o.push({ t: 'L', x, w: 2.2, len: 2.2, warn: 7, y0: 0.15, y1: 0.55 });  // 점프로 피하기
  const HIGH = (x, len = 3) => o.push({ t: 'L', x, w: len, len, warn: 7, y0: 1.25, y1: 1.65 }); // 점프하지 말기
  S(14); S(22); S(23);
  LOW(32);
  K(40);
  HIGH(48);
  B(56, 3, 1); S(62);
  LOW(70);
  K(78, 1.2);                 // 매달린 가시 공: 점프 금지
  HIGH(86);
  S(94); S(95); S(96);
  J(104); B(108, 3, 3); S(115); S(116);
  LOW(122);
  HIGH(129, 4);
  K(138); K(139);
  LOW(146);
  K(153, 1.2); S(158); S(159);
  return { objs: o.sort((a, b) => a.x - b.x), end: 168, name: '레이저 괴물', boss: true };
}
const LEVELS = [buildLevel1, buildLevel2];
function buildLevel(i = 0) { return LEVELS[i](); }

function newPlayer() { return { x: 0, y: 0, vy: 0, grounded: true, dead: false, won: false, padHit: false }; }

function sub(s, dt, hold, L) {
  if (s.grounded && hold) { s.vy = CFG.jumpV; s.grounded = false; s.jumped = true; }
  const py = s.y;
  s.x += CFG.speed * dt; s.vy -= CFG.g * dt; s.y += s.vy * dt;
  let g = false;
  if (s.y <= 0) { s.y = 0; if (s.vy < 0) s.vy = 0; g = true; }
  const a = CFG.inset, L0 = s.x + a, R0 = s.x + 1 - a;
  for (const o of L.objs) {
    const ow = o.w || 1;
    if (o.x > R0 + 0.05) break;
    if (o.x + ow < L0 - 0.05) continue;
    if (o.t === 'b') {
      const top = o.y + o.h;
      const hx = R0 > o.x && L0 < o.x + ow;
      if (hx && s.y + 1 - a > o.y && s.y < top - 1e-9) {
        if (py >= top - 0.3 && s.vy <= 0) { s.y = top; s.vy = 0; g = true; }
        else { s.dead = true; return; }
      } else if (hx && Math.abs(s.y - top) < 1e-6 && s.vy <= 0) g = true;
    } else if (o.t === 's') {
      const sy = o.d ? o.y + 1 - CFG.sh : o.y; // d: 아래를 향한(매달린) 가시
      if (R0 > o.x + 0.5 - CFG.sw && L0 < o.x + 0.5 + CFG.sw && s.y < sy + CFG.sh && s.y + 1 - a > sy) { s.dead = true; return; }
    } else if (o.t === 'p') {
      if (R0 > o.x + 0.1 && L0 < o.x + 0.9 && s.y < o.y + 0.3 && s.vy < CFG.padV - 1) {
        s.vy = CFG.padV; g = false; s.y = Math.max(s.y, o.y + 0.01); s.padHit = true;
      }
    } else if (o.t === 'k') {
      const cx = o.x + 0.5, cy = o.y + 0.5, r = 0.36 + (CFG.sw - 0.15);
      const nx = Math.max(L0, Math.min(cx, R0)), ny = Math.max(s.y, Math.min(cy, s.y + 1 - a));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) { s.dead = true; return; }
    } else if (o.t === 'L') {
      if (s.x >= o.x && s.x <= o.x + o.len && s.y + 1 - a > o.y0 && s.y < o.y1) { s.dead = true; return; }
    }
  }
  s.grounded = g && s.vy <= 0;
  if (s.x >= L.end) s.won = true;
}

function step(s, dt, hold, L) {
  const n = 4;
  for (let i = 0; i < n; i++) { if (s.dead || s.won) return; sub(s, dt / n, hold, L); }
}
// ===== 완주 경로 탐색 =====
// 지면에 있을 때마다 "점프 / 안 함"을 모두 시도하는 DFS. path = 점프한 x 위치들, dead = 가장 멀리 간 사망 지점.
function solveLevel(L, dt = 1 / 60) {
  const memo = new Set(); let far = 0, dead = null;
  function go(s, f) {
    far = Math.max(far, s.x);
    if (s.won) return [];
    if (s.dead) { if (!dead || s.x > dead.x) dead = { x: s.x, y: s.y }; return null; }
    if (f > 6000) return null;
    if (s.grounded) {
      const k = f + '|' + s.y.toFixed(3);
      if (memo.has(k)) return null; memo.add(k);
      for (const jump of [false, true]) {
        const t = { ...s }; let ff = f;
        step(t, dt, jump, L); ff++;
        if (jump) while (!t.grounded && !t.dead && !t.won) { step(t, dt, false, L); ff++; }
        const r = go(t, ff);
        if (r) return jump ? [+s.x.toFixed(1), ...r] : r;
      }
      return null;
    }
    const t = { ...s }; step(t, dt, false, L); return go(t, f + 1);
  }
  const path = go(newPlayer(), 0);
  return { path, far, dead };
}

// ===== 그림 → 맵 =====
// 진한 선 = 블록, 빨강 = 가시, 노랑 = 점프 패드, 연한 색 = 꾸미기(무시).
// 그림 높이를 rows칸으로 나누고, 그림의 맨 아래(또는 그려 둔 땅선)가 바닥(y=0)이 된다.
// rows: 그림 높이를 몇 칸으로 나눌지, sx: 가로로 늘리는 배율(칸 폭 = 칸 높이 / sx), frac: 칸이 '찼다'고 볼 잉크 비율,
// zig: 한 줄에 선이 이만큼 이상 끊기면 지그재그(연필로 그린 가시)로 본다
const DRAW = { rows: 16, sx: 1.5, maxRows: 20, margin: 0.03, frac: 0.025, zig: 2.1, fillMax: 16, gap: 3, lead: 7, tail: 6 };

// 픽셀 분류: 0 빈칸, 1 블록, 2 가시, 3 패드. d는 RGBA 배열.
function classifyPixels(d, w, h) {
  const n = w * h, lum = new Uint8Array(n), cls = new Uint8Array(n);
  // 사진의 조명 차이를 줄이려고 구역마다 종이 밝기(밝은 쪽 10%)를 따로 잰다
  const ts = Math.max(16, Math.round(h / 6)), tw = Math.ceil(w / ts), th = Math.ceil(h / ts);
  const hist = new Uint32Array(tw * th * 64), gh = new Uint32Array(64);
  for (let i = 0; i < n; i++) {
    const v = (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) | 0; lum[i] = v;
    hist[((((i / w) | 0) / ts | 0) * tw + ((i % w) / ts | 0)) * 64 + (v >> 2)]++; gh[v >> 2]++;
  }
  const p90 = (H, o, tot) => { let c = 0; for (let b = 63; b >= 0; b--) { c += H[o + b]; if (c >= tot * .1) return b * 4 + 2; } return 255; };
  const gbg = p90(gh, 0, n), bg = new Float32Array(tw * th);
  for (let t = 0; t < tw * th; t++) {
    let tot = 0; for (let b = 0; b < 64; b++) tot += hist[t * 64 + b];
    bg[t] = Math.max(tot ? p90(hist, t * 64, tot) : gbg, gbg * .75); // 칠한 블록이 구역을 다 덮어도 종이로 착각하지 않게
  }
  const mx = Math.round(w * DRAW.margin), my = Math.round(h * DRAW.margin); // 가장자리(종이 끝, 그림자)는 무시
  for (let y = my; y < h - my; y++) for (let x = mx; x < w - mx; x++) {
    const i = y * w + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], v = lum[i];
    const B = bg[(y / ts | 0) * tw + (x / ts | 0)], M = Math.max(r, g, b), c = M - Math.min(r, g, b);
    let k = 0;
    if (c > 55 && c > M * .4) {          // 연한 색(하늘색, 연노랑 해)은 꾸미기
      const hue = M === r ? (60 * (g - b) / c + 360) % 360 : M === g ? 60 * (b - r) / c + 120 : 60 * (r - g) / c + 240;
      if ((hue < 35 || hue > 320) && r > B * .7) k = 2;          // 빨강·주황·분홍 (갈색은 어두워서 블록으로 감)
      else if (hue >= 38 && hue <= 75 && M > B * .7) k = 3;      // 노랑
    }
    if (!k && (v < B * .55 || (c < 60 && v < B * .7))) k = 1;   // 진한 색, 연필
    cls[i] = k;
  }
  return cls;
}

// 사진에서 종이 찾기: 가장 큰 '밝고 무채색인' 덩어리의 네 모서리. 못 찾으면 null(사진 전체를 종이로 본다).
function findPaper(d, w, h) {
  const n = w * h, lum = new Uint8Array(n), gh = new Uint32Array(256);
  for (let i = 0; i < n; i++) { const v = (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) | 0; lum[i] = v; gh[v]++; }
  // 밝은 쪽 절반에서 Otsu 문턱값: 종이와 (밝은) 배경을 가른다
  let c = 0, mid = 0; for (let v = 0; v < 256; v++) { c += gh[v]; if (c >= n / 2) { mid = v; break; } }
  let T = mid, bestVar = -1, tot = 0, sum = 0;
  for (let v = mid; v < 256; v++) { tot += gh[v]; sum += v * gh[v]; }
  for (let t = mid, w0 = 0, s0 = 0; t < 255; t++) {
    w0 += gh[t]; s0 += t * gh[t]; const w1 = tot - w0; if (!w0 || !w1) continue;
    const bv = w0 * w1 * (s0 / w0 - (sum - s0) / w1) ** 2; if (bv > bestVar) { bestVar = bv; T = t; }
  }
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    if (lum[i] > T && Math.max(r, g, b) - Math.min(r, g, b) < 45) m[i] = 1;
  }
  // 연필 선이 종이를 끊지 않게 가로·세로로 3px씩 메운다
  for (let pass = 0; pass < 2; pass++) {
    const step = pass ? w : 1, src = m.slice();
    for (let i = 0; i < n; i++) if (!src[i]) {
      let a = 0, b = 0; for (let k = 1; k <= 3; k++) { if (src[i - k * step]) a = 1; if (src[i + k * step]) b = 1; }
      if (a && b) m[i] = 2;
    }
  }
  // 3px 깎아서 종이와 배경 사이의 가는 연결을 끊는다
  for (let pass = 0; pass < 2; pass++) {
    const step = pass ? w : 1, src = m.slice();
    for (let i = 0; i < n; i++) if (src[i]) for (let k = -3; k <= 3; k++) { const j = i + k * step; if (j < 0 || j >= n || !src[j] || (!pass && ((j % w) - (i % w)) !== k)) { m[i] = 0; break; } }
  }
  // 가장 큰 덩어리
  const lab = new Int32Array(n), st = new Int32Array(n);
  let best = 0, bestId = 0, id = 0;
  for (let s0 = 0; s0 < n; s0++) if (m[s0] && !lab[s0]) {
    id++; let sp = 0, cnt = 0; st[sp++] = s0; lab[s0] = id;
    while (sp) {
      const i = st[--sp], x = i % w; cnt++;
      if (x > 0 && m[i - 1] && !lab[i - 1]) { lab[i - 1] = id; st[sp++] = i - 1; }
      if (x < w - 1 && m[i + 1] && !lab[i + 1]) { lab[i + 1] = id; st[sp++] = i + 1; }
      if (i >= w && m[i - w] && !lab[i - w]) { lab[i - w] = id; st[sp++] = i - w; }
      if (i < n - w && m[i + w] && !lab[i + w]) { lab[i + w] = id; st[sp++] = i + w; }
    }
    if (cnt > best) { best = cnt; bestId = id; }
  }
  if (best < n * .05 || best > n * .9) return null;
  // 종이와 배경의 밝기 차이가 작으면(종이가 사진을 꽉 채우고 조명만 고르지 않은 경우) 자르지 않는다
  let si = 0, so = 0;
  for (let i = 0; i < n; i++) if (lab[i] === bestId) si += lum[i]; else so += lum[i];
  if (si / best - so / (n - best) < 30) return null;
  // 모서리: x+y, x-y가 가장 작은/큰 점
  const q = [[0, 0, Infinity], [0, 0, -Infinity], [0, 0, -Infinity], [0, 0, Infinity]]; // TL, TR, BR, BL
  for (let i = 0; i < n; i++) if (lab[i] === bestId) {
    const x = i % w, y = (i / w) | 0, s = x + y, t = x - y;
    if (s < q[0][2]) q[0] = [x, y, s]; if (t > q[1][2]) q[1] = [x, y, t];
    if (s > q[2][2]) q[2] = [x, y, s]; if (t < q[3][2]) q[3] = [x, y, t];
  }
  return q.map(([x, y]) => [x, y]);
}

// 네 모서리(TL, TR, BR, BL) 사이를 ow×oh 직사각형으로 펴기 (사각형 → 사각형 원근 변환)
function warpQuad(d, w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]], ow, oh) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, e = y1 - y0 + g * y1, f = y3 - y0 + hh * y3;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let v = 0; v < oh; v++) for (let u = 0; u < ow; u++) {
    const U = (u + .5) / ow, V = (v + .5) / oh, z = g * U + hh * V + 1;
    const sx = Math.min(w - 1, Math.max(0, Math.round((a * U + b * V + x0) / z))), sy = Math.min(h - 1, Math.max(0, Math.round((e * U + f * V + y0) / z)));
    const si = (sy * w + sx) * 4, oi = (v * ow + u) * 4;
    out[oi] = d[si]; out[oi + 1] = d[si + 1]; out[oi + 2] = d[si + 2]; out[oi + 3] = 255;
  }
  return out;
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

const median = a => [...a].sort((p, q) => p - q)[a.length >> 1];

// 그림 한 장 → 칸 격자와 열(column) 목록
function analyzeDrawing(d, w, h, rows = DRAW.rows, sx = DRAW.sx) {
  const cls = classifyPixels(d, w, h), cs = h / rows, cw = cs / sx;
  let x0 = w, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cls[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; y1 = y; }
  if (x1 < 0) return null;
  // 땅선 찾기: 절반 이상의 열에서 가장 아래 있는 선이 비슷한 높이면 땅선으로 보고 지운다
  let bottom = y1 + 1;
  const low = [];
  for (let x = x0; x <= x1; x++) {
    let y = y1; while (y >= 0 && cls[y * w + x] !== 1) y--;
    if (y < 0) continue;
    let t = 0; while (y - t >= 0 && cls[(y - t) * w + x] === 1) t++;
    low.push([x, y, t]);
  }
  if (low.length) {
    const ref = [...low.map(l => l[1])].sort((p, q) => p - q)[Math.floor(low.length * .7)];
    const on = low.filter(l => Math.abs(l[1] - ref) < cs * .6);
    if (on.length >= (x1 - x0 + 1) * .5) {
      const T = Math.min(cs * .6, median(on.map(l => l[2]))) + 2, tops = [];
      for (const [x, y, t] of on) { const k = Math.min(t, T); for (let j = 0; j < k; j++) cls[(y - j) * w + x] = 0; tops.push(y - k + 1); }
      bottom = median(tops);
      cls.fill(0, bottom * w);
    }
  }
  // 격자는 종이 전체(여백 제외)를 덮는다: 아이가 빈 곳에도 칸을 칠할 수 있게
  const mx = Math.round(w * DRAW.margin), gx0 = mx;
  const nc = Math.max(1, Math.ceil((w - 2 * mx) / cw));
  const nr = Math.max(1, Math.min(DRAW.maxRows, Math.ceil(bottom / cs)));
  // 칸마다 종류별 잉크 수, 그리고 진한 선이 가로줄 하나에서 몇 번 끊기는지(runs / lines)
  const cnt = new Uint32Array(nc * nr * 4), edge = new Uint32Array(nc * nr * 2), runs = new Uint32Array(nc * nr), lines = new Uint32Array(nc * nr), lastY = new Int32Array(nc * nr).fill(-1);
  for (let y = Math.max(0, Math.floor(bottom - nr * cs)); y < bottom; y++) {
    const r = Math.floor((bottom - 1 - y) / cs); if (r >= nr) continue;
    for (let x = x0; x <= x1; x++) {
      const k = cls[y * w + x]; if (!k) continue;
      const i = r * nc + Math.floor((x - gx0) / cw);
      cnt[i * 4 + k]++;
      const fy = (bottom - 1 - y) / cs - r; // 칸 안의 높이 0(아래)~1(위)
      if (fy > .75) edge[i * 2]++; else if (fy < .25) edge[i * 2 + 1]++;
      if (k === 1 && (x === x0 || cls[y * w + x - 1] !== 1)) { runs[i]++; if (lastY[i] !== y) { lastY[i] = y; lines[i]++; } }
    }
  }
  const g = new Uint8Array(nc * nr), lim = cs * cw * DRAW.frac;
  for (let i = 0; i < nc * nr; i++) {
    let best = lim, bk = 0;
    for (let k = 1; k <= 3; k++) if (cnt[i * 4 + k] > best) { best = cnt[i * 4 + k]; bk = k; }
    if (bk === 1 && lines[i] >= cs * .3 && runs[i] / lines[i] >= DRAW.zig) bk = 2; // 지그재그 = 가시
    g[i] = bk;
  }
  // 가시 끝이 옆 칸에 살짝 걸친 것은 지운다: 잉크가 칸의 위/아래 1/4에만 있고 그 너머가 가시인 블록
  for (let i = 0; i < nc * nr; i++) if (g[i] === 1) {
    const n = cnt[i * 4 + 1];
    if ((edge[i * 2] === n && i + nc < nc * nr && g[i + nc] === 2) || (edge[i * 2 + 1] === n && i >= nc && g[i - nc] === 2)) g[i] = 0;
  }
  // 테두리만 그린 모양은 속을 채운다: 위·왼쪽·오른쪽 끝에서 빈칸만 따라 닿지 않는 빈칸 = 안쪽
  const seen = new Uint8Array(nc * nr), st = [];
  const seed = (c, r) => { const i = r * nc + c; if (!g[i] && !seen[i]) { seen[i] = 1; st.push(i); } };
  for (let c = 0; c < nc; c++) seed(c, nr - 1);
  for (let r = 0; r < nr; r++) { seed(0, r); seed(nc - 1, r); }
  while (st.length) {
    const i = st.pop(), c = i % nc, r = (i / nc) | 0;
    if (c) seed(c - 1, r); if (c < nc - 1) seed(c + 1, r); if (r) seed(c, r - 1); if (r < nr - 1) seed(c, r + 1);
  }
  // 닫힌 빈 공간 중 작은 것만 채운다 (큰 공간은 그림들 사이의 틈일 가능성이 높다)
  for (let i0 = 0; i0 < nc * nr; i0++) if (!seen[i0] && !g[i0]) {
    const reg = [i0]; seen[i0] = 1;
    for (let j = 0; j < reg.length; j++) {
      const i = reg[j], c = i % nc, r = (i / nc) | 0;
      for (const k of [c ? i - 1 : -1, c < nc - 1 ? i + 1 : -1, r ? i - nc : -1, r < nr - 1 ? i + nc : -1])
        if (k >= 0 && !seen[k] && !g[k]) { seen[k] = 1; reg.push(k); }
    }
    if (reg.length <= DRAW.fillMax) for (const i of reg) g[i] = 1;
  }
  return { cols: gridColumns(g, nc, nr), g, nc, nr, x0: gx0, bottom, cs, cw };
}

// 칸 격자(0 빈칸, 1 블록, 2 가시, 3 패드, 아래 행이 r=0) → 열 목록. 아이가 칸을 고친 뒤에도 이걸로 다시 만든다.
function gridColumns(g, nc, nr) {
  // 열마다 블록(세로 묶음), 가시, 패드. 1칸 이내로 떠 있으면 아래 바닥에 붙인다
  const cols = [];
  for (let c = 0; c < nc; c++) {
    const at = r => g[r * nc + c], col = { b: [], s: [], v: [], p: [] };
    for (let r = 0; r < nr; r++) {
      const k = at(r);
      if (k === 1) { if (r && at(r - 1) === 1) col.b[col.b.length - 1][1]++; else col.b.push([r, 1]); }
      else if (k > 1 && !(r && at(r - 1) === k)) {
        let re = r; while (re + 1 < nr && at(re + 1) === k) re++;
        if (k === 2 && re + 1 < nr && at(re + 1) === 1) { if (!col.v.includes(re)) col.v.push(re); continue; } // 블록에 매달린 가시
        let top = 0; for (let q = r - 1; q >= 0; q--) if (at(q) === 1) { top = q + 1; break; }
        if (k === 3 && r - top > 1) continue;                       // 하늘에 뜬 노랑(해 등)은 꾸미기
        const y = r - top <= 1 ? top : r, list = k === 2 ? col.s : col.p;
        if (!list.includes(y)) list.push(y);
      }
    }
    cols.push(col);
  }
  return cols;
}

// 여러 장의 열 목록을 이어 붙여 레벨을 만든다. 빈 열은 stretch칸으로 늘려 간격을 벌린다.
// 장마다 앞뒤의 빈 열은 잘라 낸다. colX[장][열] = 그 열이 놓인 레벨 x (잘린 열은 null).
function columnsToLevel(parts, stretch = 1, name = '내 그림 맵') {
  const o = [], cols = [], where = [], colX = parts.map(p => p.map(() => null));
  const isEmpty = c => !c || !(c.b.length || c.s.length || c.v.length || c.p.length);
  parts.forEach((p, pi) => {
    let a = 0, b = p.length - 1;
    while (a <= b && isEmpty(p[a])) a++;
    while (b >= a && isEmpty(p[b])) b--;
    if (a > b) return;
    if (cols.length) for (let k = 0; k < DRAW.gap; k++) { cols.push(null); where.push(null); }
    for (let ci = a; ci <= b; ci++) { cols.push(p[ci]); where.push([pi, ci]); }
  });
  let x = DRAW.lead, open = new Map();
  for (let j = 0; j < cols.length; j++) {
    const c = cols[j], empty = isEmpty(c), next = new Map();
    if (where[j]) colX[where[j][0]][where[j][1]] = x;
    if (!empty) {
      for (const [y, h] of c.b) {
        const k = y + ',' + h, prev = open.get(k);
        if (prev) { prev.w++; next.set(k, prev); }
        else { const nb = { t: 'b', x, y, w: 1, h }; o.push(nb); next.set(k, nb); }
      }
      for (const y of c.s) o.push({ t: 's', x, y });
      for (const y of c.v) o.push({ t: 's', x, y, d: 1 });
      for (const y of c.p) o.push({ t: 'p', x, y });
    }
    open = next; x += empty ? stretch : 1;
  }
  return { objs: o.sort((a, b) => a.x - b.x), end: x + DRAW.tail, name, boss: false, colX };
}

// 깰 수 없으면 가장 멀리 간 사망 지점의 장애물을 하나씩 낮추거나 치운다
function autoFix(L, max = 60) {
  const M = { ...L, objs: L.objs.map(o => ({ ...o })) };
  let n = 0, r = solveLevel(M);
  while (!r.path && r.dead && n < max) {
    const d = r.dead, a = CFG.inset, px0 = d.x + a, px1 = d.x + 1 - a, py0 = d.y, py1 = d.y + 1 - a;
    let bi = -1, bd = Infinity;
    M.objs.forEach((o, i) => {
      if (o.t === 'p' || o.t === 'L') return;
      const top = o.t === 'b' ? o.y + o.h : o.y + 1;
      if (o.t === 'b' && Math.abs(py0 - top) < 1e-6) return; // 밟고 서 있던 블록
      const dx = Math.max(o.x - px1, px0 - o.x - (o.w || 1), 0), dy = Math.max(o.y - py1, py0 - top, 0);
      if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; bi = i; }
    });
    if (bi < 0) break;
    const o = M.objs[bi];
    if (o.t === 'b' && o.h > 1 && o.y <= d.y) {
      const top = o.y + o.h; o.h--;
      for (const q of M.objs) if (q.t !== 'b' && !q.d && q.y === top && q.x >= o.x && q.x < o.x + o.w) q.y--;
    } else M.objs.splice(bi, 1);
    n++; r = solveLevel(M);
  }
  return { L: M, fixes: n, ok: !!r.path, res: r };
}

// 공유 링크용 문자열: 1~이름~끝~b x.y.w.h_s x.y_v x.y(매달린 가시)_p x.y ...
function encodeLevel(L) {
  const t = L.objs.map(o => o.t === 'b' ? `b${o.x}.${o.y}.${o.w}.${o.h}` : `${o.d ? 'v' : o.t}${o.x}.${o.y}`).join('_');
  return `1~${encodeURIComponent(L.name)}~${L.end}~${t}`;
}
function decodeLevel(str) {
  const [v, nm, end, t] = String(str).split('~');
  if (v !== '1' || t === undefined) return null;
  let name; try { name = decodeURIComponent(nm).slice(0, 20); } catch (e) { return null; }
  const E = +end; if (!(E > 0 && E <= 3000)) return null;
  const objs = [], ok = n => Number.isInteger(n) && n >= 0 && n <= 3000;
  for (const tok of t ? t.split('_') : []) {
    const ty = tok[0], n = tok.slice(1).split('.').map(Number);
    if (!n.every(ok) || objs.length >= 4000) return null;
    if (ty === 'b' && n.length === 4 && n[1] <= 20 && n[2] >= 1 && n[3] >= 1 && n[3] <= 20) objs.push({ t: 'b', x: n[0], y: n[1], w: n[2], h: n[3] });
    else if (ty === 'v' && n.length === 2 && n[1] <= 20) objs.push({ t: 's', x: n[0], y: n[1], d: 1 });
    else if ((ty === 's' || ty === 'p' || ty === 'k') && n.length === 2 && n[1] <= 20) objs.push({ t: ty, x: n[0], y: n[1] });
    else return null;
  }
  return { objs: objs.sort((a, b) => a.x - b.x), end: E, name: name || '이름 없는 맵', boss: false };
}
if (typeof module !== 'undefined') module.exports = { DRAW, gridColumns, findPaper, warpQuad, dist, CFG, buildLevel, LEVELS, newPlayer, step, solveLevel, classifyPixels, analyzeDrawing, columnsToLevel, autoFix, encodeLevel, decodeLevel };
