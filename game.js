// 部落領主 demo v1a（純 JS，無模組，可直接以 file:// 開啟）
// 規格：idle-core-loop/tribe/handoff/demo-v1a-dev-spec.md（§16 待確認項目一律照「開發預設」）。
// 這版沒有戰鬥、偵察、遠征、世界地圖、人口事件；人口固定。所有數字都在 CONFIG（標「佔位」「預設」的之後只改這裡）。
// 字型：Cubic 11（俐方體11號，https://github.com/ACh-K/Cubic-11）子集，family 改名 TribePixel，授權 SIL OFL 1.1（全文見 assets/OFL.txt；單檔版內嵌於 #font-license）。

var VERSION = 'demo v1a.1';

var CONFIG = {
  // ===== 迴圈與存檔 =====
  tickMs: 250,                 // 遊戲迴圈間隔（毫秒）
  maxTickSec: 1,               // 單次 tick 最多算幾秒（切回分頁不補時間：離線不產出、不消耗）
  autosaveSec: 5,              // 自動存檔間隔（秒）
  saveKey: 'tribalLordSave_demoV1a',
  saveVersion: 'demo-v1a-1',
  oldSaveKeys: ['tribalLordSave_v04'],   // v0.4–v0.8 舊存檔：不相容，開新局並提示玩家（舊檔改名保留，不刪）

  // ===== §1 開局與人口 =====
  popMin: 20, popMax: 40,      // 開局人口 P 均勻整數【定案】
  heroRatio: 0.05,             // H = round(0.05 × P)【預設 §16 #5】
  startFoodPerPop: 12,         // 開局食物 = 12 × P【定案】
  startMatPer10: 35,           // 開局建材 = 35 × ⌈P/10⌉ + 20【定案】
  startMatBase: 20,

  // ===== §2 人物 =====
  maleRatio: 0.5,              // 性別 50/50【預設 §16 #4】
  ageMin: 16, ageMax: 50,      // 年齡均勻整數，整局不變【預設 §16 #3】
  loyalty: 80,                 // 忠誠度固定 80，只顯示【定案】

  // ===== §4 居民生成【定案】=====
  resCap3P: 0.35,              // cap = 3 的機率（否則 cap = 2）
  resCap2Cur1P: 0.20,          // cap = 2 時 cur = 1 的機率（否則 2）
  resCap3Cur3P: 0.50,          // cap = 3 時 cur = 3 的機率（否則 2）

  // ===== §5 英雄生成（方法 A）=====
  heroKProbs: [0.60, 0.35, 0.05],  // 突出屬性 1／2／3 項【定案；3 項以上取 3 = 預設 §16 #10】
  heroStandout5P: 0.35,        // 突出屬性 5★ 的機率（否則 4★）【定案】
  heroOther3P: 0.50,           // 非突出屬性 3★ 的機率（否則 2★）【定案】
  heroMinTotal: 15,            // 總星數 < 15 時只重抽非突出屬性【定案】
  heroFoodMult: 1.0,           // 英雄吃 ×1.0【預設 §16 #11】

  // ===== §6 英雄天賦 =====
  heroTalentP: 0.75,           // 有天賦機率【定案】；每名英雄最多 1 個【預設 §16 #7】

  // ===== §7 居民生產天賦 =====
  resTalentRMin: 0.10, resTalentRMax: 0.15,   // 每局 r ~ U(0.10, 0.15)，人數 = round(居民數 × r)【預設 §16 #6】
  resTalentJobs: [             // 天賦職業各 50%，固定給主產量天賦，係數 1【預設 §16 #6】
    { job: 'hunt', name: '追蹤', coef: 1, p: 0.5 },
    { job: 'lumber', name: '快斧', coef: 1, p: 0.5 }
  ],
  resTalentMinPct: 3,          // 數值 = 係數 × max(3%, (3s − 1)%)【定案】
  resTalentPerStar: 3, resTalentOffset: -1,

  // ===== §8 領主 =====
  lordPointsMin: 15, lordPointsMax: 20,   // 隨機 15–20 點（均勻整數）【定案】
  lordAttrMax: 5,              // 每項最多 5★【定案】
  lordName: '領主',            // 規格沒有命名規則 → 只顯示「領主」（需要企劃確認）

  // ===== §3 屬性效果（s = cur）=====
  staminaPerStar: 0.05,        // 耐力：× (1 + 0.05 × (s − 2))，只用在伐木/狩獵/採礦/撿柴【定案；職業 = 預設 §16 #17】
  staminaBase: 2,
  leaderPerStar: 0.02,         // 統帥（領班）：+0.02 × max(0, s − 2)【定案】
  leaderBase: 2,
  spiritPerStar: 0.05,         // 精神 R = 0.05 × (s − 2)【定案】
  spiritBase: 2,
  personalMultCap: 1.35,       // 個人倍率 m 上限【定案】
  happinessProdE: 1.0,         // E 固定 1.0（本版幸福度不影響產量）【預設 §16 #2】

  // ===== §10 食物、幸福度 =====
  foodPerPersonPerSec: 0.2,    // 每人每秒吃 0.2【定案】
  soldierFoodMult: 1.2,        // 駐守士兵 ×1.2【定案】
  lordEats: false,             // 領主不吃【預設 §16 #12】
  happinessStart: 60,          // 起始 60（+ 感召點數，取整數）【定案】
  happinessDecayPerMin: 0.1,   // 每分鐘 0.1 × (1 − R̄) × (1 − 堅毅%)，只在上線時，最低 0【預設 §16 #1】
  happinessMin: 0,

  // ===== §9.3 撿柴 =====
  gatherPerIdlePerSec: 0.02,   // 伐木場 0 座時每名閒置居民 0.02 建材/秒 × (1 + 耐力項)；蓋第一座伐木場後永久停止【定案】

  // ===== §11 軍營 =====
  enlistMinValor: 3,           // 勇武 cur ≥ 3★【定案】
  enlistNeedsBarracks: 1,      // 至少 1 座軍營【預設 §16 #21】
  reenlistLockSec: 300,        // 轉回後 5 分鐘不能再入伍，真實時間（含離線）【定案；含離線 = 預設 §16 #22】

  // ===== §13.4 職業分配 =====
  idleHintSurplus: 1.30,       // 「還能閒置 N 人」：食物產量 ≥ 消耗 × 130%【預設 §16 #23】
  holdDelayMs: 400,            // 長按 0.4 秒後
  holdRepeatMs: 100,           // 每 0.1 秒連續加減

  // ===== §12 地圖 =====
  map: {
    cols: 18, rows: 14, tile: 20,          // 18×14，每格 20 邏輯 px【定案】
    viewX: 0, viewY: 40, viewW: 180, viewH: 250,   // 地圖視窗【定案 20:07】
    homeX: 100, homeY: 25,                 // 回營地鏡頭【定案】
    dragThresholdCss: 6,                   // 移動 ≥ 6 CSS px 才算拖曳【定案】
    hitPad: 4,                             // 議事廳／軍營點擊區外擴 4 邏輯 px（28×28）【定案／軍營 = 預設】
    spriteOffset: 2,                       // 建築圖 16×16 畫在 (20c + 2, 20r + 2)【佔位】
    // 地形（欄 c、列 r，0 起算）【定案】；JSON 裡的小部落格 (17,1)、(0,12) 本版不畫
    grid: [
      '......FFFFFFF.....',
      '.AAA..FFFFFFF.....',
      '.AAA..FFFFFFF.MM..',
      '.AAA..FFFFFFF.MM..',
      '......FFFFFFF.....',
      '..................',
      '.GGG........HH....',
      '.GGG........HH....',
      '.GGG........HH....',
      '.GGG..............',
      '..................',
      '.............WWW..',
      '.............WWWW.',
      '..................'
    ]
  },
  realSecPerGameDay: 3600,     // 真實 1 小時 = 遊戲 1 天（ui-layout-v1 §2.1）

  // ===== §9.1 建築表 =====
  // cost：建材；slots：每座工位；rate：每名工人每秒產量；tiles：地圖格位（依序使用）
  buildings: [
    { id: 'council',  name: '議事廳',   cost: 0,  start: 1, tiles: [[9, 7]] },                                   // 開局已蓋好，不能拆【定案】
    { id: 'house',    name: '居民住所', cost: 10, beds: 2, tiles: [[8, 9], [7, 9], [6, 9], [8, 10], [7, 10]] },  // 2 床【定案】
    { id: 'lumber',   name: '伐木場',   cost: 15, slots: 2, job: 'lumber', produces: 'material', rate: 0.12, tiles: [[9, 5], [8, 5], [10, 5], [7, 5], [11, 5]] },        // 【定案】
    { id: 'lodge',    name: '狩獵屋',   cost: 20, slots: 5, job: 'hunt', produces: 'food', rate: 0.5, tiles: [[11, 7], [11, 6], [11, 8], [12, 5], [12, 9], [11, 9]] },  // 【定案】
    { id: 'fishery',  name: '捕魚場',   cost: 20, slots: 4, job: 'fish', produces: 'food', rate: 0.4, tiles: [[12, 11], [13, 10], [14, 10], [12, 12], [15, 10]] },   // 【佔位；花費為假設】
    { id: 'field',    name: '田',       cost: 20, slots: 4, job: 'farm', produces: 'food', rate: 0.35, tiles: [[4, 3], [4, 2], [3, 4], [4, 1]] },                    // 【佔位；花費為假設】
    { id: 'ranch',    name: '牧場',     cost: 20, slots: 4, job: 'pasture', produces: 'food', rate: 0.3, tiles: [[4, 7], [4, 8], [4, 6], [4, 9]] },                 // 【佔位；花費為假設】
    { id: 'pen',      name: '家畜欄',   cost: 20, slots: 3, job: 'livestock', produces: 'food', rate: 0.3, tiles: [[3, 10], [2, 10], [4, 10], [1, 10]] },           // 【佔位；花費為假設】
    { id: 'mine',     name: '採礦場',   cost: 20, slots: 2, job: 'mine', produces: 'mineral', rate: 0.12, tiles: [[13, 3], [13, 2], [14, 4], [15, 4]] },            // 【預設 §16 #13】
    { id: 'barracks', name: '軍營',     cost: 20, tiles: [[8, 7]] },        // 入伍功能【花費 = 預設 §16 #14】
    { id: 'clinic',   name: '醫療館',   cost: 20, tiles: [[9, 6]] },        // 本版沒有效果【預設 §16 #14、#20】
    { id: 'storage',  name: '倉庫',     cost: 20, tiles: [[10, 7]] }        // 本版沒有效果、沒有上限【預設 §16 #14、#20】
  ],

  // ===== §9.2 職業（順序 = 介面順序）；w = §7 職業加權（勇武、智力、精神、耐力、統帥）=====
  jobs: [
    { id: 'lumber',    name: '伐木', bld: 'lumber',  stamina: true,  w: [0, 0, 0, 1, 0] },
    { id: 'fish',      name: '釣魚', bld: 'fishery', stamina: false, w: [0, 0, 0.8, 0.2, 0] },
    { id: 'mine',      name: '採礦', bld: 'mine',    stamina: true,  w: [0, 0, 0, 1, 0] },
    { id: 'farm',      name: '種田', bld: 'field',   stamina: false, w: [0, 0.6, 0, 0.4, 0] },
    { id: 'hunt',      name: '狩獵', bld: 'lodge',   stamina: true,  w: [0.4, 0, 0.4, 0.2, 0] },
    { id: 'pasture',   name: '牧耕', bld: 'ranch',   stamina: false, w: [0, 0, 0.2, 0.3, 0.5] },
    { id: 'livestock', name: '家畜', bld: 'pen',     stamina: false, w: [0, 0.3, 0.2, 0, 0.5] }
  ],
  // 食物彈窗分類（§13.1）：獵獲／漁獲／農作／畜產／採集（採集本版沒有對應職業 → 0）
  foodSources: [['獵獲', ['hunt']], ['漁獲', ['fish']], ['農作', ['farm']], ['畜產', ['pasture', 'livestock']], ['採集', []]],

  // ===== §6.2 本版有效果的 21 項英雄天賦（其他 47 項：照樣抽、照樣顯示，標「尚未開放」）=====
  // 疊加【預設 §16 #18、#19】：產量 % 乘在基礎產量上 ×(1 + 加總%)、英雄之間相加、不受 1.35 上限；工位每名英雄各 +1；花費減少相乘後四捨五入
  heroTalentEffects: {
    '生產_hunt_yield':  { type: 'prod', jobs: ['hunt'] },                       // 圍獵
    '生產_hunt_lodge':  { type: 'slot', bld: 'lodge' },                         // 獵隊
    '生產_hunt_jerky':  { type: 'jerky' },                                      // 肉乾
    '統帥_command':     { type: 'leader' },                                     // 號令
    '統帥_supply':      { type: 'supply' },                                     // 補給
    '生產_past_yield':  { type: 'prod', jobs: ['pasture'] },                    // 放牧
    '生產_live_yield':  { type: 'prod', jobs: ['livestock'] },                  // 畜產
    '生產_live_breed':  { type: 'slot', bld: 'pen' },                           // 繁殖
    '智力_craftsman':   { type: 'cost', blds: null },                           // 巧匠（全部建築）
    '生產_farm_yield':  { type: 'prod', jobs: ['farm'] },                       // 精耕
    '生產_farm_plot':   { type: 'slot', bld: 'field' },                         // 墾荒
    '生產_farm_straw':  { type: 'straw' },                                      // 秸稈
    '精神_resolve':     { type: 'resolve' },                                    // 堅毅
    '精神_focus':       { type: 'prod', jobs: ['lumber', 'fish', 'mine', 'farm', 'hunt', 'pasture', 'livestock'] },  // 專注（所有生產職業）
    '精神_inspire':     { type: 'inspire' },                                    // 感召
    '生產_fish_yield':  { type: 'prod', jobs: ['fish'] },                       // 撒網
    '生產_fish_shed':   { type: 'slot', bld: 'fishery' },                       // 漁棚
    '生產_fish_gear':   { type: 'cost', blds: ['fishery'] },                    // 漁具
    '耐力_endure':      { type: 'prod', jobs: ['lumber', 'hunt', 'mine'] },     // 持久
    '耐力_mining':      { type: 'prod', jobs: ['mine'] },                       // 挖礦
    '耐力_logging':     { type: 'prod', jobs: ['lumber'] }                      // 伐木
  }
};

