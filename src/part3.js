
// =====================================================================
// ===== 畫面（只讀 state；所有寫入都經過上面的操作函式）=====
// 邏輯畫布 180×320；s = max(2, floor(min(W/180, H/320)))，整數倍置中；文字只在 DOM（TribePixel 12 邏輯 px）
// =====================================================================
var $ = function (id) { return document.getElementById(id); };
var ASSETS = window.TL_ASSETS || {};
var SPR = (ASSETS.atlasJson && ASSETS.atlasJson.sprites) || {};
var S = 2, uiDirty = true, worldDirty = true, camDirty = true;
var cam = { x: CONFIG.map.homeX, y: CONFIG.map.homeY };   // 鏡頭不存檔
var ui = { page: null, tab: 'jobs', popup: null, roster: { sex: 'all', job: 'all', tal: 'all', key: 'job', dir: 1, open: {} } };

// Endesga 32
var PAL = { a: '#be4a2f', b: '#d77643', c: '#ead4aa', d: '#e4a672', e: '#b86f50', f: '#733e39', g: '#3e2731', h: '#a22633', i: '#e43b44', j: '#f77622', k: '#feae34', l: '#fee761',
  m: '#63c74d', n: '#3e8948', o: '#265c42', p: '#193c3e', q: '#124e89', r: '#0099db', s: '#2ce8f5', t: '#ffffff', u: '#c0cbdc', v: '#8b9bb4', w: '#5a6988', x: '#3a4466', y: '#262b44', z: '#181425',
  A: '#ff0044', B: '#68386c', C: '#b55088', D: '#f6757a', E: '#e8b796', F: '#c28569' };

// ===== 像素圖（佔位美術；每個字母 = 一個 Endesga 32 色，'.' = 透明）=====
var PIX = {
  star: ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', '.X...X.'],
  sun: ['..lll..', '.lllll.', 'llkllll', 'lllllll', 'llllkll', '.lllll.', '..lll..'],
  moon: ['..uuu..', '.uu....', 'uu.....', 'uu.....', 'uu.....', '.uu....', '..uuu..'],
  mineral: ['...xx...', '..xvvx..', '.xvuuvx.', 'xvukuuvx', 'xvuuukvx', '.xvvvvx.', '..xxxx..', '........'],
  council: ['.......hi.......', '.......hii......', '.......h........', '......fdf.......', '.....fdddf......', '....fdbdbdf.....', '...fdbdbdbdf....', '..fdbdbdbdbdf...',
    '.fdbdbdbdbdbdf..', 'fkkkkkkkkkkkkkf.', '.fbbbbgggbbbbf..', '.fbbbggzggbbbf..', '.fbbbgzzzgbbbf..', '.fbbbgzzzgbbbf..', '.ffffgzzzgffff..', '................'],
  storage: ['................', '................', '................', '....ffffffff....', '....feeeeeef....', '....fefeefef....', '....feeeeeef....', '....ffffffff....',
    '.ffffffffffffff.', '.feeeeeffeeeeef.', '.fefeefffefeeef.', '.feeeeeffeeeeef.', '.feefeeffeeefef.', '.feeeeeffeeeeef.', '.ffffffffffffff.', '................'],
  barracks: ['..t..........t..', '..w..........w..', '..w...xxxx...w..', '..w..xaaaax..w..', '..w.xaaaaaax.w..', '..wxaaiaaiaaxw..', '..xaaiaaiaaiaax.', '.xaaaaaaaaaaaax.',
    'xaaaaazzzzaaaaax', 'xaaaazzzzzzaaaax', 'xaaaazzzzzzaaaax', 'xxxxxzzzzzzxxxxx', '..w..........w..', '..w..........w..', '................', '................'],
  clinic: ['................', '......xxxx......', '.....xuuuux.....', '....xuuiiuux....', '...xuuuiiuuux...', '..xuuiiiiiiuux..', '.xuuuiiiiiiuuux.', 'xuuuuuuiiuuuuuux',
    'xuuuuuuiiuuuuuux', 'xuuuuuzzzzuuuuux', 'xuuuuzzzzzzuuuux', 'xuuuuzzzzzzuuuux', 'xxxxxzzzzzzxxxxx', '................', '................', '................'],
  mine: ['................', '................', '.....xxxxx......', '...xxwwwwwxx....', '..xwwvvwwwwwx...', '.xwwvuvwwkwwwx..', '.xwvuvwwwwwwwx..', 'xwwwwwwzzzwwwwx.',
    'xwwwkwzzzzzwwwx.', 'xwwwwzzzzzzzwwx.', 'xxxxxzzzzzzzxxx.', '..f.........e...', '.fff......eeeee.', '..f.......e...e.', '..f.......xe.ex.', '................'],
  field: ['................', '.gggggggggggggg.', '.gfnfnfnfnfnfng.', '.gfmfmfmfmfmfmg.', '.geeeeeeeeeeeeg.', '.gfnfnfnfnfnfng.', '.gfmfmfmfmfmfmg.', '.geeeeeeeeeeeeg.',
    '.gfnfnfnfnfnfng.', '.gfmfmfmfmfmfmg.', '.geeeeeeeeeeeeg.', '.gfnfnfnfnfnfng.', '.gfmfmfmfmfmfmg.', '.gggggggggggggg.', '................', '................'],
  ranch: ['................', '................', 'e....e....e....e', 'eeeeeeeeeeeeeeee', 'e.m..e..m.e..m.e', 'e....e....e....e', 'eeeeeeeeeeeeeeee', 'e..m.e.m..e.m..e',
    'e....e....e....e', 'e.m..e....e..m.e', 'eeeeeeeeeeeeeeee', 'e....e..m.e....e', 'e....e....e....e', '................', '................', '................'],
  pen: ['................', '................', '....uttu........', '..uttttttu......', '.utttttttuzz....', '.uttttttttzzz...', '.utttttttuzz....', '..uttttttu......',
    '...z..z..z......', 'eeeeeeeeeeeeeeee', 'e...e...e...e..e', 'e...e...e...e..e', 'eeeeeeeeeeeeeeee', 'e...e...e...e..e', '................', '................'],
  pine: ['....o....', '...ooo...', '...oto...', '..ooooo..', '..otooo..', '.ooooooo.', '.ooootoo.', 'ooooooooo', '....f....', '....f....']
};
var ATLAS_FOR = { house: 'tent', lumber: 'lumber', lodge: 'hunt_hut', fishery: 'fish_rack' };

function pixCanvas(rows, map) {
  var h = rows.length, w = rows[0].length, c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var ch = rows[y].charAt(x);
    if (ch === '.' || !ch) continue;
    var col = map ? map(ch, x, y, rows) : PAL[ch];
    if (!col) continue;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function inShape(rows, x, y) { return y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y].charAt(x) !== '.'; }
var IMG = {};
function makeImages() {
  IMG.starW = pixCanvas(PIX.star, function () { return '#ffffff'; });
  IMG.starB = pixCanvas(PIX.star, function (ch, x, y, r) {   // 黑星：亮色外框 + 黑色內部
    return inShape(r, x - 1, y) && inShape(r, x + 1, y) && inShape(r, x, y - 1) && inShape(r, x, y + 1) ? '#181425' : '#8b9bb4';
  });
  ['sun', 'moon', 'mineral', 'council', 'storage', 'barracks', 'clinic', 'mine', 'field', 'ranch', 'pen', 'pine'].forEach(function (k) { IMG[k] = pixCanvas(PIX[k]); });
  var d = document.createElement('canvas'); d.width = 2; d.height = 2;   // 遮罩：2×2 棋盤格 dither（只用調色盤色）
  var g = d.getContext('2d'); g.fillStyle = '#181425'; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  var root = document.documentElement.style;
  root.setProperty('--star-w', 'url(' + IMG.starW.toDataURL() + ')');
  root.setProperty('--star-b', 'url(' + IMG.starB.toDataURL() + ')');
  root.setProperty('--dither', 'url(' + d.toDataURL() + ')');
  root.setProperty('--ic-mineral', 'url(' + IMG.mineral.toDataURL() + ')');
}

