// ===== Game shell: render, input, audio =====
(() => {
let lv = 2, L = buildLevel(2);
const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
const $ = id => document.getElementById(id);
const ov = $('ov'), ovTitle = $('ovTitle'), ovSub = $('ovSub'), ovTap = $('ovTap');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COL = { night:'#170d2b', dusk:'#2a1647', coral:'#ff6a4d', gold:'#ffc94a', mint:'#3fe3c3', ink:'#f4ecff' };

let hot = window.claude?.hot?.data ?? {};
let attempts = 1, bests = LEVELS.map(() => 0), best = 0;
let coinBest = 0;
try { coinBest = Number(localStorage.getItem('jumpmap-doodle-coins')) || 0; } catch (e) {}
for (let i = 0; i < bests.length; i++) { try { bests[i] = +localStorage.getItem('ncr-best-' + i) || 0; } catch (e) {} }
if (hot.bests) bests = bests.map((b, i) => Math.max(b, hot.bests[i] || 0));
best = bests[lv];
let monY = 2.6, monFlash = 0;
let p = newPlayer(), rot = 0, state = 'title', deadT = 0, parts = [], hold = false, t0 = 0, shake = 0;
let W = 0, H = 0, T = 40, dpr = 1;

function resize() {
  const r = stage.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr;
  T = Math.max(24, Math.min(H / 8.5, W / 11));
}
new ResizeObserver(resize).observe(stage); resize();

// --- audio: tiny 128 BPM synth loop ---
let ac = null, muted = false, master, nextBeat = 0, beatN = 0;
const BPM = 128 * K, SPB = 60 / BPM / 2; // 8th notes
const basslines = [[45,45,57,45,48,48,60,48,43,43,55,43,40,40,52,47],[38,38,50,38,41,41,53,41,37,37,49,37,36,36,48,44],[48,55,60,55,53,60,65,60,45,52,57,52,43,50,55,59]];
let bassline = basslines[lv];
function initAudio() {
  if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.35; master.connect(ac.destination);
}
function tone(f, t, d, type, v) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
  return o;
}
function kick(t) { const o = tone(150, t, .22, 'sine', .9); o.frequency.exponentialRampToValueAtTime(40, t + .15); }
function hat(t) {
  const b = ac.createBuffer(1, ac.sampleRate * .05, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = .25; s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function schedule() {
  if (!ac || state !== 'play') return;
  if (nextBeat < ac.currentTime) nextBeat = ac.currentTime + .05;
  while (nextBeat < ac.currentTime + .12) {
    if (beatN % 2 === 0) kick(nextBeat); else hat(nextBeat);
    tone(mtof(bassline[beatN % 16]), nextBeat, SPB * .9, 'sawtooth', .12);
    if (beatN % 4 === 2) tone(mtof(bassline[beatN % 16] + 24), nextBeat, .12, 'square', .05);
    nextBeat += SPB; beatN++;
  }
}
function sfx(kind) {
  if (!ac || muted) return; const t = ac.currentTime;
  if (kind === 'die') { const o = tone(300, t, .35, 'square', .25); o.frequency.exponentialRampToValueAtTime(50, t + .3); }
  if (kind === 'warn') { tone(880, t, .08, 'square', .08); tone(880, t + .14, .08, 'square', .08); }
  if (kind === 'zap') { const o = tone(1400, t, .35, 'sawtooth', .14); o.frequency.exponentialRampToValueAtTime(200, t + .35); }
  if (kind === 'coin') tone(1047, t, .12, 'sine', .12);
  if (kind === 'win') [0, 4, 7, 12].forEach((n, i) => tone(mtof(72 + n), t + i * .09, .3, 'triangle', .2));
}
$('mute').addEventListener('click', e => {
  e.stopPropagation(); muted = !muted; if (master) master.gain.value = muted ? 0 : .35;
  e.currentTarget.textContent = muted ? '사운드 꺼짐' : '사운드 켜짐';
});

// --- input ---
function press() {
  initAudio(); if (ac && ac.state === 'suspended') ac.resume();
  if (state === 'paused') { resume(); return; }
  if (state === 'title' || state === 'won') { start(lv); }
  hold = true;
}
function release() { hold = false; }
stage.addEventListener('pointerdown', e => { e.preventDefault(); press(); });
addEventListener('pointerup', release); addEventListener('pointercancel', release);
addEventListener('keydown', e => {
  if (e.target?.closest?.('button')) return;
  if (e.code === 'Escape') { e.preventDefault(); if (state === 'paused') resume(); else pause(); return; }
  if (e.code === 'KeyR') { e.preventDefault(); start(lv); return; }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) press(); }
});
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release(); });

