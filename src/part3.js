
// =====================================================================
// ===== 畫面（橫式 v2；只讀 state，所有寫入都經過上面的操作函式）=====
// stage = DW×720 du，u = min(可用高/720, 可用寬/1280)，DW = clamp(1280, floor(可用寬/u), 1600)，在可用區置中（§1）
// =====================================================================
var $ = function (id) { return document.getElementById(id); };
var U = 0.5, DW = 1280, DPR = 1, INS = { l: 0, r: 0, t: 0, b: 0 };
var GOAL_X = 4;   // v2-land.17：目標格 x（du），往右 4 讓左邊卷軸凸出看得到
var uiDirty = true, worldDirty = true, camDirty = true;
var cam = { x: 0, y: 0 };   // 世界座標 du；鏡頭不存檔
var ui = { page: null, tab: 'jobs', popup: null, roster: { sex: 'all', job: 'all', tal: 'all', key: 'job', dir: 1, open: {} } };
var portrait = false, inBackground = false, hiddenAt = 0, pendingWelcome = null;
var FONT = '"Iansui","PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei",sans-serif';

// ===== 小工具 =====
function el(tag, cls, parent, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function du(v) { return 'calc((' + v + ') * var(--u))'; }   // v 可以是數字或 'var(--dw) - 160' 這種字串
function box(e, x, y, w, h) { var s = e.style; if (x !== null && x !== undefined) s.left = du(x); if (y !== null && y !== undefined) s.top = du(y); if (w !== null && w !== undefined) s.width = du(w); if (h !== null && h !== undefined) s.height = du(h); return e; }
function setText(e, s) { if (e.__t === s) return false; e.__t = s; e.textContent = s; return true; }
function setHTML(e, s) { if (e.__h === s) return false; e.__h = s; e.innerHTML = s; return true; }
function setDis(e, v) { if (e.disabled !== v) e.disabled = v; }
function setCls(e, c) { if (e.__c !== c) { e.__c = c; e.className = c; } }
function btn(parent, x, y, w, h, label, cls) { var b = el('button', 'btn ab f28' + (cls ? ' ' + cls : ''), parent); box(b, x, y, w, h); el('span', '', b, label); return b; }
function btnLabel(b, s) { setText(b.firstChild, s); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtAmt(n) { var v = Math.floor(n + 1e-9); return v < 10000 ? String(v) : v < 1e6 ? Math.floor(v / 1000) + 'k' : (Math.floor(v / 1e5) / 10) + 'M'; }
function fmtNum(n, d) { var s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }
function fmtR(n, d) { var s = fmtNum(Math.abs(n), d === undefined ? 3 : d); return (s === '0' ? '±' : n > 0 ? '+' : '−') + s; }
function fmtClock(sec) { var t = Math.max(0, Math.ceil(sec - 1e-6)); return Math.floor(t / 60) + ':' + pad2(t % 60); }
function fmtAway(sec) { var t = Math.max(0, Math.floor(sec)); if (t > 99 * 3600 + 59 * 60 + 59) return '超過 99 小時'; return pad2(Math.floor(t / 3600)) + ':' + pad2(Math.floor(t / 60) % 60) + ':' + pad2(t % 60); }
function sexCh(p) { return p.sex === 'M' ? '♂' : '♀'; }
function jobName(p) { return p.job === 'soldier' ? '士兵' : p.job ? JOB[p.job].name : '閒置'; }
function starsHTML(cur, cap, slots) {   // ★ = 現值、☆ = 潛力，固定 slots 格寬
  var h = '';
  for (var i = 0; i < slots; i++) h += i < cur ? '<i class="w">★</i>' : i < cap ? '<i class="b">☆</i>' : '<i class="e">☆</i>';
  return '<span class="stars">' + h + '</span>';
}
function attrHTML(p, a, x) { return '<span class="ab t" style="left:' + du(x) + '"><b class="dim" style="margin-right:.3em">' + ATTR_S[a] + '</b>' + starsHTML(p.cur[a], p.cap[a], 5) + '</span>'; }
function heroTalentText(t) {
  var T = TAL[t.tid], v = t.value, s;
  if (T.unit === '格') s = '+' + Math.round(v) + ' 格';
  else if (T.unit.charAt(0) === '%') s = fmtNum(v, 1) + '%';
  else if (T.unit === '點') s = '+' + fmtNum(v, 1) + ' 點';
  else s = fmtNum(v, 4) + ' ' + T.unit;
  return T.name + ' ' + s;
}
// 流式排版：一列（高度 du），子元素用絕對座標
function line(parent, h, cls) { var d = el('div', 'ln' + (cls ? ' ' + cls : ''), parent); d.style.height = du(h); return d; }
function txt(parent, x, s, cls) { var t = el('span', 'ab t' + (cls ? ' ' + cls : ''), parent, s); t.style.left = du(x); return t; }
function rtxt(parent, x, s, cls) { return txt(parent, x, s, 'ra' + (cls ? ' ' + cls : '')); }
function ctxt(parent, x, s, cls) { return txt(parent, x, s, 'ca' + (cls ? ' ' + cls : '')); }

// ===== 縮放與安全區（§1）=====
function readInsets() {
  var m = /[#&?]safe=(\d+),(\d+),(\d+),(\d+)/.exec(location.hash + '&' + location.search);   // 測試用：#safe=左,右,上,下 模擬瀏海安全區
  if (m) return { l: +m[1], r: +m[2], t: +m[3], b: +m[4] };
  var cs = getComputedStyle($('safeProbe'));
  return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
}
function applyScale() {
  INS = readInsets();
  var vw = window.innerWidth, vh = window.innerHeight;
  var aw = Math.max(1, vw - INS.l - INS.r), ah = Math.max(1, vh - INS.t - INS.b);
  var u = Math.min(ah / 720, aw / 1280);
  var dw = Math.max(1280, Math.min(1600, Math.floor(aw / u + 1e-6)));
  var dpr = window.devicePixelRatio || 1;
  var changed = u !== U || dw !== DW || dpr !== DPR;
  U = u; DW = dw; DPR = dpr;
  var root = document.documentElement.style;
  root.setProperty('--u', u + 'px'); root.setProperty('--dw', dw);
  var app = $('app'), st = app.style;
  st.width = (dw * u) + 'px'; st.height = (720 * u) + 'px';
  st.left = (INS.l + (aw - dw * u) / 2) + 'px'; st.top = (INS.t + (ah - 720 * u) / 2) + 'px';
  document.documentElement.setAttribute('data-u', u.toFixed(4)); document.documentElement.setAttribute('data-dw', dw);
  checkOrientation();
  if (changed && R.map) { sizeMap(); setCam(cam.x, cam.y); worldDirty = true; }   // 鏡頭世界座標不變，只重新夾限（§1.2）
}
function mapWdu() { return DW - 360; }

var R = {};   // 固定元素參照
var CAT_COL = { prod: '#3f8a3a', house: '#c9a227', mil: '#b8402f', other: '#7d7d7d' };
var BLD_CAT = { council: 'other', house: 'house', lumber: 'prod', lodge: 'prod', fishery: 'prod', field: 'prod', ranch: 'prod', pen: 'prod', mine: 'prod', barracks: 'mil', clinic: 'other', storage: 'other' };
var JOB_OF_BLD = {}; CONFIG.jobs.forEach(function (j) { JOB_OF_BLD[j.bld] = j.id; });
var JOB_CH = { lumber: '伐', hunt: '獵', fish: '漁', farm: '農', mine: '礦', pasture: '牧', livestock: '畜' };
var TOOL_CH = { lumber: '斧', hunt: '矛', fish: '網', farm: '鋤', mine: '鎬', pasture: '杖', livestock: '繩' };
var JOB_COL = { lumber: '#8b5a2b', hunt: '#b5462f', fish: '#2f7fb5', farm: '#b8901a', mine: '#5f5f70', pasture: '#4f9a3f', livestock: '#9a5a3a', idle: '#8f8f8f', soldier: '#c0392b', hero: '#7d3cb5' };
var RES_UNIT = { material: '建材', food: '食物', mineral: '礦物' };

function icon(parent, x, y, d, ch, col) { var i = el('i', 'ab icon', parent, ch); box(i, x, y, d, d); i.style.background = col; i.style.fontSize = 'max(12px, ' + du(d * 0.5) + ')'; return i; }

function buildUI() {
  // 地圖 x200..W−160
  var cv = R.map = $('map'); box(cv, 200, 0, 'var(--dw) - 360', 720);
  R.mapCtx = cv.getContext('2d');
  R.world = document.createElement('canvas');
  box($('mapMask'), 200, 0, 'var(--dw) - 360', 720);
  $('mapMask').onclick = function () { closePage(); };   // 點地圖露出的部分 = 關閉面板
  bindMapPointer(cv);
  // v2-land.13：卷軸邊（裝飾）。面板左緣外的直卷軸、彈窗上下的卷軸邊，平常藏起來
  R.pageEdge = el('div', 'ab scrolledge', $('app')); R.pageEdge.id = 'pageEdge'; R.pageEdge.hidden = true;
  R.popEdgeT = el('div', 'ab scrolledge popedge', $('app')); R.popEdgeT.id = 'popEdgeT'; R.popEdgeT.hidden = true;
  R.popEdgeB = el('div', 'ab scrolledge popedge', $('app')); R.popEdgeB.id = 'popEdgeB'; R.popEdgeB.hidden = true;
  // v2-land.15（企劃回覆第 3 項）：卷軸邊、左直卷軸算彈窗／面板本體：點了沒反應，不關閉、不穿透到遮罩或地圖
  [R.pageEdge, R.popEdgeT, R.popEdgeB].forEach(function (e) { ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(function (t) { e.addEventListener(t, function (ev) { ev.stopPropagation(); }); }); });
  // 左欄 0..200
  var left = $('left'); box(left, 0, 0, 200, 720); left.style.zIndex = 5;
  R.lordBtn = el('button', 'ab cell', left); box(R.lordBtn, 0, 0, 200, 160); R.lordBtn.id = 'btnLord';
  R.avatar = el('div', 'ab avatar N', R.lordBtn, '?'); box(R.avatar, 38, 18, 124, 124);
  R.lordBtn.onclick = function () { closePage(); openPopup('lord'); };
  [['btnWood', 160, '木', '#9a6a3a', 'wood', 'material'], ['btnFood', 264, '食', '#c8642a', 'food', 'food'], ['btnPop', 368, '人', '#3c7fc0', 'pop', 'pop'], ['btnMineral', 472, '礦', '#6f6f86', 'mineral', 'mineral']].forEach(function (a) {
    var b = el('button', 'ab cell', left); b.id = a[0]; box(b, 0, a[1], 200, 104);
    icon(b, 16, 28, 48, a[2], a[3]);
    R[a[4]] = el('b', 'ab t num f30', b); R[a[4]].style.left = du(76); R[a[4]].id = a[4];
    b.onclick = function () { closePage(); openPopup(a[5]); };
  });
  var g = R.goal = el('button', 'ab cell', left); g.id = 'goal'; box(g, GOAL_X, 576, 200, 144); g.style.borderBottom = '0';   // v2-land.17：整格往右 4 du，左邊卷軸凸出不再被切掉
  var gl = el('span', 'ab f24 glabel', g, '目標'); box(gl, 16, 10);   // v2-land.13：底色改標題帶色，字色交給 CSS（主字 #2D2E25）
  R.goalDot = el('i', 'ab goaldot', g); box(R.goalDot, 164, 12, 24, 24); R.goalDot.id = 'goalDot';
  R.goalName = el('b', 'ab f28 bold', g); box(R.goalName, 16, 46, 180); R.goalName.style.whiteSpace = 'nowrap'; R.goalName.id = 'goalName';
  R.goalBar = el('div', 'ab bar', g); box(R.goalBar, 16, 102, 112, 18); R.goalFill = el('i', '', R.goalBar);
  R.goalProg = el('span', 'ab f24', g); box(R.goalProg, 136, 92, 64, 38); R.goalProg.style.display = 'flex'; R.goalProg.style.alignItems = 'center'; R.goalProg.style.whiteSpace = 'nowrap'; R.goalProg.id = 'goalProg';
  // v2-land.15（企劃回覆第 1 項）：8 du 木框的上下邊改成 12 du 高木條，左右各凸出 4 du，兩端半圓（只是外觀，不吃點擊）
  R.goalRollT = el('i', 'ab goalroll', g); box(R.goalRollT, -4, 0, 208, 12); R.goalRollT.id = 'goalRollT';
  R.goalRollB = el('i', 'ab goalroll', g); box(R.goalRollB, -4, 132, 208, 12); R.goalRollB.id = 'goalRollB';
  // 企劃回覆第 5 項：按下時整格亮度 ×0.9，放開恢復（iOS 的 :active 不一定會亮，所以自己加 class）
  var unpress = function () { g.classList.remove('press'); };
  g.addEventListener('pointerdown', function () { if (!goalStatus().all) g.classList.add('press'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { g.addEventListener(t, unpress); });
  g.onclick = function () { if (goalStatus().all) return; closePage(); openPopup('goal'); };
  // 右欄 W−160..W
  var right = $('right'); box(right, 'var(--dw) - 160', 0, 160, 720); right.style.zIndex = 5; right.style.background = 'var(--side)';
  var tc = el('div', 'ab timecell', right); box(tc, 0, 0, 160, 112); tc.id = 'timeCell';
  R.hour = el('div', 'ab f32 bold', tc); box(R.hour, 0, 8, 160, 52); R.hour.style.textAlign = 'center'; R.hour.style.lineHeight = du(52); R.hour.id = 'hour';
  R.sun = icon(tc, 62, 64, 36, '日', '#e8a52a'); R.sun.id = 'sunIcon';
  function side(id, y, ch, col, label, fn) {
    var b = el('button', 'ab sidebtn', right); b.id = id; box(b, 0, y, 160, 152);
    var f = el('div', 'ab frame', b); box(f, 8, 8, 144, 136);
    icon(b, 48, 24, 64, ch, col);
    var l = el('span', 'ab f28 bold', b, label); box(l, 0, 92, 160, 40); l.style.textAlign = 'center'; l.style.lineHeight = du(40);
    b.onclick = fn; return b;
  }
  R.bEvents = side('btnEvents', 112, '事', '#8a5ab0', '事件', function () { closePage(); openPopup('events'); });
  R.bBuild = side('btnBuild', 264, '建', '#3f8a3a', '建造', function () { closePage(); openPopup('build'); });
  R.bHome = side('btnHome', 416, '營', '#e8742a', '回營地', function () { closePage(); goHome(); });
  R.bCouncil = side('btnCouncil', 568, '政', '#b8402f', '內政', function () { if (ui.page === 'council') closePage(); else { closePage(); openPage('council'); } });
  R.badge = el('span', 'ab badge f24', R.bCouncil); box(R.badge, 108, 2, 40, 40); R.badge.id = 'badgeCouncil'; R.badge.hidden = true;
  R.badge.style.minWidth = du(40); R.badge.style.width = 'auto'; R.badge.style.padding = '0 ' + du(6);
  // 遮罩、彈窗
  $('mask').onclick = function () { if (ui.popup && !ui.popup.confirm) closePopup(); };   // 點遮罩 = 點關閉鈕；確認框例外
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (ui.popup && !ui.popup.confirm) closePopup(); else if (ui.page) closePage(); } });
  sizeMap();
}

// ===== 地圖：尺寸、鏡頭（§3.2）=====
var WORLD_W = CONFIG.map.cols * CONFIG.map.tile, WORLD_H = CONFIG.map.rows * CONFIG.map.tile;
var FIRE = { x: (CONFIG.map.campfire[0] + 0.5) * CONFIG.map.tile, y: (CONFIG.map.campfire[1] + 0.5) * CONFIG.map.tile };   // (816,624)
function sizeMap() {
  var cv = R.map, w = Math.max(1, Math.round(mapWdu() * U * DPR)), h = Math.max(1, Math.round(720 * U * DPR));
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  camDirty = true;
}
function camClamp(x, y) { return { x: Math.max(0, Math.min(WORLD_W - mapWdu(), x)), y: Math.max(0, Math.min(WORLD_H - 720, y)) }; }
function homeCam() { return camClamp(FIRE.x - mapWdu() / 2, FIRE.y - 360); }
function atHome() { var h = homeCam(), t = CONFIG.map.homeTolDu; return Math.abs(cam.x - h.x) <= t && Math.abs(cam.y - h.y) <= t; }
function setCam(x, y) {
  var c = camClamp(x, y);
  if (c.x !== cam.x || c.y !== cam.y) { cam.x = c.x; cam.y = c.y; camDirty = true; }
  if (R.bHome) setDis(R.bHome, atHome());
  R.map.setAttribute('data-cam', Math.round(cam.x) + ',' + Math.round(cam.y));
}
function goHome() { var h = homeCam(); setCam(h.x, h.y); }

// ===== 地圖：靜態圖層（地形＋建築；有變動才重畫）=====
var GRASS = '#C8CEB3';   // v2-land.10（ui-landscape-v2 §3.2）：草地不出圖，程式畫純色；森林底色也是草地色
var TERRAIN = { '.': [GRASS, '草地'], F: [GRASS, '森林'], A: ['#b9905a', '農地'], G: ['#a8c97a', '牧草地'], H: ['#6f9a52', '獵場'], M: ['#9a948a', '石坡'], W: ['#5aa9e6', '河'] };
function hash2(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }
function fontDu(sizeDu, minPx) { return Math.max(sizeDu, minPx / U) + 'px ' + FONT; }   // v2-land.12：芫荽只有 Regular，畫布字也不加粗（原本的第 3 個參數 bold 不再用）
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
var worldK = 1;
// ===== 美術圖（v2-land.5）：TL_ASSETS 有這個名字的圖就畫圖；沒有、或還沒解碼完，就畫原本的色塊 =====
// 圖在載入時解碼一次（data URL → Image），onload 之後才拿來畫，之前照樣畫色塊；載好時重畫地圖。
// 規格（1 du = 2 px）：地形 ter_* 96×96 du（ter_farm ter_pasture ter_hunt ter_stone ter_river_00..15）；樹 obj_tree_0..2 64×80；建築 bld_<建築 id> 96×120（圖的底邊＝格子底邊）；議事廳 bld_council 112×136（水平置中，左右各凸出 8）；
// 居民 ppl_<職業>_<m|f> 28×56（腳底在底邊中央；職業：lumber hunt fish farm herd stock mine idle soldier hero）；營火 fire_0..fire_5 96×96（動畫）。
// v2-land.19：英雄帽 ppl_hero_hat 28×56（和居民同錨點，疊在英雄上）；工具泡泡 bubble_tool_<farm|fish|herd|hunt|lumber|mine|stock> 36×36。
// v2-land.22：空格位四角白色小方塊恢復；4 個字的建築名稱縮小字到放得進格子裡；人口彈窗加「收留流浪者」。
// v2-land.20：河一格寬；英雄有頭飾就不寫「英」；職業字在頭頂上（碰到泡泡改腳下）；議事廳、軍營不閃名稱；點出來的名稱在格子下緣；拿掉空格位白色小方塊。
var ART = {}, ART_JOB = { pasture: 'herd', livestock: 'stock' };
// v2-land.8（設計確認的檔名）：地形 ter_farm／ter_pasture／ter_hunt／ter_stone；河 ter_river_00..15（autotile，見 riverMask）；
// 草地沒有圖（程式畫純色）；森林＝草地＋樹物件 obj_tree_0..2（64×80 du，樹幹底部中央對齊；擺放之後再做，現在只認名稱）。
var TER_ART = { A: 'ter_farm', G: 'ter_pasture', H: 'ter_hunt', M: 'ter_stone' };
var TREE_ART = ['obj_tree_0', 'obj_tree_1', 'obj_tree_2'];
// 河的遮罩：上 1＋右 2＋下 4＋左 8，那一邊也是水才加；地圖外面算不是水
function isWater(c, r) { var M = CONFIG.map; return r >= 0 && r < M.rows && c >= 0 && c < M.cols && M.grid[r].charAt(c) === 'W'; }
function riverMask(c, r) { return (isWater(c, r - 1) ? 1 : 0) + (isWater(c + 1, r) ? 2 : 0) + (isWater(c, r + 1) ? 4 : 0) + (isWater(c - 1, r) ? 8 : 0); }
function terArt(k, c, r) { if (k === 'W') { var m = riverMask(c, r); return 'ter_river_' + (m < 10 ? '0' : '') + m; } return TER_ART[k] || ''; }
(function () {
  var A = typeof TL_ASSETS === 'object' && TL_ASSETS ? TL_ASSETS : {};
  Object.keys(A).forEach(function (name) {
    var img = new Image();
    img.onload = function () { if (img.naturalWidth > 0) { ART[name] = img; worldDirty = true; camDirty = true; } };
    img.onerror = function () { if (window.console) console.warn('美術圖載入失敗：' + name); };
    img.src = A[name];
  });
})();
// 有圖就畫圖並回傳 true；沒有就回傳 false（呼叫的地方畫色塊）
function spr(g, name, x, y, w, h) { var img = ART[name]; if (!img) return false; g.drawImage(img, x, y, w, h); return true; }
function fireFrames() { var n = 0; while (n < 6 && ART['fire_' + n]) n++; return n; }
// 地形名稱：每種地形第一次出現的格子左上角（BUG-02：人物排位置也要避開這些字）
function terrainLabels() {
  var M = CONFIG.map, T = M.tile, seen = {}, out = [], g = R.mapCtx, f = fontDu(26, 12), sz = parseFloat(f);
  for (var r = 0; r < M.rows; r++) for (var c = 0; c < M.cols; c++) { var k = M.grid[r].charAt(c); if (k !== '.' && !seen[k]) { seen[k] = 1; out.push({ s: TERRAIN[k][1], x: c * T + 8, y: r * T + 6 }); } }
  g.save(); g.font = f;
  out.forEach(function (l) { var w = g.measureText(l.s).width; l.x0 = l.x - 2; l.x1 = l.x + w + 2; l.y0 = l.y - 2; l.y1 = l.y + sz + 2; });
  g.restore();
  return out;
}
// 佔位地形格：中間 80×80 實色，四周 8 du 由實色漸淡到透明（四邊線性漸層、四角放射漸層），疊在草地上
var SOFT = 8;
function softTile(g, x, y, col) {
  var T = CONFIG.map.tile, E = SOFT, rgb = col.replace('#', ''), cr = parseInt(rgb.slice(0, 2), 16), cg = parseInt(rgb.slice(2, 4), 16), cb = parseInt(rgb.slice(4, 6), 16);
  var c1 = 'rgba(' + cr + ',' + cg + ',' + cb + ',1)', c0 = 'rgba(' + cr + ',' + cg + ',' + cb + ',0)';
  g.fillStyle = col; g.fillRect(x + E, y + E, T - 2 * E, T - 2 * E);
  function lin(x0, y0, x1, y1, rx, ry, rw, rh) { var gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); }
  lin(x + E, 0, x, 0, x, y + E, E, T - 2 * E);                 // 左
  lin(x + T - E, 0, x + T, 0, x + T - E, y + E, E, T - 2 * E); // 右
  lin(0, y + E, 0, y, x + E, y, T - 2 * E, E);                 // 上
  lin(0, y + T - E, 0, y + T, x + E, y + T - E, T - 2 * E, E); // 下
  [[x + E, y + E, x, y], [x + T - E, y + E, x + T - E, y], [x + E, y + T - E, x, y + T - E], [x + T - E, y + T - E, x + T - E, y + T - E]].forEach(function (q) {
    var gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], E); gr.addColorStop(0, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(q[2], q[3], E, E);
  });
}
// 樹（v2-land.10）：森林格每格 2–3 棵，位置用格子座標當種子（hash2），每次載入都一樣。樹是物件：64×80 du，對齊點＝樹幹底部（畫布底邊中點）。
// 樹跟建築、營火、居民一起依腳底 y 排序（動態層），有程式畫的腳下影子，晚上跟著變暗。
// 位置規則：腳底在格子裡（x 16..80、y 40..92），兩棵至少相距 30 du；整棵樹（±32 × 80）不碰任何建築格位（含還沒蓋的），也不蓋地形名稱。
var TREES = null;
function treeList() {
  if (TREES) return TREES;
  var M = CONFIG.map, T = M.tile, out = [], slots = [], seen = {}, tl = [];
  // 地形名稱的位置用固定的 26 du 字寬估（不跟畫面大小變），這樣大小螢幕的樹位置都一樣
  for (var lr = 0; lr < M.rows; lr++) for (var lc = 0; lc < M.cols; lc++) { var lk = M.grid[lr].charAt(lc); if (lk !== '.' && !seen[lk]) { seen[lk] = 1; tl.push({ x0: lc * T + 6, y0: lr * T + 4, x1: lc * T + 10 + TERRAIN[lk][1].length * 26, y1: lr * T + 36 }); } }
  CONFIG.buildings.forEach(function (b) { b.tiles.forEach(function (t) { slots.push([t[0] * T, t[1] * T, t[0] * T + T, t[1] * T + T]); }); });
  function hitAny(x0, y0, x1, y1, list) { return list.some(function (q) { return x1 > q[0] && x0 < q[2] && y1 > q[1] && y0 < q[3]; }); }
  for (var r = 0; r < M.rows; r++) for (var c = 0; c < M.cols; c++) {
    if (M.grid[r].charAt(c) !== 'F') continue;
    var want = 2 + hash2(c * 31 + 7, r * 17 + 3) % 2, mine = [];
    for (var tries = 0; tries < 24 && mine.length < want; tries++) {
      var h = hash2(c * 131 + tries * 7919, r * 977 + tries * 104729);
      var x = c * T + 16 + h % 65, y = r * T + 40 + (h >>> 8) % 53;
      if (hitAny(x - 32, y - 80, x + 32, y, slots)) continue;
      if (hitAny(x - 32, y - 80, x + 32, y, tl.map(function (l) { return [l.x0, l.y0, l.x1, l.y1]; }))) continue;
      if (mine.concat(out).some(function (o) { return Math.abs(o.x - x) < 30 && Math.abs(o.y - y) < 30; })) continue;
      mine.push({ x: x, y: y, v: (h >>> 20) % 3, c: c, r: r });
    }
    out = out.concat(mine);
  }
  TREES = out;
  return out;
}
var TREE_COL = [['#4f7a4a', '#6a9660'], ['#3f6e48', '#5c8a58'], ['#5d8550', '#7aa266']];
function drawTree(g, o) {
  var x = o.x, y = o.y;
  if (spr(g, 'obj_tree_' + o.v, x - 32, y - 80, 64, 80)) return;
  // 佔位：64×80 畫布內，樹幹 10×28（底部在對齊點），樹冠 3 個圓（三種樹形狀、顏色略不同）
  g.fillStyle = '#6b4a2e'; g.fillRect(x - 5, y - 28, 10, 28);
  var cc = TREE_COL[o.v]; g.fillStyle = cc[0];
  g.beginPath();
  if (o.v === 0) { g.arc(x, y - 52, 24, 0, 7); }
  else if (o.v === 1) { g.moveTo(x, y - 80); g.lineTo(x + 26, y - 26); g.lineTo(x - 26, y - 26); g.closePath(); }
  else { g.arc(x - 12, y - 46, 18, 0, 7); g.arc(x + 12, y - 46, 18, 0, 7); g.arc(x, y - 62, 18, 0, 7); }
  g.fill();
  g.fillStyle = cc[1]; g.beginPath(); g.arc(x - 7, y - (o.v === 1 ? 46 : 58), 7, 0, 7); g.fill();
}
function drawWorld() {
  var M = CONFIG.map, T = M.tile;
  worldK = Math.min(2, U * DPR);
  var cw = Math.ceil(WORLD_W * worldK), ch = Math.ceil(WORLD_H * worldK);
  if (R.world.width !== cw) R.world.width = cw;
  if (R.world.height !== ch) R.world.height = ch;
  var g = R.world.getContext('2d');
  g.setTransform(worldK, 0, 0, worldK, 0, 0);
  var r, c, k, seen = {};
  // v2-land.10（§3.2、art-v2 第 3 項）：先整張鋪草地色（森林格也是，樹是動態層的物件，見 TREES）
  g.fillStyle = GRASS; g.fillRect(0, 0, WORLD_W, WORLD_H);
  for (r = 0; r < M.rows; r++) for (c = 0; c < M.cols; c++) {
    k = M.grid[r].charAt(c);
    if (k === '.' || k === 'F') continue;
    var x = c * T, y = r * T;
    if (k === 'W') {   // 河：有 ter_river_<遮罩> 圖就直接疊在草地上；沒有圖才鋪水色色塊
      // v2-land.19：正式河圖自己畫了水面和河岸，河岸外面是透明的（畫師的場景圖是畫在草地上），先鋪水色會在河岸外露出藍色方角
      if (!spr(g, terArt(k, c, r), x, y, T + 0.5, T + 0.5)) { g.fillStyle = TERRAIN.W[0]; g.fillRect(x, y, T + 0.5, T + 0.5); g.fillStyle = 'rgba(255,255,255,.35)'; var hw = hash2(c, r); g.fillRect(x + 12 + hw % 40, y + 30 + (hw >>> 8) % 30, 30, 4); }
      continue;
    }
    // 農地／牧草地／獵場／石坡：有圖就疊圖（圖自帶 8 du 柔邊）；沒有圖畫佔位：四周 8 du 柔邊的色塊疊在草地上
    if (spr(g, terArt(k, c, r), x, y, T, T)) continue;
    softTile(g, x, y, TERRAIN[k][0]);
    if (k === 'M') { g.fillStyle = '#7d776e'; var hm = hash2(c, r); g.beginPath(); g.arc(x + 30 + hm % 30, y + 40 + (hm >>> 8) % 30, 14, 0, 7); g.fill(); }
    else if (k === 'A') { g.fillStyle = 'rgba(80,50,20,.25)'; for (var j = 0; j < 4; j++) g.fillRect(x + 12, y + 14 + j * 22, T - 24, 4); }
  }
  // 地形名稱（佔位要看得出是什麼）
  g.textBaseline = 'top'; g.font = fontDu(26, 12);
  terrainLabels().forEach(function (l) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(l.s, l.x, l.y); });
  // 空格位：四角記號（v2-land.22 恢復；v2-land.20 拿掉過）。蓋好的建築、營火在動態層和人物一起依腳底 y 排序（v2-land.6）
  g.fillStyle = 'rgba(255,255,255,.3)';
  CONFIG.buildings.forEach(function (b) {
    b.tiles.forEach(function (t, i) {
      if (i < state.built[b.id]) return;
      var x = t[0] * T + 8, y = t[1] * T + 8;
      [[0, 0], [68, 0], [0, 68], [68, 68]].forEach(function (o) { g.fillRect(x + o[0], y + o[1], 12, 12); });
    });
  });
  g.textBaseline = 'alphabetic';
}

