
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
  var lord = { sex: null, points: C.lordSysPoints + C.lordFreePoints, sys: rollLordSys(rnd) };   // 性別由玩家選（v1a.3）
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
function rollLordSys(rnd) {   // 系統點：每點 1/5 機率落在某一項；那項已滿 5★ 就重抽（10 點 < 25 格，一定抽得完）
  var sys = [0, 0, 0, 0, 0];
  for (var i = 0; i < CONFIG.lordSysPoints; i++) {
    var a; do { a = Math.floor(rnd() * 5); } while (sys[a] >= CONFIG.lordAttrMax);
    sys[a]++;
  }
  return sys;
}
function validatePerson(p) {
  for (var a = 0; a < 5; a++) {
    var c = p.cur[a], k = p.cap[a];
    if (!(c === (c | 0) && k === (k | 0) && c >= 1 && c <= k && k <= 5)) throw new Error('人物資料錯誤：#' + p.id + ' ' + ATTR[a] + ' cur=' + c + ' cap=' + k + '（要 1 <= cur <= cap <= 5）');
  }
}

// ===== 狀態 =====
var state, MODS;
function startMaterial(P) {   // v2-land.21 §1 #4；−1e-9：P = 35 時 0.2 × 35 ÷ 1.75 在浮點是 4.000…01
  var C = CONFIG, n0 = Math.ceil(C.startMatHouses * P / C.startMatPerHouse - 1e-9), m = C.startMatBase;
  for (var n = 1; n <= n0; n++) m += Math.round(C.startMatFirst * Math.pow(C.costGrowth, n - 1));
  return m;
}
function newGameState(seed) {
  var w = genWorld(seed), C = CONFIG;
  var s = {
    v: C.saveVersion,
    start: { pop: w.pop, seed: seed >>> 0 },
    lord: { sex: null, points: w.lord.points, sys: w.lord.sys.slice(), attrs: w.lord.sys.slice(), done: false },   // attrs = 系統 + 自由
    people: w.people.map(function (p) { p.job = null; p.bld = -1; p.seq = 0; p.reenlistLockUntil = 0; return p; }),
    food: C.startFoodPerPop * w.pop, material: startMaterial(w.pop), mineral: 0,
    built: {}, happiness: 0, seqCounter: 0, enlistQ: [], enlistLeft: 0, stray: { at: 0, cdUntil: 0 },   // v2-land.22：stray.at = 流浪者到達時間（0 = 沒有在路上），cdUntil = 冷卻結束（毫秒，真實時間）   // v2-land.21：enlistQ = [{ id, food }]，排第一的在訓練，enlistLeft = 剩幾秒
    explored: [], lastOnline: Date.now(), playSec: 0,
    goalIndex: 0, lastSeen: Date.now()   // 橫式 v2：目標進度、最後在線時間（只給畫面用）
  };
  C.buildings.forEach(function (b) { s.built[b.id] = b.start || 0; });
  for (var i = 0; i < C.map.cols * C.map.rows; i++) s.explored.push(1);   // 全部已探索，沒有迷霧（保留欄位給之後）
  var m = heroMods(s.people);
  s.happiness = Math.round(C.happinessStart + m.inspire);
  return s;
}

// 英雄天賦加總（英雄固定，所以載入後算一次）
function heroMods(people) {
  var m = { prod: {}, slot: {}, jerky: 0, supply: 0, carry: 0, leader: 0, costAll: [], costBld: {}, straw: 0, resolve: 0, inspire: 0, list: [] };
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
    else if (e.type === 'carry') m.carry += v / 100;
  });
  return m;
}