// ===== 小工具 =====
function el(tag, cls, parent, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function box(e, x, y, w, h) { var s = e.style; s.setProperty('--x', x); s.setProperty('--y', y); if (w !== undefined) s.setProperty('--w', w); if (h !== undefined) s.setProperty('--h', h); return e; }
function setText(e, s) { if (e.__t === s) return false; e.__t = s; e.textContent = s; return true; }
function setHTML(e, s) { if (e.__h === s) return false; e.__h = s; e.innerHTML = s; return true; }
function setDis(e, v) { if (e.disabled !== v) e.disabled = v; }
function setCls(e, c) { if (e.__c !== c) { e.__c = c; e.className = c; } }
function btn(parent, x, y, w, h, label, cls) { var b = el('button', 'px ab' + (cls ? ' ' + cls : ''), parent); box(b, x, y, w, h); el('span', 't', b, label); return b; }
function btnLabel(b, s) { setText(b.firstChild, s); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtAmt(n) { var v = Math.floor(n + 1e-9); return v < 10000 ? String(v) : v < 1e6 ? Math.floor(v / 1000) + 'k' : (Math.floor(v / 1e5) / 10) + 'M'; }
function fmtNum(n, d) { var s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }
function fmtR(n, d) { var s = fmtNum(Math.abs(n), d === undefined ? 3 : d); return (s === '0' ? '±' : n > 0 ? '+' : '−') + s; }
function fmtClock(sec) { var t = Math.max(0, Math.ceil(sec - 1e-6)); return Math.floor(t / 60) + ':' + pad2(t % 60); }
function sexCh(p) { return p.sex === 'M' ? '♂' : '♀'; }
function jobName(p) { return p.job === 'soldier' ? '士兵' : p.job ? JOB[p.job].name : '閒置'; }
function starsHTML(cur, cap, slots) {   // 白星 = cur，黑星 = cap − cur，固定 slots 格寬
  var h = '';
  for (var i = 0; i < slots; i++) h += '<i class="st' + (i < cur ? ' w' : i < cap ? ' b' : '') + '"></i>';
  return '<span class="stars">' + h + '</span>';
}
function attrHTML(p, a, x) { return '<span class="ab at" style="--x:' + x + '"><b class="ak">' + ATTR_S[a] + '</b>' + starsHTML(p.cur[a], p.cap[a], 5) + '</span>'; }
function heroTalentText(t) {
  var T = TAL[t.tid], v = t.value, s;
  if (T.unit === '格') s = '+' + Math.round(v) + ' 格';
  else if (T.unit.charAt(0) === '%') s = fmtNum(v, 1) + '%';
  else if (T.unit === '點') s = '+' + fmtNum(v, 1) + ' 點';
  else s = fmtNum(v, 4) + ' ' + T.unit;
  return T.name + ' ' + s;
}

// ===== 版面 =====
function applyScale() {
  var s = Math.max(2, Math.floor(Math.min(window.innerWidth / 180, window.innerHeight / 320)) || 2);
  if (s !== S || !document.documentElement.style.getPropertyValue('--s')) {
    S = s; document.documentElement.style.setProperty('--s', S + 'px');
    document.documentElement.setAttribute('data-s', S);
  }
}

var R = {};   // 固定元素參照
function buildUI() {
  var app = $('app'), M = CONFIG.map;
  // 地圖
  var cv = R.map = $('map');
  cv.width = M.viewW; cv.height = M.viewH; box(cv, M.viewX, M.viewY, M.viewW, M.viewH);
  R.mapCtx = cv.getContext('2d'); R.mapCtx.imageSmoothingEnabled = false;
  R.world = document.createElement('canvas'); R.world.width = M.cols * M.tile; R.world.height = M.rows * M.tile;
  R.worldCtx = R.world.getContext('2d'); R.worldCtx.imageSmoothingEnabled = false;
  box($('mapLabels'), M.viewX, M.viewY, M.viewW, M.viewH);
  bindMapPointer(cv);
  // 頂列
  var top = $('topbar');
  R.lordBtn = el('button', 'px ab lordbtn', top); box(R.lordBtn, 2, 2, 36, 36); R.lordBtn.id = 'btnLord';
  R.avatar = el('canvas', 'avatar', R.lordBtn); R.avatar.width = 36; R.avatar.height = 36;
  R.lordBtn.onclick = function () { openPopup('lord'); };
  [['btnWood', 40, 2, 'icon_wood', 'wood', 'material'], ['btnFood', 88, 2, 'icon_food', 'food', 'food'], ['btnPop', 40, 21, 'icon_pop', 'pop', 'pop'], ['btnMineral', 88, 21, null, 'mineral', 'mineral']].forEach(function (a) {
    var b = el('button', 'px ab res', top); b.id = a[0]; box(b, a[1], a[2], 46, 18);
    var ic = el('i', 'ic ab', b); box(ic, 2, 5, 8, 8);
    if (a[3]) { var r = SPR[a[3]] || { x: 0, y: 0, w: 8, h: 8 }; ic.style.setProperty('--w', r.w); ic.style.setProperty('--h', r.h); ic.style.setProperty('--sx', r.x); ic.style.setProperty('--sy', r.y); }
    else ic.className = 'ic mineral';
    R[a[4]] = el('b', 't ab num', b); box(R[a[4]], 12, 3);
    R[a[4]].id = a[4];
    b.onclick = function () { openPopup(a[5]); };
  });
  var tb = el('div', 'ab timebox', top); box(tb, 136, 2, 42, 37);
  R.hour = el('div', 't ab', tb); box(R.hour, 0, 1); R.hour.id = 'hour';
  R.arc = el('canvas', 'ab arc', tb); R.arc.width = 42; R.arc.height = 37; box(R.arc, 0, 0, 42, 37);
  // 底列
  var bot = $('bottombar');
  R.bEvents = btn(bot, 2, 2, 43, 26, '事件'); R.bEvents.id = 'btnEvents'; R.bEvents.onclick = function () { openPopup('events'); };
  R.bBuild = btn(bot, 47, 2, 43, 26, '建造'); R.bBuild.id = 'btnBuild'; R.bBuild.onclick = function () { openPopup('build'); };
  R.bHome = btn(bot, 92, 2, 42, 26, '回營地'); R.bHome.id = 'btnHome'; R.bHome.onclick = function () { setCam(CONFIG.map.homeX, CONFIG.map.homeY); };
  R.bCouncil = btn(bot, 136, 2, 42, 26, '內政'); R.bCouncil.id = 'btnCouncil'; R.bCouncil.onclick = function () { openPage('council'); };
  // 遮罩、彈窗
  $('mask').onclick = function () { closePopup(); };
  $('version').textContent = '版本 ' + VERSION;
  $('footNew').onclick = function () { openPopup('newgame'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (ui.popup) closePopup(); else if (ui.page) closePage(); } });
  drawAvatar();
}

// ===== 地圖：繪製 =====
function hash2(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }
function drawWorld() {
  var g = R.worldCtx, M = CONFIG.map, T = M.tile;
  for (var r = 0; r < M.rows; r++) for (var c = 0; c < M.cols; c++) drawTile(g, c, r, M.grid[r].charAt(c), T);
  var slotCol = '#8b9bb4';
  CONFIG.buildings.forEach(function (b) {
    var n = state.built[b.id];
    b.tiles.forEach(function (t, i) {
      var x = t[0] * T + M.spriteOffset, y = t[1] * T + M.spriteOffset;
      if (i < n) drawBuilding(g, b.id, x, y);
      else {   // 空格位：四角記號（佔位）
        g.fillStyle = slotCol;
        [[0, 0], [14, 0], [0, 14], [14, 14]].forEach(function (o) { g.fillRect(x + o[0], y + o[1], 2, 1); g.fillRect(x + o[0] + (o[0] ? 1 : 0), y + o[1] + (o[1] ? -1 : 1), 1, 1); });
      }
    });
  });
  updateLabels();
}
function drawTile(g, c, r, k, T) {
  var x0 = c * T, y0 = r * T, i, h;
  var base = { '.': '#c0cbdc', F: '#265c42', H: '#c0cbdc', W: '#0099db', M: '#5a6988', G: '#3e8948', A: '#733e39' }[k] || '#c0cbdc';
  g.fillStyle = base; g.fillRect(x0, y0, T, T);
  if (k === '.' || k === 'H') {
    for (i = 0; i < 4; i++) { h = hash2(c * 7 + i, r * 13 + i); g.fillStyle = (h & 1) ? '#8b9bb4' : '#ffffff'; g.fillRect(x0 + h % T, y0 + (h >>> 8) % T, 1, 1); }
    if (k === 'H') { g.fillStyle = '#b86f50'; for (i = 0; i < 5; i++) { h = hash2(c * 3 + i, r * 5 + i * 7); var hx = x0 + 1 + h % 17, hy = y0 + 2 + (h >>> 8) % 15; g.fillRect(hx, hy, 1, 3); g.fillRect(hx + 2, hy + 1, 1, 2); } g.fillStyle = '#733e39'; h = hash2(c, r); g.fillRect(x0 + 4 + h % 10, y0 + 12, 2, 1); g.fillRect(x0 + 8 + h % 8, y0 + 6, 2, 1); }
  } else if (k === 'F') {
    g.fillStyle = '#193c3e'; for (i = 0; i < 3; i++) { h = hash2(c + i * 5, r + i * 3); g.fillRect(x0 + h % 18, y0 + (h >>> 8) % 18, 2, 1); }
    g.drawImage(IMG.pine, x0 + 1 + hash2(c, r) % 3, y0 + 1); g.drawImage(IMG.pine, x0 + 10, y0 + 8 + hash2(r, c) % 3);
  } else if (k === 'W') {
    g.fillStyle = '#124e89'; g.fillRect(x0, y0 + T - 1, T, 1);
    g.fillStyle = '#2ce8f5'; for (i = 0; i < 2; i++) { h = hash2(c * 11 + i, r * 3); g.fillRect(x0 + 2 + h % 12, y0 + 4 + i * 8 + (h >>> 8) % 4, 5, 1); }
  } else if (k === 'M') {
    g.fillStyle = '#8b9bb4'; g.fillRect(x0 + 3, y0 + 4, 6, 4); g.fillRect(x0 + 11, y0 + 11, 6, 5);
    g.fillStyle = '#3a4466'; g.fillRect(x0 + 3, y0 + 8, 6, 1); g.fillRect(x0 + 11, y0 + 16, 6, 1);
    g.fillStyle = '#feae34'; h = hash2(c, r); g.fillRect(x0 + 5 + h % 3, y0 + 5, 1, 1); g.fillRect(x0 + 13, y0 + 12 + h % 3, 1, 1);
  } else if (k === 'G') {
    g.fillStyle = '#63c74d'; for (i = 0; i < 6; i++) { h = hash2(c * 9 + i, r * 4 + i); g.fillRect(x0 + h % 18, y0 + (h >>> 8) % 17, 1, 2); }
  } else if (k === 'A') {
    g.fillStyle = '#b86f50'; for (i = 0; i < 4; i++) g.fillRect(x0 + 1, y0 + 2 + i * 5, T - 2, 1);
  }
}
function drawBuilding(g, id, x, y) {
  var a = ATLAS_FOR[id];
  if (a && SPR[a] && atlasImg) { var r = SPR[a]; g.drawImage(atlasImg, r.x, r.y, r.w, r.h, x, y, r.w, r.h); }
  else if (IMG[id]) g.drawImage(IMG[id], x, y);
}
var atlasImg = null;
function loadAtlas() {
  if (!ASSETS.atlas) return;
  var im = new Image();
  im.onload = function () { atlasImg = im; worldDirty = true; };
  im.onerror = function () { showError('assets', '圖片載入失敗'); };
  im.src = ASSETS.atlas;
}
// ×N 標籤（DOM，跟著鏡頭移動）
var labelEls = {};
function updateLabels() {
  var T = CONFIG.map.tile;
  CONFIG.buildings.forEach(function (b) {
    var n = state.built[b.id], e = labelEls[b.id];
    if (n > b.tiles.length) {
      if (!e) { e = labelEls[b.id] = el('span', 't ab outline cnt', $('mapLabels')); e.id = 'cnt-' + b.id; }
      var t = b.tiles[b.tiles.length - 1];
      e.__wx = t[0] * T + T; e.__wy = t[1] * T + T - 12;
      setText(e, '×' + n);
    } else if (e) { e.parentNode.removeChild(e); labelEls[b.id] = null; }
  });
  positionLabels();
}
function positionLabels() {
  for (var k in labelEls) { var e = labelEls[k]; if (e) box(e, e.__wx - cam.x, e.__wy - cam.y); }
}
function drawMap() {
  if (worldDirty) { drawWorld(); worldDirty = false; camDirty = true; }
  if (!camDirty) return;
  var M = CONFIG.map;
  R.mapCtx.drawImage(R.world, cam.x, cam.y, M.viewW, M.viewH, 0, 0, M.viewW, M.viewH);
  positionLabels();
  camDirty = false;
  dbg.draws++;
}
var dbg = window.TL_DEBUG = { draws: 0 };

// ===== 地圖：拖曳與點擊（Pointer Events）=====
function setCam(x, y) {
  var M = CONFIG.map, maxX = M.cols * M.tile - M.viewW, maxY = M.rows * M.tile - M.viewH;
  x = Math.max(0, Math.min(maxX, Math.round(x))); y = Math.max(0, Math.min(maxY, Math.round(y)));
  if (x !== cam.x || y !== cam.y) { cam.x = x; cam.y = y; camDirty = true; }
  var home = cam.x === M.homeX && cam.y === M.homeY;
  setDis(R.bHome, home);
  R.map.setAttribute('data-cam', cam.x + ',' + cam.y);
}
var drag = null;
function bindMapPointer(cv) {
  cv.addEventListener('pointerdown', function (e) {
    if (drag || ui.popup || ui.page || !state.lord.done) return;   // 只認第一根手指
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, active: false };
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.active) {
      if (Math.sqrt(dx * dx + dy * dy) < CONFIG.map.dragThresholdCss) return;
      drag.active = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 有些環境不支援 */ }
      cv.setAttribute('data-dragging', '1');
    }
    setCam(drag.cx - dx / S, drag.cy - dy / S);   // 沒有慣性：放開就停
  });
  function end(e, tap) {
    if (!drag || e.pointerId !== drag.id) return;
    var wasDrag = drag.active; drag = null;
    cv.removeAttribute('data-dragging');
    try { if (cv.hasPointerCapture && cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); } catch (err) { /* 略過 */ }
    if (tap && !wasDrag) mapTap(e);
  }
  cv.addEventListener('pointerup', function (e) { end(e, true); });
  cv.addEventListener('pointercancel', function (e) { end(e, false); });
}
function cancelDrag() { if (drag) { drag = null; R.map.removeAttribute('data-dragging'); } }
function mapTap(e) {
  var rect = R.map.getBoundingClientRect(), M = CONFIG.map, T = M.tile, pad = M.hitPad;
  var wx = (e.clientX - rect.left) / S + cam.x, wy = (e.clientY - rect.top) / S + cam.y;
  var hits = [];
  ['council', 'barracks'].forEach(function (id) {
    if (!state.built[id]) return;
    var t = BLD[id].tiles[0], x = t[0] * T, y = t[1] * T;
    if (wx >= x - pad && wx < x + T + pad && wy >= y - pad && wy < y + T + pad) {
      var inside = wx >= x && wx < x + T && wy >= y && wy < y + T;
      var d = Math.abs(wx - x - T / 2) + Math.abs(wy - y - T / 2);
      hits.push({ id: id, k: inside ? -1 : d });
    }
  });
  if (!hits.length) return;   // 其他建築本版點了沒反應
  hits.sort(function (a, b) { return a.k - b.k; });   // 兩個外擴區重疊時：先看點在哪一格裡，再看離誰的中心近
  openPage(hits[0].id === 'council' ? 'council' : 'barracks');
}