// ===== 地圖：人物、泡泡、浮動數字、晝夜（動態層，每格畫）=====
function tileCenter(t) { var T = CONFIG.map.tile; return { x: (t[0] + 0.5) * T, y: (t[1] + 0.5) * T }; }
function instTile(bid, i) { var ts = BLD[bid].tiles; return ts[Math.min(i, ts.length - 1)]; }
function personAnchor(p) {
  if (p.job === 'soldier') return tileCenter(BLD.barracks.tiles[0]);
  if (p.job) return tileCenter(instTile(JOB[p.job].bld, Math.max(0, p.bld)));
  return FIRE;   // 閒置、英雄：營火周圍
}
// 人物站位（v2-land.2）：全地圖切成 40×96 du 的小格，每格最多一人。
// 人物圖的範圍是腳底往上 64、左右各 15（英雄旗子到 18），英雄旗子頂到 82，所以不同格的人不會重疊。
// 不站在已蓋好的建築方塊、營火石圈、生產建築的泡泡位置上（建築名稱不會被擋）。每群人（同一座建築的工人、
// 營火旁的閒置＋英雄）照 id 排序，依序拿離中心最近的空格。另加每人固定的小偏移（±3 du）。
var PCELL_W = 40, PCELL_H = 96;
var personPos = {}, personPosKey = '';
function hash01(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function layoutPeople() {
  var key = state.people.map(function (p) { return p.id + ':' + (p.job || '') + ':' + (p.bld || 0); }).join(',') + '|' + JSON.stringify(state.built) + '|' + U + '|' + Object.keys(ART).length;   // v2-land.20：圖載入完要重排（有圖建築的名稱不常駐 → 泡泡位置會變）
  if (key === personPosKey) return;
  personPosKey = key; personPos = {};
  var T = CONFIG.map.tile, blocks = [], bubbleBlocks = [];
  CONFIG.buildings.forEach(function (b) {
    for (var i = 0; i < Math.min(state.built[b.id], b.tiles.length); i++) blocks.push([b.tiles[i][0] * T + 2, b.tiles[i][1] * T + 2, b.tiles[i][0] * T + 96, b.tiles[i][1] * T + 98]);
  });
  blocks.push([FIRE.x - 52, FIRE.y - 48, FIRE.x + 52, FIRE.y + 56]);
  terrainLabels().forEach(function (l) { blocks.push([l.x0, l.y0, l.x1, l.y1]); });   // BUG-02：不站在地形名稱上
  treeList().forEach(function (tr) { blocks.push([tr.x - 6, tr.y - 28, tr.x + 6, tr.y]); });   // v2-land.10：不站在樹幹上（樹冠前後交給 y 排序）
  var lbox = labelBoxes();
  CONFIG.jobs.forEach(function (j) {   // 生產建築上方的狀態泡泡位置也不站人（泡泡才不會蓋住人；泡泡往右移過的話照移過的位置）
    var b = BLD[j.bld];
    for (var i = 0; i < Math.min(state.built[b.id], b.tiles.length); i++) {
      var a = bubbleAnchor(b.tiles[i]), sb = shiftBubbles([{ x0: a.x, y: a.y }], lbox)[0], q = bubbleBox(sb.x, sb.y);   // v2-land.9：新位置（格子右上角）
      blocks.push([q.x0 - 2, q.y0, q.x1 + 2, q.y1]); bubbleBlocks.push(q);
    }
  });
  var cols = Math.floor(WORLD_W / PCELL_W), rows = Math.floor(WORLD_H / PCELL_H), cells = [];
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
    var x = c * PCELL_W + PCELL_W / 2, y = r * PCELL_H + PCELL_H - 8;   // y＝腳底
    if (y - 72 < 0 || x - 20 < 0 || x + 20 > WORLD_W) continue;
    var bx0 = x - 19, bx1 = x + 19, by0 = y - 70, by1 = y + 6, hit = false;
    for (var k = 0; k < blocks.length && !hit; k++) { var q = blocks[k]; hit = bx1 > q[0] && bx0 < q[2] && by1 > q[1] && by0 < q[3]; }
    if (!hit) cells.push({ x: x, y: y, used: false });
  }
  var groups = {}, order = [];
  state.people.forEach(function (p) {
    var gk = p.job === 'soldier' ? 'soldier' : p.job ? p.job + '#' + Math.max(0, p.bld || 0) : 'fire';
    if (!groups[gk]) { groups[gk] = []; order.push(gk); }
    groups[gk].push(p);
  });
  order.sort(function (a, b) { return groups[a].length - groups[b].length || (a < b ? -1 : 1); });   // 人少的建築先挑，靠得近
  order.forEach(function (gk) {
    var list = groups[gk].slice().sort(function (a, b) { return a.id - b.id; }), a = personAnchor(list[0]);
    var ay = a.y + 30;
    var cand = cells.filter(function (c) { return !c.used; }).sort(function (p, q) {
      var dp = (p.x - a.x) * (p.x - a.x) + (p.y - ay) * (p.y - ay) * 1.4, dq = (q.x - a.x) * (q.x - a.x) + (q.y - ay) * (q.y - ay) * 1.4;
      return dp - dq || p.y - q.y || p.x - q.x;
    });
    list.forEach(function (p, i) {
      var c = cand[i]; if (!c) { personPos[p.id] = { x: a.x, y: ay }; return; }   // 全地圖都滿了（實際不會發生）
      c.used = true;
      personPos[p.id] = { x: c.x + (hash01(p.id) - 0.5) * 6, y: c.y + (hash01(p.id + 0.5) - 0.5) * 4 };
    });
  });
  // v2-land.20：頭頂上的職業字（多留 2 du，人物會上下動 1 du）碰到任何泡泡的方框 → 這個人的字改寫在腳下
  state.people.forEach(function (p) {
    var q = personPos[p.id]; if (!q) return;
    var my = q.y - 45 + MARK_UP, mb = { x0: q.x - MARK_HALF - 2, x1: q.x + MARK_HALF + 2, y0: my - MARK_HALF - 2, y1: my + MARK_HALF + 2 };
    q.low = bubbleBlocks.some(function (b) { return boxHit(mb, b); });
  });
}
function personXY(p) { layoutPeople(); return personPos[p.id] || personAnchor(p); }
// v2-land.6：建築、營火、人物一起依「腳底 y」排序再畫（建築＝格子底邊、營火＝格子底邊、人物＝腳底）。
// 同一個 y：建築 → 營火 → 人物，再依 x。站位演算法不變。影子（腳下淡橢圓，墨色 #2D2E25 15%）先全部畫在地上，再畫本體；
// 有美術圖時，圖只取代色塊，影子照樣由程式畫（圖裡不畫影子）。沒有往右下的投影。
var SHADOW_COL = 'rgba(45,46,37,.15)';
var NIGHT = { tint: '#3E4D5F', tintA: 0.35, glow: 'rgb(255,170,70)', glowA: 0.35, glowR: 220 };   // v2-land.7 夜色
var drawnDbg = [], shadowDbg = { bld: 0, ppl: 0, tree: 0 };   // 測試用：這一格畫面實際畫了哪些東西、順序
function mapItems() {
  var T = CONFIG.map.tile, out = [];
  CONFIG.buildings.forEach(function (b) {
    var n = Math.min(state.built[b.id], b.tiles.length);
    for (var i = 0; i < n; i++) { var t = b.tiles[i]; out.push({ k: 0, kind: 'bld', b: b, i: i, t: t, x: (t[0] + 0.5) * T, y: (t[1] + 1) * T }); }
  });
  out.push({ k: 1, kind: 'fire', x: FIRE.x, y: FIRE.y + T / 2 });
  treeList().forEach(function (tr, n) { out.push({ k: 0, kind: 'tree', tr: tr, id: n, x: tr.x, y: tr.y }); });   // v2-land.10：樹（同 y 時跟建築同一級，排在人物前面）
  layoutPeople();
  state.people.forEach(function (p) { var pp = personPos[p.id] || personAnchor(p); out.push({ k: 2, kind: 'ppl', p: p, x: pp.x, y: pp.y }); });
  out.forEach(function (o, n) { o.n = n; });
  out.sort(function (a, b) { return a.y - b.y || a.k - b.k || a.x - b.x || a.n - b.n; });
  return out;
}
function itemVisible(o) { return o.x > cam.x - 80 && o.x < cam.x + mapWdu() + 80 && o.y > cam.y - 20 && o.y < cam.y + 720 + 160; }
function drawShadows(g, items) {
  g.fillStyle = SHADOW_COL; shadowDbg = { bld: 0, ppl: 0, tree: 0 };
  items.forEach(function (o) {
    if (o.kind === 'fire' || !itemVisible(o)) return;
    g.beginPath();
    if (o.kind === 'bld') { g.ellipse(o.x, o.y - 8, o.b.id === 'council' ? 50 : 44, 9, 0, 0, 7); shadowDbg.bld++; }   // 建築底部＝格子底邊往上 8 du
    else if (o.kind === 'tree') { g.ellipse(o.x, o.y, 20, 6, 0, 0, 7); shadowDbg.tree++; }   // 樹：樹幹底部的淡橢圓 40×12 du
    else { g.ellipse(o.x, o.y + 1, 13, 4.5, 0, 0, 7); shadowDbg.ppl++; }
    g.fill();
  });
}
function drawBld(g, o) {
  var T = CONFIG.map.tile, b = o.b, t = o.t, x = t[0] * T + 8, y = t[1] * T + 8;
  if (!(b.id === 'council' ? spr(g, 'bld_council', t[0] * T - 8, (t[1] + 1) * T - 136, 112, 136) : spr(g, 'bld_' + b.id, t[0] * T, (t[1] + 1) * T - 120, 96, 120))) {
    // 佔位：80×80，格子內縮 8，圓角 14，類別色＋白字（v2-land.6 拿掉往右下的影子）
    g.fillStyle = CAT_COL[BLD_CAT[b.id]]; rrect(g, x, y, 80, 80, 14); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fontDu(26, 13);
    var nm = b.name;
    if (nm.length > 3) { g.fillText(nm.slice(0, 2), x + 40, y + 24); g.fillText(nm.slice(2), x + 56 - 16, y + 56); }
    else g.fillText(nm, x + 40, y + 40);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  var n = state.built[b.id];
  if (n > b.tiles.length && o.i === b.tiles.length - 1) {   // 超過格位數：最後一格標 ×N
    g.font = fontDu(26, 13); g.textBaseline = 'alphabetic'; g.lineWidth = 6; g.strokeStyle = '#2e1f15'; g.fillStyle = '#fff';
    g.strokeText('×' + n, t[0] * T + 58, t[1] * T + 92); g.fillText('×' + n, t[0] * T + 58, t[1] * T + 92);
  }
}
// 營火：有 fire_0..5 圖就播動畫（8 fps，一輪 0.75 秒，0→5 再接回 0，不來回播）；沒有就畫石圈＋橘色圓形＋白字
var FIRE_FPS = 8;
function drawFire(g, t) {
  var nfr = fireFrames();
  if (nfr) { spr(g, 'fire_' + (Math.floor(t * FIRE_FPS / 1000) % nfr), FIRE.x - 48, FIRE.y - 48, 96, 96); return; }
  g.fillStyle = '#7d776e'; g.beginPath(); g.arc(FIRE.x, FIRE.y + 6, 46, 0, 7); g.fill();
  var fl = Math.sin(t * 0.012) * 3 + Math.sin(t * 0.031) * 2;
  g.fillStyle = '#e8742a'; g.beginPath(); g.arc(FIRE.x, FIRE.y, 38 + fl, 0, 7); g.fill();
  g.fillStyle = '#ffb84a'; g.beginPath(); g.arc(FIRE.x, FIRE.y - 4, 24 + fl * 0.6, 0, 7); g.fill();
  // v2-land.15：「營火」名稱不再壓在火上，改在 drawBldLabels 畫（fireLabel）
}
function drawPerson(g, p, x, y) {
  var kind = p.type === 'hero' ? 'hero' : p.job === 'soldier' ? 'soldier' : p.job || 'idle';
  var ak = ART_JOB[kind] || kind;
  var ch = kind === 'hero' ? '英' : kind === 'soldier' ? '兵' : kind === 'idle' ? '閒' : JOB_CH[kind];
  // v2-land.17（企劃回覆 v2-land.16 第 4 項）：有正式圖的居民也寫職業字，位置、字級、顏色跟佔位小人一樣（圖不縮放）
  // v2-land.19：英雄沒有自己的身體圖（英雄不能派工），用閒置居民的圖，上面再疊 ppl_hero_hat（同一個錨點、同尺寸）
  var sx = p.sex === 'M' ? 'm' : 'f';
  if (spr(g, 'ppl_' + ak + '_' + sx, x - 14, y - 56, 28, 56) || spr(g, 'ppl_' + ak, x - 14, y - 56, 28, 56) || (kind === 'hero' && spr(g, 'ppl_idle_' + sx, x - 14, y - 56, 28, 56))) {
    // v2-land.20（企劃回覆 v2-land.19 第 3 項）：英雄有頭飾圖就不寫「英」（頭飾就是記號）；其他人的職業字移到頭頂上面（MARK_UP），
    // 那個位置會碰到泡泡的人改寫在腳下（MARK_LOW，見 layoutPeople 的 low）
    if (kind === 'hero' && spr(g, 'ppl_hero_hat', x - 14, y - 56, 28, 56)) return;
    var pp = personPos[p.id];
    jobMark(g, ch, x, y + (pp && pp.low ? MARK_LOW : MARK_UP)); return;
  }
  g.fillStyle = JOB_COL[kind]; rrect(g, x - 14, y - 34, 28, 34, 12); g.fill();
  g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(x, y - 46, 15, 0, 7); g.fill();
  if (kind === 'hero') { g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(x + 6, y - 58); g.lineTo(x + 18, y - 82); g.lineTo(x + 12, y - 56); g.fill(); }
  jobMark(g, ch, x, y);
}
// 職業字（字級 22 du，置中）：佔位小人寫在頭上（腳底往上 45，照舊）。正式圖：字的中心在腳底往上 69（字底在圖頂 y−56 上面 2 du），
// 或腳底往下 14（字頂在影子下面）。jobMark 的 dy 是相對佔位位置（y − 45）的位移
var MARK_UP = -24, MARK_LOW = 59, MARK_HALF = 11;
function jobMark(g, ch, x, y) {
  g.fillStyle = '#2e1f15'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fontDu(22, 11); g.fillText(ch, x, y - 45);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function drawSorted(g, t) {
  var items = mapItems();
  drawShadows(g, items); drawOrder.push('shadows');
  drawnDbg = [];
  items.forEach(function (o) {
    if (!itemVisible(o)) return;
    if (o.kind === 'bld') { drawBld(g, o); drawnDbg.push({ kind: 'bld', id: o.b.id + '#' + o.i, x: o.x, y: o.y }); }
    else if (o.kind === 'fire') { drawFire(g, t); drawnDbg.push({ kind: 'fire', id: 'fire', x: o.x, y: o.y }); }
    else if (o.kind === 'tree') { drawTree(g, o.tr); drawnDbg.push({ kind: 'tree', id: 'tree' + o.id, x: o.x, y: o.y }); }
    else { drawPerson(g, o.p, o.x, o.y + Math.sin(t * 0.002 + o.p.id) * 1); drawnDbg.push({ kind: 'ppl', id: o.p.id, x: o.x, y: o.y }); }   // 原地輕輕上下動（±1 du），排序用不動的腳底
  });
  drawOrder.push('people');
}
// 建築名稱：每一行字的位置和方框（世界 du）。名稱畫在人物和泡泡的上面（v2-land.3）
var LABEL_FONT = function () { return fontDu(26, 13); };
// v2-land.17（美術決定第 4 項）：有正式建築圖（bld_<代碼>，議事廳 bld_council）的建築，名稱不常駐；點一下在建築上方顯示 2 秒。
// 佔位建築照舊常駐。有圖建築的泡泡不再往上躲名稱（停在原位），點出來的名稱也不推別人的泡泡。
var NAME_FLASH_MS = 2000, nameFlash = null;   // { id, i, until }（performance.now 毫秒）
function bldHasArt(id) { return !!ART[id === 'council' ? 'bld_council' : 'bld_' + id]; }
// v2-land.20（企劃回覆 v2-land.19 第 6 項）：點出來的名稱改在建築格的下緣，蓋在建築圖的底部（不再往上蓋到人）：
// 一行，字（26 du）的中心在格子下緣往上 18 du → 字在格子下緣往上 31～5 du，加描邊 3 du 也還在格子裡
var FLASH_BOTTOM_UP = 18;
function flashLabelY(id, ty) { return ty + CONFIG.map.tile - FLASH_BOTTOM_UP; }
function labelBoxes() {
  var T = CONFIG.map.tile, g = R.mapCtx, out = [], f = LABEL_FONT(), sz = parseFloat(f);
  g.save(); g.font = f;
  CONFIG.buildings.forEach(function (b) {
    var art = bldHasArt(b.id);
    for (var i = 0; i < Math.min(state.built[b.id], b.tiles.length); i++) {
      var x = b.tiles[i][0] * T + 48, y = b.tiles[i][1] * T + 8, nm = b.name;
      if (art && !(nameFlash && nameFlash.id === b.id && nameFlash.i === i && performance.now() < nameFlash.until)) continue;
      var lines = art ? [[nm, flashLabelY(b.id, b.tiles[i][1] * T)]] : nm.length > 3 ? [[nm.slice(0, 2), y + 24], [nm.slice(2), y + 56]] : [[nm, y + 40]];
      lines.forEach(function (l) {
        var w = g.measureText(l[0]).width, lf = null, lsz = sz;
        if (l[0].length >= 4 && w + LABEL_STROKE > T - NAME_FIT_PAD * 2) {   // v2-land.22：4 個字的名稱（居民住所）縮小字，連描邊放進格子裡（左右各留 NAME_FIT_PAD）
          lsz = sz * (T - NAME_FIT_PAD * 2 - LABEL_STROKE) / w; lf = lsz + 'px ' + FONT;
          g.font = lf; w = g.measureText(l[0]).width; g.font = f;
        }
        out.push({ bld: b.id, i: i, art: art, s: l[0], f: lf, x: x, y: l[1], x0: x - w / 2 - 2, x1: x + w / 2 + 2, y0: l[1] - lsz / 2 - 2, y1: l[1] + lsz / 2 + 2 });
      });
    }
  });
  g.restore();
  return out;
}
// v2-land.15（企劃回覆：地圖名稱描邊加寬 1 du）：canvas 描邊一半在字外，lineWidth 4 → 6 = 字外的邊 2 → 3 du。名稱方框（泡泡避讓用）不變
var LABEL_STROKE = 6, NAME_FIT_PAD = 2;
// v2-land.15：「營火」名稱移到營火格下緣，字頂在橘色火（半徑最大 43 du）下面，跟建築名稱同樣式、一起畫在最上層
// v2-land.17（企劃回覆 v2-land.16）：「營火」放在營火格裡、貼格子下緣、水平置中，不跨進下面的軍營格；
// 底下墊 #2D2E25 80% 的圓角小牌，白字不描邊。只有營火這樣做。小牌：字寬＋左右各 8、高 34、圓角 10，牌底在格子下緣往上 2 du
var FIRE_PLATE = { padX: 8, h: 34, r: 10, gap: 2, col: 'rgba(45,46,37,.8)' };
function fireLabel() {
  var T = CONFIG.map.tile, bottom = (Math.floor(FIRE.y / T) + 1) * T, g = R.mapCtx;
  g.save(); g.font = LABEL_FONT(); var w = g.measureText('營火').width; g.restore();
  var y1 = bottom - FIRE_PLATE.gap, y0 = y1 - FIRE_PLATE.h;
  return { s: '營火', x: FIRE.x, y: (y0 + y1) / 2, plate: { x0: FIRE.x - w / 2 - FIRE_PLATE.padX, x1: FIRE.x + w / 2 + FIRE_PLATE.padX, y0: y0, y1: y1 } };
}
var drawOrder = [];   // 測試用：這一格畫面的圖層順序
function drawBldLabels(g, boxes) {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = LABEL_FONT(); g.lineWidth = LABEL_STROKE; g.strokeStyle = 'rgba(40,25,15,.7)'; g.fillStyle = '#fff';
  boxes.forEach(function (l) {
    if (l.x1 < cam.x - 20 || l.x0 > cam.x + mapWdu() + 20 || l.y1 < cam.y - 20 || l.y0 > cam.y + 740) return;
    g.font = l.f || LABEL_FONT();
    g.strokeText(l.s, l.x, l.y); g.fillText(l.s, l.x, l.y);
  });
  g.font = LABEL_FONT();
  if (!fireFrames()) {   // 有營火動畫圖時不寫字（照舊）
    var fl = fireLabel(), pl = fl.plate;
    g.fillStyle = FIRE_PLATE.col; rrect(g, pl.x0, pl.y0, pl.x1 - pl.x0, pl.y1 - pl.y0, FIRE_PLATE.r); g.fill();
    g.fillStyle = '#fff'; g.fillText(fl.s, fl.x, fl.y);
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  drawOrder.push('labels');
}
// 泡泡中心（v2-land.9，ui-landscape-v2 §3.5）：建築格右上角 =（格 x + 80, 格 y + 4），格 x／格 y 是格子左上角。
// 最右一欄（x = 17）往左推 18 du，泡泡（68 寬）右緣剛好貼齊地圖右緣。大小不變（68×64）。
var BUBBLE_DX = 80, BUBBLE_DY = 4, BUBBLE_EDGE_PUSH = 18;
function bubbleAnchor(tile) {
  var T = CONFIG.map.tile, x = tile[0] * T + BUBBLE_DX;
  if (tile[0] === CONFIG.map.cols - 1) x -= BUBBLE_EDGE_PUSH;
  return { x: x, y: tile[1] * T + BUBBLE_DY };
}
// 泡泡的方框（世界 du）：圓角框 ±34（加框線 ±36），上 −33，尾巴尖到 +44
function bubbleBox(x, y) { return { x0: x - 36, x1: x + 36, y0: y - 33, y1: y + 45 }; }
function boxHit(a, b) { return a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1; }
// v2-land.11（設計決定）：泡泡蓋到任何建築名稱時「只往上移」，取最小的移動量，最多半格（48 du）；半格還不夠就停在半格（名稱仍畫在上面）。
// 不再左右移來躲名稱：x 永遠是格子右上角（格 x + 80；最右一欄 −18，見 bubbleAnchor，這是唯一的左右移動）。
// 最上面：泡泡方框頂（中心 −33）不能超出地圖上緣；往上移會出地圖就停在上緣（可能還蓋到名稱上半，名稱照樣畫在上面）。
// 第 0 列的建築（目前沒有）中心 y = 4，本來就超出上緣，會被夾回上緣（等於往下 29 du）。
// b.shift＝往上移了幾 du（正＝往上；被夾回上緣時可能是負的），b.capped＝半格還不夠，b.clamped＝被地圖上緣擋住。
// 名稱改成不常駐以後，這個往上移的規則要拿掉（現在先不拿）。
var BUBBLE_SHIFT_MAX = CONFIG.map.tile / 2, BUBBLE_TAP_HALF = 48, BUBBLE_TOP = 33;
function shiftBubbles(list, boxes) {
  boxes = boxes.filter(function (l) { return !l.art; });   // v2-land.17：有圖建築點出來的名稱不推泡泡
  list.forEach(function (b) {
    if (b.y0 === undefined) b.y0 = b.y;
    if (bldHasArt(b.bld)) { b.x = b.x0; b.y = b.y0; b.shift = 0; b.capped = b.clamped = false; b.dir = 0; return; }   // 有圖建築的泡泡停在原位
    var s = 0, y = Math.max(b.y0, BUBBLE_TOP), clamped = y !== b.y0, hit = true;
    for (; s <= BUBBLE_SHIFT_MAX; s++) {
      y = Math.max(b.y0 - s, BUBBLE_TOP); clamped = y !== b.y0 - s;
      var bb = bubbleBox(b.x0, y);
      hit = boxes.some(function (l) { return boxHit(bb, l); });
      if (!hit || clamped) break;
    }
    if (s > BUBBLE_SHIFT_MAX) y = Math.max(b.y0 - BUBBLE_SHIFT_MAX, BUBBLE_TOP);   // 半格還不夠：停在半格
    b.capped = hit && !clamped; b.clamped = clamped; b.x = b.x0; b.y = y; b.shift = b.y0 - y; b.dir = 0;
  });
  return list;
}
// 建築狀態泡泡（§3.5）：只有生產建築；空位（有空工位且閒置 > 0）優先於工作中
var bubbles = [];
function computeBubbles() {
  var out = [], idle = idleResidents().length, cnt = {};
  state.people.forEach(function (p) { if (p.job && p.job !== 'soldier') { var k = p.job + ':' + Math.min(p.bld, BLD[JOB[p.job].bld].tiles.length - 1); cnt[k] = (cnt[k] || 0) + 1; } });
  CONFIG.jobs.forEach(function (j) {
    var b = BLD[j.bld], n = state.built[b.id], per = slotsPer(b.id), ntile = Math.min(n, b.tiles.length);
    for (var i = 0; i < ntile; i++) {
      var w = cnt[j.id + ':' + i] || 0;
      var cap = i === b.tiles.length - 1 ? per * (n - i) : per;   // 最後一格代表超出格位的那幾座
      var kind = w < cap && idle > 0 ? 'free' : w > 0 ? 'work' : null;
      if (!kind) continue;
      var a = bubbleAnchor(b.tiles[i]);
      out.push({ bld: b.id, i: i, job: j.id, kind: kind, x: a.x, x0: a.x, shift: 0, capped: false, y: a.y });
    }
  });
  return out;
}
function drawBubbles(g, t) {
  bubbles.forEach(function (b) {
    var x = b.x, y = b.y;
    g.fillStyle = '#fffaf0'; g.strokeStyle = '#3a2616'; g.lineWidth = 3;
    rrect(g, x - 34, y - 32, 68, 64, 18); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 10, y + 30); g.lineTo(x, y + 44); g.lineTo(x + 10, y + 30); g.closePath(); g.fill(); g.stroke();
    g.fillRect(x - 9, y + 26, 18, 5);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (b.kind === 'free') { g.fillStyle = '#2f7a2a'; g.font = fontDu(48, 18); g.fillText('＋', x, y + 2); }
    else {
      g.save(); g.translate(x, y); g.rotate(Math.sin(t * 0.006 + b.i) * 0.14);
      // v2-land.19：工具泡泡圖 bubble_tool_<職業>（72×72 px＝36×36 du，置中；牧場 herd、家畜欄 stock，同 ART_JOB）；沒有圖就照舊寫字
      if (!spr(g, 'bubble_tool_' + (ART_JOB[b.job] || b.job), -18, -17, 36, 36)) { g.fillStyle = '#6b4a2e'; g.font = fontDu(32, 13); g.fillText(TOOL_CH[b.job], 0, 1); }
      g.restore();
    }
  });
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  drawOrder.push('bubbles');
}
// 浮動產量數字（§3.6，純裝飾）
var floats = [], floatAcc = {}, floatSec = 0;
function floatTick(sec, e) {
  if (!(sec > 0)) return;
  CONFIG.jobs.forEach(function (j) { floatAcc[j.id] = (floatAcc[j.id] || 0) + e.job[j.id] * sec; });
  floatSec += sec;
  if (floatSec < CONFIG.floatEverySec) return;
  floatSec = 0;
  var now = performance.now(), blocked = ui.page || ui.popup || !state.lord.done;
  CONFIG.jobs.forEach(function (j) {
    var n = Math.floor(floatAcc[j.id] + 1e-9); floatAcc[j.id] = 0;
    if (blocked || n < 1) return;
    floats = floats.filter(function (f) { return now - f.t0 < 1200; });
    if (floats.length >= CONFIG.floatMax) return;
    var bi = -1; state.people.forEach(function (p) { if (p.job === j.id && (bi < 0 || p.bld < bi)) bi = p.bld; });   // 第一座有工人的建築
    if (bi < 0) return;
    var c = tileCenter(instTile(j.bld, bi));
    if (c.x < cam.x || c.x > cam.x + mapWdu() || c.y < cam.y || c.y > cam.y + 720) return;   // 不在畫面上就不顯示
    floats.push({ x: c.x, y: c.y - 40, s: '＋' + n + ' ' + RES_UNIT[BLD[j.bld].produces], t0: now, job: j.id });
    dbg.floats++;
  });
}
function drawFloats(g, now) {
  floats = floats.filter(function (f) { return now - f.t0 < 1200; });
  g.textAlign = 'center'; g.font = fontDu(28, 14); g.lineWidth = 6; g.strokeStyle = '#2e1f15';
  floats.forEach(function (f) {
    var k = (now - f.t0) / 1200;
    g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = '#fff6c8';
    g.strokeText(f.s, f.x, f.y - 48 * k); g.fillText(f.s, f.x, f.y - 48 * k);
  });
  g.globalAlpha = 1; g.textAlign = 'left';
}
// 晝夜（§9）：真實 1 小時 = 遊戲 1 天，:00 = 06 時；06、18 時前後各 2 遊戲分鐘漸變
// BUG-05：時鐘照「遊玩時間」走（企劃確認）：現實 1 分鐘 = 遊戲 24 分鐘，從 06:00 開始；playSec 只在橫向、畫面開著時增加
function gameMinutes() { return (360 + state.playSec * 24 / 60) % 1440; }
function nightFactor(gm) {
  var r = 2;
  if (gm >= 1080 - r && gm <= 1080 + r) return (gm - (1080 - r)) / (2 * r);
  if (gm >= 360 - r && gm <= 360 + r) return 1 - (gm - (360 - r)) / (2 * r);
  return gm > 1080 || gm < 360 ? 1 : 0;
}
function drawMap(now) {
  if (worldDirty) { drawWorld(); worldDirty = false; }
  var g = R.mapCtx, k = U * DPR, cv = R.map;
  // v2-land.5：鏡頭位移取整數裝置像素再畫（拖曳時不閃爍）；cam 本身、點擊換算都不變
  var cpx = Math.round(cam.x * k), cpy = Math.round(cam.y * k);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(R.world, cpx / k * worldK, cpy / k * worldK, mapWdu() * worldK, 720 * worldK, 0, 0, cv.width, cv.height);
  g.setTransform(k, 0, 0, k, -cpx, -cpy);
  var t = performance.now();
  drawOrder = [];
  drawSorted(g, t);
  var showOver = !ui.page && !ui.popup && state.lord.done, lbox = labelBoxes();
  bubbles = showOver ? shiftBubbles(computeBubbles(), lbox) : [];
  // 晚上（v2-land.7，ui-landscape-v2 §9）：整張地圖疊 #3E4D5F multiply 35%；只有營火有暖光（screen 35%，半徑 220 du）。
  // 建築的暖光拿掉。泡泡、建築名稱、浮動數字在這之後才畫，所以不會變暗。UI 欄、彈窗也不受影響。
  var nf = nightFactor(gameMinutes());
  if (nf > 0) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = NIGHT.tintA * nf; g.fillStyle = NIGHT.tint; g.fillRect(0, 0, cv.width, cv.height);
    g.restore(); g.save();
    g.globalCompositeOperation = 'screen'; g.globalAlpha = NIGHT.glowA * nf;
    var gr = g.createRadialGradient(FIRE.x, FIRE.y, 10, FIRE.x, FIRE.y, NIGHT.glowR);
    gr.addColorStop(0, NIGHT.glow); gr.addColorStop(1, 'rgba(255,170,70,0)');
    g.fillStyle = gr; g.fillRect(FIRE.x - NIGHT.glowR, FIRE.y - NIGHT.glowR, NIGHT.glowR * 2, NIGHT.glowR * 2);
    g.restore();
    drawOrder.push('night');
  }
  R.map.setAttribute('data-night', nf.toFixed(2));
  if (showOver) drawBubbles(g, t);
  drawBldLabels(g, lbox);   // 名稱在泡泡上面
  if (showOver) { drawFloats(g, t); drawOrder.push('floats'); } else floats = [];
  camDirty = false;
  dbg.draws++;
}
var dbg = window.TL_DEBUG = { draws: 0, floats: 0 };

// ===== 地圖：拖曳與點擊（Pointer Events，沿用 v1a 規則）=====
var drag = null;
function bindMapPointer(cv) {
  cv.addEventListener('pointerdown', function (e) {
    if (drag || ui.popup || ui.page || !state.lord.done || portrait) return;   // 只認第一根手指
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, active: false };
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.active) {
      if (Math.sqrt(dx * dx + dy * dy) < CONFIG.map.dragThresholdCss) return;   // 6 CSS px，不乘 u
      drag.active = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 有些環境不支援 */ }
      cv.setAttribute('data-dragging', '1');
    }
    setCam(drag.cx - dx / U, drag.cy - dy / U);   // 沒有慣性：放開就停
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
function screenToWorld(cx, cy) { var r = R.map.getBoundingClientRect(); return { x: (cx - r.left) / U + cam.x, y: (cy - r.top) / U + cam.y }; }
function worldToScreen(wx, wy) { var r = R.map.getBoundingClientRect(); return { x: r.left + (wx - cam.x) * U, y: r.top + (wy - cam.y) * U }; }
function mapTap(e) {
  var w = screenToWorld(e.clientX, e.clientY), T = CONFIG.map.tile, pad = CONFIG.map.hitPad;
  // 1) 泡泡（點擊區 96×96，以泡泡中心為準）：開職業分配、捲到那一列並閃一下
  for (var i = bubbles.length - 1; i >= 0; i--) { var b = bubbles[i]; if (Math.abs(w.x - b.x) <= 48 && Math.abs(w.y - b.y) <= 48) { gotoJob(b.job); return; } }
  // v2-land.17：點到有圖建築的格子 → 名稱顯示 2 秒（議事廳、軍營有圖時照樣開頁面，見下面）
  CONFIG.buildings.forEach(function (b) {
    if (!bldHasArt(b.id) || b.id === 'council' || b.id === 'barracks') return;   // v2-land.20（第 4 項）：議事廳、軍營點了開頁面，不閃名稱
    for (var j = 0; j < Math.min(state.built[b.id], b.tiles.length); j++) { var tt = b.tiles[j];
      if (w.x >= tt[0] * T && w.x < tt[0] * T + T && w.y >= tt[1] * T && w.y < tt[1] * T + T) nameFlash = { id: b.id, i: j, until: performance.now() + NAME_FLASH_MS }; }
  });
  // 2) 議事廳 → 內政；軍營 → 軍營頁（點擊區 = 格子 96 往外擴 12 = 120×120）
  var hits = [];
  ['council', 'barracks'].forEach(function (id) {
    if (!state.built[id]) return;
    var t = BLD[id].tiles[0], x = t[0] * T, y = t[1] * T;
    if (w.x >= x - pad && w.x < x + T + pad && w.y >= y - pad && w.y < y + T + pad) {
      var inside = w.x >= x && w.x < x + T && w.y >= y && w.y < y + T;
      hits.push({ id: id, k: inside ? -1 : Math.abs(w.x - x - T / 2) + Math.abs(w.y - y - T / 2) });
    }
  });
  if (!hits.length) return;   // 其他建築點了沒反應（同 v1a）
  hits.sort(function (a, b) { return a.k - b.k; });
  openPage(hits[0].id === 'council' ? 'council' : 'barracks');
}
function gotoJob(jid) {
  closePopup(); ui.tab = 'jobs'; openPage('council');
  var row = $('job-' + jid), body = $('pageBody');
  if (!row || !body) return;
  body.scrollTop = Math.max(0, row.offsetTop - 8 * U);   // 列的 offsetParent 就是 pageBody
  var fr = row.querySelector('.jrow') || row; fr.classList.remove('flash'); void fr.offsetWidth; fr.classList.add('flash');
}
window.TL_DEBUG_MAP = {   // 測試用（唯讀）：泡泡、建築的螢幕座標
  art: function () { return Object.keys(ART).sort(); },
  terArt: function (c, r) { return terArt(CONFIG.map.grid[r].charAt(c), c, r); },   // v2-land.8：這一格用哪張地形圖（河含遮罩）
  drawn: function () { return drawnDbg.slice(); },
  night: function () { return { tint: NIGHT.tint, tintA: NIGHT.tintA, glowA: NIGHT.glowA, glowR: NIGHT.glowR }; },   // v2-land.6：這一格依腳底 y 畫的順序（建築、營火、人物）
  shadows: function () { return { bld: shadowDbg.bld, ppl: shadowDbg.ppl, tree: shadowDbg.tree, col: SHADOW_COL }; },
  trees: function () { return treeList().map(function (t) { return { x: t.x, y: t.y, v: t.v, c: t.c, r: t.r }; }); },   // v2-land.10：樹（世界 du，對齊點＝樹幹底部）   // v2-land.5：已解碼、會拿來畫的美術圖名稱
  bubbles: function () { return bubbles.map(function (b) { var s = worldToScreen(b.x, b.y), bb = bubbleBox(b.x, b.y), p0 = worldToScreen(bb.x0, bb.y0), p1 = worldToScreen(bb.x1, bb.y1); return { bld: b.bld, i: b.i, job: b.job, kind: b.kind, x: s.x, y: s.y, wx: b.x, wy: b.y, x0: b.x0, y0: b.y0, shift: b.shift, dir: b.dir, capped: b.capped, clamped: b.clamped, box: { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y } }; }); },
  labels: function () { return labelBoxes().map(function (l) { var p0 = worldToScreen(l.x0, l.y0), p1 = worldToScreen(l.x1, l.y1); return { bld: l.bld, i: l.i, s: l.s, x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y }; }); },
  order: function () { return drawOrder.slice(); },
  terrain: function () { return terrainLabels().map(function (l) { var p0 = worldToScreen(l.x0, l.y0), p1 = worldToScreen(l.x1, l.y1); return { s: l.s, x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y }; }); },
  halfTile: function () { return BUBBLE_SHIFT_MAX; },
  tile: function (c, r) { var T = CONFIG.map.tile; return worldToScreen((c + 0.5) * T, (r + 0.5) * T); },
  cam: function () { return { x: cam.x, y: cam.y, home: homeCam(), atHome: atHome() }; },
  floats: function () { return floats.length; },
  people: function () {   // 每個人物圖的螢幕方框（CSS px）
    return state.people.map(function (p) {
      var q = personXY(p), hero = p.type === 'hero';
      var a = worldToScreen(q.x - 15, q.y - (hero ? 82 : 61)), b = worldToScreen(q.x + (hero ? 18 : 15), q.y + 7);
      return { id: p.id, job: p.job || '', x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    });
  }
};

// ===== 左欄、右欄更新 =====
var lastHourKey = '';
function updateTime() {
  var gm = gameMinutes(), hour = Math.floor(gm / 60), day = gm >= 360 && gm < 1080;
  setText(R.hour, hour + '時');
  var key = day ? 'd' : 'n';
  if (key !== lastHourKey) { lastHourKey = key; setText(R.sun, day ? '日' : '月'); R.sun.style.background = day ? '#e8a52a' : '#4a5a9a'; R.sun.setAttribute('data-icon', day ? 'sun' : 'moon'); }
}
function renderSides() {
  setText(R.wood, fmtAmt(state.material)); setText(R.food, fmtAmt(state.food));
  setText(R.pop, String(state.people.length)); setText(R.mineral, fmtAmt(state.mineral));
  var sx = state.lord.sex; setCls(R.avatar, 'ab avatar ' + (sx === 'M' ? 'M' : sx === 'F' ? 'F' : 'N')); setText(R.avatar, sx === 'M' ? '♂' : sx === 'F' ? '♀' : '?');
  var st = goalStatus();
  if (st.all) {
    setText(R.goalName, '全部完成'); R.goalBar.hidden = R.goalProg.hidden = true; R.goalDot.hidden = true; setCls(R.goal, 'ab cell alldone'); setCls(R.goalName, 'ab f28 bold chk');   // v2-land.15：「✓ 全部完成」，✓ 芫荽沒有這個字，用 CSS 畫（.chk::before）
  } else {
    setText(R.goalName, st.g.name); R.goalBar.hidden = R.goalProg.hidden = false;
    R.goalFill.style.width = (st.n / st.m * 100) + '%';
    setText(R.goalProg, st.done ? '完成' : st.n + '/' + st.m);
    R.goalDot.hidden = !st.done; setCls(R.goal, 'ab cell'); setCls(R.goalName, 'ab f28 bold');
  }
  var idle = idleResidents().length;
  R.badge.hidden = idle <= 0; setText(R.badge, idle > 99 ? '99+' : String(idle));
  setDis(R.bHome, atHome());
}

// ===== 彈窗（§5：置中；預設 960×600，確認 640×360，歡迎回來 800×520）=====
var POP_SIZE = { restart: [640, 360, 1], welcome: [800, 640, 0] };
function openPopup(kind, arg) {
  if (!state.lord.done) return;
  closePopup(); cancelDrag();
  var sz = POP_SIZE[kind] || [Math.min(DW - 320, 960), kind === 'pop' ? 640 : 600, 0], w = sz[0], h = sz[1];   // v2-land.22：人口彈窗多了收留流浪者兩行，高 600 → 640 才放得下
  var p = $('popup'); p.innerHTML = '';
  box(p, 'var(--dw) / 2 - ' + (w / 2), 360 - h / 2, w, h);
  // v2-land.15（企劃回覆第 2 項）：卷軸邊 24 du 高，寬＝彈窗寬＋16（左右各凸出 8），兩端半圓（半徑 12），往彈窗內壓 4 du 蓋住圓角縫
  box(R.popEdgeT, 'var(--dw) / 2 - ' + (w / 2 + 8), 360 - h / 2 - 20, w + 16, 24); box(R.popEdgeB, 'var(--dw) / 2 - ' + (w / 2 + 8), 360 + h / 2 - 4, w + 16, 24);
  var head = el('div', 'ab phead', p); box(head, 0, 0, w, 96);
  var title = el('div', 'ab t f40', head); title.style.left = du(32); title.style.maxWidth = du(w - 140); title.style.overflow = 'hidden';
  var x = el('button', 'ab xbtn', head, ''); box(x, w - 96, 0, 96, 96); x.id = 'popClose'; x.setAttribute('aria-label', '關閉');
  x.onclick = closePopup;
  var foot = el('div', 'ab pfoot', p); box(foot, 0, h - 128, w, 104); foot.style.gap = du(32);
  var body = el('div', 'ab scroll', p); box(body, 32, 112, w - 64, h - 112 - 136); body.id = 'popBody';
  var upd = POPUPS[kind](body, title, foot, w - 64, arg);
  if (!foot.children.length) { foot.remove(); box(body, null, null, null, h - 112 - 24); }
  ui.popup = { kind: kind, confirm: !!sz[2], update: upd || function () {} };
  p.setAttribute('data-kind', kind);
  $('mask').hidden = false; p.hidden = false; R.popEdgeT.hidden = R.popEdgeB.hidden = false;
  ui.popup.update(true);
}
function closePopup() { if (!ui.popup) return; ui.popup = null; $('popup').hidden = true; R.popEdgeT.hidden = R.popEdgeB.hidden = true; $('mask').hidden = true; $('popup').innerHTML = ''; }
function fbtn(foot, label, id, cls, w) { var b = el('button', 'btn f28' + (cls ? ' ' + cls : ''), foot); b.style.position = 'relative'; b.style.width = du(w || 240); b.style.height = du(96); el('span', '', b, label); if (id) b.id = id; return b; }
function msg(b, s, h, cls) { var l = line(b, h || 64); var t = el('div', 'ab wrap' + (cls ? ' ' + cls : ''), l, s); box(t, 0, 0, null, h || 64); t.style.right = '0'; t.style.display = 'flex'; t.style.alignItems = 'center'; return t; }
function restartNow() { closePopup(); closePage(); wipeAndNew(randomSeed()); floats = []; goHome(); uiDirty = true; render(true); }

var POPUPS = {
  lord: function (b, title, foot, W) {
    setText(title, '領主');
    var L = state.lord, l1 = line(b, 64);
    txt(l1, 0, '名字 ' + CONFIG.lordName + '　性別 ' + (L.sex === 'M' ? '♂ 男' : '♀ 女'), 'bold');
    [[0, 1, 2], [3, 4]].forEach(function (grp) {
      var l = line(b, 56);
      grp.forEach(function (a, i) {
        var x = i * 290;
        txt(l, x, ATTR[a], 'bold');
        var s = el('span', 'ab t', l); s.style.left = du(x + 76);
        s.innerHTML = L.attrs[a] ? starsHTML(L.attrs[a], L.attrs[a], 5) : '<span class="dim">—</span>';
      });
    });
    txt(line(b, 56), 0, '沒有天賦、不會成長', 'dim');
    var lv = line(b, 56, 'sep'); txt(lv, 0, '版本 ' + VERSION, 'dim').id = 'lordVersion';
    msg(b, '字型：芫荽 Iansui 子集，SIL OFL 1.1', 56, 'dim f24').id = 'lordCredit';   // v2-land.12：授權全文在單檔 <style> 開頭的註解和 font/OFL.txt
    var ex = fbtn(foot, '匯出存檔', 'btnExport'); ex.onclick = function () { openPopup('export'); };   // v2-land.18
    var im = fbtn(foot, '匯入存檔', 'btnImport'); im.onclick = function () { openPopup('import'); };
    var rs = fbtn(foot, '重新開始', 'btnRestart'); rs.onclick = function () { openPopup('restart'); };
  },
  // v2-land.18：匯出／匯入存檔（從領主彈窗進來）。文字框一律可以選取，複製失敗（file:// 常見）時請玩家自己全選複製
  export: function (b, title, foot, W) {
    setText(title, '匯出存檔');
    var r = exportSave();
    msg(b, r.err ? r.err : '把下面整段文字存起來，之後可以用「匯入存檔」還原。', 64, r.err ? 'err' : '');
    var ta = el('textarea', 'savecode', b); ta.id = 'exportCode'; ta.readOnly = true; ta.value = r.code || ''; ta.style.height = du(192); ta.setAttribute('spellcheck', 'false');
    ta.onfocus = function () { try { ta.select(); } catch (e) { /* 略過 */ } };
    var st = msg(b, '', 56, 'dim f24'); st.id = 'exportStatus';
    var cp = fbtn(foot, '複製', 'btnCopy', 'primary'); cp.disabled = !r.code;
    cp.onclick = function () {
      var done = function (ok) { setText(st, ok ? '已複製。' : '沒辦法自動複製，請手動全選上面的文字後複製。'); };
      try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); } catch (e) { /* 略過 */ }
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { done(document.execCommand && document.execCommand('copy')); }); return; } } catch (e) { /* 改用 execCommand */ }
      try { done(document.execCommand('copy')); } catch (e) { done(false); }
    };
    fbtn(foot, '關閉', 'btnExportClose').onclick = closePopup;
  },
  import: function (b, title, foot, W) {
    setText(title, '匯入存檔');
    msg(b, '貼上匯出的存檔文字。目前的存檔會先備份，再換成匯入的存檔並重新載入。', 64, 'f24');
    var ta = el('textarea', 'savecode', b); ta.id = 'importCode'; ta.style.height = du(192); ta.setAttribute('spellcheck', 'false'); ta.setAttribute('autocomplete', 'off');
    var st = msg(b, '', 56, 'err f24'); st.id = 'importErr';
    var ok = fbtn(foot, '匯入', 'btnImportOk', 'primary');
    ok.onclick = function () { var r = importSave(ta.value); setText(st, r.err || ''); };
    fbtn(foot, '取消', 'btnImportNo').onclick = closePopup;
  },
  restart: function (b, title, foot) {
    setText(title, '重新開始');
    msg(b, '目前的存檔會刪除，確定重新開始？', 112, 'bigmsg');
    var ok = fbtn(foot, '確定', 'btnRestartOk', 'primary'), no = fbtn(foot, '取消', 'btnRestartNo');
    ok.onclick = restartNow;   // 重新開始只在這裡（v2-land.2 拿掉生活分頁的「新遊戲」）
    no.onclick = closePopup;   // 取消：存檔不動
  },
  material: function (b, title, foot, W) {
    var rows = {};
    [['伐木', 'lumber'], ['撿柴', 'gather'], ['稻草', 'straw'], ['淨值', 'net']].forEach(function (a) { var l = line(b, 56, a[1] === 'net' ? 'sep' : ''); txt(l, 0, a[0]); rows[a[1]] = rtxt(l, W, ''); });
    var note = msg(b, '', 64, 'dim');
    return function () {
      var e = econ();
      setText(title, '建材 ' + fmtAmt(state.material));
      setText(rows.lumber, fmtR(e.job.lumber) + '/秒'); setText(rows.gather, fmtR(e.gather) + '/秒');
      setText(rows.straw, fmtR(e.straw) + '/秒'); setText(rows.net, fmtR(e.material) + '/秒');
      setText(note, '閒置居民撿柴（訓練中的人、士兵不撿）');
    };
  },
  food: function (b, title, foot, W) {
    var h = line(b, 52, 'dim'); txt(h, 0, '來源'); rtxt(h, W - 220, '每秒'); rtxt(h, W, '比例');
    var rows = CONFIG.foodSources.map(function (s) { var l = line(b, 52); txt(l, 0, s[0]); return { l: l, v: rtxt(l, W - 220, ''), p: rtxt(l, W, ''), jobs: s[1] }; });
    var lc = line(b, 52, 'sep'); txt(lc, 0, '消耗'); var cons = rtxt(lc, W - 220, '');
    var ln = line(b, 52); txt(ln, 0, '淨值'); var net = rtxt(ln, W - 220, '');
    var empty = msg(b, '', 52, 'dim');
    return function () {
      var e = econ(), tot = e.food;
      setText(title, '食物 ' + fmtAmt(state.food));
      rows.forEach(function (r) {
        var v = r.jobs.reduce(function (a, j) { return a + e.job[j]; }, 0);
        setText(r.v, fmtR(v)); setText(r.p, tot > 0 ? Math.round(v / tot * 100) + '%' : '—');
        setCls(r.l, 'ln' + (v > 0 ? '' : ' dim'));
      });
      setText(cons, fmtR(-e.cons)); setText(net, fmtR(e.foodNet));
      setCls(net, 'ab t ra ' + (e.foodNet > 1e-9 ? 'pos' : e.foodNet < -1e-9 ? 'neg' : 'dim'));
      setText(empty, tot > 0 ? '' : '目前沒有人生產食物');
    };
  },
  pop: function (b, title, foot, W) {
    var cells = CONFIG.jobs.map(function (j) { return [j.name, j.id]; }).concat([['士兵', 'soldier'], ['英雄', 'hero'], ['閒置', 'idle'], ['床位', 'beds']]);
    var refs = [], l;
    cells.forEach(function (c, i) { if (i % 3 === 0) l = line(b, 64); refs.push([c, txt(l, (i % 3) * 300, '')]); });
    // v2-land.22 §1 #19：收留流浪者（企劃補充決定：按鈕放在人口彈窗；在路上、冷卻中都不能按）
    var sl = line(b, 64, 'sep'); txt(sl, 0, '收留流浪者'); var sSt = txt(sl, 300, ''); sSt.id = 'strayStatus';
    var sNote = msg(b, '', 56, 'dim'); sNote.id = 'strayNote';
    var sb = fbtn(foot, '收留流浪者', 'btnStray', '', 280);
    sb.onclick = function () { if (takeStray()) uiDirty = true; };
    var go = fbtn(foot, '前往內政', 'popGoCouncil', 'primary', 280);
    go.onclick = function () { closePopup(); ui.tab = 'jobs'; openPage('council'); };
    return function () {
      var now = Date.now(), blk = strayBlock(now), st = state.stray, cost = strayCost();
      setText(sSt, { goals: '完成 9 個目標後開放', coming: '在路上，' + fmtClock((st.at - now) / 1000) + ' 後到達', cooldown: '冷卻中，還要 ' + fmtClock((st.cdUntil - now) / 1000),
        bed: '沒有空床（人口上限 ' + popCap() + '）', food: '食物不夠 ' + cost }[blk] || '可以收留');
      setText(sNote, '花 ' + cost + ' 食物，30 秒後到達，冷卻 90 秒，空床 ' + Math.max(0, strayFreeBeds()));
      setDis(sb, !!blk);
      var cnt = countPeople();
      setText(title, '人口 ' + state.people.length + '　幸福度 ' + Math.floor(state.happiness + 1e-9));
      refs.forEach(function (r) {
        var id = r[0][1], v = id === 'beds' ? beds() : cnt[id] || 0;
        setText(r[1], r[0][0] + ' ' + v);
        setCls(r[1], 'ab t' + (id === 'idle' && v > 0 ? ' hi' : v ? '' : ' dim'));
      });
    };
  },
  mineral: function (b, title, foot, W) {
    var l = line(b, 56); txt(l, 0, '採礦'); var v = rtxt(l, W, '');
    var note = msg(b, '', 64, 'dim');
    return function () {
      setText(title, '礦物 ' + fmtAmt(state.mineral));
      setText(v, fmtR(econ().mineral) + '/秒');
      setText(note, state.mineral < 1e-9 && !state.built.mine ? '還沒有礦物。蓋採礦場後派人採礦。' : '礦物本版沒有用途，只累積');
    };
  },
  events: function (b, title) { setText(title, '事件'); msg(b, '目前沒有事件', 300, 'bigmsg dim'); },
  build: function (b, title, foot, W) {
    setText(title, '建造');
    var rows = CONFIG.buildings.filter(function (d) { return d.id !== 'council'; }).map(function (d) {
      var l = line(b, 112, 'sep');
      var ic = el('div', 'ab', l); box(ic, 0, 16, 80, 80); ic.style.background = CAT_COL[BLD_CAT[d.id]]; ic.style.borderRadius = du(14);
      txt(l, 104, d.name, 'bold').style.height = '50%';
      var info = d.slots ? '工位 ' + slotsPer(d.id) : d.beds ? '床位 ' + d.beds : d.id === 'barracks' ? '入伍' : '沒有效果';
      var i2 = txt(l, 104, info, 'dim f24'); i2.style.top = '50%'; i2.style.height = '50%';
      var c = rtxt(l, W - 264, '');
      var bt = btn(l, W - 240, 8, 240, 96, '', 'primary'); bt.id = 'build-' + d.id;
      bt.onclick = function () { build(d.id); render(true); };
      return { d: d, c: c, b: bt };
    });
    var up = fbtn(foot, '升級（尚未開放）', 'btnUpgrade', '', 320); up.disabled = true;
    return function () {
      rows.forEach(function (r) {
        setText(r.c, '已蓋 ' + state.built[r.d.id]);
        btnLabel(r.b, '蓋　' + costOf(r.d.id) + ' 建材'); setDis(r.b, !canBuild(r.d.id));
      });
    };
  },
  goal: function (b, title, foot) {
    setText(title, '目標');
    var nm = msg(b, '', 72, 'f36'); nm.id = 'goalPopName';
    var ds = msg(b, '', 64); var pr = msg(b, '', 64, 'bold'); pr.id = 'goalPopProg';
    msg(b, '目標沒有獎勵，只是提示下一步可以做什麼。', 56, 'dim f24');
    var go = fbtn(foot, '前往', 'goalGo', 'primary'), nx = fbtn(foot, '下一個', 'goalNextBtn', 'primary');
    go.onclick = function () {
      var st = goalStatus(); if (st.all) return;
      var t = st.g.go;
      if (t === 'build') openPopup('build');
      else if (t === 'barracks') { if (state.built.barracks) openPage('barracks'); else openPopup('build'); }
      else gotoJob(t);
    };
    nx.onclick = function () { goalNext(); var st = goalStatus(); if (st.all) closePopup(); else openPopup('goal'); render(true); };
    return function () {
      var st = goalStatus();
      if (st.all) { setText(nm, '全部完成'); setText(ds, ''); setText(pr, ''); go.hidden = nx.hidden = true; return; }
      setText(nm, st.g.name); setText(ds, st.g.desc);
      setText(pr, st.done ? '已完成' : '進度 ' + st.n + ' / ' + st.m);
      go.hidden = st.done; nx.hidden = !st.done;
    };
  },
  welcome: function (b, title, foot, W, away) {
    setText(title, '歡迎回來');
    var l = line(b, 80); txt(l, 0, '離開時間'); var t = txt(l, 200, fmtAway(away), 'f36'); t.id = 'wbTime';
    var g = lastOffline || { food: 0, material: 0, mineral: 0, lost: { food: 0, material: 0, mineral: 0 } };   // v2-land.21 §1 #14
    [['食物', 'food'], ['建材', 'material'], ['礦物', 'mineral']].forEach(function (a) {
      var lr = line(b, 56); txt(lr, 0, a[0]);
      var s = '+' + fmtAmt(g[a[1]]) + (g.lost[a[1]] >= 1 ? '（倉庫滿了，少收 ' + fmtAmt(g.lost[a[1]]) + '）' : '');
      if (g[a[1]] < 0) s = '−' + fmtAmt(-g[a[1]]);
      txt(lr, 200, s).id = 'wb_' + a[1];
    });
    msg(b, '離線收益 = 線上 50%，最多 8 小時', 56, 'dim').id = 'wbNote';
    msg(b, '沒有完成的事件', 64, 'dim').id = 'wbEvents';
    var ok = fbtn(foot, '好', 'wbOk', 'primary', 320); ok.onclick = closePopup;
  }
};
function countPeople() {
  var c = { soldier: 0, hero: 0, idle: 0 };
  state.people.forEach(function (p) {
    if (p.type === 'hero') c.hero++;
    else if (p.job === 'soldier') c.soldier++;
    else if (p.inQ) c.train = (c.train || 0) + 1;   // v2-land.21：入伍佇列中，不算閒置
    else if (!p.job) c.idle++;
    else c[p.job] = (c[p.job] || 0) + 1;
  });
  return c;
}

