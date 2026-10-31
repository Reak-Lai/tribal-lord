
// ===== 查表 =====
var BLD = {}, JOB = {}, TAL = {};
CONFIG.buildings.forEach(function (b) { BLD[b.id] = b; });
CONFIG.jobs.forEach(function (j) { JOB[j.id] = j; });
HERO_TALENTS.forEach(function (t) { TAL[t[0]] = { id: t[0], cat: t[1], name: t[2], min: t[3], max: t[4], unit: t[5], status: t[6], effect: t[7] }; });
var TAL_BY_CAT = {};
HERO_TALENTS.forEach(function (t) { (TAL_BY_CAT[t[1]] = TAL_BY_CAT[t[1]] || []).push(t[0]); });
function talentActive(tid) { return !!CONFIG.heroTalentEffects[tid]; }

// ===== 亂數（用 start.seed，重新整理結果相同）=====
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ===== 生成（純函式：同一個 seed → 同一份結果）=====
function genWorld(seed) {
  var C = CONFIG, rnd = mulberry32(seed >>> 0);
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  var P = ri(C.popMin, C.popMax);
  var H = Math.round(C.heroRatio * P + 1e-9);
  var R = P - H, people = [], i;
  for (i = 0; i < R; i++) people.push(genResident(i + 1));
  // §7 居民生產天賦：每局配額
  var r = C.resTalentRMin + (C.resTalentRMax - C.resTalentRMin) * rnd();
  var n = Math.round(R * r), idx = [];
  for (i = 0; i < R; i++) idx.push(i);
  for (i = 0; i < n; i++) {
    var j = i + Math.floor(rnd() * (R - i)), tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    var u = rnd(), acc = 0, pick = C.resTalentJobs[C.resTalentJobs.length - 1];
    for (var q = 0; q < C.resTalentJobs.length; q++) { acc += C.resTalentJobs[q].p; if (u < acc) { pick = C.resTalentJobs[q]; break; } }
    people[idx[i]].talent = { kind: 'res', job: pick.job, name: pick.name, coef: pick.coef };
  }
  for (i = 0; i < H; i++) people.push(genHero(R + i + 1));
  var lord = { sex: rnd() < C.maleRatio ? 'M' : 'F', points: ri(C.lordPointsMin, C.lordPointsMax) };
  people.forEach(validatePerson);
  return { pop: P, heroes: H, residents: R, r: r, people: people, lord: lord };

  function base(id, type) {
    return { id: id, type: type, sex: rnd() < C.maleRatio ? 'M' : 'F', age: ri(C.ageMin, C.ageMax), loyalty: C.loyalty, cur: [], cap: [], talent: null };
  }
  function genResident(id) {
    var p = base(id, 'res');
    for (var a = 0; a < 5; a++) {
      var cap = rnd() < C.resCap3P ? 3 : 2;
      var cur = cap === 2 ? (rnd() < C.resCap2Cur1P ? 1 : 2) : (rnd() < C.resCap3Cur3P ? 3 : 2);
      p.cap.push(cap); p.cur.push(cur);
    }
    return p;
  }
  function genHero(id) {
    var p = base(id, 'hero'), u = rnd(), k = C.heroKProbs.length, acc = 0, a;
    for (a = 0; a < C.heroKProbs.length; a++) { acc += C.heroKProbs[a]; if (u < acc) { k = a + 1; break; } }
    var order = [0, 1, 2, 3, 4];
    for (a = 0; a < 5; a++) { var j = a + Math.floor(rnd() * (5 - a)), t = order[a]; order[a] = order[j]; order[j] = t; }
    var stand = order.slice(0, k), cur = [0, 0, 0, 0, 0];
    stand.forEach(function (s) { cur[s] = rnd() < C.heroStandout5P ? 5 : 4; });
    var guard = 0;
    do {
      for (a = 0; a < 5; a++) if (stand.indexOf(a) < 0) cur[a] = rnd() < C.heroOther3P ? 3 : 2;
      if (++guard > 1000) throw new Error('英雄生成重抽超過 1000 次');
    } while (cur[0] + cur[1] + cur[2] + cur[3] + cur[4] < C.heroMinTotal);
    p.cur = cur.slice(); p.cap = cur.slice();       // 英雄 cap = cur【預設 §16 #9】
    p.standout = stand.slice().sort();
    if (rnd() < C.heroTalentP) {
      var cat = ATTR[stand[Math.floor(rnd() * stand.length)]];
      var pool = TAL_BY_CAT[cat], tid = pool[Math.floor(rnd() * pool.length)], T = TAL[tid];
      p.talent = { kind: 'hero', tid: tid, value: T.min + (T.max - T.min) * rnd() };   // 建立時抽一次【預設 §16 #8】
    }
    return p;
  }
}
function validatePerson(p) {
  for (var a = 0; a < 5; a++) {
    var c = p.cur[a], k = p.cap[a];
    if (!(c === (c | 0) && k === (k | 0) && c >= 1 && c <= k && k <= 5)) throw new Error('人物資料錯誤：#' + p.id + ' ' + ATTR[a] + ' cur=' + c + ' cap=' + k + '（要 1 <= cur <= cap <= 5）');
  }
}

