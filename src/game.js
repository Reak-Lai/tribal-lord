// 阿斑下樓梯 Banban v1.1（同人作品，原作 NS-SHAFT／NAGI-P SOFT）。單檔腳本，不用模組，file:// 可直接開。
(() => {
'use strict';
const VERSION = '阿斑下樓梯 v1.1';
const CREDIT = '同人作品｜原作 NS-SHAFT／NAGI-P SOFT';

// ---- 數值（邏輯座標：畫面 360×640，整張畫布等比縮放）----
const W = 360, H = 640;
const HUD_H = 44;                 // 上方 HUD 高度
const SPIKE_H = 14;               // 頂部尖刺高度
const CEIL_Y = HUD_H + SPIKE_H;   // 玩家頭頂碰到這條線 = 碰到尖刺
const PW = 20, PH = 26;           // 玩家
const PLAT_W = 90, PLAT_H = 12;   // 平台寬 ≈ 畫面 1/4
const GAP = 80;                   // 平台垂直間距（固定）
const MAX_LIFE = 10, START_LIFE = 10, HEAL = 1, DMG = 5;
const MOVE = 200;                 // 左右速度 px/s
const GRAV = 1600, MAX_FALL = 560;
const SCROLL0 = 50, SCROLL_STEP = 0.05; // 起始捲動 px/s；每 10 層 +5%（以起始值計）
const CEIL_INVULN = 0.6, CEIL_PUSH = 160; // 頂刺：扣血後 0.6 秒內不再扣；往下推 160 px/s 並穿過腳下平台
const DT = 1 / 120;
const AIR = 24, MIN_OV = 6;       // 生成器假設：離開邊緣後最多再往外飄 24 px；落地至少重疊 6 px
const SPIKE_EVERY = 5;            // 每 5 層裡剛好 1 塊釘板（4:1）

// ---- 亂數 ----
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- 平台生成器：保證每塊平台都走得到下一塊一般平台 ----
// 從平台 P 的某一邊走下去，玩家剛離開時 x 在 [lo, hi]，能落在 Q 上嗎
function canLand(lo, hi, Q) { return lo <= hi && Q.x <= hi + PW - MIN_OV && Q.x + PLAT_W >= lo + MIN_OV; }
function dropX(P, d) { const x0 = d > 0 ? P.x + PLAT_W : P.x - PW; return (x0 < 0 || x0 + PW > W) ? null : x0; }
function reachSide(P, Q, d) { const x0 = dropX(P, d); if (x0 === null) return false;
  return d > 0 ? canLand(x0, Math.min(x0 + AIR, W - PW), Q) : canLand(Math.max(x0 - AIR, 0), x0, Q); }
function reachable(P, Q) { return reachSide(P, Q, 1) || reachSide(P, Q, -1); }

function makeGen(seed) { return { rng: mulberry32(seed), n: 0, prev: { x: (W - PLAT_W) / 2, type: 'normal' }, queue: [], spikeAt: 1, fallbacks: 0 }; }
function pick(g, ok) {
  for (let i = 0; i < 80; i++) { const c = { x: Math.floor(g.rng() * (W - PLAT_W + 1)) }; if (ok(c)) return c; }
  const all = []; for (let x = 0; x <= W - PLAT_W; x++) if (ok({ x })) all.push({ x });
  return all.length ? all[Math.floor(g.rng() * all.length)] : null;
}
// 釘板 Q 和它下面的一般平台 R 一起排：從 P 某一邊直直掉下去，穿過 Q 那一層、落在 R；Q 不擋這條路，Q 也走得到 R
function spikePair(g, P) {
  const sides = g.rng() < 0.5 ? [1, -1] : [-1, 1];
  for (const d of sides) {
    const x0 = dropX(P, d); if (x0 === null) continue;
    const R = pick(g, c => c.x <= x0 && c.x + PLAT_W >= x0 + PW); if (!R) continue;
    const Q = pick(g, c => (c.x + PLAT_W <= x0 - 2 || c.x >= x0 + PW + 2) && reachable(c, R)); if (!Q) continue;
    return [{ x: Q.x, type: 'spike' }, { x: R.x, type: 'normal' }];
  }
  return null;
}
function nextRow(g) {
  if (g.queue.length) { g.n++; return g.queue.shift(); }
  g.n++;
  const pos = (g.n - 1) % SPIKE_EVERY;
  if (pos === 0) g.spikeAt = 1 + Math.floor(g.rng() * 3);   // 1..3：釘板不會出現在區塊頭尾，不會連續兩塊
  if (pos === g.spikeAt) {
    const pair = spikePair(g, g.prev);
    if (pair) { g.queue.push(pair[1]); g.prev = pair[1]; return pair[0]; }
    g.fallbacks++;
  }
  const P = g.prev, q = pick(g, c => reachable(P, c));
  const row = { x: q ? q.x : P.x, type: 'normal' }; if (!q) g.fallbacks++;
  g.prev = row; return row;
}
function genRows(seed, n) { const g = makeGen(seed), rows = [{ x: g.prev.x, type: 'normal' }];
  for (let i = 0; i < n; i++) rows.push(nextRow(g)); return { rows, fallbacks: g.fallbacks }; }

// ---- 輸入：按住移動、放開停；最後按下的方向優先 ----
let order = 0;
const keys = { ArrowLeft: 0, ArrowRight: 0 };       // 0 = 沒按；否則為按下順序
const ptrs = new Map();                              // pointerId → { dir, ord }
function inputDir() {
  let best = 0, dir = 0;
  if (keys.ArrowLeft > best) { best = keys.ArrowLeft; dir = -1; }
  if (keys.ArrowRight > best) { best = keys.ArrowRight; dir = 1; }
  for (const p of ptrs.values()) if (p.ord > best) { best = p.ord; dir = p.dir; }
  return dir;
}
function clearInput() { keys.ArrowLeft = keys.ArrowRight = 0; ptrs.clear(); }

// ---- 遊戲狀態 ----
let mode = 'title', plats = [], player = null, life = START_LIFE, floors = 0, invuln = 0, lastY = 0, nextId = 0;
let hurtT = 0;   // 只影響畫面：受傷動作顯示的剩餘秒數
let gen = null, seed = 0, nextSeed = null, overReason = '', overAt = 0, clock = 0, games = 0;
const scrollSpeed = () => SCROLL0 * (1 + SCROLL_STEP * Math.floor(floors / 10));

function fill() { while (lastY < H + GAP * 2) { const r = nextRow(gen); lastY += GAP; plats.push({ x: r.x, y: lastY, py: lastY, type: r.type, id: ++nextId, visited: false }); } }
function newGame(s) {
  seed = s !== undefined ? s >>> 0 : nextSeed !== null ? nextSeed : (Math.random() * 2 ** 32) >>> 0; nextSeed = null;
  gen = makeGen(seed); nextId = 0; lastY = 240;
  plats = [{ x: gen.prev.x, y: lastY, py: lastY, type: 'normal', id: 0, visited: true }];
  fill();
  player = { x: W / 2 - PW / 2, y: lastY - GAP * 0 - PH, vy: 0, on: plats[0], ignore: null };
  player.y = plats[0].y - PH;
  life = START_LIFE; floors = 0; invuln = 0; hurtT = 0; overReason = ''; mode = 'play'; games++;
  ptrs.clear();
}
function hurt(n) { life = Math.max(0, life - n); hurtT = 0.4; }
function land(p) {
  player.on = p; player.vy = 0; player.y = p.y - PH;
  if (!p.visited) { p.visited = true; floors++; }
  if (p.type === 'spike') hurt(DMG); else life = Math.min(MAX_LIFE, life + HEAL);
}
function gameOver(why) { mode = 'over'; overReason = why; overAt = clock; }

function step(dt) {
  clock += dt;
  if (mode !== 'play') return;
  const sp = scrollSpeed();
  for (const p of plats) { p.py = p.y; p.y -= sp * dt; }
  lastY -= sp * dt;
  while (plats.length && plats[0].y + PLAT_H < 0) plats.shift();
  fill();
  invuln = Math.max(0, invuln - dt); hurtT = Math.max(0, hurtT - dt);
  player.x = Math.min(W - PW, Math.max(0, player.x + inputDir() * MOVE * dt));
  const on = player.on;
  if (on) {
    if (player.x + PW <= on.x || player.x >= on.x + PLAT_W) { player.on = null; player.vy = 0; }
    else player.y = on.y - PH;
  }
  if (!player.on) {
    const pb = player.y + PH;
    player.vy = Math.min(MAX_FALL, player.vy + GRAV * dt);
    player.y += player.vy * dt;
    const nb = player.y + PH;
    for (const p of plats) {   // 由上往下找第一塊穿過的平台
      if (p === player.ignore) continue;
      if (player.x < p.x + PLAT_W && player.x + PW > p.x && pb <= p.py + 0.001 && nb >= p.y) { land(p); break; }
    }
  }
  if (player.y < CEIL_Y) {     // 頂部尖刺
    player.y = CEIL_Y;
    if (invuln <= 0) { hurt(DMG); invuln = CEIL_INVULN; }
    if (player.on) { player.ignore = player.on; player.on = null; }
    player.vy = Math.max(player.vy, CEIL_PUSH);
  }
  if (life <= 0) gameOver('life');
  else if (player.y > H) gameOver('fall');
}

// ---- 畫面 ----
// ---- 像素圖（1 美術像素 = 2×2 遊戲像素；'.' = 透明）----
const PAL = {
  K: '#1c1418', H: '#55331f', S: '#f2c39b', N: '#2c4590', O: '#ea8a2a', P: '#e8ddc3', Q: '#b9a787',
  R: '#cc3340', W: '#ffffff', T: '#2a9e9c', L: '#7fded3', D: '#14575b', G: '#2d313b', M: '#5d6474', E: '#ff6a4d',
};
const SPR = {
  stand: [
    '....KK....',
    '...KHHK...',
    '..KKKKKK..',
    '.KHHKKHHK.',
    '.KKSSSSKK.',
    '.KSKSSKSK.',
    '..KSSSSK..',
    '..NNNNNN..',
    '.SNNNNONS.',
    '..NNNNNN..',
    '..PPPPPP..',
    '..PQ..QP..',
    '.RWR..RWR.',
  ],
  walk1: [
    '..KK......',
    '.KHHK.....',
    '..KKKKK...',
    '.KHKKKKK..',
    '.KKKKSSS..',
    '.KKKSSKS..',
    '..KKSSSS..',
    '...NNNN...',
    '..SNNNOS..',
    '...NNNN...',
    '...PPPP...',
    '..PP..PP..',
    '.RWR..RWRR',
  ],
  walk2: [
    '..KK......',
    '.KHHK.....',
    '..KKKKK...',
    '.KHKKKKK..',
    '.KKKKSSS..',
    '.KKKSSKS..',
    '..KKSSSS..',
    '...NNNN...',
    '...NNNOS..',
    '...NNNN...',
    '...PPPP...',
    '...PPPQ...',
    '...RWRRR..',
  ],
  fall: [
    '....KK....',
    '...KHHK...',
    'S.KKKKKK.S',
    'SKHHKKHHKS',
    'SKKSSSSKKS',
    'NKSKSSKSKN',
    '.NKSRRSKN.',
    '..NNNNNN..',
    '..NNNNON..',
    '..NNNNNN..',
    '..PPPPPP..',
    '.PP....PP.',
    '.RW....WR.',
  ],
  hurt: [
    '..........',
    '....KK....',
    '...KHHK...',
    '..KKKKKK..',
    '.KHHKKHHK.',
    '.KKSSSSKK.',
    '.KKKSSKKK.',
    '..KSRRSK..',
    '.NNNNNNNN.',
    '.NNSSSONN.',
    '..PPPPPP..',
    '..PQ..QP..',
    '.RWR..RWR.',
  ],
  plat: [
    '.LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.',
    'LTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTD',
    'LTTLTTTTTTTTLTTTTTTTTLTTTTTTTTLTTTTTTTTLTTTTD',
    'LTTDTTTTTTTTDTTTTTTTTDTTTTTTTTDTTTTTTTTDTTTTD',
    'LTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTD',
    '.DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
  ],
  spike: [
    '..E....E....E....E....E....E....E....E....E..',
    '..R....R....R....R....R....R....R....R....R..',
    '.RER..RER..RER..RER..RER..RER..RER..RER..RER.',
    '.MMG..MMG..MMG..MMG..MMG..MMG..MMG..MMG..MMG.',
    'MMMGGMMMGGMMMGGMMMGGMMMGGMMMGGMMMGGMMMGGMMMGG',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'GGMGGGGGMGGGGGMGGGGGMGGGGGMGGGGGMGGGGGMGGGGGM',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  ],
};
// 把字串畫成小畫布（10×13、45×6…），畫的時候再用最近鄰放大 2 倍
function bake(rows, flip) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = flip ? r[r.length - 1 - x] : r[x];
    if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } } });
  return c;
}
const IMG = {}; for (const k in SPR) { IMG[k] = bake(SPR[k]); IMG[k + 'L'] = bake(SPR[k], true); }
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
let cssScale = 1;
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight, s = Math.min(vw / W, vh / H);
  const dpr = window.devicePixelRatio || 1;
  cssScale = s; cv.style.width = Math.round(W * s) + 'px'; cv.style.height = Math.round(H * s) + 'px';
  cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