// ===== 內政／軍營面板（§4：x = W−880，720×720，從右滑入）=====
function openPage(kind) {
  if (!state.lord.done) return;
  if (kind === 'barracks' && !state.built.barracks) return;
  var again = ui.page === kind;
  closePopup(); cancelDrag(); cancelHolds();
  ui.page = kind;
  var pg = $('page'); pg.innerHTML = ''; pg.hidden = false; pg.setAttribute('data-kind', kind);
  box(pg, 'var(--dw) - 880', 0, 720, 720); pg.style.zIndex = 7;
  box(R.pageEdge, 'var(--dw) - 896', 0, 16, 720); R.pageEdge.hidden = false;   // 左緣外 16 du 直卷軸
  if (!again) { pg.classList.remove('slide'); R.pageEdge.classList.remove('slide'); void pg.offsetWidth; pg.classList.add('slide'); R.pageEdge.classList.add('slide'); }
  $('mapMask').hidden = false; box($('mapMask'), 200, 0, 'var(--dw) - 1080', 720); $('mapMask').style.zIndex = 6;
  var head = el('div', 'ab phead', pg); box(head, 0, 0, 720, 96);
  var title = el('div', 'ab t f40', head, kind === 'council' ? '內政' : '軍營'); title.style.left = du(32);
  var x = el('button', 'ab xbtn', head, ''); box(x, 624, 0, 96, 96); x.id = 'pageClose'; x.setAttribute('aria-label', '關閉'); x.onclick = closePage;
  var top = 96;
  R.popBar = null;
  if (kind === 'council') {
    R.popBar = [['barWork', '工作'], ['barSoldier', '士兵'], ['barIdle', '閒置']].map(function (c, i) {
      var d = el('div', 'ab popcell', pg); box(d, i * 240 + 8, 104, 224, 64);
      txt(d, 24, c[1], 'dim');
      var v = rtxt(d, 200, '', 'f30'); v.id = c[0]; return v;
    });
    [['life', '生活'], ['jobs', '職業分配'], ['heroes', '英雄']].forEach(function (t, i) {
      var b = btn(pg, i * 240, 192, 240, 96, t[1], 'tab' + (ui.tab === t[0] ? ' on' : '')); b.id = 'tab-' + t[0];
      b.onclick = function () { if (ui.tab !== t[0]) { ui.tab = t[0]; openPage('council'); } };
    });
    top = 288;
  }
  var body = el('div', 'ab scroll', pg); box(body, 0, top, 720, 720 - top); body.id = 'pageBody';
  R.pageUpdate = (kind === 'council' ? TABS[ui.tab] : buildBarracks)(body) || function () {};
  R.pageUpdate(true);
  if (R.popBar) updatePopBar();
}
function closePage() {
  if (!ui.page) return;
  cancelHolds();
  ui.page = null; $('page').hidden = true; $('page').innerHTML = ''; R.pageUpdate = null; R.popBar = null;
  $('mapMask').hidden = true; R.pageEdge.hidden = true;
}
function updatePopBar() {
  var c = countPeople(), w = 0; CONFIG.jobs.forEach(function (j) { w += c[j.id] || 0; });
  setText(R.popBar[0], String(w)); setText(R.popBar[1], String(c.soldier)); setText(R.popBar[2], String(c.idle));
  setCls(R.popBar[2], 'ab t ra f30' + (c.idle > 0 ? ' hi' : ''));
}