// ===== 狀態 =====
var state, MODS;
function startMaterial(P) { return CONFIG.startMatPer10 * Math.ceil(P / 10) + CONFIG.startMatBase; }
function newGameState(seed) {
  var w = genWorld(seed), C = CONFIG;
  var s = {
    v: C.saveVersion,
    start: { pop: w.pop, seed: seed >>> 0 },
    lord: { sex: w.lord.sex, points: w.lord.points, attrs: [0, 0, 0, 0, 0], done: false },
    people: w.people.map(function (p) { p.job = null; p.bld = -1; p.seq = 0; p.reenlistLockUntil = 0; return p; }),
    food: C.startFoodPerPop * w.pop, material: startMaterial(w.pop), mineral: 0,
    built: {}, happiness: 0, gatherStopped: false, seqCounter: 0,
    explored: [], lastOnline: Date.now(), playSec: 0
  };
  C.buildings.forEach(function (b) { s.built[b.id] = b.start || 0; });
  for (var i = 0; i < C.map.cols * C.map.rows; i++) s.explored.push(1);   // 全部已探索，沒有迷霧（保留欄位給之後）
  var m = heroMods(s.people);
  s.happiness = Math.round(C.happinessStart + m.inspire);
  return s;
}

// 英雄天賦加總（英雄固定，所以載入後算一次）
function heroMods(people) {
  var m = { prod: {}, slot: {}, jerky: 0, supply: 0, leader: 0, costAll: [], costBld: {}, straw: 0, resolve: 0, inspire: 0, list: [] };
  CONFIG.jobs.forEach(function (j) { m.prod[j.id] = 0; });
  people.forEach(function (p) {
    if (p.type !== 'hero' || !p.talent) return;
    var e = CONFIG.heroTalentEffects[p.talent.tid], v = p.talent.value;
    if (!e) return;
    m.list.push(p.talent.tid);
    if (e.type === 'prod') e.jobs.forEach(function (j) { m.prod[j] += v / 100; });
    else if (e.type === 'slot') m.slot[e.bld] = (m.slot[e.bld] || 0) + Math.round(v);
    else if (e.type === 'jerky') m.jerky += v / 100;
    else if (e.type === 'supply') m.supply += v / 100;
    else if (e.type === 'leader') m.leader += v / 100;
    else if (e.type === 'cost') { if (e.blds) e.blds.forEach(function (b) { (m.costBld[b] = m.costBld[b] || []).push(v / 100); }); else m.costAll.push(v / 100); }
    else if (e.type === 'straw') m.straw += v;
    else if (e.type === 'resolve') m.resolve += v / 100;
    else if (e.type === 'inspire') m.inspire += v;
  });
  return m;
}

function slotsPer(bid) { return (BLD[bid].slots || 0) + (MODS.slot[bid] || 0); }
function jobSlots(jid) { var b = JOB[jid].bld; return state.built[b] * slotsPer(b); }
function costOf(bid) {
  var c = BLD[bid].cost;
  MODS.costAll.concat(MODS.costBld[bid] || []).forEach(function (r) { c *= Math.max(0, 1 - r); });
  return Math.round(c);
}
function beds() { return state.built.house * BLD.house.beds; }
function jobS(p, jid) { var w = JOB[jid].w, s = 0; for (var a = 0; a < 5; a++) s += w[a] * p.cur[a]; return s; }
function resTalentPct(p) {   // 居民天賦數值（%）：係數 × max(3, 3s − 1)，s = 天賦職業的加權
  if (!p.talent || p.talent.kind !== 'res') return 0;
  var s = jobS(p, p.talent.job);
  return p.talent.coef * Math.max(CONFIG.resTalentMinPct, CONFIG.resTalentPerStar * s + CONFIG.resTalentOffset);
}
function hasJobTalent(p, jid) { return !!(p.talent && p.talent.kind === 'res' && p.talent.job === jid); }
function isIdleRes(p) { return p.type === 'res' && !p.job; }
function stamTerm(p) { return CONFIG.staminaPerStar * (p.cur[A_STAMINA] - CONFIG.staminaBase); }
function spiritR(p) { return CONFIG.spiritPerStar * (p.cur[A_SPIRIT] - CONFIG.spiritBase); }