// ===== 頂列 =====
function drawAvatar() {
  var g = R.avatar.getContext('2d'), F = state && state.lord.sex === 'F';
  var face = F ? ['ggggg', 'gEEEg', 'gzEzg', 'gEEEg', 'hhhhh'] : ['ggggg', 'gEEEg', 'EzEzE', 'EEEEE', 'hhhhh'];
  g.fillStyle = '#3a4466'; g.fillRect(0, 0, 36, 36);
  for (var y = 0; y < 5; y++) for (var x = 0; x < 5; x++) { g.fillStyle = PAL[face[y].charAt(x)]; g.fillRect(1 + x * 7, 1 + y * 7, 7, 7); }
}
var lastArcKey = '';
function updateTime(now) {
  var d = new Date(now), m = d.getMinutes() + d.getSeconds() / 60;   // 真實 1 小時 = 遊戲 1 天；:00 = 06 時
  var hour = Math.floor((6 + m * 24 / 60) % 24);
  setText(R.hour, hour + '時');
  var day = m < 30, ang = (180 - ((day ? m : m - 30) / 30) * 180) * Math.PI / 180;
  var x = Math.round(157 + 16 * Math.cos(ang)) - 136, y = Math.round(36 - 16 * Math.sin(ang)) - 2;
  var key = day + ':' + x + ':' + y;
  if (key === lastArcKey) return;
  lastArcKey = key;
  var g = R.arc.getContext('2d');
  g.clearRect(0, 0, 42, 37);
  g.fillStyle = '#3a4466';
  for (var a = 0; a <= 180; a += 12) { var r = a * Math.PI / 180; g.fillRect(Math.round(21 + 16 * Math.cos(r)), Math.round(34 - 16 * Math.sin(r)), 1, 1); }
  g.drawImage(day ? IMG.sun : IMG.moon, x - 3, y - 3);
  R.arc.setAttribute('data-icon', (day ? 'sun' : 'moon') + ',' + (x + 136) + ',' + (y + 2));
}
function renderTop() {
  setText(R.wood, fmtAmt(state.material));
  setText(R.food, fmtAmt(state.food));
  setText(R.pop, String(state.people.length));
  setText(R.mineral, fmtAmt(state.mineral));
}