var TABS = {
  life: function (b) {
    var refs = {};
    function row(key, label, x, cls) { var l = line(b, 56, cls); txt(l, x || 24, label); refs[key] = rtxt(l, 696, ''); return l; }
    row('food', '食物', 24, 'hd');
    CONFIG.jobs.forEach(function (j) { if (BLD[j.bld].produces === 'food') row('f_' + j.id, j.name, 64); });
    row('cons', '消耗', 64); row('soldier', '（其中士兵）', 64, 'dim'); row('fnet', '淨值', 64);
    row('mat', '建材', 24, 'hd'); row('m_lumber', '伐木', 64); row('m_gather', '撿柴', 64); row('m_straw', '稻草', 64); row('mnet', '淨值', 64);
    row('min', '礦物', 24, 'hd'); row('n_mine', '採礦', 64);
    row('hap', '幸福度', 24, 'hd'); row('decay', '每分鐘衰退', 64);
    row('beds', '床位', 24, 'hd');
    txt(line(b, 56, 'dim'), 64, '床位本版只顯示，沒有效果');
    row('talents', '生效中的英雄天賦', 24, 'hd');
    var tlw = line(b, 8); var tl = el('div', 'wrap dim', b); tl.style.padding = '0 ' + du(24) + ' 0 ' + du(64); void tlw;
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
    var h1 = line(b, 64); var hint = txt(h1, 24, ''); hint.id = 'idleHint';
    var h2 = line(b, 112); var one = btn(h2, 8, 8, 704, 96, '一鍵派去狩獵'); one.id = 'btnOneKey';
    one.onclick = function () { oneKeyHunt(); render(true); };
    var hd = line(b, 64, 'dim'); txt(hd, 32, '工作', 'f24'); txt(hd, 160, '工位', 'f24'); ctxt(hd, 424, '人數', 'f24'); rtxt(hd, 704, '產量/分', 'f24');
    var rows = CONFIG.jobs.map(function (j) {
      var l = line(b, 104); l.id = 'job-' + j.id;
      var fr = el('div', 'ab jrow', l); box(fr, 8, 4, 704, 96);
      txt(fr, 22, j.name, 'bold');
      var u = txt(fr, 150, '');
      var mi = btn(fr, 278, -2, 96, 96, '－', 'jbtn'); mi.id = 'minus-' + j.id;
      var c = ctxt(fr, 414, '', 'f30'); c.id = 'cnt-' + j.id;
      var pl = btn(fr, 454, -2, 96, 96, '＋', 'jbtn'); pl.id = 'plus-' + j.id;
      var r = rtxt(fr, 690, '');
      hold(mi, function () { return assignMinus(j.id); }); hold(pl, function () { return assignPlus(j.id); });
      return { j: j, l: fr, u: u, c: c, mi: mi, pl: pl, r: r };
    });
    var li = line(b, 64); txt(li, 32, '閒置'); var idleN = txt(li, 160, '', 'bold'); idleN.id = 'rowIdle';
    var ls = line(b, 64, 'dim'); txt(ls, 32, '士兵'); var soldN = txt(ls, 160, ''); soldN.id = 'rowSoldier'; txt(ls, 240, '（在軍營調整）');
    var rosterUpd = buildRoster(b);
    return function () {
      var e = econ(), h = idleHint(), idle = idleResidents().length;
      h1.hidden = h2.hidden = !CONFIG.foodUpkeep;   // foodUpkeep false：藏起「還能閒置／還差」提示和一鍵按鈕（程式保留）
      if (h.short) setText(hint, '食物不夠，還差 ' + h.need + ' 名獵人'); else setText(hint, '還能閒置 ' + Math.max(0, h.n) + ' 人');
      setCls(hint, 'ab t' + (h.short ? ' warn' : ''));
      btnLabel(one, h.need > 0 ? '一鍵派去狩獵（' + h.need + ' 人）' : '一鍵派去狩獵');
      setDis(one, !(h.need > 0 && canPlus('hunt')));
      rows.forEach(function (r) {
        var slots = jobSlots(r.j.id), w = e.workers[r.j.id], built = state.built[r.j.bld] > 0;
        setCls(r.l, 'ab jrow' + (built ? '' : ' dim'));
        setText(r.u, built ? w + '/' + slots : '未建造');
        r.mi.hidden = r.pl.hidden = r.c.hidden = r.r.hidden = !built;
        setText(r.c, String(w));
        setDis(r.mi, w <= 0); setDis(r.pl, idle <= 0 || w >= slots);
        var pm = e.job[r.j.id] * 60;
        setText(r.r, (pm > 0 ? '+' : '') + (pm >= 100 ? Math.round(pm) : fmtNum(pm, 1)));
      });
      setText(idleN, String(idle)); setCls(idleN, 'ab t' + (idle > 0 ? ' hi' : ''));
      setText(soldN, String(countPeople().soldier));
      rosterUpd();
    };
  },
  heroes: function (b) {
    var hs = state.people.filter(function (p) { return p.type === 'hero'; }), h = '';
    function ln(hh, inner) { return '<div class="ln" style="height:' + du(hh) + '">' + inner + '</div>'; }
    hs.forEach(function (p) {
      h += '<div class="card" data-id="' + p.id + '" style="margin:' + du(8) + ';padding:' + du(8) + ' 0">';
      h += ln(56, '<span class="ab t bold" style="left:' + du(24) + '">#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲　英雄　忠' + p.loyalty + '</span>');
      h += ln(52, attrHTML(p, 0, 24) + attrHTML(p, 1, 248) + attrHTML(p, 2, 472));
      h += ln(52, attrHTML(p, 3, 24) + attrHTML(p, 4, 248));
      if (p.talent) {
        var T = TAL[p.talent.tid], on = talentActive(p.talent.tid);
        h += ln(56, '<span class="ab t tal" style="left:' + du(24) + '">天賦：' + esc(heroTalentText(p.talent)) + '</span>' + (on ? '' : '<span class="ab t ra off" style="left:' + du(680) + '">尚未開放</span>'));
        h += '<div class="wrap dim f24" style="padding:0 ' + du(24) + ' ' + du(8) + '">' + esc(T.effect) + '（' + T.cat + '）</div>';
      } else h += ln(56, '<span class="ab t dim" style="left:' + du(24) + '">沒有天賦</span>');
      h += '</div>';
    });
    if (!hs.length) h = ln(96, '<span class="ab t dim" style="left:' + du(24) + '">沒有英雄</span>');
    b.innerHTML = h;
  }
};

