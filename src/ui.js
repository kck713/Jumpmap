// ===== Game shell: render, input, audio =====
(() => {
const CUSTOM = LEVELS.length; // 그림으로 만든 맵 자리
let custom = null;
const getLevel = i => i === CUSTOM ? { ...custom, objs: custom.objs.map(o => ({ ...o })) } : buildLevel(i);
let lv = 0, L = buildLevel(0);
const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
const $ = id => document.getElementById(id);
const ov = $('ov'), ovTitle = $('ovTitle'), ovSub = $('ovSub'), ovTap = $('ovTap');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COL = { night:'#170d2b', dusk:'#2a1647', coral:'#ff6a4d', gold:'#ffc94a', mint:'#3fe3c3', ink:'#f4ecff' };

let hot = window.claude?.hot?.data ?? {};
let attempts = 1, bests = [0, 0, 0], best = 0;
for (let i = 0; i < CUSTOM; i++) { try { bests[i] = +localStorage.getItem('ncr-best-' + i) || 0; } catch (e) {} }
if (hot.bests) bests = bests.map((b, i) => Math.max(b, hot.bests[i] || 0));
best = bests[0];
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
const basslines = [[45,45,57,45,48,48,60,48,43,43,55,43,40,40,52,47],[38,38,50,38,41,41,53,41,37,37,49,37,36,36,48,44],[41,41,53,41,45,45,57,45,43,43,55,43,48,48,60,47]];
let bassline = basslines[0];
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
  if (kind === 'win') [0, 4, 7, 12].forEach((n, i) => tone(mtof(72 + n), t + i * .09, .3, 'triangle', .2));
}
$('mute').addEventListener('click', e => {
  e.stopPropagation(); muted = !muted; if (master) master.gain.value = muted ? 0 : .35;
  e.currentTarget.textContent = muted ? '사운드 꺼짐' : '사운드 켜짐';
});

// --- input ---
function press() {
  initAudio(); if (ac && ac.state === 'suspended') ac.resume();
  if (state === 'title' || state === 'won') { start(lv); }
  hold = true;
}
function release() { hold = false; }
stage.addEventListener('pointerdown', e => { e.preventDefault(); press(); });
addEventListener('pointerup', release); addEventListener('pointercancel', release);
addEventListener('keydown', e => {
  if (state === 'maker' || e.target.closest?.('input,select,textarea')) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) press(); }
});
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release(); });

function pick(i) {
  lv = i; best = bests[i]; L = getLevel(i); $('best').textContent = best + '%';
  document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.lv === i)));
}
document.querySelectorAll('#levels button').forEach(b => {
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('click', e => { e.stopPropagation(); pick(+b.dataset.lv); initAudio(); if (ac && ac.state === 'suspended') ac.resume(); start(lv); });
});
function showMenu(title, sub) {
  state = 'title'; ov.hidden = false; ovTitle.textContent = title; ovSub.textContent = sub; ovTap.textContent = 'TAP TO START';
  bests.forEach((b, i) => { $('b' + i).textContent = '최고 ' + b + '%'; });
}
$('menu').addEventListener('click', e => { e.stopPropagation(); e.currentTarget.blur(); p = newPlayer(); showMenu('네온 큐브 런', '레벨을 고르고 화면을 탭하세요. 가시를 피해 끝까지!'); });
function start(level) {
  if (level !== undefined) { lv = level; L = getLevel(lv); bassline = basslines[lv]; best = bests[lv]; attempts = 1; $('best').textContent = best + '%'; }
  monY = 2.6;
  for (const o of L.objs) { o._w = 0; o._f = 0; }
  p = newPlayer(); rot = 0; parts = []; state = 'play'; ov.hidden = true; beatN = 0; nextBeat = 0; t0 = performance.now();
  $('att').textContent = attempts;
}
function die() {
  state = 'dead'; deadT = 0; shake = reduce ? 0 : 10; sfx('die');
  for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 9; parts.push({ x: p.x + .5, y: p.y + .5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1 }); }
  saveBest();
}
function saveBest() {
  const pc = Math.min(100, Math.floor(p.x / L.end * 100)); if (pc > best) { best = pc; bests[lv] = pc; if (lv !== CUSTOM) try { localStorage.setItem('ncr-best-' + lv, best); } catch (e) {} }
  $('best').textContent = best + '%';
}
function win() {
  state = 'won'; p.x = L.end; saveBest(); sfx('win');
  showMenu(L.boss ? '괴물을 따돌렸어요!' : '클리어!', attempts + '번째 시도에 완주했어요. 다시 하거나 다른 레벨을 골라보세요.');
  state = 'won'; ovTap.textContent = 'TAP TO PLAY AGAIN';
}