function updateHUD() {
  $('coinsStat').hidden = L.theme !== 'doodle';
  $('coins').textContent = p.coins + ' / ' + (L.coins || []).length;
  $('levelName').textContent = L.name;
  $('pct').textContent = Math.min(100, Math.floor(p.x / L.end * 100)) + '%';
}
function pause() {
  release();
  if (state !== 'play') return;
  state = 'paused'; acc = 0; ov.hidden = false;
  $('levels').hidden = true; $('pause').textContent = '계속하기';
  ovTitle.textContent = '잠깐 쉬어가기'; ovSub.textContent = '화면을 탭하거나 Esc를 누르면 이어서 달려요.';
  ovTap.textContent = 'TAP TO RESUME';
  if (ac) ac.suspend();
}
function resume() {
  if (state !== 'paused') return;
  state = 'play'; hold = false; acc = 0; last = performance.now(); ov.hidden = true;
  $('levels').hidden = false; $('pause').textContent = '일시정지';
  if (ac) ac.resume();
  nextBeat = 0;
}
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('pause').addEventListener('click', () => state === 'paused' ? resume() : pause());
$('retry').addEventListener('click', () => { initAudio(); if (ac) ac.resume(); start(lv); });
function pick(i) {
  lv = i; best = bests[i]; L = buildLevel(i); $('best').textContent = best + '%';
  document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.lv === i)));
}
document.querySelectorAll('#levels button').forEach(b => {
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('click', e => { e.stopPropagation(); pick(+b.dataset.lv); initAudio(); if (ac && ac.state === 'suspended') ac.resume(); start(lv); });
});
function showMenu(title, sub) {
  state = 'title'; $('levels').hidden = false; $('pause').textContent = '일시정지'; ov.hidden = false; ovTitle.textContent = title; ovSub.textContent = sub; ovTap.textContent = 'TAP TO START';
  bests.forEach((b, i) => { $('b' + i).textContent = '최고 ' + b + '%'; });
}
$('menu').addEventListener('click', e => { e.stopPropagation(); e.currentTarget.blur(); release(); p = newPlayer(); updateHUD(); showMenu('오늘은 어느 세계로?', '손그림에서 태어난 우주기지와 기존 네온 레벨을 골라보세요.'); });
function start(level) {
  if (level !== undefined) { lv = level; L = buildLevel(lv); bassline = basslines[lv]; best = bests[lv]; attempts = 1; $('best').textContent = best + '%'; }
  hold = false; acc = 0; $('levels').hidden = false; $('pause').textContent = '일시정지';
  monY = 2.6;
  for (const o of L.objs) { o._w = 0; o._f = 0; }
  p = newPlayer(); rot = 0; parts = []; state = 'play'; ov.hidden = true; beatN = 0; nextBeat = 0; t0 = performance.now();
  $('att').textContent = attempts; updateHUD();
}
function die() {
  state = 'dead'; deadT = 0; shake = reduce ? 0 : 10; sfx('die');
  for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 9; parts.push({ x: p.x + .5, y: p.y + .5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1 }); }
  saveBest();
}
function saveBest() {
  const pc = Math.min(100, Math.floor(p.x / L.end * 100)); if (pc > best) { best = pc; bests[lv] = pc; try { localStorage.setItem('ncr-best-' + lv, best); } catch (e) {} }
  $('best').textContent = best + '%';
}
function win() {
  state = 'won'; p.x = L.end; saveBest(); sfx('win');
  showMenu(L.boss ? '괴물을 따돌렸어요!' : '클리어!', attempts + '번째 시도에 완주했어요. 다시 하거나 다른 레벨을 골라보세요.');
  if (L.theme === 'doodle') {
    coinBest = Math.max(coinBest, p.coins);
    try { localStorage.setItem('jumpmap-doodle-coins', coinBest); } catch (e) {}
    ovTitle.textContent = p.coins === L.coins.length ? '태극 코인 올 클리어!' : '우주기지 탈출 성공!';
    ovSub.textContent = attempts + '번째 시도 · 태극 코인 ' + p.coins + '/' + L.coins.length + ' · 완주 최고 ' + coinBest + '개';
  }
  state = 'won'; ovTap.textContent = 'TAP TO PLAY AGAIN';
}