// 點一下＝加減一次（click）；長按 0.4 秒後每 0.1 秒連續加減（沿用 v1a）
var holdStops = [];
function cancelHolds() { holdStops.forEach(function (f) { f(); }); holdStops = []; }
function hold(b, fn) {
  var t1 = null, t2 = null, held = false, sx = 0, sy = 0, pid = null;
  function stop() { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; pid = null; }
  holdStops.push(stop);
  b.addEventListener('pointerdown', function (e) {
    if (b.disabled || portrait || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stop(); held = false; sx = e.clientX; sy = e.clientY; pid = e.pointerId;
    t1 = setTimeout(function () {
      held = true;
      if (b.disabled || portrait || !fn()) { stop(); render(true); return; }
      render(true);
      t2 = setInterval(function () { if (b.disabled || portrait || !fn()) { stop(); } render(true); }, CONFIG.holdRepeatMs);
    }, CONFIG.holdDelayMs);
  });
  b.addEventListener('pointermove', function (e) {
    if (pid !== e.pointerId || !t1) return;
    var th = CONFIG.map.dragThresholdCss;
    if (Math.abs(e.clientX - sx) > th || Math.abs(e.clientY - sy) > th) stop();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, stop); });
  b.addEventListener('click', function () {
    if (held) { held = false; return; }
    if (b.disabled || portrait) return;
    fn(); render(true);
  });
}