// ===== 產量／消耗（§9.3、§10.1）。people 可以是假設的派工（「還能閒置」試算用），virtual = 不受座數限制 =====
function computeEcon(people) {
  var C = CONFIG, e = { job: {}, workers: {}, food: 0, material: 0, mineral: 0, cons: 0, gather: 0, straw: 0, leaders: {}, soldiers: 0, soldierCons: 0, maxM: 0 };
  var groups = {};
  people.forEach(function (p) {
    if (p.job === 'soldier') { e.soldiers++; return; }
    if (!p.job) return;
    var key = p.job + ':' + p.bld;
    (groups[key] = groups[key] || []).push(p);
  });
  C.jobs.forEach(function (j) { e.job[j.id] = 0; e.workers[j.id] = 0; });
  Object.keys(groups).forEach(function (key) {
    var list = groups[key], jid = list[0].job, J = JOB[jid], B = BLD[J.bld];
    var leader = list[0];   // 領班：統帥 s 最高；同分選最早進這座建築的人（seq 小）
    list.forEach(function (p) { if (p.cur[A_COMMAND] > leader.cur[A_COMMAND] || (p.cur[A_COMMAND] === leader.cur[A_COMMAND] && p.seq < leader.seq)) leader = p; });
    e.leaders[key] = leader.id;
    var lead = C.leaderPerStar * Math.max(0, leader.cur[A_COMMAND] - C.leaderBase) * (1 + MODS.leader);
    var tribe = 1 + MODS.prod[jid];
    list.forEach(function (p) {
      var m = 1 + (J.stamina ? stamTerm(p) : 0) + (hasJobTalent(p, jid) ? resTalentPct(p) / 100 : 0) + lead;
      m = Math.min(C.personalMultCap, m);
      if (m > e.maxM) e.maxM = m;
      var out = B.rate * tribe * m * C.happinessProdE;
      e.job[jid] += out; e.workers[jid]++;
      e[B.produces] += out;
    });
  });
  if (!state.gatherStopped && state.built.lumber === 0) {
    people.forEach(function (p) { if (isIdleRes(p)) e.gather += C.gatherPerIdlePerSec * (1 + stamTerm(p)); });
    e.material += e.gather;
  }
  e.straw = e.workers.farm * MODS.straw; e.material += e.straw;
  var jerky = Math.max(0, 1 - MODS.jerky), supply = Math.max(0, 1 - MODS.supply);
  people.forEach(function (p) {
    var c = C.foodPerPersonPerSec * supply;
    if (p.job === 'soldier') { c *= C.soldierFoodMult; e.soldierCons += c; }
    else if (p.type === 'hero') c *= C.heroFoodMult;
    if (p.job === 'hunt') c *= jerky;
    e.cons += c;
  });
  e.foodNet = e.food - e.cons;
  return e;
}

var econCache = null;
function econ() { if (!econCache) econCache = computeEcon(state.people); return econCache; }
function dirty() { econCache = null; hintCache = null; uiDirty = true; }

function happinessDecayPerMin() {
  var n = state.people.length, R = 0;
  state.people.forEach(function (p) { R += spiritR(p); });
  R = n ? R / n : 0;
  return CONFIG.happinessDecayPerMin * (1 - R) * Math.max(0, 1 - MODS.resolve);
}

function tick(sec) {
  if (!state.lord.done || !(sec > 0)) return;
  var e = econ();
  state.food = Math.max(0, state.food + e.foodNet * sec);   // 食物到 0 停在 0，不減人口
  state.material = Math.max(0, state.material + e.material * sec);
  state.mineral = Math.max(0, state.mineral + e.mineral * sec);
  state.happiness = Math.max(CONFIG.happinessMin, state.happiness - happinessDecayPerMin() / 60 * sec);
  state.playSec += sec;
}