// ===== 彈窗（x8 y44 w164，最高 236；一次一個；背後遮罩）=====
function openPopup(kind) {
  if (!state.lord.done) return;
  closePopup(); cancelDrag();
  var p = $('popup'); p.innerHTML = '';
  var head = el('div', 'phead', p), title = el('span', 't ab ptitle', head); box(title, 4, 1);
  var x = el('button', 'px ab pclose', head); box(x, 146, 0, 18, 16); el('span', 't', x, '×'); x.id = 'popClose';
  x.onclick = closePopup;
  var body = el('div', 'pbody', p);
  var upd = POPUPS[kind](body, title);
  ui.popup = { kind: kind, update: upd || function () {} };
  p.setAttribute('data-kind', kind);
  $('mask').hidden = false; p.hidden = false;
  ui.popup.update(true);
}
function closePopup() { if (!ui.popup) return; ui.popup = null; $('popup').hidden = true; $('mask').hidden = true; $('popup').innerHTML = ''; }
function line(parent, h, cls) { var d = el('div', 'ln' + (cls ? ' ' + cls : ''), parent); d.style.setProperty('--h', h || 14); return d; }
function txt(parent, x, s, cls) { var t = el('span', 't ab' + (cls ? ' ' + cls : ''), parent, s); box(t, x, 0); return t; }
function rtxt(parent, x, s, cls) { var t = txt(parent, x, s, 'ra' + (cls ? ' ' + cls : '')); return t; }

