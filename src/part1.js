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