// ===== 居民名冊 =====
var JOB_ORDER = {};
CONFIG.jobs.forEach(function (j, i) { JOB_ORDER[j.id] = i; });
JOB_ORDER.soldier = 7; JOB_ORDER.idle = 8;
var rosterVersion = 0;
function buildRoster(b) {
  var F = ui.roster;
  var hd = line(b, 72, 'hd sep'); txt(hd, 24, '居民名冊'); var total = rtxt(hd, 696, ''); total.id = 'rosterCount';
  var f = line(b, 112);
  function sel(x, w, id, opts, key) {
    var s = el('select', 'ab sel', f); box(s, x, 8, w, 96); s.id = id;
    opts.forEach(function (o) { var op = el('option', '', s, o[1]); op.value = o[0]; });
    s.value = F[key]; s.onchange = function () { F[key] = s.value; F.ver = -1; upd(); };
    return s;
  }
  sel(8, 224, 'fSex', [['all', '全性別'], ['M', '♂ 男'], ['F', '♀ 女']], 'sex');
  sel(248, 224, 'fJob', [['all', '全職業']].concat(CONFIG.jobs.map(function (j) { return [j.id, j.name]; }), [['soldier', '士兵'], ['idle', '閒置']]), 'job');
  sel(488, 224, 'fTal', [['all', '全天賦'], ['yes', '有天賦'], ['no', '無天賦']], 'tal');
  f = line(b, 112);
  txt(f, 24, '排序', 'dim');
  sel(128, 224, 'fKey', [['job', '職業'], ['age', '年齡'], ['0', '勇武'], ['1', '智力'], ['2', '精神'], ['3', '耐力'], ['4', '統帥']], 'key');
  var dir = btn(f, 368, 8, 240, 96, ''); dir.id = 'fDir';
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
  function S(x, s, cls) { return '<span class="ab t' + (cls ? ' ' + cls : '') + '" style="left:' + du(x) + '">' + s + '</span>'; }
  function L(h, inner) { return '<div class="ln" style="height:' + du(h) + '">' + inner + '</div>'; }
  function upd() {
    btnLabel(dir, F.dir > 0 ? '↑ 低→高' : '↓ 高→低');
    var key = F.key + '|' + rosterVersion;
    if (F.ver === key) return;
    F.ver = key;
    var rows = state.people.filter(function (p) {
      if (p.type !== 'res') return false;
      if (F.sex !== 'all' && p.sex !== F.sex) return false;
      if (F.job !== 'all' && (p.job || 'idle') !== F.job) return false;
      if (F.tal === 'yes' && !p.talent) return false;
      if (F.tal === 'no' && p.talent) return false;
      return true;
    });
    rows.sort(function (a, b) {
      var d;
      if (F.key === 'job') d = JOB_ORDER[a.job || 'idle'] - JOB_ORDER[b.job || 'idle'];
      else if (F.key === 'age') d = a.age - b.age;
      else { var k = +F.key; d = (a.cur[k] - b.cur[k]) || (a.cap[k] - b.cap[k]); }
      return d * F.dir || (a.id - b.id);
    });
    setText(total, '共 ' + rows.length + ' 人');
    var h = '';
    rows.forEach(function (p) {
      var open = !!F.open[p.id];
      h += '<div class="rr' + (open ? ' open' : '') + '" data-id="' + p.id + '">' +
        L(96, S(24, '#' + pad2(p.id)) + S(104, sexCh(p), p.sex === 'M' ? 'male' : 'female') + S(152, p.age + '歲') + S(248, jobName(p), p.job ? '' : 'dim') +
          (p.talent ? S(360, '〔' + p.talent.name + '〕', 'tal') : '') + S(696, '忠' + p.loyalty, 'ra'));
      if (open) {
        h += L(52, attrHTML(p, 0, 24) + attrHTML(p, 1, 248) + attrHTML(p, 2, 472));
        h += L(52, attrHTML(p, 3, 24) + attrHTML(p, 4, 248));
        if (p.talent) {
          var J = JOB[p.talent.job], pct = fmtNum(resTalentPct(p), 1);
          h += L(56, S(24, p.talent.name + ' ' + (p.job === p.talent.job ? '+' + pct + '%' : '0%（' + J.name + '時 +' + pct + '%）'), 'tal'));
        }
      }
      h += '</div>';
    });
    if (!rows.length) h = L(64, S(24, '沒有符合條件的居民', 'dim')) + L(112, '<button class="btn ab f28" id="btnClearFilter" style="left:' + du(24) + ';top:' + du(8) + ';width:' + du(240) + ';height:' + du(96) + '"><span>清除篩選</span></button>');
    list.innerHTML = h;
  }
  return upd;
}

