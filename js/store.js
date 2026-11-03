/**
 * 初一学习工作台 - 数据层
 * ============================================================
 * 机制沿用「暑假学习管家」store.js 并全面换新前缀：
 *  - 所有 localStorage key 前缀 j1_（与旧项目 ssm_ 完全隔离，
 *    两者若部署在同一 origin 下也不会互相覆盖）
 *  - DATA_VERSION 迁移 + _repairData（保留用户数据只修结构）
 *  - localStorage 主写 + IndexedDB 冗余双写（j1-study-db-v1）
 *  - exportData / importData（合并式导入，校验 app 标识）
 *  - 去金钱化：本文件不存在任何积分/价格/兑换字段
 * ============================================================
 */
(function (global) {
  'use strict';

  /* ==================== 常量 ==================== */
  const STORAGE_KEYS = {
    VERSION: 'j1_data_version',
    SETTINGS: 'j1_settings',
    GOALS: 'j1_goals',
    WEEK_TASKS: 'j1_weekTasks',
    TODOS: 'j1_todos',
    EXAMS: 'j1_exams',
    MISTAKES: 'j1_mistakes',
    PLANS: 'j1_plans',
    HABIT_EVENTS: 'j1_habitEvents',
    BADGES: 'j1_badges',
    KPOINT_STATES: 'j1_kpointStates',
    KPOINT_OVERRIDES: 'j1_kpointOverrides',
    DELETED_KPOINT_IDS: 'j1_deletedKpointIds',
    PRIVILEGES: 'j1_privileges',
    PRAISE_LIBRARY: 'j1_praiseLibrary',
    AI_NOTES: 'j1_aiNotes',
    PROGRESS_LOG: 'j1_progressLog',
    META: 'j1_meta'
  };

  // 修改默认数据结构时递增，并同步升 service-worker.js 的 CACHE_NAME
  const DATA_VERSION = '1';

  const IDB_NAME = 'j1-study-db-v1';
  const IDB_STORE = 'kv';
  const IDB_DATA_KEY = 'all';

  /* ==================== 默认数据 ==================== */
  const DEFAULT_SETTINGS = {
    child: {
      name: '哥哥', grade: '初一上', weakSubject: 'math',
      note: '牙齿矫正 + OK 镜护理中，晚间可用时间约 30-40 分钟'
    },
    completionBaseline: 0.6,
    pomodoroMinutes: 15,
    breakMinutes: 5,
    restDays: [0],               // 0=周日不排新任务
    dailyMaxTodos: 3,
    dailyMaxMinutes: 45,
    carryOverMax: 3,
    topN: 3,
    planDays: 7,
    ebbinghausOffsets: [1, 3, 7],
    causeWeights: { concept: 1.4, method: 1.3, reading: 1.1, calc: 1.0, sloppy: 0.8, time: 0.7 }
  };

  // 表扬话术库：5 场景 × 4 条。原则：具体行为+过程，不评价聪明、不比较、不含分数
  const DEFAULT_PRAISE_LIBRARY = [
    { id: 'pr_hard_1', scene: 'hard_task', text: '你刚才那道题卡了 5 分钟没放弃，最后自己把思路理出来了，这一步是你自己走出来的。', tip: '说完可以摸摸头或击掌', usedCount: 0 },
    { id: 'pr_hard_2', scene: 'hard_task', text: '这道题你昨天还不会，今天能自己做完，我看得到这两天的差别。', tip: '语气平实，不夸张', usedCount: 0 },
    { id: 'pr_hard_3', scene: 'hard_task', text: '你刚才先把题目读了两遍再动笔，这个习惯特别好，很多错题就是读一遍就写才错的。', tip: '指出具体动作', usedCount: 0 },
    { id: 'pr_hard_4', scene: 'hard_task', text: '今天这个是你自己选的顺序，选完就开始了，没拖，这个开始很棒。', tip: '配合 A/B/C 自选使用', usedCount: 0 },
    { id: 'pr_exam_1', scene: 'exam_progress', text: '这次计算题比上次少错了 3 道，我看得出来你这周练了运算顺序。', tip: '只跟自己比', usedCount: 0 },
    { id: 'pr_exam_2', scene: 'exam_progress', text: '这张卷子你会做的那部分都拿住了，稳稳的，这就是基础在变牢。', tip: '强调稳住的部分', usedCount: 0 },
    { id: 'pr_exam_3', scene: 'exam_progress', text: '错的那几道我们已经知道卡在哪了，接下来一小步一小步补，不用急。', tip: '把注意力引向下一步', usedCount: 0 },
    { id: 'pr_exam_4', scene: 'exam_progress', text: '你考前自己把错题本翻了一遍，这个动作很多大人都做不到。', tip: '肯定自主行为', usedCount: 0 },
    { id: 'pr_init_1', scene: 'initiative', text: '今天你没等我提醒就把书翻开了，这个「自己开始」我很想记下来。', tip: '当天说最有效', usedCount: 0 },
    { id: 'pr_init_2', scene: 'initiative', text: '你刚才那个问题问得好，会提问说明你真的在想过它。', tip: '认真回答后再说', usedCount: 0 },
    { id: 'pr_init_3', scene: 'initiative', text: '你把这道题讲给我听的时候思路是清楚的，能讲明白才是真会。', tip: '讲题后使用', usedCount: 0 },
    { id: 'pr_init_4', scene: 'initiative', text: '你自己发现了那道题错在哪，自己找到的错，下次最不容易再犯。', tip: '自纠后使用', usedCount: 0 },
    { id: 'pr_frus_1', scene: 'frustration', text: '做错说明这道题正好在我们要补的地方，我们先只做第一步，剩下的明天来。', tip: '把任务切小', usedCount: 0 },
    { id: 'pr_frus_2', scene: 'frustration', text: '这道题确实难，卡住很正常，你已经比我上学时强了。', tip: '先共情再鼓励', usedCount: 0 },
    { id: 'pr_frus_3', scene: 'frustration', text: '今天状态不好我们就到这，能坐下来这 15 分钟已经算数了。', tip: '允许停止', usedCount: 0 },
    { id: 'pr_frus_4', scene: 'frustration', text: '不是你笨，是这一块还没补到，补到了就好了，我们按计划走。', tip: '把问题和人分开', usedCount: 0 },
    { id: 'pr_habit_1', scene: 'habit', text: '这七天你每天都坐下来做 15 分钟，最难的是「每天都坐下来」，你做到了。', tip: '连续打卡里程碑时用', usedCount: 0 },
    { id: 'pr_habit_2', scene: 'habit', text: '错题重做这件事你坚持了两周，比考多少分都让我佩服。', tip: '重做坚持期用', usedCount: 0 },
    { id: 'pr_habit_3', scene: 'habit', text: '这个知识点被你点亮了——从错 5 道到连对 3 次，这是你自己练出来的。', tip: '知识点点亮时用', usedCount: 0 },
    { id: 'pr_habit_4', scene: 'habit', text: '你今天自己安排了先做哪科，安排得挺合理，下次还交给你。', tip: '自选顺序后用', usedCount: 0 }
  ];

  // 低成本非货币特权（无价格、无兑换，妈妈直接「这周送给他」）
  const DEFAULT_PRIVILEGES = [
    { id: 'pv_1', title: '决定周末晚餐吃什么', icon: '🍜', note: '全家跟着吃他选的' },
    { id: 'pv_2', title: '晚睡 30 分钟', icon: '🌙', note: '周末晚上用' },
    { id: 'pv_3', title: '选一部家庭电影', icon: '🎬', note: '全家一起看' },
    { id: 'pv_4', title: '决定周末去哪散步', icon: '🚶', note: '附近公园路线他定' },
    { id: 'pv_5', title: '选一本亲子共读的书', icon: '📚', note: '妈妈陪着读' },
    { id: 'pv_6', title: '免一次家务', icon: '🧦', note: '指定一次不做' },
    { id: 'pv_7', title: '选今晚餐桌音乐/桌游', icon: '🎵', note: '晚饭时间他做主' },
    { id: 'pv_8', title: '邀请同学来家里玩一次', icon: '🤝', note: '提前和妈妈约时间' },
    { id: 'pv_9', title: '妈妈陪打一场球', icon: '🏀', note: '楼下或球场 30 分钟' },
    { id: 'pv_10', title: '先决定今天 A/B/C 顺序', icon: '🎲', note: '每日待办自选权' },
    { id: 'pv_11', title: '选周末早餐', icon: '🥞', note: '早餐吃什么他定' },
    { id: 'pv_12', title: '决定一次家庭拍照地点', icon: '📸', note: '周末拍照他选景' }
  ];

  /* ==================== IndexedDB 封装 ==================== */
  function _idbOpen() {
    return new Promise((resolve, reject) => {
      try {
        if (!global.indexedDB) { reject(new Error('no indexedDB')); return; }
        const req = global.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('idb open error'));
      } catch (e) { reject(e); }
    });
  }

  function _idbPut(key, value) {
    return _idbOpen().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => { try { db.close(); } catch (e) {} resolve(true); };
        tx.onerror = () => { try { db.close(); } catch (e) {} reject(tx.error); };
      } catch (e) { try { db.close(); } catch (e2) {} reject(e); }
    }));
  }

  function _idbGet(key) {
    return _idbOpen().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => { try { db.close(); } catch (e) {} resolve(req.result); };
        req.onerror = () => { try { db.close(); } catch (e) {} reject(req.error); };
      } catch (e) { try { db.close(); } catch (e2) {} reject(e); }
    }));
  }

  /* ==================== 工具 ==================== */
  let _uidCounter = 0;
  function uid(prefix) {
    _uidCounter++;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + _uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ==================== Store 类 ==================== */
  class Store {
    constructor() {
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this.goals = [];
      this.weekTasks = [];
      this.todos = {};          // { 'YYYY-MM-DD': [todo,...] }
      this.exams = [];
      this.mistakes = [];
      this.plans = [];
      this.habitEvents = [];
      this.badges = [];
      this.kpointStates = {};   // { kpointId: {lit,litAt,mastery,redoRightStreak,lastPracticeAt,criteriaConfirmed} }
      this.kpointOverrides = []; // 用户自定义知识点（custom:true）
      this.deletedKpointIds = []; // 已停用内置知识点（防复活）
      this.privileges = JSON.parse(JSON.stringify(DEFAULT_PRIVILEGES));
      this.praiseLibrary = JSON.parse(JSON.stringify(DEFAULT_PRAISE_LIBRARY));
      this.aiNotes = [];
      this.progressLog = [];
      this.meta = { lastRollOverDate: null, lastExportAt: null, visited: false };
      this._lsAvailable = true;
    }

    /* ---------- 初始化 / 加载 / 保存 ---------- */
    init() {
      const hasData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const savedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
      const needsRepair = !savedVersion || savedVersion !== DATA_VERSION;

      if (hasData && !needsRepair) {
        this.load();
        if (this._needsDataRepair()) { this._repairData(); this.save(); }
      } else if (hasData && needsRepair) {
        this.load();
        this._repairData();
        this.save();
      } else {
        this._resetToDefaults();
      }
      this._syncIdb();
    }

    load() {
      const get = (key, fallback) => {
        try {
          const raw = localStorage.getItem(key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      };
      this.settings = get(STORAGE_KEYS.SETTINGS, this.settings);
      this.goals = get(STORAGE_KEYS.GOALS, []);
      this.weekTasks = get(STORAGE_KEYS.WEEK_TASKS, []);
      this.todos = get(STORAGE_KEYS.TODOS, {});
      this.exams = get(STORAGE_KEYS.EXAMS, []);
      this.mistakes = get(STORAGE_KEYS.MISTAKES, []);
      this.plans = get(STORAGE_KEYS.PLANS, []);
      this.habitEvents = get(STORAGE_KEYS.HABIT_EVENTS, []);
      this.badges = get(STORAGE_KEYS.BADGES, []);
      this.kpointStates = get(STORAGE_KEYS.KPOINT_STATES, {});
      this.kpointOverrides = get(STORAGE_KEYS.KPOINT_OVERRIDES, []);
      this.deletedKpointIds = get(STORAGE_KEYS.DELETED_KPOINT_IDS, []);
      this.privileges = get(STORAGE_KEYS.PRIVILEGES, JSON.parse(JSON.stringify(DEFAULT_PRIVILEGES)));
      this.praiseLibrary = get(STORAGE_KEYS.PRAISE_LIBRARY, JSON.parse(JSON.stringify(DEFAULT_PRAISE_LIBRARY)));
      this.aiNotes = get(STORAGE_KEYS.AI_NOTES, []);
      this.progressLog = get(STORAGE_KEYS.PROGRESS_LOG, []);
      this.meta = Object.assign({ lastRollOverDate: null, lastExportAt: null, visited: false }, get(STORAGE_KEYS.META, {}));
    }

    _serializeAll() {
      return {
        settings: this.settings,
        goals: this.goals,
        weekTasks: this.weekTasks,
        todos: this.todos,
        exams: this.exams,
        mistakes: this.mistakes,
        plans: this.plans,
        habitEvents: this.habitEvents,
        badges: this.badges,
        kpointStates: this.kpointStates,
        kpointOverrides: this.kpointOverrides,
        deletedKpointIds: this.deletedKpointIds,
        privileges: this.privileges,
        praiseLibrary: this.praiseLibrary,
        aiNotes: this.aiNotes,
        progressLog: this.progressLog,
        meta: this.meta
      };
    }

    save() {
      if (!this._lsAvailable) return false;
      const pairs = {
        SETTINGS: this.settings,
        GOALS: this.goals,
        WEEK_TASKS: this.weekTasks,
        TODOS: this.todos,
        EXAMS: this.exams,
        MISTAKES: this.mistakes,
        PLANS: this.plans,
        HABIT_EVENTS: this.habitEvents,
        BADGES: this.badges,
        KPOINT_STATES: this.kpointStates,
        KPOINT_OVERRIDES: this.kpointOverrides,
        DELETED_KPOINT_IDS: this.deletedKpointIds,
        PRIVILEGES: this.privileges,
        PRAISE_LIBRARY: this.praiseLibrary,
        AI_NOTES: this.aiNotes,
        PROGRESS_LOG: this.progressLog,
        META: this.meta
      };
      try {
        Object.keys(pairs).forEach(k => {
          localStorage.setItem(STORAGE_KEYS[k], JSON.stringify(pairs[k]));
        });
        localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
      } catch (e) {
        this._lsAvailable = false;
        console.warn('[Store] localStorage 不可用，请立即导出备份', e);
        return false;
      }
      this._backupToIdb();
      return true;
    }

    _needsDataRepair() {
      return !this.settings || typeof this.settings !== 'object' || !this.settings.child;
    }

    _resetToDefaults() {
      const fresh = new Store();
      ['settings', 'privileges', 'praiseLibrary', 'meta'].forEach(f => {
        this[f] = fresh[f];
      });
      this.goals = []; this.weekTasks = []; this.todos = {};
      this.exams = []; this.mistakes = []; this.plans = [];
      this.habitEvents = []; this.badges = []; this.kpointStates = {};
      this.kpointOverrides = []; this.deletedKpointIds = [];
      this.aiNotes = []; this.progressLog = [];
      localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
      this.save();
    }

    /**
     * 修复/迁移：保留全部用户数据，只补结构、清孤儿引用。
     */
    _repairData() {
      const D = (global.J1Engine && global.J1Engine.date) || null;

      // 1) settings 补默认字段
      this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings || {});
      if (!this.settings.child) this.settings.child = DEFAULT_SETTINGS.child;

      // 2) 数组字段兜底
      ['goals', 'weekTasks', 'exams', 'mistakes', 'plans', 'habitEvents', 'badges',
        'kpointOverrides', 'deletedKpointIds', 'privileges', 'praiseLibrary', 'aiNotes', 'progressLog']
        .forEach(f => { if (!Array.isArray(this[f])) this[f] = []; });
      if (!this.todos || typeof this.todos !== 'object' || Array.isArray(this.todos)) this.todos = {};
      if (!this.kpointStates || typeof this.kpointStates !== 'object') this.kpointStates = {};

      // 3) 特权/话术库合并默认（只补新增，不覆盖用户改动）
      const mergeById = (list, defaults) => {
        const ids = new Set(list.map(x => x.id));
        defaults.forEach(d => { if (!ids.has(d.id)) list.push(JSON.parse(JSON.stringify(d))); });
        return list;
      };
      if (this.privileges.length === 0) this.privileges = JSON.parse(JSON.stringify(DEFAULT_PRIVILEGES));
      else mergeById(this.privileges, DEFAULT_PRIVILEGES);
      if (this.praiseLibrary.length === 0) this.praiseLibrary = JSON.parse(JSON.stringify(DEFAULT_PRAISE_LIBRARY));
      else mergeById(this.praiseLibrary, DEFAULT_PRAISE_LIBRARY);

      // 4) 实体字段补默认（幂等）
      this.goals.forEach(g => {
        g.status = g.status || 'active';
        g.kpointIds = Array.isArray(g.kpointIds) ? g.kpointIds : [];
        g.metric = g.metric || { type: 'count', target: 1, unit: '次', baseline: 0 };
        g.lastMeasured = (g.lastMeasured === undefined) ? null : g.lastMeasured;
        g.lastMeasuredAt = g.lastMeasuredAt || null;
      });
      this.weekTasks.forEach(w => {
        w.status = w.status || 'active';
        w.target = w.target || { type: 'count', value: 1, unit: '题' };
        w.suggestedValue = w.suggestedValue || w.target.value || 1;
        w.manualAdjust = w.manualAdjust || { delta: 0, reason: '' };
        w.progressMode = w.progressMode || 'auto';
        w.manualProgress = w.manualProgress || 0;
        w.kpointIds = Array.isArray(w.kpointIds) ? w.kpointIds : [];
      });
      Object.keys(this.todos).forEach(date => {
        if (!Array.isArray(this.todos[date])) { delete this.todos[date]; return; }
        this.todos[date].forEach(t => {
          t.status = t.status || 'pending';
          t.carryOver = !!t.carryOver;
          t.carryCount = t.carryCount || 0;
          t.stagnant = !!t.stagnant;
          t.doneValue = t.doneValue || 0;
          t.targetValue = t.targetValue || 1;
          t.estMinutes = t.estMinutes || 15;
          t.originId = t.originId || t.id;
          t.originDate = t.originDate || t.date;
          t.source = t.source || 'manual';
        });
      });
      this.exams.forEach(e => { e.mistakeIds = Array.isArray(e.mistakeIds) ? e.mistakeIds : []; });
      this.mistakes.forEach(m => {
        m.status = m.status || 'todo';
        m.redoHistory = Array.isArray(m.redoHistory) ? m.redoHistory : [];
        m.reviewSchedule = Array.isArray(m.reviewSchedule) ? m.reviewSchedule : [];
        m.failCount = m.failCount || 0;
        m.archived = !!m.archived;
      });

      // 5) 清孤儿引用：错题挂已停用知识点 → 归到未分类（保留原文不删）
      const validIds = new Set(this.getKpoints(true).map(k => k.id));
      this.mistakes.forEach(m => {
        if (m.kpointId && !validIds.has(m.kpointId) && m.kpointId !== '_custom.unclassified') {
          m.kpointId = '_custom.unclassified';
        }
      });

      // 6) meta 补默认 + 写版本号
      this.meta = Object.assign({ lastRollOverDate: null, lastExportAt: null, visited: false }, this.meta || {});
      try { localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION); } catch (e) { /* 忽略 */ }
    }

    /* ---------- IndexedDB 双写 ---------- */
    _backupToIdb() {
      _idbPut(IDB_DATA_KEY, this._serializeAll()).catch(() => {});
    }

    _syncIdb() {
      _idbGet(IDB_DATA_KEY).then(data => {
        if (!data || !data.settings) return;
        const lsSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (lsSettings) return; // localStorage 正常，无需恢复
        // localStorage 缺失：从 IDB 恢复
        this.settings = data.settings; this.goals = data.goals || [];
        this.weekTasks = data.weekTasks || []; this.todos = data.todos || {};
        this.exams = data.exams || []; this.mistakes = data.mistakes || [];
        this.plans = data.plans || []; this.habitEvents = data.habitEvents || [];
        this.badges = data.badges || []; this.kpointStates = data.kpointStates || {};
        this.kpointOverrides = data.kpointOverrides || []; this.deletedKpointIds = data.deletedKpointIds || [];
        this.privileges = data.privileges || []; this.praiseLibrary = data.praiseLibrary || [];
        this.aiNotes = data.aiNotes || []; this.progressLog = data.progressLog || [];
        this.meta = data.meta || this.meta;
        this.save();
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('j1_idb_recovered')) return;
        try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('j1_idb_recovered', '1'); } catch (e) {}
        if (typeof location !== 'undefined' && typeof location.reload === 'function') {
          location.reload();
        }
      }).catch(() => {});
    }

    /* ---------- 知识点图谱 ---------- */
    // all=true 时包含 enabled:false（七下占位）；默认只返回启用的
    getKpoints(all) {
      const KP = global.J1KPOINTS;
      let list = [];
      if (KP && Array.isArray(KP.kpoints)) {
        list = KP.kpoints.map(k => JSON.parse(JSON.stringify(k)));
      }
      (this.kpointOverrides || []).forEach(o => list.push(JSON.parse(JSON.stringify(o))));
      const delSet = new Set(this.deletedKpointIds || []);
      list = list.filter(k => !delSet.has(k.id));
      if (!all) list = list.filter(k => k.enabled !== false);
      return list;
    }

    getKpoint(id) {
      return this.getKpoints(true).find(k => k.id === id) || null;
    }

    addKpoint(data) {
      const k = Object.assign({}, data, {
        id: data.id || uid('kpt'), custom: true, enabled: true,
        term: data.term || '七上',
        prescription: data.prescription || {
          microLesson: '', practiceTypes: [], masteryCriteria: '', estMinutes: 15, reviewRhythm: [1, 3, 7], commonCauses: []
        }
      });
      this.kpointOverrides.push(k);
      this.save();
      return k;
    }

    disableKpoint(id) {
      if (this.deletedKpointIds.indexOf(id) < 0) this.deletedKpointIds.push(id);
      this.save();
    }

    enableKpoint(id) {
      this.deletedKpointIds = this.deletedKpointIds.filter(x => x !== id);
      this.save();
    }

    getKpointState(kpointId) {
      if (!this.kpointStates[kpointId]) {
        this.kpointStates[kpointId] = {
          lit: false, litAt: null, mastery: 0, redoRightStreak: 0,
          lastPracticeAt: null, criteriaConfirmed: false
        };
      }
      return this.kpointStates[kpointId];
    }

    // 点亮判定：连续重做对≥3 且 mastery≥0.8 且妈妈确认掌握标准
    tryLightKpoint(kpointId, today) {
      const st = this.getKpointState(kpointId);
      if (st.lit) return { lit: true, just: false };
      if (st.redoRightStreak >= 3 && st.mastery >= 0.8 && st.criteriaConfirmed) {
        st.lit = true; st.litAt = today;
        this.logProgress('kpoint_lit', kpointId, 1);
        this.save();
        return { lit: true, just: true };
      }
      return { lit: false, just: false };
    }

    /* ---------- 月目标 ---------- */
    addGoal(goal) {
      const g = Object.assign({
        id: uid('g'), month: todayStr().slice(0, 7), subject: 'math', title: '',
        metric: { type: 'count', target: 1, unit: '题', baseline: 0 },
        kpointIds: [], status: 'active', note: '',
        startDate: todayStr().slice(0, 7) + '-01', endDate: null, lastMeasured: null, lastMeasuredAt: null
      }, goal);
      if (!g.endDate) {
        const m = D_monthEnd(g.month || todayStr().slice(0, 7));
        g.endDate = m;
      }
      this.goals.push(g);
      this.save();
      return g;
    }
    updateGoal(id, patch) {
      const g = this.goals.find(x => x.id === id);
      if (g) Object.assign(g, patch);
      this.save();
      return g;
    }
    deleteGoal(id) {
      this.goals = this.goals.filter(g => g.id !== id);
      this.weekTasks = this.weekTasks.filter(w => w.goalId !== id); // 周任务级联删除；已生成的每日待办保留（source 标 manual）
      Object.keys(this.todos).forEach(d => {
        this.todos[d].forEach(t => { if (t.goalId === id) t.goalId = null; });
      });
      this.save();
    }

    /* ---------- 周任务 ---------- */
    addWeekTask(wt) {
      const w = Object.assign({
        id: uid('w'), goalId: null, weekStart: null, weekEnd: null, subject: 'math',
        title: '', target: { type: 'count', value: 1, unit: '题' }, suggestedValue: 1,
        manualAdjust: { delta: 0, reason: '' }, derived: 'auto', progressMode: 'auto',
        manualProgress: 0, kpointIds: [], status: 'active'
      }, wt);
      this.weekTasks.push(w);
      this.save();
      return w;
    }
    updateWeekTask(id, patch) {
      const w = this.weekTasks.find(x => x.id === id);
      if (w) Object.assign(w, patch);
      this.save();
      return w;
    }
    deleteWeekTask(id) {
      this.weekTasks = this.weekTasks.filter(w => w.id !== id);
      Object.keys(this.todos).forEach(d => {
        this.todos[d].forEach(t => { if (t.weekTaskId === id) t.weekTaskId = null; });
      });
      this.save();
    }

    /* ---------- 每日待办 ---------- */
    addTodo(todo) {
      const t = Object.assign({
        id: uid('t'), date: todayStr(), weekTaskId: null, goalId: null,
        source: 'manual', planId: null, mistakeId: null, kpointId: null,
        subject: 'other', title: '', targetValue: 1, estMinutes: 15,
        hardToStart: false, choiceGroup: null,
        status: 'pending', completedAt: null, doneValue: 0,
        carryOver: false, carryCount: 0, originId: null, originDate: null,
        stagnant: false, ebbinghausTag: null, rescheduleCount: 0, note: ''
      }, todo);
      if (!t.originId) t.originId = t.id;
      if (!t.originDate) t.originDate = t.date;
      if (!this.todos[t.date]) this.todos[t.date] = [];
      this.todos[t.date].push(t);
      this.save();
      return t;
    }
    // 幂等添加：同 id 已存在则跳过（补学计划转待办/艾宾浩斯待办用）
    addTodoIfAbsent(todo) {
      const list = this.todos[todo.date] || [];
      if (list.some(t => t.id === todo.id)) return null;
      return this.addTodo(todo);
    }
    updateTodo(id, patch) {
      let found = null;
      Object.keys(this.todos).forEach(d => {
        this.todos[d].forEach(t => { if (t.id === id) { Object.assign(t, patch); found = t; } });
      });
      if (found) this.save();
      return found;
    }
    deleteTodo(id) {
      Object.keys(this.todos).forEach(d => {
        this.todos[d] = this.todos[d].filter(t => t.id !== id);
        if (this.todos[d].length === 0) delete this.todos[d];
      });
      this.save();
    }
    getTodo(id) {
      for (const d of Object.keys(this.todos)) {
        const t = (this.todos[d] || []).find(x => x.id === id);
        if (t) return t;
      }
      return null;
    }

    /* ---------- 考试 ---------- */
    addExam(exam) {
      const e = Object.assign({
        id: uid('e'), date: todayStr(), subject: 'math', type: 'unit',
        score: 0, fullScore: 100, classRank: null, gradeRank: null,
        source: '', note: '', mistakeIds: [], createdAt: todayStr()
      }, exam);
      this.exams.push(e);
      this.logProgress('exam_added', e.id, 1);
      this.save();
      return e;
    }
    updateExam(id, patch) {
      const e = this.exams.find(x => x.id === id);
      if (e) Object.assign(e, patch);
      this.save();
      return e;
    }
    deleteExam(id) {
      this.exams = this.exams.filter(e => e.id !== id);
      this.mistakes.forEach(m => { if (m.examId === id) m.examId = null; });
      this.save();
    }

    /* ---------- 错题 ---------- */
    addMistake(m, today) {
      const d = today || todayStr();
      const E = global.J1Engine;
      const ms = Object.assign({
        id: uid('m'), examId: null, date: d, subject: 'math',
        kpointId: '_custom.unclassified', kpointPath: '', source: '',
        cause: 'concept', questionText: '', correctAnswer: '',
        status: 'todo', redoHistory: [], failCount: 0, archived: false
      }, m);
      if (E && E.buildReviewSchedule) {
        ms.reviewSchedule = E.buildReviewSchedule(ms.date, this.settings);
      } else {
        ms.reviewSchedule = [];
      }
      this.mistakes.push(ms);
      if (ms.examId) {
        const ex = this.exams.find(x => x.id === ms.examId);
        if (ex && ex.mistakeIds.indexOf(ms.id) < 0) ex.mistakeIds.push(ms.id);
      }
      this.save();
      return ms;
    }
    updateMistake(id, patch) {
      const m = this.mistakes.find(x => x.id === id);
      if (m) Object.assign(m, patch);
      this.save();
      return m;
    }
    archiveMistake(id) {
      this.updateMistake(id, { archived: true });
    }

    /**
     * 记录一次重做结果。返回 {lit, justLit, rescheduled}
     */
    recordRedo(mistakeId, result, today) {
      const E = global.J1Engine;
      const d = today || todayStr();
      const m = this.mistakes.find(x => x.id === mistakeId);
      if (!m) return null;
      m.redoHistory.push({ date: d, result: result });
      const st = this.getKpointState(m.kpointId);
      st.lastPracticeAt = d;
      let rescheduled = false;
      if (result === 'right') {
        m.status = 'redo_right';
        st.redoRightStreak += 1;
        st.mastery = Math.min(1, (st.mastery || 0) + 0.2);
        // 勾掉到期复习项
        (m.reviewSchedule || []).forEach(rv => {
          if (!rv.done && E && E.date && E.date.diff(rv.date, d) >= 0) rv.done = true;
        });
      } else {
        m.status = 'redo_wrong';
        m.failCount = (m.failCount || 0) + 1;
        st.redoRightStreak = 0;
        m.rescheduleCount = (m.rescheduleCount || 0) + 1;
        if (m.rescheduleCount <= 2) {
          let nd = E ? E.date.shift(d, 2) : d;
          m.reviewSchedule.push({ tag: 'D2补', date: nd, done: false, todoId: null });
          rescheduled = true;
        }
      }
      this.addHabitEvent('redo', mistakeId, '');
      this.logProgress('mistake_redo', m.id, result === 'right' ? 1 : 0);
      const litRes = this.tryLightKpoint(m.kpointId, d);
      this.save();
      return { lit: litRes.lit, justLit: litRes.just, rescheduled: rescheduled };
    }

    /* ---------- 补学计划 ---------- */
    addPlan(plan) {
      this.plans.forEach(p => { if (p.status === 'active') p.status = 'replaced'; });
      this.plans.push(plan);
      this.save();
      return plan;
    }

    /* ---------- 习惯事件 / 徽章 ---------- */
    addHabitEvent(type, refId, note) {
      const d = todayStr();
      // 同一天同类型去重
      const dup = this.habitEvents.find(h => h.type === type && h.date === d && h.refId === refId);
      if (dup) return dup;
      const h = { id: uid('h'), date: d, type: type, refId: refId || null, note: note || '' };
      this.habitEvents.push(h);
      this.save();
      return h;
    }

    evaluateBadges(today) {
      const E = global.J1Engine;
      if (!E) return [];
      const fresh = E.evaluateBadges(this, today || todayStr());
      if (fresh.length) {
        this.badges = this.badges.concat(fresh);
        this.save();
      }
      return fresh;
    }

    /* ---------- 特权 ---------- */
    grantPrivilege(id, weekKey) {
      const p = this.privileges.find(x => x.id === id);
      if (p) { p.grantedWeek = weekKey; p.grantedAt = todayStr(); p.usedAt = null; this.save(); }
      return p;
    }

    /* ---------- 话术 ---------- */
    usePraise(id) {
      const p = this.praiseLibrary.find(x => x.id === id);
      if (p) { p.usedCount = (p.usedCount || 0) + 1; this.save(); }
      return p;
    }
    addPraise(scene, text) {
      const p = { id: uid('pr'), scene: scene, text: text, tip: '', usedCount: 0 };
      this.praiseLibrary.push(p);
      this.save();
      return p;
    }

    /* ---------- 进度日志 ---------- */
    logProgress(type, refId, delta) {
      this.progressLog.push({ date: todayStr(), type: type, refId: refId, delta: delta });
      if (this.progressLog.length > 2000) this.progressLog = this.progressLog.slice(-1500);
    }

    /* ---------- 导出 / 导入 / 清除 ---------- */
    exportData() {
      this.meta.lastExportAt = new Date().toISOString();
      this.save();
      return Object.assign({ app: 'j1-study-workbench', version: DATA_VERSION, exportDate: new Date().toISOString() }, this._serializeAll());
    }

    /**
     * 合并式导入：校验 app 标识，按 id 合并（导入数据优先），未知字段忽略。
     * 返回 {ok, warnings}
     */
    importData(data) {
      const warnings = [];
      if (!data || data.app !== 'j1-study-workbench') {
        return { ok: false, warnings: ['文件标识不对：这不是初一学习工作台的备份文件'] };
      }
      // 导入前快照摘要（可追溯）
      this.aiNotes.push({
        id: uid('ai'), createdAt: todayStr(), raw: '【导入前快照】目标 ' + this.goals.length +
          ' 个，周任务 ' + this.weekTasks.length + ' 条，待办 ' + Object.keys(this.todos).length +
          ' 天，错题 ' + this.mistakes.length + ' 题，考试 ' + this.exams.length + ' 场',
        parsed: null, warnings: [], applied: null, undone: false
      });
      const mergeList = (cur, inc) => {
        if (!Array.isArray(inc)) return cur;
        const map = new Map(cur.map(x => [x.id, x]));
        inc.forEach(x => { if (x && x.id) map.set(x.id, x); });
        return Array.from(map.values());
      };
      if (data.settings) this.settings = Object.assign({}, this.settings, data.settings);
      if (Array.isArray(data.goals)) this.goals = mergeList(this.goals, data.goals);
      if (Array.isArray(data.weekTasks)) this.weekTasks = mergeList(this.weekTasks, data.weekTasks);
      if (Array.isArray(data.exams)) this.exams = mergeList(this.exams, data.exams);
      if (Array.isArray(data.mistakes)) this.mistakes = mergeList(this.mistakes, data.mistakes);
      if (Array.isArray(data.plans)) this.plans = mergeList(this.plans, data.plans);
      if (Array.isArray(data.habitEvents)) this.habitEvents = mergeList(this.habitEvents, data.habitEvents);
      if (Array.isArray(data.badges)) this.badges = mergeList(this.badges, data.badges);
      if (Array.isArray(data.kpointOverrides)) this.kpointOverrides = mergeList(this.kpointOverrides, data.kpointOverrides);
      if (Array.isArray(data.privileges)) this.privileges = mergeList(this.privileges, data.privileges);
      if (Array.isArray(data.praiseLibrary)) this.praiseLibrary = mergeList(this.praiseLibrary, data.praiseLibrary);
      if (Array.isArray(data.aiNotes)) this.aiNotes = mergeList(this.aiNotes, data.aiNotes);
      if (Array.isArray(data.deletedKpointIds)) {
        this.deletedKpointIds = Array.from(new Set(this.deletedKpointIds.concat(data.deletedKpointIds)));
      }
      if (data.kpointStates && typeof data.kpointStates === 'object') {
        this.kpointStates = Object.assign({}, this.kpointStates, data.kpointStates);
      }
      if (data.todos && typeof data.todos === 'object' && !Array.isArray(data.todos)) {
        Object.keys(data.todos).forEach(date => {
          const inc = data.todos[date] || [];
          const cur = this.todos[date] || (this.todos[date] = []);
          const ids = new Set(cur.map(t => t.id));
          inc.forEach(t => { if (t && t.id && !ids.has(t.id)) cur.push(t); else if (t && t.id) {
            const i = cur.findIndex(x => x.id === t.id); if (i >= 0) cur[i] = t;
          } });
        });
      }
      if (Array.isArray(data.progressLog)) {
        const seen = new Set(this.progressLog.map(p => p.date + '|' + p.type + '|' + p.refId));
        data.progressLog.forEach(p => {
          const k = p.date + '|' + p.type + '|' + p.refId;
          if (!seen.has(k)) { this.progressLog.push(p); seen.add(k); }
        });
      }
      this._repairData();
      this.save();
      return { ok: true, warnings: warnings };
    }

    // 只删 j1_ 前缀的键，同步清 IDB 备份键（不清缓存，不动其他应用数据）
    clearData() {
      Object.keys(STORAGE_KEYS).forEach(k => {
        try { localStorage.removeItem(STORAGE_KEYS[k]); } catch (e) {}
      });
      this._resetToDefaults();
    }
  }

  /* ==================== 辅助 ==================== */
  function D_monthEnd(monthStr) {
    const m = monthStr.match(/^(\d{4})-(\d{2})$/);
    if (!m) return todayStr();
    const y = Number(m[1]), mo = Number(m[2]);
    const d = new Date(y, mo, 0);
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ==================== 导出 ==================== */
  global.J1Constants = { STORAGE_KEYS: STORAGE_KEYS, DATA_VERSION: DATA_VERSION, IDB_NAME: IDB_NAME };
  global.J1StoreClass = Store;
  global.J1Store = new Store();
})(typeof window !== 'undefined' ? window : globalThis);