var POPUPS = {
  lord: function (b, title) {
    setText(title, '領主');
    var L = state.lord, l1 = line(b, 16);
    txt(l1, 4, '名字 ' + CONFIG.lordName + '　性別 ' + (L.sex === 'M' ? '♂' : '♀'));
    ATTR.forEach(function (n, a) {
      var l = line(b, 14);
      txt(l, 4, n);
      var s = el('span', 'ab', l); box(s, 34, 0); s.innerHTML = L.attrs[a] ? starsHTML(L.attrs[a], L.attrs[a], L.attrs[a]) : '<span class="t dim">—</span>';
    });
    txt(line(b, 14), 4, '沒有天賦、不會成長', 'dim');
  },
  material: function (b, title) {
    var rows = {};
    [['伐木', 'lumber'], ['撿柴', 'gather'], ['秸稈', 'straw'], ['淨值', 'net']].forEach(function (a) { var l = line(b, 14); txt(l, 4, a[0]); rows[a[1]] = rtxt(l, 160, ''); });
    var note = txt(line(b, 14), 4, '', 'dim');
    return function () {
      var e = econ();
      setText(title, '建材 ' + fmtAmt(state.material));
      setText(rows.lumber, fmtR(e.job.lumber) + '/秒'); setText(rows.gather, fmtR(e.gather) + '/秒');
      setText(rows.straw, fmtR(e.straw) + '/秒'); setText(rows.net, fmtR(e.material) + '/秒');
      setText(note, state.gatherStopped || state.built.lumber ? '撿柴已停止（蓋了伐木場）' : '閒置居民撿柴，蓋伐木場後停止');
    };
  },
  food: function (b, title) {
    var h = line(b, 14, 'dim'); txt(h, 4, '來源'); rtxt(h, 112, '每秒'); rtxt(h, 160, '比例');
    var rows = CONFIG.foodSources.map(function (s) { var l = line(b, 14); var n = txt(l, 4, s[0]); return { l: l, n: n, v: rtxt(l, 112, ''), p: rtxt(l, 160, ''), jobs: s[1] }; });
    var sep = line(b, 3, 'sep');
    var lc = line(b, 14); txt(lc, 4, '消耗'); var cons = rtxt(lc, 112, '');
    var ln = line(b, 14); txt(ln, 4, '淨值'); var net = rtxt(ln, 112, '');
    var empty = txt(line(b, 14), 4, '', 'dim');
    return function () {
      var e = econ(), tot = e.food;
      setText(title, '食物 ' + fmtAmt(state.food));
      rows.forEach(function (r) {
        var v = r.jobs.reduce(function (a, j) { return a + e.job[j]; }, 0);
        setText(r.v, fmtR(v) + ''); setText(r.p, tot > 0 ? Math.round(v / tot * 100) + '%' : '—');
        setCls(r.l, 'ln' + (v > 0 ? '' : ' dim'));
      });
      setText(cons, fmtR(-e.cons)); setText(net, fmtR(e.foodNet));
      setCls(net, 't ab ra ' + (e.foodNet > 1e-9 ? 'pos' : e.foodNet < -1e-9 ? 'neg' : 'dim'));
      setText(empty, tot > 0 ? '' : '目前沒有人生產食物');
    };
  },
  pop: function (b, title) {
    var cells = CONFIG.jobs.map(function (j) { return [j.name, j.id]; }).concat([['士兵', 'soldier'], ['英雄', 'hero'], ['閒置', 'idle'], ['床位', 'beds']]);
    var refs = [], l;
    cells.forEach(function (c, i) {
      if (i % 3 === 0) l = line(b, 15);
      var t = txt(l, 4 + (i % 3) * 53, ''); refs.push([c, t]);
    });
    var go = btn(line(b, 26), 70, 3, 90, 20, '前往內政'); go.id = 'popGoCouncil';
    go.onclick = function () { closePopup(); ui.tab = 'jobs'; openPage('council'); };
    return function () {
      var e = econ(), cnt = countPeople();
      setText(title, '人口 ' + state.people.length + '　幸福度 ' + Math.floor(state.happiness + 1e-9));
      refs.forEach(function (r) {
        var id = r[0][1], v = id === 'beds' ? beds() : cnt[id] || 0;
        setText(r[1], r[0][0] + ' ' + v);
        setCls(r[1], 't ab' + (id === 'idle' && v > 0 ? ' hi' : v ? '' : ' dim'));
      });
    };
  },
  mineral: function (b, title) {
    var l = line(b, 14); txt(l, 4, '採礦'); var v = rtxt(l, 160, '');
    var note = txt(line(b, 28, 'wrap'), 4, '', 'dim');
    return function () {
      var e = econ();
      setText(title, '礦物 ' + fmtAmt(state.mineral));
      setText(v, fmtR(e.mineral) + '/秒');
      setText(note, state.mineral < 1e-9 && !state.built.mine ? '還沒有礦物。蓋採礦場後派人採礦。' : '礦物本版沒有用途，只累積');
    };
  },
  events: function (b, title) { setText(title, '事件'); txt(line(b, 20), 4, '目前沒有事件', 'dim'); },
  build: function (b, title) {
    setText(title, '建造');
    var rows = CONFIG.buildings.filter(function (d) { return d.id !== 'council'; }).map(function (d) {
      var l = line(b, 30, 'brow');
      var ic = el('canvas', 'ab bic', l); ic.width = 16; ic.height = 16; box(ic, 2, 7, 16, 16);
      var g = ic.getContext('2d'); g.imageSmoothingEnabled = false; drawBuilding(g, d.id, 0, 0);
      var n = txt(l, 21, d.name); box(n, 21, 2);
      var info = d.slots ? '工位 ' + slotsPer(d.id) : d.beds ? '床位 ' + d.beds : d.id === 'barracks' ? '入伍' : '沒有效果';
      var i2 = txt(l, 21, info, 'dim'); box(i2, 21, 16);
      var c = rtxt(l, 116, ''); box(c, 116, 9);
      var bt = btn(l, 118, 4, 44, 22, ''); bt.id = 'build-' + d.id;
      bt.onclick = function () { build(d.id); };
      return { d: d, c: c, b: bt };
    });
    var up = btn(line(b, 26), 4, 3, 156, 20, '升級（尚未開放）'); up.disabled = true; up.id = 'btnUpgrade';
    return function () {
      rows.forEach(function (r) {
        setText(r.c, '已蓋 ' + state.built[r.d.id]);
        btnLabel(r.b, '蓋 ' + costOf(r.d.id)); setDis(r.b, !canBuild(r.d.id));
      });
    };
  },
  newgame: function (b, title) {
    setText(title, '新遊戲');
    txt(line(b, 30, 'wrap'), 4, '清除存檔、重新抽人口和所有人物。目前的進度會消失。');
    var ok = btn(line(b, 26), 4, 2, 76, 22, '確定重來'); ok.id = 'btnNewOk';
    var no = btn(ok.parentNode, 84, 2, 76, 22, '取消');
    ok.onclick = function () { closePopup(); closePage(); wipeAndNew(randomSeed()); setCam(CONFIG.map.homeX, CONFIG.map.homeY); drawAvatar(); uiDirty = true; render(); };
    no.onclick = closePopup;
  }
};
function countPeople() {
  var c = { soldier: 0, hero: 0, idle: 0 };
  state.people.forEach(function (p) {
    if (p.type === 'hero') c.hero++;
    else if (p.job === 'soldier') c.soldier++;
    else if (!p.job) c.idle++;
    else c[p.job] = (c[p.job] || 0) + 1;
  });
  return c;
}

// ===== 全螢幕頁：內政、軍營 =====
function openPage(kind) {
  if (!state.lord.done) return;
  if (kind === 'barracks' && !state.built.barracks) return;
  closePopup(); cancelDrag();
  ui.page = kind;
  var pg = $('page'); pg.innerHTML = ''; pg.hidden = false; pg.setAttribute('data-kind', kind);
  var back = btn(pg, 2, 2, 52, 20, '< 返回'); back.id = 'pageBack'; back.onclick = closePage;
  var title = el('div', 't ab ptitle2', pg, kind === 'council' ? '內政' : '軍營'); box(title, 72, 5);
  R.pageIdle = el('div', 't ab ra', pg); box(R.pageIdle, 178, 5); R.pageIdle.id = 'pageIdle';
  var top = 24;
  if (kind === 'council') {
    [['life', '生活'], ['jobs', '職業分配'], ['heroes', '英雄']].forEach(function (t, i) {
      var b = btn(pg, i * 60, 24, 60, 20, t[1], 'tab' + (ui.tab === t[0] ? ' on' : '')); b.id = 'tab-' + t[0];
      b.onclick = function () { ui.tab = t[0]; openPage('council'); };
    });
    top = 44;
  }
  var body = el('div', 'ab pagebody', pg); box(body, 0, top, 180, 320 - top); body.id = 'pageBody';
  R.pageUpdate = (kind === 'council' ? TABS[ui.tab] : buildBarracks)(body) || function () {};
  R.pageUpdate(true);
}
function closePage() { if (!ui.page) return; ui.page = null; $('page').hidden = true; $('page').innerHTML = ''; R.pageUpdate = null; }