// ===== 派工（§13.4）=====
function idleResidents() { return state.people.filter(isIdleRes); }
function plusOrder(jid) {   // + 時：先有該職業天賦，再看 s 高，同分編號小
  return function (a, b) { return (hasJobTalent(b, jid) - hasJobTalent(a, jid)) || (jobS(b, jid) - jobS(a, jid)) || (a.id - b.id); };
}
function freeBldIndex(people, jid, virtual) {
  var b = JOB[jid].bld, per = slotsPer(b), n = virtual ? 1e9 : state.built[b], cnt = {};
  people.forEach(function (p) { if (p.job === jid) cnt[p.bld] = (cnt[p.bld] || 0) + 1; });
  for (var i = 0; i < n; i++) if ((cnt[i] || 0) < per) return i;
  return -1;
}
function canPlus(jid) { return idleResidents().length > 0 && econ().workers[jid] < jobSlots(jid); }
function assignPlus(jid) {
  if (!canPlus(jid)) return false;
  var bi = freeBldIndex(state.people, jid, false);
  if (bi < 0) return false;
  var p = idleResidents().sort(plusOrder(jid))[0];
  p.job = jid; p.bld = bi; p.seq = ++state.seqCounter;   // 依序填：第 1 座滿了才填第 2 座
  dirty(); return true;
}
function assignMinus(jid) {   // − 時反過來：先放沒天賦、s 低的
  var list = state.people.filter(function (p) { return p.job === jid; });
  if (!list.length) return false;
  var o = plusOrder(jid), p = list.sort(function (a, b) { return -o(a, b); })[0];
  p.job = null; p.bld = -1; p.seq = 0;
  dirty(); return true;
}

// 「還能閒置 N 人」：假設依 + 的順序把閒置居民派去狩獵（不受工位限制），直到食物產量 ≥ 消耗 × 130%；用每個人的實際產量
var hintCache = null;
function idleHint() {
  if (hintCache) return hintCache;
  var sim = state.people.map(function (p) { return { id: p.id, type: p.type, cur: p.cur, talent: p.talent, job: p.job, bld: p.bld, seq: p.seq }; });
  var idle = sim.filter(isIdleRes).sort(plusOrder('hunt')), x = 0, seq = state.seqCounter;
  var e = computeEcon(sim);
  // 食物淨值 < 0：X = 讓淨值 ≥ 0 最少要再派的獵人（目標 = 消耗 × 1）；淨值 ≥ 0：照「還能閒置 N 人」（目標 = 消耗 × 130%）【企劃確認 2026-10-31】
  // X 是真實缺口，不受工位限制；一鍵按鈕實際派的人數受狩獵工位和閒置人數限制（見 oneKeyHunt）
  var short = e.food - e.cons < -1e-9, target = short ? 1 : CONFIG.idleHintSurplus;
  while (e.food < target * e.cons - 1e-9 && x < idle.length) {
    var p = idle[x++]; p.bld = freeBldIndex(sim, 'hunt', true); p.job = 'hunt'; p.seq = ++seq;
    e = computeEcon(sim);
  }
  if (e.food < target * e.cons - 1e-9) {   // 閒置的人全派還不夠：剩下的用基礎產量估算
    var per = BLD.lodge.rate * (1 + MODS.prod.hunt) * CONFIG.happinessProdE;
    x += Math.ceil((target * e.cons - e.food) / per - 1e-9);
  }
  hintCache = { short: short, need: x, idle: idle.length, n: idle.length - x };
  return hintCache;
}
function oneKeyHunt() {
  var h = idleHint(), k = 0;
  for (var i = 0; i < h.need; i++) { if (!assignPlus('hunt')) break; k++; }
  return k;
}

// ===== 建造 =====
function canBuild(bid) { return bid !== 'council' && state.material + 1e-9 >= costOf(bid); }
function build(bid) {
  if (!canBuild(bid)) return false;
  state.material -= costOf(bid);
  state.built[bid]++;
  if (bid === 'lumber') state.gatherStopped = true;   // 撿柴永久停止
  dirty(); worldDirty = true; save();
  return true;
}