// --- render ---
function draw(now) {
  const bt = ((now - t0) / 1000) * BPM / 60, pulse = state === 'play' && !reduce ? Math.pow(1 - (bt % 1), 3) : 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake : 0;
  ctx.translate(sx, sy);
  if (L.theme === 'doodle') {
    drawDoodle(now, pulse);
    return;
  }
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COL.night); g.addColorStop(.75, COL.dusk); g.addColorStop(1, '#4a1d4f');
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
  const groundY = H - T * 1.6;
  const camX = p.x - W * 0.28 / T;
  const camY = Math.max(0, p.y - 3.2);
  // sun
  ctx.save(); ctx.globalAlpha = .9;
  const sunR = Math.min(W, H) * .22 * (1 + pulse * .04), sunX = W * .72, sunY = groundY - T * .3 + camY * T * .3;
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR); sg.addColorStop(0, COL.gold); sg.addColorStop(1, COL.coral);
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sunX, sunY, sunR, Math.PI, 0); ctx.fill();
  ctx.fillStyle = COL.dusk; for (let i = 0; i < 6; i++) ctx.fillRect(sunX - sunR, sunY - sunR * (.15 + i * .14), sunR * 2, 2 + i * 1.4);
  ctx.restore();
  // far skyline parallax
  ctx.fillStyle = 'rgba(23,13,43,.85)';
  for (let i = -1; i < W / 60 + 2; i++) {
    const wx = i * 60 - ((camX * T * .25) % 60), hh = 30 + ((i + Math.floor(camX * T * .25 / 60)) * 37 % 5) * 18;
    ctx.fillRect(wx, groundY + camY * T - hh, 52, hh);
  }
  const X = x => (x - camX) * T, Y = y => groundY - (y - camY) * T;
  // ground
  ctx.fillStyle = COL.night; ctx.fillRect(0, Y(0), W, H);
  ctx.strokeStyle = COL.mint; ctx.lineWidth = 2; ctx.shadowColor = COL.mint; ctx.shadowBlur = 10 + pulse * 14;
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(63,227,195,.14)'; ctx.lineWidth = 1;
  for (let i = Math.floor(camX); i < camX + W / T + 1; i++) { ctx.beginPath(); ctx.moveTo(X(i), Y(0)); ctx.lineTo(X(i) - T * 1.2, H); ctx.stroke(); }
  // finish line
  const fx = X(L.end);
  if (fx < W + T) { for (let j = 0; j < 12; j++) { ctx.fillStyle = j % 2 ? COL.ink : COL.night; ctx.fillRect(fx, Y(j + 1), T * .35, T); } }
  // objects
  for (const o of L.objs) {
    const x = X(o.x); if (x > W + T * 4 || x + (o.w || 1) * T < -T) continue;
    if (o.t === 'b') {
      ctx.fillStyle = '#21123b'; ctx.fillRect(x, Y(o.y + o.h), o.w * T, o.h * T);
      ctx.strokeStyle = COL.mint; ctx.lineWidth = 2; ctx.strokeRect(x + 1, Y(o.y + o.h) + 1, o.w * T - 2, o.h * T - 2);
      ctx.strokeStyle = 'rgba(63,227,195,.25)'; ctx.lineWidth = 1;
      for (let i = 1; i < o.w; i++) { ctx.beginPath(); ctx.moveTo(x + i * T, Y(o.y + o.h)); ctx.lineTo(x + i * T, Y(o.y)); ctx.stroke(); }
      for (let j = 1; j < o.h; j++) { ctx.beginPath(); ctx.moveTo(x, Y(o.y + j)); ctx.lineTo(x + o.w * T, Y(o.y + j)); ctx.stroke(); }
    } else if (o.t === 's') {
      ctx.fillStyle = COL.coral; ctx.shadowColor = COL.coral; ctx.shadowBlur = 8 + pulse * 10;
      ctx.beginPath(); ctx.moveTo(x + T * .08, Y(o.y)); ctx.lineTo(x + T * .5, Y(o.y + .92)); ctx.lineTo(x + T * .92, Y(o.y)); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (o.t === 'p') {
      ctx.fillStyle = COL.gold; ctx.shadowColor = COL.gold; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(x + T * .5, Y(o.y + .08), T * .45, T * .14, 0, Math.PI, 0); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  // spiky balls (매달린 공 포함)
  for (const o of L.objs) if (o.t === 'k') {
    const x = X(o.x); if (x > W + T || x < -T * 2) continue;
    if (o.y > 0) { ctx.strokeStyle = 'rgba(244,236,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + T / 2, 0); ctx.lineTo(x + T / 2, Y(o.y + .5)); ctx.stroke(); }
    spikyBall(x + T / 2, Y(o.y + .5), T * .36, now / 400);
  }
  if (L.boss) drawBoss(now, X, Y);
  // player
  if (state !== 'dead') {
    const cx = X(p.x + .5), cy = Y(p.y + .5), s = T * (1 + pulse * .04);
    // trail
    ctx.fillStyle = 'rgba(63,227,195,.18)';
    for (let i = 1; i <= 4; i++) ctx.fillRect(cx - s / 2 - i * T * .32, cy - s * .18 + (i % 2) * 2, T * .22, s * .36);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
    ctx.fillStyle = COL.mint; ctx.shadowColor = COL.mint; ctx.shadowBlur = 16; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.shadowBlur = 0;
    ctx.fillStyle = COL.night; ctx.fillRect(-s * .32, -s * .32, s * .64, s * .64);
    ctx.fillStyle = COL.gold; ctx.fillRect(-s * .2, -s * .2, s * .4, s * .4);
    ctx.fillStyle = COL.night; ctx.fillRect(-s * .06, -s * .14, s * .12, s * .12);
    ctx.restore();
  }
  for (const q of parts) { ctx.globalAlpha = Math.max(0, q.l); ctx.fillStyle = q.l > .5 ? COL.mint : COL.gold; ctx.fillRect(X(q.x) - 4, Y(q.y) - 4, 8, 8); }
  ctx.globalAlpha = 1;
  // progress bar
  const pr = Math.min(1, p.x / L.end);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(244,236,255,.15)'; ctx.fillRect(W * .2, 14, W * .6, 6);
  ctx.fillStyle = COL.gold; ctx.fillRect(W * .2, 14, W * .6 * pr, 6);
  ctx.fillStyle = 'rgba(244,236,255,.5)'; ctx.fillRect(W * .2 + W * .6 * best / 100 - 1, 10, 2, 14);
}

function spikyBall(cx, cy, r, spin) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin);
  ctx.fillStyle = COL.gold; ctx.shadowColor = COL.coral; ctx.shadowBlur = 10; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * .62 : r * 1.12; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = COL.coral; ctx.beginPath(); ctx.arc(0, 0, r * .45, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// 레이저 괴물: 둥근 몸통, 외눈, 화난 표시, 아래로 늘어진 가시 공 — 그림을 바탕으로
function drawBoss(now, X, Y) {
  let target = 2.6, warn = null, fire = null;
  for (const o of L.objs) if (o.t === 'L') {
    const ph = p.x - o.x;
    if (ph >= -o.warn - 2 && ph <= o.len) { target = (o.y0 + o.y1) / 2; if (ph >= 0) fire = o; else if (ph >= -o.warn) warn = o; break; }
  }
  monY += (target - monY) * .12; monFlash *= .9;
  const R = T * 1.45, bx = W - R * 1.15, eyeY = Y(monY), by = eyeY + R * .15 + (reduce ? 0 : Math.sin(now / 300) * T * .08);
  // beam
  if (fire) {
    const y0 = Y(fire.y1), y1 = Y(fire.y0), hgt = y1 - y0;
    ctx.fillStyle = 'rgba(255,106,77,.35)'; ctx.fillRect(0, y0 - hgt * .6, bx - R * .5, hgt * 2.2);
    ctx.fillStyle = COL.coral; ctx.shadowColor = COL.coral; ctx.shadowBlur = 24; ctx.fillRect(0, y0, bx - R * .5, hgt);
    ctx.fillStyle = '#fff6e8'; ctx.fillRect(0, y0 + hgt * .3, bx - R * .5, hgt * .4); ctx.shadowBlur = 0;
  } else if (warn) {
    const on = Math.floor(now / 110) % 2 === 0;
    const yc = Y((warn.y0 + warn.y1) / 2);
    ctx.save(); ctx.setLineDash([T * .4, T * .25]); ctx.lineDashOffset = -now / 20;
    ctx.strokeStyle = on ? COL.coral : 'rgba(255,106,77,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, yc); ctx.lineTo(bx - R * .5, yc); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,106,77,.18)'; ctx.strokeRect(0, Y(warn.y1), bx - R * .5, Y(warn.y0) - Y(warn.y1));
  }
  // stick + ball under body
  const sx = bx - R * .1, sy = by + R * .55, swing = reduce ? 0 : Math.sin(now / 350) * .25;
  const ex = sx + Math.sin(swing) * R * 1.1, ey = sy + Math.cos(swing) * R * 1.1;
  ctx.strokeStyle = '#5b2a6e'; ctx.lineWidth = T * .28; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineCap = 'butt';
  spikyBall(ex, ey, T * .42, now / 300);
  // body
  const bg = ctx.createRadialGradient(bx - R * .3, by - R * .4, R * .2, bx, by, R * 1.1);
  bg.addColorStop(0, '#9b4fb8'); bg.addColorStop(1, '#4a1d63');
  ctx.fillStyle = bg; ctx.shadowColor = '#c46bff'; ctx.shadowBlur = 18 + monFlash * 30;
  ctx.beginPath(); ctx.ellipse(bx, by, R * 1.08, R * .85, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  // eye (looks at player)
  const ex2 = bx - R * .45, ey2 = eyeY - R * .05;
  ctx.fillStyle = '#fff6e8'; ctx.beginPath(); ctx.ellipse(ex2, ey2, R * .34, R * .4, -.3, 0, Math.PI * 2); ctx.fill();
  const px = X(p.x + .5), py = Y(p.y + .5), ang = Math.atan2(py - ey2, px - ex2);
  ctx.fillStyle = warn || fire ? COL.coral : COL.night;
  ctx.beginPath(); ctx.arc(ex2 + Math.cos(ang) * R * .16, ey2 + Math.sin(ang) * R * .18, R * .14 + (fire ? R * .05 : 0), 0, Math.PI * 2); ctx.fill();
  // angry marks
  ctx.strokeStyle = COL.coral; ctx.lineWidth = 3;
  const ax = bx + R * .55, ay = by - R * .7, m = R * .13;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath(); ctx.moveTo(ax + dx * m * .5, ay + dy * m * 1.6); ctx.lineTo(ax + dx * m * .5, ay + dy * m * .5); ctx.lineTo(ax + dx * m * 1.6, ay + dy * m * .5); ctx.stroke();
  }
}


// --- Doodle Orbit: vector art inspired by the photographed pencil map.
// The level is rendered live: platforms, coins and hazards share physics coordinates.
function drawDoodle(now, pulse) {
  const paper = '#fff1cf', ink = '#13254b', cyan = '#72e8f3', gold = '#ffd267', coral = '#ff876e';
  const time = reduce ? 0 : now / 1000;
  const ground = H - T * 1.55, cam = p.x - W * .25 / T, camY = Math.max(0, p.y - 3.2);
  const X = x => (x - cam) * T, Y = y => ground - (y - camY) * T;
  const ellipse = (x,y,rx,ry,fill,stroke=paper) => {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  };
  const line = (x1,y1,x2,y2,color=paper,width=2) => {
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  };
  const rect = (x,y,w,h,fill,stroke=paper) => {
    ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
  };
  ctx.lineJoin='round';ctx.lineCap='round';
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#0b1736');sky.addColorStop(.65,'#263c70');sky.addColorStop(1,'#546499');
  ctx.fillStyle=sky;ctx.fillRect(-20,-20,W+40,H+40);
  // Deterministic stars and sketchbook grain: no random flicker between frames.
  for(let i=0;i<75;i++){
    const x=((i*173.37-cam*T*.05) % (W+40)+(W+40))%(W+40)-20;
    const y=(i*83.71 % Math.max(1,ground-35))+25, r=i%9===0?2:1;
    ctx.globalAlpha=.25+(i%5)*.12;
    ellipse(x,y,r,r,paper,null);
    if(i%9===0){line(x-5,y,x+5,y,paper,1);line(x,y-5,x,y+5,paper,1);}
  }
  ctx.globalAlpha=1;
  ellipse(W*.81-cam*T*.015,H*.2,T*.8,T*.8,'#52658e','#8496b2');
  ctx.save();ctx.translate(W*.81-cam*T*.015,H*.2);ctx.rotate(-.3);
  ellipse(0,0,T*1.3,T*.23,'rgba(0,0,0,0)','#b8c0ca');ctx.restore();
  // Distant orbital towers, not obstacles.
  for(let i=-1;i<Math.ceil(W/220)+2;i++){
    const x=i*220-((cam*T*.17)%220), y=ground-T*(2.0+(i%3)*.5);
    rect(x+55,y,24,ground-y,'#263856','#36547a');
    ellipse(x+67,y,80,15,'#36547a','#6480a1');
    ellipse(x+67,y-9,56,13,'#2b4369','#6480a1');
    line(x+67,y-15,x+67,y-57,'#6480a1',3);
    for(let j=0;j<7;j++)rect(x+15+j*17,y-4,4,3,gold,gold);
  }
  // Paper mountain silhouettes in the distance.
  ctx.beginPath();ctx.moveTo(-50,H);
  for(let i=-1;i<W/75+2;i++)ctx.lineTo(i*75,ground+T*.2-Math.sin(i*1.7+cam*.025)*T*.38);
  ctx.lineTo(W+100,H);ctx.closePath();ctx.fillStyle='#344c77';ctx.fill();
  rect(-10,Y(0),W+20,H,'#142747','#48668c');
  line(0,Y(0),W,Y(0),paper,4);
  for(let i=Math.floor(cam/1.5);i<cam/1.5+W/T+2;i++){
    line(X(i*1.5),Y(-.12),X(i*1.5-.65),Y(-1.5),'#294264',1);
  }
  // Doors, flowers and starting portal from the photographed sketch.
  for(const d of L.decorations){
    const x=X(d.x),y=Y(d.y);if(x<-T*4||x>W+T*4)continue;
    if(d.kind==='door'){
      const w=T*1.3,h=T*1.85;
      rect(x,y-h,w,h,paper,ink);
      line(x+w*.5,y-h,x+w*.5,y,ink,2);
      ellipse(x+w*.25,y-h*.52,T*.13,T*.16,paper,ink);
      ellipse(x+w*.75,y-h*.52,T*.13,T*.16,paper,ink);
      for(let j=0;j<7;j++)line(x+5+j*w/7,y-h+4,x+j*w/7-7,y-h+25,'#d5cdb9',1);
      if(d.x>140){
        ctx.shadowColor=gold;ctx.shadowBlur=16;
        line(x-5,y-h-5,x+w+5,y-h-5,gold,4);ctx.shadowBlur=0;
        ctx.fillStyle=paper;ctx.font='600 14px system-ui';ctx.textAlign='center';ctx.fillText('EXIT',x+w/2,y-h-16);
      }
    }else if(d.kind==='flowers'){
      for(let i=0;i<3;i++){
        const fx=x+i*T*.45,fy=y-T*(.6+(i%2)*.2);
        line(fx,y,fx,fy,paper,2);
        for(let j=0;j<4;j++)ellipse(fx+Math.cos(j*Math.PI/2)*T*.11,fy+Math.sin(j*Math.PI/2)*T*.11,T*.075,T*.11,'#8794ac',paper);
      }
    }else{
      ctx.shadowColor=cyan;ctx.shadowBlur=18;
      ellipse(x,y-T*.9,T*.6,T*.9,'#214c70',paper);
      ellipse(x,y-T*.9,T*.43,T*.7,'#306a8b',cyan);
      ctx.shadowBlur=0;
    }
  }
  // Solid platforms retain the core's exact shape.
  for(const o of L.objs){
    const x=X(o.x),w=(o.w||1)*T;
    if(x>W+T*4||x+w<-T*3)continue;
    if(o.t==='b'){
      rect(x,Y(o.y+o.h),w,o.h*T,ink,'#a1b4cc');
      line(x,Y(o.y+o.h),x+w,Y(o.y+o.h),paper,5);
      for(let k=0;k<o.w*3;k++)line(x+k*T/3,Y(o.y+.1),x+Math.min(o.w*T,k*T/3+T*.5),Y(o.y+Math.min(o.h-.1,.8)),'#345072',1);
    }else if(o.t==='s'){
      ctx.beginPath();ctx.moveTo(x+T*.08,Y(0));ctx.lineTo(x+T*.5,Y(.88));ctx.lineTo(x+T*.92,Y(0));ctx.closePath();
      ctx.fillStyle='#583d50';ctx.fill();ctx.strokeStyle=coral;ctx.lineWidth=3;
      ctx.shadowColor=coral;ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;
    }else if(o.t==='p'){
      ellipse(x+T*.5,Y(.1),T*.45,T*.13,gold,paper);
      line(x+T*.35,Y(.45),x+T*.5,Y(.62),gold);
      line(x+T*.5,Y(.62),x+T*.65,Y(.45),gold);
    }else if(o.t==='u'){
      const cx=x+w/2,hy=Y(3.5)+(reduce?0:Math.sin(time*2)*T*.06);
      // Only the red floor band is lethal. The pale tractor cone is decoration.
      ctx.beginPath();ctx.moveTo(cx-T*.22,hy+T*.15);ctx.lineTo(x+w,Y(o.h));ctx.lineTo(x,Y(o.h));ctx.closePath();
      ctx.fillStyle='rgba(255,210,103,.10)';ctx.fill();
      rect(x,Y(o.h),w,o.h*T,'rgba(255,135,110,.30)',coral);
      for(let j=0;j<3;j++)line(x+4,Y(.15+j*.24),x+w-4,Y(.15+j*.24),coral,2);
      ctx.beginPath();ctx.moveTo(cx-T*.65,hy);ctx.lineTo(cx,hy-T*.65);ctx.lineTo(cx+T*.65,hy);ctx.closePath();
      ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
      ellipse(cx,hy,T*.73,T*.18,paper,ink);ellipse(cx,hy-T*.63,T*.26,T*.12,paper,ink);
      ctx.fillStyle=gold;ctx.font='600 14px system-ui';ctx.textAlign='center';ctx.fillText('JUMP',cx,hy-T*.92);
    }else if(o.t==='k'){
      const cx=x+T*.5;
      ctx.beginPath();ctx.moveTo(x,Y(.95));ctx.lineTo(x+T,Y(.95));ctx.lineTo(cx,Y(0));ctx.closePath();
      ctx.fillStyle='#62738c';ctx.fill();ctx.strokeStyle=coral;ctx.lineWidth=3;ctx.stroke();
      for(let k=0;k<6;k++)line(x+k*T/6,Y(.9),cx,Y(.05),paper,1);
      ellipse(cx,Y(.95),T*.5,T*.12,'#566d8d',paper);
    }
  }
  // Taegeuk collectibles, tied to per-run immutable bit masks.
  for(let i=0;i<L.coins.length;i++){
    if(p.coinMask & (1<<i))continue;
    const c=L.coins[i],x=X(c.x),y=Y(c.y),r=T*.24;
    if(x<-T||x>W+T)continue;
    ctx.save();ctx.translate(x,y);ctx.rotate(reduce?0:Math.sin(time*2+i)*.12);
    ctx.shadowColor=gold;ctx.shadowBlur=9;
    ellipse(0,0,r+3,r+3,ink,gold);ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);ctx.arc(0,r/2,r/2,Math.PI/2,-Math.PI/2,true);ctx.arc(0,-r/2,r/2,Math.PI/2,-Math.PI/2);ctx.closePath();ctx.fillStyle=coral;ctx.fill();
    ctx.beginPath();ctx.arc(0,0,r,Math.PI/2,Math.PI*1.5);ctx.arc(0,-r/2,r/2,-Math.PI/2,Math.PI/2,true);ctx.arc(0,r/2,r/2,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fillStyle='#6cc4ef';ctx.fill();
    ctx.restore();
  }
  // The ring-faced monster joins the last third and signals low/high beams.
  if(p.x>99 && p.x<139){
    let laser=null, firing=false;
    for(const o of L.objs)if(o.t==='L'&&p.x>=o.x-o.warn&&p.x<=o.x+o.len){laser=o;firing=p.x>=o.x;break;}
    const bx=W-T*1.5,by=Y(3.7)+(reduce?0:Math.sin(time*2)*T*.08),r=T*.95;
    if(laser){
      const y=Y(laser.y1),h=(laser.y1-laser.y0)*T;
      if(firing){ctx.fillStyle=coral;ctx.fillRect(0,y,W,h);ctx.fillStyle=paper;ctx.fillRect(0,y+h*.35,W,h*.3);}
      else{ctx.save();ctx.setLineDash([12,9]);line(0,y+h/2,W,y+h/2,gold,2);ctx.restore();}
      ctx.fillStyle=paper;ctx.textAlign='center';ctx.font='600 16px system-ui';
      ctx.fillText(laser.y0<1?'낮은 빔 · 점프!':'높은 빔 · 그대로 달리기',W/2,55);
    }
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5;rect(bx+Math.cos(a)*r-r*.08,by+Math.sin(a)*r-r*.08,r*.17,r*.17,paper,ink);}
    ellipse(bx,by,r,r,paper,ink);ellipse(bx,by,r*.76,r*.8,paper,ink);
    ellipse(bx-r*.27,by-r*.16,r*.1,r*.2,ink,ink);ellipse(bx+r*.24,by-r*.16,r*.1,r*.2,ink,ink);
    ellipse(bx,by+r*.29,r*.13,r*.19,firing?coral:ink,ink);
    line(bx-r*.5,by-r*.55,bx-r*.29,by-r*.63,ink,2);
  }
  if(state!=='dead'){
    const cx=X(p.x+.5),cy=Y(p.y+.5),s=T*.9;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(reduce?0:rot*Math.PI/180);
    rect(-s/2,-s/2,s,s,paper,ink);
    line(-s*.3,-s*.5,-s*.38,-s*.72,paper,2);ellipse(-s*.38,-s*.76,s*.06,s*.06,cyan,paper);
    ellipse(-s*.19,-s*.06,s*.035,s*.09,ink,ink);ellipse(s*.19,-s*.06,s*.035,s*.09,ink,ink);
    ctx.beginPath();ctx.arc(0,s*.08,s*.16,0,Math.PI);ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
    rect(-s*.43,s*.5,s*.28,s*.12,ink,paper);rect(s*.15,s*.5,s*.28,s*.12,ink,paper);
    ctx.restore();
  }
  for(const q of parts){ctx.globalAlpha=Math.max(0,q.l);ctx.fillStyle=paper;ctx.fillRect(X(q.x)-3,Y(q.y)-3,6,6);}ctx.globalAlpha=1;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='rgba(255,241,207,.18)';ctx.fillRect(20,16,W-40,4);
  ctx.fillStyle=gold;ctx.fillRect(20,16,(W-40)*Math.min(1,p.x/L.end),4);
  ctx.textAlign='left';ctx.lineCap='butt';
}

// --- loop ---
let last = performance.now(), acc = 0; const DT = 1 / 120;
function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state === 'play') {
    acc += dt;
    while (acc >= DT) {
      const wasG = p.grounded, oldCoins = p.coins; step(p, DT, hold, L); acc -= DT;
      if (p.coins > oldCoins) sfx('coin');
      if (p.dead) { die(); break; }
      if (p.won) { win(); break; }
      if (!p.grounded) rot += (p.padHit ? 540 : 400) * DT;
      else if (!wasG || rot % 90) rot = Math.round(rot / 90) * 90;
      if (p.grounded) p.padHit = false;
      if (L.boss) for (const o of L.objs) if (o.t === 'L') {
        const ph = p.x - o.x;
        if (ph >= -o.warn && !o._w) { o._w = 1; sfx('warn'); }
        if (ph >= 0 && !o._f) { o._f = 1; sfx('zap'); monFlash = 1; }
      }
    }
    acc = state === 'play' ? acc : 0;
    updateHUD();
    schedule();
  } else if (state === 'dead') {
    deadT += dt;
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 30 * dt; q.l -= dt * 1.6; }
    if (deadT > .7) { attempts++; start(); }
  }
  shake *= .85; if (shake < .3) shake = 0;
  draw(now);
  requestAnimationFrame(frame);
}
$('best').textContent = best + '%'; $('att').textContent = attempts;
window.claude?.hot?.snapshot?.(() => ({ bests }));
bests.forEach((b, i) => { $('b' + i).textContent = '최고 ' + b + '%'; });
pick(lv); updateHUD();
requestAnimationFrame(frame);
})();