// ===== 軍營 =====
function buildBarracks(b) {
  var h1 = line(b, 72); var head = txt(h1, 24, '', 'bold'); head.id = 'soldierHead';
  txt(line(b, 64, 'hd'), 24, '訓練中');   // v2-land.21 §2：入伍佇列
  var qu = el('div', '', b); qu.id = 'enlistQueue';
  txt(line(b, 64, 'hd'), 24, '入伍（閒置、勇武 ' + CONFIG.enlistMinValor + '★ 以上，' + CONFIG.enlistFood + ' 食物）');
  var en = el('div', '', b); en.id = 'enlistList';
  txt(line(b, 64, 'hd'), 24, '士兵');
  var so = el('div', '', b); so.id = 'soldierList';
  var nt = el('div', 'wrap dim f24', b, '入伍按下時扣 ' + CONFIG.enlistFood + ' 食物，訓練 ' + fmtNum(enlistSecs(), 1) + ' 秒；一次訓練 1 人，最多排 ' + CONFIG.enlistQueueMax + ' 人，取消全退。士兵只駐守，不工作。轉回後 ' + Math.round(CONFIG.reenlistLockSec / 60) + ' 分鐘內不能再入伍。'); nt.style.padding = du(24);
  b.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t || t.disabled) return;
    var id = +t.getAttribute('data-id');
    var act = t.getAttribute('data-act');
    if (act === 'enlist') enlist(id); else if (act === 'back') discharge(id); else if (act === 'cancel') cancelEnlist(id);
    lastBk = ''; render(true);
  });
  var lastBk = '';
  function S(x, s, cls) { return '<span class="ab t' + (cls ? ' ' + cls : '') + '" style="left:' + du(x) + '">' + s + '</span>'; }
  function B(act, id, label, w) { return '<button class="btn ab f28" data-act="' + act + '" data-id="' + id + '" id="' + act + '-' + id + '" style="left:' + du(712 - w) + ';top:' + du(4) + ';width:' + du(w) + ';height:' + du(96) + '"><span>' + label + '</span></button>'; }
  return function () {
    var e = econ(), now = Date.now();
    setText(head, '士兵 ' + e.soldiers + ' / ' + CONFIG.barracksCapL1 + ' 人，每秒吃 ' + fmtNum(e.soldierCons, 2) + ' 食物');
    var blk = enlistBlock(), paused = state.enlistQ.length && queuePaused(e);
    var cand = state.people.filter(function (p) { return enlistState(p, now); });
    var sol = state.people.filter(function (p) { return p.job === 'soldier'; });
    var key = blk + '|' + paused + '|' + state.enlistQ.map(function (it) { return it.id; }).join() + '|' + Math.ceil(state.enlistLeft) + '|' + cand.map(function (p) { var st = enlistState(p, now); return p.id + st + (st === 'locked' ? fmtClock((p.reenlistLockUntil - now) / 1000) : ''); }).join() + '|' + sol.map(function (p) { return p.id; }).join();
    if (key === lastBk) return;
    lastBk = key;
    var h = '';
    state.enlistQ.forEach(function (it, i) {
      var p = byId(it.id); if (!p) return;
      h += '<div class="ln sep" style="height:' + du(104) + '" data-q="' + p.id + '">' + S(24, '#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲') +
        S(300, i ? '排隊中' : paused ? '暫停（食物 0）' : '訓練中 ' + fmtClock(state.enlistLeft), i || paused ? 'dim' : '') + B('cancel', p.id, '取消', 160) + '</div>';
    });
    if (!state.enlistQ.length) h = '<div class="ln" style="height:' + du(64) + '">' + S(24, '沒有人在訓練', 'dim') + '</div>';
    $('enlistQueue').innerHTML = h;
    h = '';
    var why = { cap: '士兵已滿 ' + CONFIG.barracksCapL1 + ' 人', queue: '佇列已滿 ' + CONFIG.enlistQueueMax + ' 人', food: '食物不夠 ' + CONFIG.enlistFood }[blk];
    cand.forEach(function (p) {
      var st = enlistState(p, now);
      h += '<div class="ln sep' + (st === 'locked' ? ' dim' : '') + '" style="height:' + du(104) + '" data-row="' + p.id + '">' + S(24, '#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲') +
        S(220, '勇 ' + starsHTML(p.cur[0], p.cap[0], 5)) +
        (st === 'locked' ? S(696, fmtClock((p.reenlistLockUntil - now) / 1000), 'ra lock') : why ? S(696, why, 'ra dim') : B('enlist', p.id, '入伍', 200)) + '</div>';
    });
    if (!cand.length) h = '<div class="ln" style="height:' + du(64) + '">' + S(24, '目前沒有可入伍的人', 'dim') + '</div>';
    $('enlistList').innerHTML = h;
    h = '';
    sol.forEach(function (p) {
      h += '<div class="ln sep" style="height:' + du(104) + '">' + S(24, '#' + pad2(p.id) + ' ' + sexCh(p) + ' ' + p.age + '歲') + B('back', p.id, '轉回居民', 240) + '</div>';
    });
    if (!sol.length) h = '<div class="ln" style="height:' + du(64) + '">' + S(24, '目前沒有士兵', 'dim') + '</div>';
    $('soldierList').innerHTML = h;
  };
}

