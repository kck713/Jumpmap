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
      if (R0 > o.x + 0.5 - CFG.sw && L0 < o.x + 0.5 + CFG.sw && s.y < o.y + CFG.sh && s.y + 1 - a > o.y) { s.dead = true; return; }
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
if (typeof module !== 'undefined') module.exports = { CFG, buildLevel, LEVELS, newPlayer, step };