var TABS = {
  life: function (b) {
    var refs = {};
    function row(key, label, x, cls) { var l = line(b, 14, cls); txt(l, x || 4, label); refs[key] = rtxt(l, 176, ''); return l; }
    row('food', '食物', 4, 'hd');
    CONFIG.jobs.forEach(function (j) { if (BLD[j.bld].produces === 'food') row('f_' + j.id, j.name, 14); });
    row('cons', '消耗', 14); row('soldier', '（其中士兵）', 14, 'dim'); row('fnet', '淨值', 14);
    row('mat', '建材', 4, 'hd'); row('m_lumber', '伐木', 14); row('m_gather', '撿柴', 14); row('m_straw', '秸稈', 14); row('mnet', '淨值', 14);
    row('min', '礦物', 4, 'hd'); row('n_mine', '採礦', 14);
    row('hap', '幸福度', 4, 'hd'); row('decay', '每分鐘衰退', 14);
    row('beds', '床位', 4, 'hd');
    txt(line(b, 14, 'dim'), 4, '床位本版只顯示，沒有效果');
    row('talents', '生效中的英雄天賦', 4, 'hd');
    var tl = el('div', 't wrap dim talentlist', b);
    var ng = btn(line(b, 30), 4, 4, 100, 22, '新遊戲'); ng.id = 'btnNewGame'; ng.onclick = function () { openPopup('newgame'); };
    return function () {
      var e = econ();
      setText(refs.food, fmtAmt(state.food));
      CONFIG.jobs.forEach(function (j) { if (refs['f_' + j.id]) setText(refs['f_' + j.id], fmtR(e.job[j.id]) + '/秒'); });
      setText(refs.cons, fmtR(-e.cons) + '/秒'); setText(refs.soldier, fmtR(-e.soldierCons) + '/秒'); setText(refs.fnet, fmtR(e.foodNet) + '/秒');
      setText(refs.mat, fmtAmt(state.material)); setText(refs.m_lumber, fmtR(e.job.lumber) + '/秒'); setText(refs.m_gather, fmtR(e.gather) + '/秒');
      setText(refs.m_straw, fmtR(e.straw) + '/秒'); setText(refs.mnet, fmtR(e.material) + '/秒');
      setText(refs.min, fmtAmt(state.mineral)); setText(refs.n_mine, fmtR(e.job.mine) + '/秒');
      setText(refs.hap, String(Math.floor(state.happiness + 1e-9))); setText(refs.decay, fmtR(-happinessDecayPerMin(), 4));
      setText(refs.beds, String(beds())); setText(refs.talents, MODS.list.length ? '' : '沒有');
      setText(tl, MODS.list.map(function (t) { return TAL[t].name; }).join('、'));
    };
  },
  jobs: function (b) {
    var h1 = line(b, 16); var hint = txt(h1, 4, ''); hint.id = 'idleHint';
    var h2 = line(b, 26); var one = btn(h2, 4, 2, 172, 22, '一鍵派去狩獵'); one.id = 'btnOneKey';
    one.onclick = function () { oneKeyHunt(); render(); };
    var hd = line(b, 14, 'dim'); txt(hd, 2, '工作'); txt(hd, 34, '工位'); txt(hd, 86, '人數'); rtxt(hd, 178, '產量/分');
    var rows = CONFIG.jobs.map(function (j) {
      var l = line(b, 22, 'jrow'); l.id = 'job-' + j.id;
      var n = txt(l, 2, j.name); box(n, 2, 4);
      var u = txt(l, 34, ''); box(u, 34, 4);
      var mi = btn(l, 72, 1, 20, 20, '－'); mi.id = 'minus-' + j.id;
      var c = el('span', 't ab ctr', l); box(c, 92, 4, 22); c.id = 'cnt-' + j.id;
      var pl = btn(l, 114, 1, 20, 20, '＋'); pl.id = 'plus-' + j.id;
      var r = rtxt(l, 178, ''); box(r, 178, 4);
      hold(mi, function () { return assignMinus(j.id); }); hold(pl, function () { return assignPlus(j.id); });
      return { j: j, l: l, u: u, c: c, mi: mi, pl: pl, r: r };
    });
    var li = line(b, 16); txt(li, 2, '閒置'); var idleN = txt(li, 30, ''); idleN.id = 'rowIdle';
    var ls = line(b, 16, 'dim'); txt(ls, 2, '士兵'); var soldN = txt(ls, 30, ''); soldN.id = 'rowSoldier'; txt(ls, 60, '（在軍營調整）');
    var rosterUpd = buildRoster(b);
    return function () {
      var e = econ(), h = idleHint(), idle = idleResidents().length;
      if (h.short) setText(hint, '食物不夠，還差 ' + h.need + ' 名獵人'); else setText(hint, '還能閒置 ' + Math.max(0, h.n) + ' 人');
      setCls(hint, 't ab' + (h.short ? ' warn' : ''));
      btnLabel(one, h.need > 0 ? '一鍵派去狩獵（' + h.need + ' 人）' : '一鍵派去狩獵');
      setDis(one, !(h.need > 0 && canPlus('hunt')));
      rows.forEach(function (r) {
        var slots = jobSlots(r.j.id), w = e.workers[r.j.id], built = state.built[r.j.bld] > 0;
        setCls(r.l, 'ln jrow' + (built ? '' : ' dim'));
        setText(r.u, built ? w + '/' + slots : '未建造');
        r.mi.hidden = r.pl.hidden = r.c.hidden = r.r.hidden = !built;
        setText(r.c, String(w));
        setDis(r.mi, w <= 0); setDis(r.pl, idle <= 0 || w >= slots);
        var pm = e.job[r.j.id] * 60;
        setText(r.r, (pm > 0 ? '+' : '') + (pm >= 100 ? Math.round(pm) : fmtNum(pm, 1)));
      });
      setText(idleN, String(idle)); setText(soldN, String(countPeople().soldier));
      rosterUpd();
    };
  },
  heroes: function (b) {
    var hs = state.people.filter(function (p) { return p.type === 'hero'; }), h = '';
    hs.forEach(function (p) {
      h += '<div class="card" data-id="' + p.id + '"><div class="ln" style="--h:14"><span class="t ab" style="--x:2">#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲　英雄　忠' + p.loyalty + '</span></div>';
      h += '<div class="ln" style="--h:13">' + attrHTML(p, 0, 2) + attrHTML(p, 1, 62) + attrHTML(p, 2, 122) + '</div>';
      h += '<div class="ln" style="--h:13">' + attrHTML(p, 3, 2) + attrHTML(p, 4, 62) + '</div>';
      if (p.talent) {
        var T = TAL[p.talent.tid], on = talentActive(p.talent.tid);
        h += '<div class="ln" style="--h:14"><span class="t ab tal" style="--x:2">天賦：' + esc(heroTalentText(p.talent)) + '</span>' + (on ? '' : '<span class="t ab ra off" style="--x:174">尚未開放</span>') + '</div>';
        h += '<div class="t wrap dim eff">' + esc(T.effect) + '（' + T.cat + '）</div>';
      } else h += '<div class="ln" style="--h:14"><span class="t ab dim" style="--x:2">沒有天賦</span></div>';
      h += '</div>';
    });
    if (!hs.length) h = '<div class="t dim">沒有英雄</div>';
    b.innerHTML = h;
  }
};

// 點一下＝加減一次（click）；長按 0.4 秒後每 0.1 秒連續加減。
// 按下時不立刻動作：手指從按鈕上開始捲動名冊時（瀏覽器送 pointercancel 或手指移動超過門檻）不會誤加減。
function hold(b, fn) {
  var t1 = null, t2 = null, held = false, sx = 0, sy = 0, pid = null;
  function stop() { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; pid = null; }
  b.addEventListener('pointerdown', function (e) {
    if (b.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stop(); held = false; sx = e.clientX; sy = e.clientY; pid = e.pointerId;
    t1 = setTimeout(function () {
      held = true;
      if (b.disabled || !fn()) { stop(); render(); return; }
      render();
      t2 = setInterval(function () { if (b.disabled || !fn()) { stop(); } render(); }, CONFIG.holdRepeatMs);
    }, CONFIG.holdDelayMs);
  });
  b.addEventListener('pointermove', function (e) {
    if (pid !== e.pointerId || !t1) return;
    var th = CONFIG.map.dragThresholdCss;
    if (Math.abs(e.clientX - sx) > th || Math.abs(e.clientY - sy) > th) stop();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, stop); });
  b.addEventListener('click', function () {
    if (held) { held = false; return; }   // 長按已經連續加減過，放開時的 click 不再多加一次
    if (b.disabled) return;
    fn(); render();
  });
}

