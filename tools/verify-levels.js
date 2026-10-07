// 모든 레벨이 실제로 클리어 가능한지 자동으로 확인합니다.
// 지면에 있을 때마다 "점프 / 안 함"을 모두 시도하는 탐색(DFS)으로 완주 경로를 찾습니다.
// - 기본 판정: 게임과 같은 히트박스
// - 엄격 판정: 가시·공 판정을 넓히고 큐브를 키운 상태 → 여유가 너무 빡빡한 구간을 잡아냅니다.
const C = require('../src/core.js');
const DT = 1 / 60;

function solve(L) {
  const memo = new Set(); let far = 0;
  function go(s, f) {
    far = Math.max(far, s.x);
    if (s.won) return [];
    if (s.dead || f > 6000) return null;
    if (s.grounded) {
      const k = f + '|' + s.y.toFixed(3);
      if (memo.has(k)) return null; memo.add(k);
      for (const jump of [false, true]) {
        const t = { ...s }; let ff = f;
        C.step(t, DT, jump, L); ff++;
        if (jump) while (!t.grounded && !t.dead && !t.won) { C.step(t, DT, false, L); ff++; }
        const r = go(t, ff);
        if (r) return jump ? [+s.x.toFixed(1), ...r] : r;
      }
      return null;
    }
    const t = { ...s }; C.step(t, DT, false, L); return go(t, f + 1);
  }
  const path = go(C.newPlayer(), 0);
  return { path, far };
}

const base = { sw: C.CFG.sw, sh: C.CFG.sh, inset: C.CFG.inset };
let fail = 0;
for (let i = 0; i < C.LEVELS.length; i++) {
  const L = C.buildLevel(i);
  for (const [label, cfg] of [['기본', base], ['엄격', { sw: 0.3, sh: 0.75, inset: -0.05 }]]) {
    Object.assign(C.CFG, cfg);
    const { path, far } = solve(C.buildLevel(i));
    if (path) console.log(`✔ 레벨 ${i + 1} ${L.name} [${label}] 클리어 가능 · 점프 ${path.length}회 @ ${path.join(', ')}`);
    else { fail++; console.log(`✘ 레벨 ${i + 1} ${L.name} [${label}] 클리어 불가 · x≈${far.toFixed(1)} 부근에서 막힘`); }
  }
  Object.assign(C.CFG, base);
}
process.exit(fail ? 1 : 0);