// --- 그림 → 맵 만들기 ---
const maker = $('maker'), mkMsg = $('mkMsg');
let mkShots = [], mkLevel = null, mkRes = null;
const say = (t, bad) => { mkMsg.textContent = t; mkMsg.classList.toggle('bad', !!bad); };
function setCustom(M) {
  custom = M; bests[CUSTOM] = 0;
  $('cName').textContent = '3. ' + M.name; $('lvCustom').hidden = false;
  try { localStorage.setItem('ncr-custom', encodeLevel(M)); } catch (e) {}
}
const shareURL = M => location.href.split('#')[0] + '#map=' + encodeLevel(M);
function openMaker() {
  state = 'maker'; maker.hidden = false; $('mkClose').focus();
}
function closeMaker() {
  maker.hidden = true; p = newPlayer(); showMenu('네온 큐브 런', '레벨을 고르고 화면을 탭하세요. 가시를 피해 끝까지!');
}
for (const id of ['makeBtn', 'mkClose']) $(id).addEventListener('pointerdown', e => e.stopPropagation());
$('makeBtn').addEventListener('click', e => { e.stopPropagation(); openMaker(); });
$('mkClose').addEventListener('click', closeMaker);
maker.addEventListener('keydown', e => { if (e.key === 'Escape') closeMaker(); });