// ===== 居民名冊 =====
var JOB_ORDER = {};
CONFIG.jobs.forEach(function (j, i) { JOB_ORDER[j.id] = i; });
JOB_ORDER.soldier = 7; JOB_ORDER.idle = 8;
function buildRoster(b) {
  var F = ui.roster;
  var hd = line(b, 16, 'hd'); txt(hd, 2, '居民名冊'); var total = rtxt(hd, 178, ''); total.id = 'rosterCount';
  var f = line(b, 22);
  function sel(x, w, id, opts, key) {
    var s = el('select', 'ab sel', f); box(s, x, 1, w, 20); s.id = id;
    opts.forEach(function (o) { var op = el('option', '', s, o[1]); op.value = o[0]; });
    s.value = F[key]; s.onchange = function () { F[key] = s.value; F.ver = -1; upd(); };
    return s;
  }
  sel(2, 56, 'fSex', [['all', '全性別'], ['M', '♂'], ['F', '♀']], 'sex');
  sel(61, 58, 'fJob', [['all', '全職業']].concat(CONFIG.jobs.map(function (j) { return [j.id, j.name]; }), [['soldier', '士兵'], ['idle', '閒置']]), 'job');
  sel(122, 56, 'fTal', [['all', '全天賦'], ['yes', '有天賦'], ['no', '無天賦']], 'tal');
  var s2 = line(b, 22); f = s2;
  sel(2, 56, 'fKey', [['job', '職業'], ['age', '年齡'], ['0', '勇武'], ['1', '智力'], ['2', '精神'], ['3', '耐力'], ['4', '統帥']], 'key');
  var dir = btn(s2, 61, 1, 58, 20, ''); dir.id = 'fDir';
  dir.onclick = function () { F.dir = -F.dir; F.ver = -1; upd(); };
  var list = el('div', 'roster', b); list.id = 'roster';
  list.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('#btnClearFilter')) { F.sex = F.job = F.tal = 'all'; ['fSex', 'fJob', 'fTal'].forEach(function (i) { $(i).value = 'all'; }); F.ver = -1; upd(); return; }
    while (t && t !== list && !t.getAttribute('data-id')) t = t.parentNode;
    if (!t || t === list) return;
    var id = +t.getAttribute('data-id'); F.open[id] = !F.open[id]; F.ver = -1; upd();
  });
  F.ver = -1;
  function upd() {
    btnLabel(dir, F.dir > 0 ? '↑低→高' : '↓高→低');
    var key = F.key + '|' + rosterVersion;
    if (F.ver === key) return;
    F.ver = key;
    var res = state.people.filter(function (p) { return p.type === 'res'; });
    var rows = res.filter(function (p) {
      if (F.sex !== 'all' && p.sex !== F.sex) return false;
      var j = p.job || 'idle';
      if (F.job !== 'all' && j !== F.job) return false;
      if (F.tal === 'yes' && !p.talent) return false;
      if (F.tal === 'no' && p.talent) return false;
      return true;
    });
    rows.sort(function (a, b) {
      var d;
      if (F.key === 'job') d = JOB_ORDER[a.job || 'idle'] - JOB_ORDER[b.job || 'idle'];
      else if (F.key === 'age') d = a.age - b.age;
      else { var k = +F.key; d = (a.cur[k] - b.cur[k]) || (a.cap[k] - b.cap[k]); }   // 依現值，同分比潛力
      return d * F.dir || (a.id - b.id);
    });
    setText(total, '共 ' + rows.length + ' 人');
    var h = '';
    rows.forEach(function (p) {
      var open = !!F.open[p.id];
      h += '<div class="rr' + (open ? ' open' : '') + '" data-id="' + p.id + '">' +
        '<div class="ln" style="--h:14"><span class="t ab" style="--x:1">#' + pad2(p.id) + '</span><span class="t ab ' + (p.sex === 'M' ? 'male' : 'female') + '" style="--x:25">' + sexCh(p) + '</span>' +
        '<span class="t ab" style="--x:38">' + p.age + '歲</span><span class="t ab' + (p.job ? '' : ' dim') + '" style="--x:69">' + jobName(p) + '</span>' +
        (p.talent ? '<span class="t ab tal" style="--x:95">〔' + p.talent.name + '〕</span>' : '') +
        '<span class="t ab" style="--x:149">忠' + p.loyalty + '</span></div>';
      if (open) {
        h += '<div class="ln" style="--h:13">' + attrHTML(p, 0, 2) + attrHTML(p, 1, 62) + attrHTML(p, 2, 122) + '</div>';
        h += '<div class="ln" style="--h:13">' + attrHTML(p, 3, 2) + attrHTML(p, 4, 62) + '</div>';
        if (p.talent) {
          var J = JOB[p.talent.job], pct = fmtNum(resTalentPct(p), 1);
          h += '<div class="ln" style="--h:14"><span class="t ab tal" style="--x:2">' + p.talent.name + ' ' + (p.job === p.talent.job ? '+' + pct + '%' : '0%（' + J.name + '時 +' + pct + '%）') + '</span></div>';
        }
      }
      h += '</div>';
    });
    if (!rows.length) h = '<div class="ln" style="--h:16"><span class="t ab dim" style="--x:4">沒有符合條件的居民</span></div><div class="ln" style="--h:26"><button class="px ab" id="btnClearFilter" style="--x:4;--y:2;--w:90;--h:22"><span class="t">清除篩選</span></button></div>';
    list.innerHTML = h;
  }
  return upd;
}
var rosterVersion = 0;

// ===== 軍營頁 =====
function buildBarracks(b) {
  var h1 = line(b, 16); var head = txt(h1, 4, ''); head.id = 'soldierHead';
  txt(line(b, 16, 'hd'), 4, '入伍（閒置、勇武 ' + CONFIG.enlistMinValor + '★ 以上）');
  var en = el('div', '', b); en.id = 'enlistList';
  txt(line(b, 16, 'hd'), 4, '士兵');
  var so = el('div', '', b); so.id = 'soldierList';
  txt(line(b, 30, 'wrap dim'), 4, '士兵只駐守，不工作。轉回後 ' + Math.round(CONFIG.reenlistLockSec / 60) + ' 分鐘內不能再入伍。');
  b.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t || t.disabled) return;
    var id = +t.getAttribute('data-id');
    if (t.getAttribute('data-act') === 'enlist') enlist(id); else if (t.getAttribute('data-act') === 'back') discharge(id);
    lastBk = ''; render();
  });
  var lastBk = '';
  return function () {
    var e = econ(), now = Date.now();
    setText(head, '士兵 ' + e.soldiers + ' 人，每秒吃 ' + fmtNum(e.soldierCons, 2) + ' 食物');
    var cand = state.people.filter(function (p) { return enlistState(p, now); });
    var sol = state.people.filter(function (p) { return p.job === 'soldier'; });
    var key = cand.map(function (p) { var st = enlistState(p, now); return p.id + st + (st === 'locked' ? fmtClock((p.reenlistLockUntil - now) / 1000) : ''); }).join() + '|' + sol.map(function (p) { return p.id; }).join();
    if (key === lastBk) return;
    lastBk = key;
    var h = '';
    cand.forEach(function (p) {
      var st = enlistState(p, now);
      h += '<div class="ln brk' + (st === 'locked' ? ' dim' : '') + '" style="--h:22" data-row="' + p.id + '"><span class="t ab" style="--x:4;--y:4">#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲</span>' +
        '<span class="ab" style="--x:70;--y:6">' + starsHTML(p.cur[0], p.cap[0], 5) + '</span>' +
        (st === 'locked' ? '<span class="t ab ra lock" style="--x:174;--y:4">' + fmtClock((p.reenlistLockUntil - now) / 1000) + '</span>'
          : '<button class="px ab" data-act="enlist" data-id="' + p.id + '" id="enlist-' + p.id + '" style="--x:126;--y:1;--w:50;--h:20"><span class="t">入伍</span></button>') + '</div>';
    });
    if (!cand.length) h = '<div class="ln" style="--h:16"><span class="t ab dim" style="--x:4">目前沒有可入伍的人</span></div>';
    $('enlistList').innerHTML = h;
    h = '';
    sol.forEach(function (p) {
      h += '<div class="ln brk" style="--h:22"><span class="t ab" style="--x:4;--y:4">#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲</span>' +
        '<button class="px ab" data-act="back" data-id="' + p.id + '" id="back-' + p.id + '" style="--x:106;--y:1;--w:70;--h:20"><span class="t">轉回居民</span></button></div>';
    });
    if (!sol.length) h = '<div class="ln" style="--h:16"><span class="t ab dim" style="--x:4">目前沒有士兵</span></div>';
    $('soldierList').innerHTML = h;
  };
}