var ATTR = ['勇武', '智力', '精神', '耐力', '統帥'];
var ATTR_S = ['勇', '智', '精', '耐', '統'];
var A_VALOR = 0, A_INT = 1, A_SPIRIT = 2, A_STAMINA = 3, A_COMMAND = 4;

var HERO_TALENTS = [ // [id, 類別(屬性), 名稱, min, max, 單位, status, 效果]；由 talents/hero_talents_db.json v0.3 轉出（68 項，全部 drawable；效果文字只取「（」之前）
  ["勇武_brave", "勇武", "勇猛", 5, 15, "%", "wait_combat", "軍隊戰力提升"],
  ["勇武_armorbreak", "勇武", "破甲", 10, 20, "%", "wait_combat", "攻擊無視敵方防禦"],
  ["勇武_combo", "勇武", "連擊", 10, 30, "%機率", "wait_combat", "攻擊有機率追加一擊"],
  ["勇武_ironwall", "勇武", "鐵壁", 5, 15, "%", "wait_combat", "我方受到傷害降低"],
  ["勇武_berserk", "勇武", "狂暴", 15, 30, "%", "wait_combat", "兵力低於一半時戰力提升"],
  ["勇武_execute", "勇武", "斬殺", 15, 30, "%", "wait_combat", "對低血量敵人傷害提升"],
  ["勇武_shield", "勇武", "盾防", 10, 20, "%", "wait_combat", "防守營地時戰力提升"],
  ["勇武_charge", "勇武", "突進", 15, 30, "%", "wait_combat", "戰鬥第一回合戰力提升"],
  ["智力_craftsman", "智力", "巧匠", 5, 15, "%", "v1", "建造和升級花費的建材減少"],
  ["智力_study", "智力", "研讀", 10, 20, "%", "wait_tech", "技能或科技研究速度提升"],
  ["智力_planning", "智力", "規劃", 10, 20, "%", "wait_buildtime", "建築升級和工作時間縮短"],
  ["智力_invent", "智力", "發明", 10, 20, "%", "wait_unlock", "解鎖新建築或新設施的時間提前"],
  ["智力_record", "智力", "記錄", 10, 20, "%", "v1", "事件獎勵提升"],
  ["智力_teach", "智力", "教學", 10, 25, "%", "wait_growth", "居民白星"],
  ["智力_observe", "智力", "觀察", 15, 25, "%", "v1", "偵察冷卻縮短"],
  ["智力_deduce", "智力", "推演", 10, 20, "%", "wait_failevents", "事件失敗機率降低"],
  ["智力_formation", "智力", "陣法", 5, 10, "%", "wait_combat", "出戰隊伍全員受到的傷害減少"],
  ["智力_artofwar", "智力", "兵法", 5, 10, "%", "wait_combat", "出戰隊伍全員攻擊力提升"],
  ["智力_scheme", "智力", "謀略", 5, 10, "%", "wait_combat", "征討時敵方全員攻擊力降低"],
  ["智力_battle_command", "智力", "指揮", 10, 20, "%", "wait_combat", "開戰前 3 回合全隊攻擊力提升"],
  ["智力_trap", "智力", "陷阱", 10, 20, "%", "wait_defense", "防守戰開戰時，敵方每人先受到其最大血量一定比例的傷害"],
  ["智力_tactics", "智力", "戰術", 10, 20, "%", "wait_combat", "我方對敵方最高星單位造成的傷害提升"],
  ["智力_judgment", "智力", "判斷", 10, 20, "%", "wait_combat", "戰敗時出戰族人的陣亡機率降低"],
  ["智力_vigilance", "智力", "警戒", 10, 20, "%", "v1", "派出偵察事件的獎勵提升"],
  ["精神_resolve", "精神", "堅毅", 30, 50, "%", "v1", "幸福度自然衰退速度降低"],
  ["精神_focus", "精神", "專注", 3, 6, "%", "v1", "全部落工作效率提升"],
  ["精神_calm", "精神", "冷靜", 15, 30, "%", "v1", "負面事件和負面幸福度效果降低"],
  ["精神_inspire", "精神", "感召", 3, 8, "點", "v1", "幸福度基礎值提升"],
  ["精神_insight", "精神", "洞察", 1, 1, "項", "wait_events", "事件出現時多一個選項或提前預告"],
  ["精神_prayer", "精神", "祈禱", 20, 40, "%", "v1", "分食宴等加成類事件持續時間延長"],
  ["精神_dream", "精神", "夢境", 10, 20, "%", "v1", "離線時事件獎勵提升"],
  ["精神_will", "精神", "意志", 30, 50, "%", "wait_loyalty", "居民忠誠度下降速度降低"],
  ["耐力_carry", "耐力", "負重", 15, 30, "%", "wait_storage", "倉庫容量提升"],
  ["耐力_endure", "耐力", "持久", 3, 6, "%", "v1", "全部落體力勞動產量提升"],
  ["耐力_recover", "耐力", "恢復", 20, 40, "%", "wait_medical", "生病或受傷的恢復速度提升"],
  ["耐力_coldres", "耐力", "抗寒", 20, 40, "%", "wait_season", "寒冬等季節的負面效果降低"],
  ["耐力_poisonres", "耐力", "抗毒", 15, 30, "%", "wait_medical", "疾病發生機率降低"],
  ["耐力_longmarch", "耐力", "長途", 15, 30, "%", "v1", "偵察和遠征所需時間縮短"],
  ["耐力_mining", "耐力", "挖礦", 10, 20, "%", "v1", "全部落採礦產量提升"],
  ["耐力_logging", "耐力", "伐木", 10, 20, "%", "v1", "全部落伐木產量提升"],
  ["統帥_command", "統帥", "號令", 50, 50, "%", "v1", "每棟建築領班的加成提升為 1.5 倍"],
  ["統帥_rally", "統帥", "集結", 20, 40, "%", "wait_combat", "軍隊出發和集合時間縮短"],
  ["統帥_supply", "統帥", "補給", 5, 10, "%", "v1", "每人食物消耗降低"],
  ["統帥_scout", "統帥", "偵察", 1, 2, "格", "wait_map", "偵察視野多 1 到 2 格"],
  ["統帥_diplomacy", "統帥", "外交", 15, 30, "%", "wait_popgrowth", "其他部落願意來歸的機率提升"],
  ["統帥_recruit", "統帥", "招募", 5, 10, "%(絕對值)", "wait_popgrowth", "新居民是先天職業者的機率提升"],
  ["統帥_fortify", "統帥", "佈防", 10, 20, "%", "wait_combat", "防守營地時戰力提升"],
  ["統帥_intimidate", "統帥", "威壓", 5, 10, "點", "wait_combat", "征討小部落時敵方士氣降低"],
  ["生產_hunt_yield", "勇武", "圍獵", 5, 10, "%", "v1", "全部落狩獵食物產量提升"],
  ["生產_hunt_fur", "勇武", "剝皮", 20, 40, "%", "v1", "狩獵的獸皮產量提升"],
  ["生產_hunt_trail", "勇武", "追蹤", 20, 40, "%", "wait_nature", "獵場豐度下降速度降低"],
  ["生產_hunt_lodge", "勇武", "獵隊", 1, 1, "格", "v1", "每座狩獵屋工位 +1"],
  ["生產_hunt_jerky", "勇武", "肉乾", 20, 40, "%", "v1", "獵人每人食物消耗降低"],
  ["生產_fish_yield", "精神", "撒網", 5, 10, "%", "v1", "全部落釣魚產量提升"],
  ["生產_fish_steady", "精神", "守漁", 20, 40, "%", "wait_nature", "漁場資源枯竭速度降低"],
  ["生產_fish_shed", "精神", "漁棚", 1, 1, "格", "v1", "每座釣魚場工位 +1"],
  ["生產_fish_gear", "精神", "漁具", 20, 40, "%", "v1", "釣魚場建造花費的建材減少"],
  ["生產_fish_ice", "精神", "冰釣", 30, 60, "%", "wait_season", "寒冬時釣魚產量的減幅降低"],
  ["生產_farm_yield", "智力", "精耕", 10, 20, "%", "v1", "全部落種田產量提升"],
  ["生產_farm_harvest", "智力", "豐收", 15, 30, "%", "wait_harvest", "每次收成的收成量提升"],
  ["生產_farm_plot", "智力", "墾荒", 1, 1, "格", "v1", "每塊田工位 +1"],
  ["生產_farm_straw", "智力", "秸稈", 0.005, 0.01, "建材/人/秒", "v1", "每名農夫額外產出建材"],
  ["生產_farm_rotate", "智力", "輪作", 20, 40, "%", "wait_soil", "田地地力下降速度降低"],
  ["生產_past_yield", "統帥", "放牧", 10, 20, "%", "v1", "全部落牧耕產量提升"],
  ["生產_live_yield", "統帥", "畜產", 10, 20, "%", "v1", "家畜的食物產量提升"],
  ["生產_live_fur", "統帥", "毛皮", 20, 40, "%", "v1", "家畜的獸皮產量提升"],
  ["生產_live_breed", "統帥", "繁殖", 1, 1, "格", "v1", "每座家畜欄工位 +1"],
  ["生產_live_vaccine", "統帥", "防疫", 20, 40, "%", "wait_medical", "家畜生病或死亡的機率降低"]
];

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