// ===== 軍營（§11）=====
function enlistState(p, now) {   // 'ok' | 'locked' | null（不在名單）
  if (p.type !== 'res' || p.job || p.cur[A_VALOR] < CONFIG.enlistMinValor) return null;
  return now < (p.reenlistLockUntil || 0) ? 'locked' : 'ok';
}
function enlist(id) {
  var p = byId(id);
  if (!p || state.built.barracks < CONFIG.enlistNeedsBarracks || enlistState(p, Date.now()) !== 'ok') return false;
  p.job = 'soldier'; p.bld = -1;
  dirty(); save(); return true;
}
function discharge(id) {
  var p = byId(id);
  if (!p || p.job !== 'soldier') return false;
  p.job = null; p.bld = -1; p.reenlistLockUntil = Date.now() + CONFIG.reenlistLockSec * 1000;
  dirty(); save(); return true;
}
function byId(id) { for (var i = 0; i < state.people.length; i++) if (state.people[i].id === id) return state.people[i]; return null; }

// ===== 領主分配 =====
function lordUsed() { return state.lord.attrs.reduce(function (a, b) { return a + b; }, 0); }
function lordAdj(a, d) {
  var L = state.lord;
  if (L.done) return;
  var v = L.attrs[a] + d;
  if (v < 0 || v > CONFIG.lordAttrMax || (d > 0 && lordUsed() >= L.points)) return;
  L.attrs[a] = v; uiDirty = true;
}
function lordConfirm() {
  if (state.lord.done || lordUsed() !== state.lord.points) return false;
  state.lord.done = true; save(); uiDirty = true; return true;
}

// ===== 存檔（§14）=====
var saveFailed = false, loadNotice = '';
function save() {
  if (!state) return;
  state.lastOnline = Date.now();
  try { localStorage.setItem(CONFIG.saveKey, JSON.stringify(state)); saveFailed = false; }
  catch (e) { saveFailed = true; }
}
function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function loadState() {
  var raw = null;
  try { raw = localStorage.getItem(CONFIG.saveKey); } catch (e) { saveFailed = true; }
  if (raw) {
    try { var s = JSON.parse(raw); sanitize(s); return s; }
    catch (e) { loadNotice = '存檔讀取失敗（' + (e && e.message ? e.message : e) + '），已開始新遊戲。'; }
  } else {
    CONFIG.oldSaveKeys.forEach(function (k) {
      try {
        var old = localStorage.getItem(k);
        if (old) { localStorage.setItem(k + '_backup', old); localStorage.removeItem(k); loadNotice = '找到舊版（v0.8 以前）的存檔，這版的規則完全不同，沒辦法沿用，已開始新遊戲。'; }
      } catch (e) { /* 不能存檔的環境 */ }
    });
  }
  return null;
}
function sanitize(s) {   // 版本不對或資料壞掉就丟錯 → 開新局並提示
  if (!s || s.v !== CONFIG.saveVersion) throw new Error('版本不同');
  if (!s.start || !(s.start.pop >= CONFIG.popMin && s.start.pop <= CONFIG.popMax) || !Array.isArray(s.people) || s.people.length !== s.start.pop) throw new Error('人口資料不符');
  s.people.forEach(function (p) {
    validatePerson(p);
    if (p.job && p.job !== 'soldier' && !JOB[p.job]) throw new Error('職業不明');
    if (p.type === 'hero' && p.job) throw new Error('英雄不能派工');
    if (p.talent && p.talent.kind === 'hero' && !TAL[p.talent.tid]) throw new Error('天賦不明');
    p.reenlistLockUntil = num(p.reenlistLockUntil, 0); p.seq = num(p.seq, 0); p.bld = num(p.bld, -1);
  });
  ['food', 'material', 'mineral', 'happiness', 'playSec', 'seqCounter'].forEach(function (k) { s[k] = Math.max(0, num(s[k], 0)); });
  CONFIG.buildings.forEach(function (b) { s.built[b.id] = Math.max(b.start || 0, num(s.built && s.built[b.id], 0) | 0); });
  if (!s.lord || !Array.isArray(s.lord.attrs)) throw new Error('領主資料錯誤');
  if (!Array.isArray(s.explored)) { s.explored = []; for (var i = 0; i < CONFIG.map.cols * CONFIG.map.rows; i++) s.explored.push(1); }
  delete s.cam;   // 鏡頭不存檔：重新整理一律回營地
}
function wipeAndNew(seed) {
  try { localStorage.removeItem(CONFIG.saveKey); } catch (e) { /* 略過 */ }
  state = newGameState(seed); MODS = heroMods(state.people); dirty(); worldDirty = true;
  save();
}
function randomSeed() {
  try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; }
}