function slotsPer(bid) { return (BLD[bid].slots || 0) + (MODS.slot[bid] || 0); }
function jobSlots(jid) { var b = JOB[jid].bld; return state.built[b] * slotsPer(b); }
function costOf(bid) {
  var c = BLD[bid].cost * CONFIG.costMult * Math.pow(CONFIG.costGrowth, state.built[bid]);   // v2-land.21 §1 #1：第 n 座（n = 已蓋 + 1）
  MODS.costAll.concat(MODS.costBld[bid] || []).forEach(function (r) { c *= Math.max(0, 1 - r); });
  return Math.round(c);
}
function beds() { return state.built.house * BLD.house.beds; }
function popCap() { return state.start.pop + beds(); }   // v2-land.22 §1 #15：開局人口 + 每座住所 2 床（開局的人不用床）
function jobS(p, jid) { var w = JOB[jid].w, s = 0; for (var a = 0; a < 5; a++) s += w[a] * p.cur[a]; return s; }
function resTalentPct(p) {   // 居民天賦數值（%）：係數 × max(3, 3s − 1)，s = 天賦職業的加權
  if (!p.talent || p.talent.kind !== 'res') return 0;
  var s = jobS(p, p.talent.job);
  return p.talent.coef * Math.max(CONFIG.resTalentMinPct, CONFIG.resTalentPerStar * s + CONFIG.resTalentOffset);
}
function hasJobTalent(p, jid) { return !!(p.talent && p.talent.kind === 'res' && p.talent.job === jid); }
function isIdleRes(p) { return p.type === 'res' && !p.job && !p.inQ; }   // inQ：入伍佇列中（排隊或訓練），不工作、不撿柴
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
  people.forEach(function (p) { if (isIdleRes(p)) e.gather += C.gatherPerIdlePerSec * (1 + stamTerm(p)); });   // v2-land.21 §1 #7：一律撿柴
  e.material += e.gather;
  e.straw = e.workers.farm * MODS.straw; e.material += e.straw;
  var jerky = Math.max(0, 1 - MODS.jerky), supply = Math.max(0, 1 - MODS.supply);
  people.forEach(function (p) {
    var c = C.foodUpkeep ? C.foodPerPersonPerSec * supply : 0;   // foodUpkeep false：居民、英雄、士兵都不吃
    if (p.job === 'soldier') { c *= C.soldierFoodMult * (1 - lordBonus(A_COMMAND)); e.soldierCons += c; }   // §1 #12：0.24 × (1 − 領主統帥加成) × (1 − 補給%)
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

// ===== v2-land.21：倉庫上限、入伍佇列、離線收益 =====
function lordBonus(a) { var C = CONFIG; return Math.min(C.lordBonusMax, (a === A_VALOR ? C.lordValorEnlistPerStar : C.lordCommandFoodPerStar) * ((state.lord.attrs && state.lord.attrs[a]) || 0)); }
function storageCap() {   // §1 #16：每種資源各自的上限
  var c = CONFIG.storageBase;
  for (var n = 1; n <= (state.built.storage || 0); n++) c += CONFIG.storagePer * Math.pow(CONFIG.costGrowth, n - 1);
  return c * (1 + (MODS ? MODS.carry : 0));
}
function addCapped(k, d, cap) {   // 增加的部分超過上限不入帳（原本就超過的不扣）；減少照扣，最低 0。回傳沒入帳的量
  var v = state[k], nv = Math.max(0, v + d), lost = 0;
  if (d > 0 && nv > cap) { lost = nv - Math.max(v, cap); nv = Math.max(v, cap); }
  state[k] = nv; return lost;
}
// ===== v2-land.22：收留流浪者（§1 #19）。照真實時間（Date.now）計時：離線、背景、直式暫停都照算；離線不會自動開始，所以一次離線最多到 1 人 =====
function strayCost() { var P = state.people.length, G = Math.max(0, P - state.start.pop); return P * (CONFIG.strayBase + G); }
function strayFreeBeds() { return popCap() - state.people.length - (state.stray.at ? 1 : 0); }   // 在路上的人已經預留 1 床
function strayBlock(now) {   // null = 可以收；其他是不能按的原因
  var st = state.stray;
  if (!goalStatus().all) return 'goals';
  if (st.at) return 'coming';
  if (now < st.cdUntil) return 'cooldown';
  if (strayFreeBeds() < 1) return 'bed';
  if (state.food + 1e-9 < strayCost()) return 'food';
  return null;
}
function takeStray() {
  var now = Date.now();
  if (strayBlock(now)) return false;
  state.food -= strayCost();
  state.stray.at = now + CONFIG.strayTravelSec * 1000;
  dirty(); save(); return true;
}
function strayTick(now) {   // 到了就 +1 人，冷卻從到達那一刻（at）開始
  var st = state.stray;
  if (tabLocked || !st.at || now < st.at) return false;   // 停用的舊分頁不動
  var id = 0; state.people.forEach(function (p) { id = Math.max(id, p.id); });
  var p = genStrayResident(id + 1, mulberry32((state.start.seed ^ Math.imul(id + 1, 0x9E3779B9)) >>> 0));
  p.job = null; p.bld = -1; p.seq = 0; p.reenlistLockUntil = 0;
  state.people.push(p);
  st.cdUntil = st.at + CONFIG.strayCooldownSec * 1000; st.at = 0;
  dirty(); if (typeof worldDirty !== 'undefined') worldDirty = true; save(); return true;
}
function genStrayResident(id, rnd) {   // 屬性機率和開局居民一樣（genWorld 的 genResident），沒有天賦
  var C = CONFIG, p = { id: id, type: 'res', sex: rnd() < C.maleRatio ? 'M' : 'F', age: C.ageMin + Math.floor(rnd() * (C.ageMax - C.ageMin + 1)), loyalty: C.loyalty, cur: [], cap: [], talent: null };
  for (var a = 0; a < 5; a++) {
    var cap = rnd() < C.resCap3P ? 3 : 2;
    var cur = cap === 2 ? (rnd() < C.resCap2Cur1P ? 1 : 2) : (rnd() < C.resCap3Cur3P ? 3 : 2);
    p.cap.push(cap); p.cur.push(cur);
  }
  validatePerson(p);
  return p;
}
function enlistSecs() { return CONFIG.enlistSec * (1 - lordBonus(A_VALOR)); }
function advanceQueue(sec) {   // 只動排第一的；時間用完就成為士兵，下一位接著從頭算（多出來的秒數接著用）
  var q = state.enlistQ, moved = false;
  while (q.length && sec > 0) {
    var use = Math.min(sec, state.enlistLeft);
    state.enlistLeft -= use; sec -= use;
    if (state.enlistLeft > 1e-9) break;
    var p = byId(q.shift().id);
    if (p) { delete p.inQ; p.job = 'soldier'; p.bld = -1; }
    state.enlistLeft = q.length ? enlistSecs() : 0; moved = true;
  }
  if (moved) dirty();
}
function queuePaused(e) { return state.food <= 0 && e.foodNet < 0; }   // §1 #13：食物 0 而且淨值負：暫停，不前進、不退費
function applyOffline(awaySec) {   // §1 #14、§2：回傳給「歡迎回來」用的收益；時間倒退 → 0
  var C = CONFIG, real = Math.max(0, awaySec || 0), s = Math.min(real, C.offlineMaxSec), e = econ(), cap = storageCap();
  var r = { sec: s, food: 0, material: 0, mineral: 0, lost: { food: 0, material: 0, mineral: 0 } };
  if (!state.lord.done) return r;
  r.stray = strayTick(Date.now());   // v2-land.22：離開期間到達的流浪者（真實時間；最多 1 人）
  var dF = Math.max(-state.food, e.foodNet * C.offlineRate * s);
  var qSec = real;   // 入伍佇列：真實時間；離線中食物歸 0 而且淨值負，只前進到歸 0 那一刻
  if (e.foodNet < 0) qSec = Math.min(qSec, state.food / (-e.foodNet * C.offlineRate));
  [['food', dF], ['material', e.material * C.offlineRate * s], ['mineral', e.mineral * C.offlineRate * s]].forEach(function (a) {
    var before = state[a[0]];
    r.lost[a[0]] = addCapped(a[0], a[1], cap);
    r[a[0]] = state[a[0]] - before;
  });
  if (state.food < 1e-9 && dF < 0) state.food = 0;
  advanceQueue(qSec);
  return r;
}

function tick(sec) {
  if (!state.lord.done) return;
  strayTick(Date.now());
  if (!(sec > 0)) return;
  var e = econ(), cap = storageCap();
  addCapped('food', e.foodNet * sec, cap);   // 食物到 0 停在 0，不減人口；超過倉庫上限不入帳
  addCapped('material', e.material * sec, cap);
  addCapped('mineral', e.mineral * sec, cap);
  if (state.enlistQ.length && !queuePaused(e)) advanceQueue(sec);
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
  dirty(); save(); return true;   // BUG-03：每次改派工馬上存（iOS 直接關分頁也不會掉）
}
function assignMinus(jid) {   // − 時反過來：先放沒天賦、s 低的
  var list = state.people.filter(function (p) { return p.job === jid; });
  if (!list.length) return false;
  var o = plusOrder(jid), p = list.sort(function (a, b) { return -o(a, b); })[0];
  p.job = null; p.bld = -1; p.seq = 0;
  dirty(); save(); return true;   // BUG-03
}

// 「還能閒置 N 人」：假設依 + 的順序把閒置居民派去狩獵（不受工位限制），直到食物產量 ≥ 消耗 × 130%；用每個人的實際產量
var hintCache = null;
function idleHint() {
  if (hintCache) return hintCache;
  var sim = state.people.map(function (p) { return { id: p.id, type: p.type, cur: p.cur, talent: p.talent, job: p.job, bld: p.bld, seq: p.seq, inQ: p.inQ }; });
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
  dirty(); worldDirty = true; save();
  return true;
}

// ===== 軍營（§11）=====
function enlistState(p, now) {   // 'ok' | 'locked' | null（不在名單）
  if (p.type !== 'res' || p.job || p.inQ || p.cur[A_VALOR] < CONFIG.enlistMinValor) return null;
  return now < (p.reenlistLockUntil || 0) ? 'locked' : 'ok';
}
function enlistBlock() {   // 不能再排的原因（null = 可以排）：軍營、食物、佇列、士兵上限
  var C = CONFIG;
  if (state.built.barracks < C.enlistNeedsBarracks) return 'barracks';
  if (econ().soldiers + state.enlistQ.length >= C.barracksCapL1) return 'cap';
  if (state.enlistQ.length >= C.enlistQueueMax) return 'queue';
  if (state.food + 1e-9 < C.enlistFood) return 'food';
  return null;
}
function enlist(id) {   // v2-land.21 §2：按下時扣 30 食物，排進佇列
  var p = byId(id);
  if (!p || enlistBlock() || enlistState(p, Date.now()) !== 'ok') return false;
  state.food -= CONFIG.enlistFood;
  if (!state.enlistQ.length) state.enlistLeft = enlistSecs();
  state.enlistQ.push({ id: p.id, food: CONFIG.enlistFood });
  p.inQ = true; p.bld = -1;
  dirty(); save(); return true;
}
function cancelEnlist(id) {   // 排隊或訓練中都能取消：食物全退，人回到閒置
  var q = state.enlistQ, i;
  for (i = 0; i < q.length; i++) if (q[i].id === id) break;
  if (i >= q.length) return false;
  var it = q.splice(i, 1)[0], p = byId(id);
  state.food += it.food;
  if (p) delete p.inQ;
  if (i === 0) state.enlistLeft = q.length ? enlistSecs() : 0;
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
function sum5(v) { return v.reduce(function (a, b) { return a + b; }, 0); }
function lordUsed() { return sum5(state.lord.attrs) - sum5(state.lord.sys); }   // 已用的自由點
function lordAdj(a, d) {
  var L = state.lord;
  if (L.done) return;
  var v = L.attrs[a] + d;
  if (v < L.sys[a] || v > CONFIG.lordAttrMax || (d > 0 && lordUsed() >= CONFIG.lordFreePoints)) return;   // － 只能拿掉自己加的
  L.attrs[a] = v; uiDirty = true;
}
function lordSetSex(sex) { if (!state.lord.done && (sex === 'M' || sex === 'F')) { state.lord.sex = sex; uiDirty = true; } }
function lordConfirm() {
  var L = state.lord;
  if (L.done || (L.sex !== 'M' && L.sex !== 'F') || lordUsed() !== CONFIG.lordFreePoints) return false;
  L.done = true; save(); uiDirty = true; return true;
}

// ===== 存檔（§14）=====
var saveFailed = false, loadNotice = '', importedV1a = false;
// v2-land.14（P-08）：同一個存檔只讓最新開的分頁玩。開遊戲時把自己的分頁代號寫進 saveKey + '_tab'，
// 再用 BroadcastChannel（沒有就靠 storage 事件）通知其他分頁；舊分頁收到後就停止存檔、蓋上「遊戲已在其他分頁開啟」。
// 每次存檔前也再讀一次代號：不是自己就不寫（事件漏掉、分頁被凍結再醒來、visibilitychange／pagehide／beforeunload 都擋得住）。
var TAB_ID = Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36), TAB_T = Date.now();
var tabLocked = false, tabChan = null, tabKey = CONFIG.saveKey + '_tab';
function tabOwner() { try { var o = JSON.parse(localStorage.getItem(tabKey)); return o && o.id ? o : null; } catch (e) { return undefined; } }   // undefined = 不能讀
function lockTab(why) {
  if (tabLocked) return; tabLocked = true; window.TL_TABLOCK = why;
  try { if (tabChan) tabChan.close(); } catch (e) { /* 略過 */ }
  var el = document.getElementById('otherTab'); if (el) el.hidden = false;
  try { cancelDrag(); cancelHolds(); } catch (e) { /* 還沒建好 UI */ }
}
function checkTab(msg) {   // 別的分頁宣告了，或要存檔／回到前景時：確認自己還是最新的分頁
  if (tabLocked) return true;
  var o = tabOwner();
  if (o === undefined) { if (msg && msg.id !== TAB_ID && (msg.t > TAB_T || (msg.t === TAB_T && msg.id > TAB_ID))) lockTab('msg'); }   // 不能用 localStorage：只比開啟時間
  else if (o && o.id !== TAB_ID) lockTab(msg ? (msg.via || 'msg') : 'check');   // via：bc／storage（收到通知）、poll（每輪檢查）、check（存檔或回到前景時）
  return tabLocked;
}
function claimTab() {   // 在讀檔之前呼叫：之後舊分頁的存檔都會被擋下，新分頁讀到的就是最後一份
  var me = { id: TAB_ID, t: TAB_T };
  try { localStorage.setItem(tabKey, JSON.stringify(me)); } catch (e) { /* 不能存檔的環境 */ }
  try {
    if (typeof BroadcastChannel === 'function') {
      tabChan = new BroadcastChannel('tl-tab-' + CONFIG.saveKey);
      tabChan.onmessage = function (ev) { var d = ev && ev.data; if (d && d.type === 'open' && d.id !== TAB_ID) { d.via = 'bc'; checkTab(d); } };
      tabChan.postMessage({ type: 'open', id: TAB_ID, t: TAB_T });
    }
  } catch (e) { tabChan = null; }
  window.TL_TABINFO = { id: TAB_ID, bc: !!tabChan };
}
window.addEventListener('storage', function (ev) {   // 沒有 BroadcastChannel 的瀏覽器靠這個；有的話兩邊都會到，先到的就算
  if (ev.key === tabKey && ev.newValue) { try { var d = JSON.parse(ev.newValue); if (d && d.id !== TAB_ID) { d.via = 'storage'; checkTab(d); } } catch (e) { /* 略過 */ } }
});
function save() {
  if (!state || saveBlocked || checkTab()) return;
  state.lastOnline = state.lastSeen = Date.now();   // 橫式 v2 §7：lastSeen 在存檔、隱藏、pagehide 時更新
  try { localStorage.setItem(CONFIG.saveKey, JSON.stringify(state)); saveFailed = false; }
  catch (e) { saveFailed = true; }
}
// v2-land.18：存檔匯出／匯入（Yi Way 要求）。匯出＝先 save()，再把 localStorage 裡的存檔字串（UTF-8）轉成 base64 文字碼。
// 匯入＝解碼、檢查，通過才把目前的存檔備份到 importBackupKey、寫入新存檔、擋住這一頁之後所有存檔（saveBlocked），再重新載入。
// 檢查的欄位＝loadState／sanitize 會直接用到的：v（＝CONFIG.saveVersion）、數字 food material mineral happiness playSec seqCounter start.pop start.seed，
// 物件／陣列 start、people、built、lord、lord.attrs；最後再拿一份複本跑 sanitize（人口數、職業、天賦等同樣的規則）。
var saveBlocked = false, importBackupKey = CONFIG.saveKey + '_importBackup';
var SAVE_NUM_FIELDS = ['food', 'material', 'mineral', 'happiness', 'playSec', 'seqCounter', 'start.pop', 'start.seed'];
function utf8ToB64(str) {
  if (typeof TextEncoder === 'function') { var u = new TextEncoder().encode(str), bin = '', i; for (i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); }
  return btoa(unescape(encodeURIComponent(str)));
}
function b64ToUtf8(b64) {
  var bin = atob(b64);   // 不是 base64 會丟錯
  if (typeof TextDecoder === 'function') { var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder('utf-8', { fatal: true }).decode(u); }
  return decodeURIComponent(escape(bin));
}
function exportSave() {   // 回傳 { code } 或 { err }
  if (tabLocked || checkTab()) return { err: '這個分頁已停用（遊戲在其他分頁開啟），不能匯出。' };
  save();
  var raw = null; try { raw = localStorage.getItem(CONFIG.saveKey); } catch (e) { /* 不能用 localStorage */ }
  if (!raw || saveFailed) return { err: '這個瀏覽器不能存檔，沒辦法匯出。' };
  return { code: utf8ToB64(raw) };
}
function getPath(o, path) { return path.split('.').reduce(function (a, k) { return a && typeof a === 'object' ? a[k] : undefined; }, o); }
function checkImport(code) {   // 回傳 { raw, save } 或 { err }；不碰 localStorage
  var s = String(code || '').replace(/\s+/g, ''), raw, o;
  if (!s) return { err: '請先貼上存檔文字。' };
  try { raw = b64ToUtf8(s); o = JSON.parse(raw); } catch (e) { return { err: '存檔文字無法解讀，請確認整段都有貼上。' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { err: '存檔文字無法解讀，請確認整段都有貼上。' };
  if (o.v !== CONFIG.saveVersion) return { err: '存檔版本不同，不能匯入。' };
  var bad = SAVE_NUM_FIELDS.filter(function (k) { var v = getPath(o, k); return typeof v !== 'number' || !isFinite(v); });
  if (!Array.isArray(o.people)) bad.push('people');
  if (!o.built || typeof o.built !== 'object') bad.push('built');
  if (!o.lord || typeof o.lord !== 'object' || !Array.isArray(o.lord.attrs)) bad.push('lord');
  if (bad.length) return { err: '存檔缺少資料或格式不對：' + bad.join('、'), fields: bad };
  try { sanitize(JSON.parse(raw)); } catch (e) { return { err: '存檔內容不對（' + (e && e.message ? e.message : e) + '），不能匯入。' }; }
  return { raw: raw, save: o };
}
function importSave(code) {   // 通過檢查才動存檔；成功會重新載入
  if (tabLocked || checkTab()) return { err: '這個分頁已停用（遊戲在其他分頁開啟），不能匯入。' };
  var r = checkImport(code);
  if (r.err) return r;
  try {
    var old = localStorage.getItem(CONFIG.saveKey);
    if (old !== null) localStorage.setItem(importBackupKey, old);
    localStorage.setItem(CONFIG.saveKey, r.raw);
  } catch (e) { return { err: '這個瀏覽器不能存檔，沒辦法匯入。' }; }
  saveBlocked = true; window.TL_SAVEBLOCKED = true;   // 這一頁之後不再存檔（自動存檔、visibilitychange、pagehide、beforeunload 都走 save()）
  if (!window.TL_NO_RELOAD) location.reload();   // TL_NO_RELOAD：測試用
  return { ok: true };
}
function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function loadState() {
  var raw = null;
  try { raw = localStorage.getItem(CONFIG.saveKey); } catch (e) { saveFailed = true; }
  if (!raw) { try { raw = localStorage.getItem(CONFIG.importKey); if (raw) importedV1a = true; } catch (e) { /* 略過 */ } }
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
  if (!s.start || !(s.start.pop >= CONFIG.popMin && s.start.pop <= CONFIG.popMax) || !Array.isArray(s.people) || s.people.length < s.start.pop) throw new Error('人口資料不符');   // v2-land.22：收留流浪者後人數 > 開局人口
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
  if (!s.lord.done && !Array.isArray(s.lord.sys)) {   // v1a.1 存檔停在領主分配畫面：照新規則（系統 10 + 自由 10、自選性別）重新產生分配；已確定的領主不動
    var wl = genWorld(s.start.seed >>> 0).lord;
    s.lord = { sex: null, points: wl.points, sys: wl.sys.slice(), attrs: wl.sys.slice(), done: false };
  }
  if (!Array.isArray(s.explored)) { s.explored = []; for (var i = 0; i < CONFIG.map.cols * CONFIG.map.rows; i++) s.explored.push(1); }
  delete s.cam;   // 鏡頭不存檔：重新整理一律回營地
  s.goalIndex = Math.max(0, num(s.goalIndex, 0) | 0);   // 橫式 v2 §3.3：舊存檔讀成 0
  s.lastSeen = num(s.lastSeen, num(s.lastOnline, Date.now()));
  // v2-land.21：舊存檔沒有入伍佇列 → 空佇列；gatherStopped 留在存檔裡但不再使用
  var seen = {};
  s.enlistQ = (Array.isArray(s.enlistQ) ? s.enlistQ : []).filter(function (it) {
    var p = it && s.people.filter(function (x) { return x.id === it.id; })[0];
    if (!p || seen[p.id] || p.type !== 'res' || p.job) return false;
    seen[p.id] = true; it.food = Math.max(0, num(it.food, CONFIG.enlistFood)); return true;
  }).slice(0, CONFIG.enlistQueueMax);
  s.people.forEach(function (p) { if (seen[p.id]) p.inQ = true; else delete p.inQ; });   // 不在佇列的人不多存欄位
  var st = s.stray && typeof s.stray === 'object' ? s.stray : {};   // v2-land.22：舊存檔沒有 → 沒有在路上、沒有冷卻
  s.stray = { at: Math.max(0, num(st.at, 0)), cdUntil: Math.max(0, num(st.cdUntil, 0)) };
  s.enlistLeft = s.enlistQ.length ? Math.max(0, Math.min(CONFIG.enlistSec, num(s.enlistLeft, CONFIG.enlistSec))) : 0;
}
function wipeAndNew(seed) {
  if (saveBlocked || checkTab()) return;
  try { localStorage.removeItem(CONFIG.saveKey); } catch (e) { /* 略過 */ }
  state = newGameState(seed); MODS = heroMods(state.people); dirty(); worldDirty = true;
  save();
}
function randomSeed() {
  try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; }
}

// ===== 目標（橫式 v2 §3.3【新】：沒有獎勵，只看條件；不影響數值）=====
var GOALS = [
  { name: '蓋狩獵屋',   m: 1, desc: '蓋 1 座狩獵屋。',                 go: 'build', val: function () { return state.built.lodge; } },
  { name: '派 5 名獵人', m: 5, desc: '派 5 名居民去狩獵。',              go: 'hunt',  val: function () { return econ().workers.hunt; } },
  { name: '蓋伐木場',   m: 1, desc: '蓋 1 座伐木場。',                 go: 'build', val: function () { return state.built.lumber; } },
  { name: '派伐木工',   m: 2, desc: '派 2 名居民去伐木。',              go: 'lumber', val: function () { return econ().workers.lumber; } },
  { name: '蓋居民住所', m: 2, desc: '蓋好 2 座居民住所。',              go: 'build', val: function () { return state.built.house; } },
  { name: '蓋捕魚場',   m: 1, desc: '蓋 1 座捕魚場。',                 go: 'build', val: function () { return state.built.fishery; } },
  { name: '派漁夫',     m: 2, desc: '派 2 名居民去釣魚。',              go: 'fish',  val: function () { return econ().workers.fish; } },
  { name: '蓋軍營',     m: 1, desc: '蓋 1 座軍營。',                   go: 'build', val: function () { return state.built.barracks; } },
  { name: '招募士兵',   m: 1, desc: '在軍營讓 1 名勇武 3★ 以上的閒置居民入伍。', go: 'barracks', val: function () { return econ().soldiers; } }
];
function anyValor3() { return state.people.some(function (p) { return p.type === 'res' && p.cur[A_VALOR] >= CONFIG.enlistMinValor; }); }
function goalCurIndex() {   // 回傳實際的目標編號；全部完成回傳 GOALS.length。第 9 項：沒有居民勇武 ≥ 3★ 就跳過
  var i = state.goalIndex || 0;
  if (i === 8 && !anyValor3()) i = 9;
  return Math.min(i, GOALS.length);
}
function goalStatus() {
  var i = goalCurIndex();
  if (i >= GOALS.length) return { i: i, all: true };
  var g = GOALS[i], v = g.val();
  return { i: i, g: g, n: Math.min(v, g.m), m: g.m, done: v >= g.m };
}
function goalNext() {
  var st = goalStatus();
  if (st.all || !st.done) return false;
  state.goalIndex = st.i + 1; save(); uiDirty = true; return true;
}