// 사진을 긴 변 1600px로 줄여 종이를 찾고, 종이만 높이 PH로 반듯하게 편 다음 분석한다
const PH = 480, SRC = 1600;
async function readDrawing(file) {
  const url = URL.createObjectURL(file), img = new Image();
  try {
    img.src = url; await img.decode();
    const k = Math.min(1, SRC / Math.max(img.naturalWidth, img.naturalHeight));
    const sw = Math.round(img.naturalWidth * k), sh = Math.round(img.naturalHeight * k);
    const src = document.createElement('canvas'); src.width = sw; src.height = sh;
    const sx = src.getContext('2d', { willReadFrequently: true });
    sx.fillStyle = '#fff'; sx.fillRect(0, 0, sw, sh); sx.drawImage(img, 0, 0, sw, sh);
    const sd = sx.getImageData(0, 0, sw, sh).data;
    const q = findPaper(sd, sw, sh) || [[0, 0], [sw - 1, 0], [sw - 1, sh - 1], [0, sh - 1]];
    const pw = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, ph = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    const w = Math.max(8, Math.min(PH * 10, Math.round(pw * PH / ph)));
    const c = document.createElement('canvas'); c.width = w; c.height = PH;
    const data = warpQuad(sd, sw, sh, q, w, PH);
    c.getContext('2d').putImageData(new ImageData(data, w, PH), 0, 0);
    return { canvas: c, data, w, a: null }; // 분석은 rebuild에서 (길이 옵션을 바꿔도 다시 분석)
  } finally { URL.revokeObjectURL(url); }
}
// 사진 위에 어떻게 읽었는지 칸 색으로 표시
function shotView({ canvas, a }) {
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
  if (a) {
    const fill = [, 'rgba(63,227,195,.5)', 'rgba(255,106,77,.6)', 'rgba(255,201,74,.6)'];
    for (let r = 0; r < a.nr; r++) for (let k = 0; k < a.nc; k++) {
      const v = a.g[r * a.nc + k]; if (!v) continue;
      x.fillStyle = fill[v]; x.fillRect(a.x0 + k * a.cw, a.bottom - (r + 1) * a.cs, a.cw, a.cs);
    }
    x.strokeStyle = COL.mint; x.lineWidth = 3; x.beginPath(); x.moveTo(a.x0, a.bottom); x.lineTo(a.x0 + a.nc * a.cw, a.bottom); x.stroke();
  }
  c.setAttribute('role', 'img'); c.setAttribute('aria-label', a ? '그림을 칸으로 읽은 결과' : '선을 찾지 못한 그림');
  return c;
}
function drawPreview(M, res) {
  const pc = $('mkPv'), ts = Math.max(10, Math.min(24, Math.floor($('mkPvBox').clientWidth / (M.end + 2)))), r = Math.min(devicePixelRatio || 1, 2);
  let top = 5; for (const o of M.objs) top = Math.max(top, (o.t === 'b' ? o.y + o.h : o.y + 1) + 2);
  const w = Math.ceil((M.end + 2) * ts), h = (top + 1) * ts;
  pc.width = w * r; pc.height = h * r; pc.style.width = w + 'px'; pc.style.height = h + 'px';
  const x = pc.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0);
  const gy = h - ts, Y = v => gy - v * ts;
  x.fillStyle = COL.dusk; x.fillRect(0, 0, w, h); x.fillStyle = COL.night; x.fillRect(0, gy, w, ts);
  x.strokeStyle = COL.mint; x.lineWidth = 1; x.beginPath(); x.moveTo(0, gy + .5); x.lineTo(w, gy + .5); x.stroke();
  for (const o of M.objs) {
    const ox = o.x * ts;
    if (o.t === 'b') { x.fillStyle = '#21123b'; x.fillRect(ox, Y(o.y + o.h), o.w * ts, o.h * ts); x.strokeStyle = COL.mint; x.strokeRect(ox + .5, Y(o.y + o.h) + .5, o.w * ts - 1, o.h * ts - 1); }
    else if (o.t === 's') { const by = o.d ? o.y + 1 : o.y; x.fillStyle = COL.coral; x.beginPath(); x.moveTo(ox + 1, Y(by)); x.lineTo(ox + ts / 2, Y(o.d ? o.y + .1 : o.y + .9)); x.lineTo(ox + ts - 1, Y(by)); x.fill(); }
    else if (o.t === 'p') { x.fillStyle = COL.gold; x.fillRect(ox + 1, Y(o.y + .3), ts - 2, ts * .3); }
    else if (o.t === 'k') { x.fillStyle = COL.gold; x.beginPath(); x.arc(ox + ts / 2, Y(o.y + .5), ts * .36, 0, Math.PI * 2); x.fill(); }
  }
  for (let j = 0; j < top; j++) { x.fillStyle = j % 2 ? COL.ink : COL.night; x.fillRect(M.end * ts, Y(j + 1), ts * .4, ts); }
  x.fillStyle = COL.mint; x.fillRect(1, Y(1), ts, ts);
  if (res.path) { x.fillStyle = COL.gold; for (const jx of res.path) { x.beginPath(); x.moveTo(jx * ts + ts / 2, gy + 2); x.lineTo(jx * ts + ts / 2 - 3, gy + 8); x.lineTo(jx * ts + ts / 2 + 3, gy + 8); x.fill(); } }
  else if (res.dead) {
    const dx = (res.dead.x + 1) * ts;
    x.strokeStyle = COL.coral; x.lineWidth = 2; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(dx, 0); x.lineTo(dx, h); x.stroke(); x.setLineDash([]);
    x.strokeRect(res.dead.x * ts, Y(res.dead.y + 1), ts, ts);
    const box = $('mkPvBox'); box.scrollLeft = dx - box.clientWidth / 2;
  }
}
function showResult(fixes) {
  mkRes = solveLevel(mkLevel);
  $('mkPvBox').hidden = false; drawPreview(mkLevel, mkRes);
  $('mkPlay').disabled = false; $('mkShare').disabled = !mkRes.path; $('mkFix').hidden = !!mkRes.path; $('mkLink').hidden = true;
  const fixed = fixes ? `${fixes}군데를 고쳤어요. ` : '';
  if (mkRes.path) say(`${fixed}완주할 수 있는 맵이에요! 점프 ${mkRes.path.length}번이면 깰 수 있어요.`);
  else say(`${fixed}${Math.round(mkRes.dead ? mkRes.dead.x : mkRes.far)}칸 근처에서 막혀요. 빨간 점선 부분을 다시 그리거나 '자동으로 고치기'를 눌러 보세요. 깰 수 있는 맵만 공유할 수 있어요.`, true);
}
function rebuild() {
  for (const s of mkShots) s.a = analyzeDrawing(s.data, s.w, PH, DRAW.rows, +$('mkGap').value);
  $('mkShots').replaceChildren(...mkShots.map(shotView));
  const parts = mkShots.filter(s => s.a).map(s => s.a.cols);
  if (!parts.length) { mkLevel = null; $('mkPvBox').hidden = true; $('mkPlay').disabled = $('mkShare').disabled = true; $('mkFix').hidden = true; return; }
  mkLevel = columnsToLevel(parts, 1, $('mkName').value.trim() || '내 그림 맵');
  showResult(0);
}
$('mkFile').addEventListener('change', async e => {
  const files = [...e.target.files]; if (!files.length) return;
  say('그림을 읽는 중이에요…');
  try { mkShots = await Promise.all(files.map(readDrawing)); }
  catch (err) { mkShots = []; say('그림 파일을 열지 못했어요. 사진(JPG, PNG)으로 다시 골라 주세요.', true); return; }
  finally { e.target.value = ''; }
  rebuild();
  if (!mkLevel) say('그림에서 선을 찾지 못했어요. 진한 펜으로 그리고 밝은 곳에서 찍어 주세요.', true);
  else if (mkShots.some(s => !s.a)) say(mkMsg.textContent + ' (선이 안 보이는 그림은 뺐어요.)', !mkRes.path);
});
$('mkGap').addEventListener('change', rebuild);
$('mkName').addEventListener('input', () => { if (mkLevel) mkLevel.name = $('mkName').value.trim() || '내 그림 맵'; });
$('mkFix').addEventListener('click', () => {
  const f = autoFix(mkLevel); mkLevel = f.L; showResult(f.fixes);
  if (!f.ok) say(`${f.fixes}군데를 고쳤지만 아직 막혀요. 그림을 조금 단순하게 다시 그려 볼까요?`, true);
});
$('mkPlay').addEventListener('click', () => {
  setCustom(mkLevel);
  try { history.replaceState(null, '', '#map=' + encodeLevel(mkLevel)); } catch (e) {}
  maker.hidden = true; pick(CUSTOM); initAudio(); if (ac && ac.state === 'suspended') ac.resume(); start(CUSTOM);
});
$('mkShare').addEventListener('click', async () => {
  const url = shareURL(mkLevel), link = $('mkLink');
  link.value = url;
  if (navigator.share) {
    try { await navigator.share({ title: mkLevel.name, text: `내가 그린 점프맵 "${mkLevel.name}"을 깨 봐!`, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); say('링크를 복사했어요! 친구에게 보내 주세요.'); }
  catch (e) { link.hidden = false; link.select(); say('아래 링크를 길게 눌러 복사해 주세요.'); }
});
// 공유 링크(#map=...)나 마지막으로 만든 맵 불러오기
function loadShared() {
  const m = /^#map=(.+)$/.exec(location.hash), M = m && decodeLevel(m[1]);
  if (M) { setCustom(M); pick(CUSTOM); showMenu('친구가 만든 맵', `"${M.name}" 맵이 도착했어요. 화면을 탭해서 시작!`); return true; }
  return false;
}
addEventListener('hashchange', () => { if (state !== 'play') loadShared(); });

// --- render ---
function draw(now) {
  const bt = ((now - t0) / 1000) * BPM / 60, pulse = state === 'play' && !reduce ? Math.pow(1 - (bt % 1), 3) : 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake : 0;
  ctx.translate(sx, sy);
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
      const by = o.d ? o.y + 1 : o.y, ty = o.d ? o.y + .08 : o.y + .92; // d: 매달린 가시는 아래를 향한다
      ctx.beginPath(); ctx.moveTo(x + T * .08, Y(by)); ctx.lineTo(x + T * .5, Y(ty)); ctx.lineTo(x + T * .92, Y(by)); ctx.closePath(); ctx.fill();
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

// --- loop ---
let last = performance.now(), acc = 0; const DT = 1 / 120;
function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state === 'play') {
    acc += dt;
    while (acc >= DT) {
      const wasG = p.grounded; step(p, DT, hold, L); acc -= DT;
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
    $('pct').textContent = Math.min(100, Math.floor(p.x / L.end * 100)) + '%';
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
if (!loadShared()) { try { const M = decodeLevel(localStorage.getItem('ncr-custom') || ''); if (M) setCustom(M); } catch (e) {} }
requestAnimationFrame(frame);
})();