// 對齊實體像素，像素圖才不會糊或忽粗忽細
const snap = v => Math.round(v * cv.width / W) / (cv.width / W);
function blit(img, x, y) { ctx.drawImage(img, snap(x), snap(y), img.width * 2, img.height * 2); }
const FONT = '"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei","Noto Serif CJK TC",sans-serif';
const font = (px, b) => (b ? 'bold ' : '') + px + 'px ' + FONT;
function text(s, x, y, px, color, align = 'center', bold = false) { ctx.font = font(px, bold); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }

function drawPlat(p) {
  if (p.type === 'spike') blit(IMG.spike, p.x, p.y - 4);   // 刺往上多畫 2 美術像素，判定不變
  else blit(IMG.plat, p.x, p.y);
}
function drawPlayer() {
  if (invuln > 0 && Math.floor(invuln * 20) % 2 === 0) return;   // 頂刺無敵時閃爍
  const d = inputDir();
  const img = hurtT > 0 ? IMG.hurt : !player.on ? IMG.fall
    : d ? IMG[(Math.floor(clock * 8) % 2 ? 'walk2' : 'walk1') + (d < 0 ? 'L' : '')] : IMG.stand;
  blit(img, player.x, player.y);
}
function drawArrows() {
  const d = mode === 'play' ? inputDir() : 0, y = H - 46;
  for (const [cx, dir] of [[W * 0.25, -1], [W * 0.75, 1]]) {
    ctx.fillStyle = d === dir ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.moveTo(cx + 22 * dir, y); ctx.lineTo(cx - 16 * dir, y - 24); ctx.lineTo(cx - 16 * dir, y + 24); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(W / 2 - 0.5, HUD_H + SPIKE_H + 8, 1, H - HUD_H - SPIKE_H - 16);
}
function drawHUD() {
  ctx.fillStyle = '#11141b'; ctx.fillRect(0, 0, W, HUD_H);
  text('生命', 10, HUD_H / 2, 13, '#cfd6e4', 'left');
  for (let i = 0; i < MAX_LIFE; i++) { ctx.fillStyle = i < life ? '#ff6b6b' : '#3a3f4c'; ctx.fillRect(44 + i * 13, 14, 11, 16); }
  text(String(life), 44 + MAX_LIFE * 13 + 6, HUD_H / 2, 13, '#cfd6e4', 'left');
  text(floors + ' 層', W - 10, HUD_H / 2, 20, '#ffffff', 'right', true);
  ctx.fillStyle = '#e8505b'; ctx.beginPath();   // 頂部尖刺
  for (let x = 0; x < W; x += 12) { ctx.moveTo(x, HUD_H); ctx.lineTo(x + 6, HUD_H + SPIKE_H); ctx.lineTo(x + 12, HUD_H); }
  ctx.fill();
}
function panel(lines) {
  ctx.fillStyle = 'rgba(8,10,16,0.78)'; ctx.fillRect(24, 170, W - 48, 300);
  for (const [s, y, px, c, b] of lines) text(s, W / 2, y, px, c, 'center', b);
}
function draw() {
  ctx.imageSmoothingEnabled = false;   // 換畫布大小會重設，所以每格都設
  ctx.fillStyle = '#1b1f2a'; ctx.fillRect(0, 0, W, H);
  if (player) { for (const p of plats) drawPlat(p); drawPlayer(); }
  drawArrows(); drawHUD();
  if (mode === 'title') panel([
    ['阿斑下樓梯', 212, 30, '#ffd34d', true], ['Banban　v1.1', 244, 13, '#8b93a5'],
    ['手機：按住左／右半邊移動', 290, 15, '#e6e9f0'], ['電腦：← → 方向鍵', 316, 15, '#e6e9f0'],
    ['點一下或按空白鍵開始', 370, 17, '#ffffff', true], [CREDIT, 440, 12, '#aab2c3']]);
  else if (mode === 'over') panel([
    ['遊戲結束', 212, 28, '#ff6b6b', true], [overReason === 'fall' ? '掉出畫面了' : '生命歸零', 248, 14, '#cfd6e4'],
    ['下了 ' + floors + ' 層', 300, 26, '#ffffff', true],
    ['點一下或按空白鍵重新開始', 370, 16, '#ffffff', true], [CREDIT, 440, 12, '#aab2c3']]);
}

// ---- 事件 ----
let paused = false, acc = 0, lastTs = 0;
function loop(ts) {
  if (!paused) { acc += Math.min(0.1, Math.max(0, (ts - (lastTs || ts)) / 1000)); while (acc >= DT) { step(DT); acc -= DT; } }
  lastTs = ts; draw(); requestAnimationFrame(loop);
}
function tryStart() { if (mode === 'title' || (mode === 'over' && clock - overAt > 0.4)) { newGame(); return true; } return false; }
const sideOf = e => (e.clientX < window.innerWidth / 2 ? -1 : 1);
window.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (mode !== 'play') { tryStart(); return; }
  const r = cv.getBoundingClientRect();
  if (e.clientY < r.top + HUD_H * cssScale) return;   // HUD 區不算觸控區
  ptrs.set(e.pointerId, { dir: sideOf(e), ord: ++order });
}, { passive: false });
window.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (p) p.dir = sideOf(e); });
for (const t of ['pointerup', 'pointercancel']) window.addEventListener(t, e => ptrs.delete(e.pointerId));
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (!keys[e.key]) keys[e.key] = ++order; return; }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tryStart(); }
});
window.addEventListener('keyup', e => { if (e.key in keys) keys[e.key] = 0; });
window.addEventListener('blur', clearInput);
window.addEventListener('pagehide', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', resize);
resize(); requestAnimationFrame(loop);

// ---- 測試介面（遊戲本身不會用到）----
window.__stairs = {
  version: VERSION, credit: CREDIT,
  C: { W, H, HUD_H, CEIL_Y, PW, PH, PLAT_W, PLAT_H, GAP, MAX_LIFE, START_LIFE, MOVE, GRAV, MAX_FALL, SCROLL0, SCROLL_STEP, CEIL_INVULN, CEIL_PUSH, DT, AIR, MIN_OV },
  state: () => ({ mode, life, floors, invuln, overReason, seed, games, scroll: scrollSpeed(), dir: inputDir(), ptrs: ptrs.size,
    player: player && { x: player.x, y: player.y, vy: player.vy, on: player.on ? player.on.id : null, onType: player.on ? player.on.type : null },
    plats: plats.map(p => ({ id: p.id, x: p.x, y: p.y, type: p.type, visited: p.visited })) }),
  setSeed: s => { nextSeed = s >>> 0; },
  start: s => newGame(s),
  pause: b => { paused = !!b; acc = 0; },
  step: (n = 1) => { for (let i = 0; i < n; i++) step(DT); draw(); },
  genRows,
  reachable,
  // 測試用：擺一個指定場景。plats: [{x,y,type}]，玩家放在 (px,py)
  setup: ({ plats: ps, px, py, life: l, floors: f }) => {
    newGame(1); plats = ps.map((p, i) => ({ x: p.x, y: p.y, py: p.y, type: p.type, id: 1000 + i, visited: false }));
    lastY = 1e9; player = { x: px, y: py, vy: 0, on: null, ignore: null };
    if (l !== undefined) life = l; if (f !== undefined) floors = f;
  },
};
})();