// ===== 領主分配（新遊戲第一個畫面；全畫面，左半：性別與說明，右半：點數）=====
function buildLordSetup() {
  var o = $('lordSetup'); o.innerHTML = '';
  box(o, 0, 0, 'var(--dw)', 720);
  var half = el('div', 'ab half', o); box(half, 0, 0, 'var(--dw) / 2', 720);
  var t = el('div', 'ab t f40', o, '分配領主屬性'); box(t, 48, 16, null, 80);
  var av = el('div', 'ab avatar N', o, '?'); box(av, 'var(--dw) / 4 - 70', 112, 140, 140); av.id = 'setupAvatar';
  var sm = btn(o, 'var(--dw) / 4 - 176', 280, 160, 96, '♂ 男', 'sexbtn'); sm.id = 'lordSexM'; sm.onclick = function () { lordSetSex('M'); render(true); };
  var sf = btn(o, 'var(--dw) / 4 + 16', 280, 160, 96, '♀ 女', 'sexbtn'); sf.id = 'lordSexF'; sf.onclick = function () { lordSetSex('F'); render(true); };
  var info = el('div', 'ab t', o, '人口 ' + state.people.length + ' 人　選性別、分配 ' + CONFIG.lordFreePoints + ' 點自由點'); box(info, 48, 400, null, 56); info.id = 'setupInfo';
  var note = el('div', 'ab wrap warn f24', o, loadNotice || (importedV1a ? '已讀入 v1a.3 的存檔（只讀，不會改動原本的存檔）。' : '')); box(note, 48, 460, 'var(--dw) / 2 - 96'); note.id = 'loadNotice';
  var TIP = '選好性別、點數用完才能確定，確定後不能再改';
  var tip = el('div', 'ab wrap dim f24', o, TIP); box(tip, 48, 540, 'var(--dw) / 2 - 200'); tip.id = 'lordTip';
  var R0 = 'var(--dw) / 2 + 40';
  var left = el('div', 'ab t f30', o); box(left, R0, 16, null, 80); left.id = 'lordLeft';
  var lg = el('div', 'ab t dim f24', o, '系統＋自由＝合計'); box(lg, 'var(--dw) - 48', 16, null, 80); lg.classList.add('ra'); lg.id = 'lordLegend';
  var rows = ATTR.map(function (n, a) {
    var y = 100 + a * 100;
    var l = el('div', 'ab t bold', o, n); box(l, R0, y, null, 96);
    var mi = btn(o, 'var(--dw) / 2 + 136', y, 96, 96, '－', 'jbtn'); mi.id = 'lord-minus-' + a; mi.onclick = function () { lordAdj(a, -1); render(true); };
    var st = el('span', 'ab', o); box(st, 'var(--dw) / 2 + 248', y + 8); st.style.lineHeight = du(44);
    var v = el('span', 'ab f24', o); box(v, 'var(--dw) / 2 + 248', y + 52); v.style.lineHeight = du(36); v.id = 'lord-val-' + a;
    var pl = btn(o, 'var(--dw) - 144', y, 96, 96, '＋', 'jbtn'); pl.id = 'lord-plus-' + a; pl.onclick = function () { lordAdj(a, 1); render(true); };
    return { mi: mi, pl: pl, st: st, v: v };
  });
  var ok = btn(o, 'var(--dw) / 2 - 120', 608, 240, 96, '確定', 'primary'); ok.id = 'lordOk';
  var tipTimer = 0;
  ok.onclick = function () {   // 不用 disabled：還不能確定時點一下，短暫顯示原因
    if (lordConfirm()) { loadNotice = ''; goHome(); render(true); return; }
    var why = lordBlockReasons(); if (!why.length) return;
    tip.textContent = why.join('、'); tip.className = 'ab wrap warn f24 bold'; tip.setAttribute('data-reason', '1');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.textContent = TIP; tip.className = 'ab wrap dim f24'; tip.removeAttribute('data-reason'); }, 2000);
  };
  R.setup = { left: left, rows: rows, ok: ok, sm: sm, sf: sf, av: av };
}
function lordBlockReasons() {
  var L = state.lord, rest = CONFIG.lordFreePoints - lordUsed(), r = [];
  if (L.sex !== 'M' && L.sex !== 'F') r.push('還沒選性別');
  if (rest > 0) r.push('還有 ' + rest + ' 點沒分');
  return r;
}
function renderLordSetup() {
  var L = state.lord, rest = CONFIG.lordFreePoints - lordUsed();
  setText(R.setup.left, '自由點剩餘 ' + rest + '（共 ' + CONFIG.lordFreePoints + '）');
  R.setup.rows.forEach(function (r, a) {
    setHTML(r.st, starsHTML(L.attrs[a], L.attrs[a], CONFIG.lordAttrMax));
    setText(r.v, L.sys[a] + '+' + (L.attrs[a] - L.sys[a]) + '=' + L.attrs[a]);
    setDis(r.mi, L.attrs[a] <= L.sys[a]); setDis(r.pl, rest <= 0 || L.attrs[a] >= CONFIG.lordAttrMax);
  });
  setCls(R.setup.sm, 'btn ab f28 sexbtn' + (L.sex === 'M' ? ' on' : '')); setCls(R.setup.sf, 'btn ab f28 sexbtn' + (L.sex === 'F' ? ' on' : ''));
  setCls(R.setup.av, 'ab avatar ' + (L.sex === 'M' ? 'M' : L.sex === 'F' ? 'F' : 'N')); setText(R.setup.av, L.sex === 'M' ? '♂' : L.sex === 'F' ? '♀' : '?');
  var blocked = lordBlockReasons().length > 0;
  setCls(R.setup.ok, 'btn ab f28 primary' + (blocked ? ' off' : '')); R.setup.ok.setAttribute('data-blocked', blocked ? '1' : '0');
}

// ===== 請轉橫向（§8）：直式時蓋住全部、暫停模擬 =====
var mqPortrait = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
if (mqPortrait) { if (mqPortrait.addEventListener) mqPortrait.addEventListener('change', applyScale); else if (mqPortrait.addListener) mqPortrait.addListener(applyScale); }
function checkOrientation() {
  var p = window.innerHeight > window.innerWidth;   // 和 (orientation: portrait) 相同判斷；直接看尺寸，避免 matchMedia 還沒更新
  if (p === portrait) return;
  portrait = p;
  $('rotate').hidden = !p;
  document.documentElement.setAttribute('data-paused', p ? '1' : '0');
  if (p) { cancelDrag(); cancelHolds(); }
  else {
    last = Date.now();
    if (pendingWelcome !== null && state && state.lord.done) { var a = pendingWelcome; pendingWelcome = null; showWelcome(a); }
  }
}
// ===== 歡迎回來（§7）=====
var lastOffline = null;
function showWelcome(awaySec) {
  if (!state.lord.done) return;
  if (portrait) { pendingWelcome = awaySec; return; }
  openPopup('welcome', awaySec);
}

// ===== 主 render =====
var lastSlow = 0, setupShown = null;
function render(force) {
  var now = Date.now();
  if (uiDirty) { rosterVersion++; }
  var showSetup = !state.lord.done;
  if (showSetup !== setupShown) { setupShown = showSetup; $('lordSetup').hidden = !showSetup; if (showSetup) { closePopup(); closePage(); buildLordSetup(); } }
  if (showSetup) { renderLordSetup(); uiDirty = false; return; }
  renderSides();
  var slow = force || uiDirty || now - lastSlow >= 1000 || now < lastSlow;   // 彈窗、面板數字每 1 秒更新（有操作時立即）
  if (slow) {
    lastSlow = now;
    updateTime();
    if (ui.popup) ui.popup.update();
    if (ui.page) { if (R.popBar) updatePopBar(); if (R.pageUpdate) R.pageUpdate(); }
  }
  setText($('saveNote'), saveFailed ? '這個瀏覽器不允許存檔：遊戲照常進行，但關掉後進度不會保留' : '');
  uiDirty = false;
}

// ===== 迴圈 =====
var lastDraw = 0;
function frameLoop() {
  var t = performance.now();
  if (!inBackground && !portrait && t - lastDraw >= 30) {   // 約 30 fps
    lastDraw = t;
    try { drawMap(); } catch (e) { showError('map', e); }
  }
  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(frameLoop); else setTimeout(frameLoop, 33);
}
function showError(where, e) { $('error').textContent = '程式錯誤（' + where + '）：' + (e && e.message ? e.message : e); if (window.console) console.error(e); }
var last = Date.now(), sinceSave = 0;
// v2-land.12：第一次畫地圖（靜態層＋畫布字）前先等芫荽載好；字型載不到時最多等 FONT_WAIT_MS 就照樣開始（用備用字型），之後載到了再重畫
var FONT_WAIT_MS = 1200, FONT_STATE = { status: 'pending', ms: 0, late: false };
window.TL_FONT = FONT_STATE;   // 測試用
function whenFontReady(cb) {
  var t0 = Date.now(), done = false;
  function go(st) { if (done) return; done = true; FONT_STATE.status = st; FONT_STATE.ms = Date.now() - t0; worldDirty = true; uiDirty = true; cb(); }
  if (!(document.fonts && typeof document.fonts.load === 'function')) { go('none'); return; }
  setTimeout(function () { go('timeout'); }, FONT_WAIT_MS);
  try {
    document.fonts.load('26px "Iansui"', '部落領主').then(function (f) {
      if (done) { FONT_STATE.late = !!(f && f.length); worldDirty = true; uiDirty = true; return; }   // 超時以後才載到：重畫
      go(f && f.length ? 'loaded' : 'missing');
    }, function () { go('error'); });
  } catch (e) { go('error'); }
}
function boot() {
  var fresh = false;
  claimTab();   // v2-land.14：先宣告自己是最新分頁，再讀檔
  try {
    state = loadState();
    if (!state) {
      var m = /[#&?]seed=(\d+)/.exec(location.hash + '&' + location.search);   // 測試用：#seed=N 只在沒有存檔時決定新局的種子
      state = newGameState(m ? (+m[1]) >>> 0 : randomSeed());
      MODS = heroMods(state.people); fresh = true;
    } else MODS = heroMods(state.people);
  } catch (e) { showError('load', e); state = newGameState(randomSeed()); MODS = heroMods(state.people); fresh = true; }
  var away = (Date.now() - state.lastSeen) / 1000;   // 讀檔前的最後在線時間
  if (!fresh) lastOffline = applyOffline(away);   // v2-land.21：離線收益、入伍佇列
  save();
  buildUI();
  applyScale();
  goHome();
  render(true);
  whenFontReady(frameLoop);   // 畫地圖要等字型（DOM 文字用 font-display: block，自己會等）
  if (!fresh && state.lord.done && away >= CONFIG.welcomeMinAwaySec) showWelcome(away);   // 新局不顯示
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { uiDirty = true; worldDirty = true; }, function () {});
}
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', function () { applyScale(); setTimeout(applyScale, 300); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', applyScale);
document.addEventListener('visibilitychange', function () {
  if (tabLocked) return;   // v2-land.14：舊分頁不再存、不再顯示歡迎回來
  if (document.visibilityState === 'hidden') { inBackground = true; hiddenAt = Date.now(); cancelDrag(); cancelHolds(); save(); }
  else {
    if (checkTab()) return;
    inBackground = false; last = Date.now(); camDirty = true;
    try { render(true); } catch (e) { showError('render', e); }
    var away = hiddenAt ? (Date.now() - hiddenAt) / 1000 : 0; hiddenAt = 0;
    lastOffline = applyOffline(away); dirty(); save();   // v2-land.21：背景期間照離線算
    if (away >= CONFIG.welcomeMinAwaySec) showWelcome(away);
  }
});
boot();
var lastVW = 0, lastVH = 0;
setInterval(function () {
  if (window.innerWidth !== lastVW || window.innerHeight !== lastVH) { lastVW = window.innerWidth; lastVH = window.innerHeight; try { applyScale(); } catch (e) { showError('scale', e); } }   // 保險：有些瀏覽器轉向後 resize 事件很晚才來
  // v2-land.14：保險，每一輪都讀一次分頁代號（有些情況收不到通知，例如 WebKit 重新載入過的分頁收不到 storage 事件）
  if (!tabLocked && !window.TL_TABPOLL_OFF) checkTab({ via: 'poll' });   // TL_TABPOLL_OFF 只給測試用：單獨驗證通知那條路
  try {
    var now = Date.now(), sec = (now - last) / 1000;
    if (!(sec >= 0)) sec = 0;
    sec = Math.min(sec, CONFIG.maxTickSec);   // 離線、背景都不補時間
    last = now;
    if (inBackground || portrait || tabLocked) sec = 0;   // v2-land.14：舊分頁整個停住     // 請轉橫向時暫停：產出、幸福度、遊玩時間（時鐘）都停
    tick(sec);
    if (state.lord.done) floatTick(sec, econ());
    sinceSave += sec;
    if (sinceSave >= CONFIG.autosaveSec) { sinceSave = 0; save(); }
  } catch (e) { showError('tick', e); }
  try { render(); } catch (e) { showError('render', e); }
}, CONFIG.tickMs);
window.addEventListener('beforeunload', save);
window.addEventListener('pagehide', save);
window.addEventListener('pageshow', function (e) { if (e.persisted) checkTab(); });   // 從上一頁快取回來：先確認
// 測試用（純函式，不改遊戲狀態）
window.TL_SIM = { genWorld: genWorld, CONFIG: CONFIG, HERO_TALENTS: HERO_TALENTS };
window.TL_STATE = function () { return state; };