// ===== 領主分配畫面（新遊戲第一個畫面）=====
function buildLordSetup() {
  var o = $('lordSetup'); o.innerHTML = '';
  var t = el('div', 't ab', o, '分配領主屬性'); box(t, 51, 6);
  var sx = el('div', 't ab', o, '性別 ' + (state.lord.sex === 'M' ? '♂' : '♀') + '　人口 ' + state.people.length + ' 人'); box(sx, 4, 24); sx.id = 'setupInfo';
  var note = el('div', 't ab wrap warn', o, loadNotice); box(note, 4, 40, 172); note.id = 'loadNotice';
  var left = el('div', 't ab', o); box(left, 4, 104); left.id = 'lordLeft';
  var rows = ATTR.map(function (n, a) {
    var y = 122 + a * 26;
    var l = el('div', 't ab', o, n); box(l, 4, y + 4);
    var mi = btn(o, 36, y, 24, 22, '－'); mi.id = 'lord-minus-' + a; mi.onclick = function () { lordAdj(a, -1); render(); };
    var st = el('span', 'ab', o); box(st, 64, y + 7);
    var v = el('span', 't ab', o); box(v, 108, y + 4); v.id = 'lord-val-' + a;
    var pl = btn(o, 124, y, 24, 22, '＋'); pl.id = 'lord-plus-' + a; pl.onclick = function () { lordAdj(a, 1); render(); };
    return { mi: mi, pl: pl, st: st, v: v };
  });
  var ok = btn(o, 40, 262, 100, 24, '確定'); ok.id = 'lordOk';
  ok.onclick = function () { if (lordConfirm()) { loadNotice = ''; render(); } };
  var tip = el('div', 't ab dim', o, '點數用完才能確定'); box(tip, 38, 290); var tip2 = el('div', 't ab dim', o, '確定後不能再改'); box(tip2, 45, 304);
  R.setup = { left: left, rows: rows, ok: ok };
}
function renderLordSetup() {
  var L = state.lord, rest = L.points - lordUsed();
  setText(R.setup.left, '剩餘 ' + rest + ' 點（共 ' + L.points + ' 點）');
  R.setup.rows.forEach(function (r, a) {
    setHTML(r.st, starsHTML(L.attrs[a], L.attrs[a], CONFIG.lordAttrMax));
    setText(r.v, String(L.attrs[a]));
    setDis(r.mi, L.attrs[a] <= 0); setDis(r.pl, rest <= 0 || L.attrs[a] >= CONFIG.lordAttrMax);
  });
  setDis(R.setup.ok, rest !== 0);
}

// ===== 主 render =====
var lastSlow = 0, setupShown = null;
function render(force) {
  var now = Date.now();
  if (uiDirty) { rosterVersion++; }
  var showSetup = !state.lord.done;
  if (showSetup !== setupShown) { setupShown = showSetup; $('lordSetup').hidden = !showSetup; if (showSetup) buildLordSetup(); else drawAvatar(); }
  if (showSetup) { renderLordSetup(); uiDirty = false; return; }
  renderTop();
  var slow = force || uiDirty || now - lastSlow >= 1000 || now < lastSlow;   // 彈窗、內政頁數字每 1 秒更新（有操作時立即）
  if (slow) {
    lastSlow = now;
    updateTime(now);
    if (ui.popup) ui.popup.update();
    if (ui.page) { setText(R.pageIdle, '閒置 ' + idleResidents().length); if (R.pageUpdate) R.pageUpdate(); }
  }
  setText($('saveNote'), saveFailed ? '這個瀏覽器不允許存檔：遊戲照常進行，但關掉後進度不會保留' : '');
  uiDirty = false;
}

// ===== 迴圈 =====
function frameLoop() {
  try { if (!inBackground) drawMap(); } catch (e) { showError('map', e); }
  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(frameLoop); else setTimeout(frameLoop, 33);
}
function showError(where, e) { $('error').textContent = '程式錯誤（' + where + '）：' + (e && e.message ? e.message : e); }
var last = Date.now(), sinceSave = 0, inBackground = false;
function boot() {
  applyScale();
  makeImages();
  try {
    state = loadState();
    if (!state) {
      var m = /[#&?]seed=(\d+)/.exec(location.hash + '&' + location.search);   // 測試用：#seed=N 只在沒有存檔時決定新局的種子
      state = newGameState(m ? (+m[1]) >>> 0 : randomSeed());
      MODS = heroMods(state.people);
      save();
    } else MODS = heroMods(state.people);
  } catch (e) { showError('load', e); state = newGameState(randomSeed()); MODS = heroMods(state.people); }
  buildUI();
  setCam(CONFIG.map.homeX, CONFIG.map.homeY);
  loadAtlas();
  render(true);
  frameLoop();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { uiDirty = true; }, function () {});
}
window.addEventListener('resize', function () { applyScale(); camDirty = true; });
window.addEventListener('orientationchange', applyScale);
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') { inBackground = true; cancelDrag(); save(); }
  else { inBackground = false; last = Date.now(); camDirty = true; try { render(true); } catch (e) { showError('render', e); } }
});
boot();
setInterval(function () {
  try {
    var now = Date.now(), sec = (now - last) / 1000;
    if (!(sec >= 0)) sec = 0;
    sec = Math.min(sec, CONFIG.maxTickSec);   // 離線、背景都不補時間
    last = now;
    if (inBackground) sec = 0;
    tick(sec);
    sinceSave += sec;
    if (sinceSave >= CONFIG.autosaveSec) { sinceSave = 0; save(); }
  } catch (e) { showError('tick', e); }
  try { render(); } catch (e) { showError('render', e); }
}, CONFIG.tickMs);
window.addEventListener('beforeunload', save);
window.addEventListener('pagehide', save);
// 測試用（純函式，不改遊戲狀態）：批次用種子生成、驗收統計
window.TL_SIM = { genWorld: genWorld, CONFIG: CONFIG, HERO_TALENTS: HERO_TALENTS };
