// Regression checks for the photographed-map level. No external dependencies.
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const jumpFrames = [100,173,258,339,411,650,731,843,1022];
for (const fps of [60, 120]) {
  const p = C.newPlayer(), level = C.buildLevel(2);
  for (let f = 0; f < fps * 30 && !p.dead && !p.won; f++) {
    C.step(p, 1 / fps, jumpFrames.includes(Math.floor(f * 60 / fps)), level);
  }
  assert.ok(p.won && !p.dead, fps + ' Hz: complete the doodle level');
  assert.equal(p.coins, 24, fps + ' Hz: all coins can be collected in one run');
}
const level = C.buildLevel(2);
assert.equal(level.coins.length, 24);
assert.equal(new Set(level.coins.map(c => c.x + ':' + c.y)).size, 24);
const coinLevel = { objs: [], end: 10, coins: [{ x: .5, y: .5 }] };
const first = C.newPlayer(), second = C.newPlayer();
C.step(first, 1 / 120, false, coinLevel);
C.step(first, 1 / 120, false, coinLevel);
assert.equal(first.coins, 1, 'No duplicate credit across substeps');
assert.equal(second.coins, 0, 'Runs do not share a coin mask');
C.step(second, 1 / 120, false, coinLevel);
assert.equal(second.coins, 1, 'Restart restores collectible');
assert.equal(coinLevel.coins.length, 1, 'Level data is not consumed');
const ufo = { objs: [{ t: 'u', x: 0, y: 0, w: 1.6, h: .85 }], end: 10 };
const floor = C.newPlayer();
C.step(floor, 1 / 120, false, ufo);
assert.ok(floor.dead, 'UFO floor band is lethal');
const air = { ...C.newPlayer(), y: 1.1, grounded: false };
C.step(air, 1 / 120, false, ufo);
assert.ok(!air.dead, 'Jumping above the UFO band is safe');
for (const high of [false, true]) {
  const laser = { objs: [{ t: 'L', x: 0, y: 0, w: 3, len: 3, y0: high ? 1.25 : .15, y1: high ? 1.65 : .55 }], end: 10 };
  const runner = C.newPlayer();
  C.step(runner, 1 / 120, false, laser);
  assert.equal(runner.dead, !high, 'High beams allow running; low beams require jumping');
}
console.log('Doodle Orbit: all 24 coins at 60/120 Hz, restart isolation, UFO and beam collisions passed.');
