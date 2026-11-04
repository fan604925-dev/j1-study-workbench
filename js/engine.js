/**
 * 初一学习工作台 - 规则引擎（纯逻辑，无 DOM，可在 Node 直接运行）
 * ============================================================
 * 职责：月→周→日拆解、进度聚合（完成率/目标进度/偏差）、逾期顺延、
 *       薄弱指数诊断、7 天补学计划生成、艾宾浩斯重做调度、徽章判定。
 * 约定：所有函数不落库、不 save，返回结果由调用方（页面/store）写回。
 * ============================================================
 */
(function (global) {
  'use strict';

  const KP = global.J1KPOINTS || { kpoints: [], causes: [], subjects: [] };
  const CAUSE_NAME = {};
  (KP.causes || []).forEach(c => { CAUSE_NAME[c.id] = c.name; });

  /* ==================== 一、日期工具 ==================== */
  const D = {
    today() { return D.fmt(new Date()); },
    fmt(d) {
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    },
    parse(s) {
      if (!s || typeof s !== 'string') return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return null;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    },
    isValid(s) { return !!D.parse(s); },
    shift(s, n) {
      const d = D.parse(s); if (!d) return s;
      d.setDate(d.getDate() + n);
      return D.fmt(d);
    },
    diff(a, b) { // b - a 的天数
      const da = D.parse(a), db = D.parse(b);
      if (!da || !db) return 0;
      return Math.round((db - da) / 86400000);
    },
    dow(s) { const d = D.parse(s); return d ? d.getDay() : 0; }, // 0=周日
    weekStart(s) { // 周一为首日
      const w = D.dow(s);
      return w === 0 ? D.shift(s, -6) : D.shift(s, -(w - 1));
    },
    weekDates(weekStartStr) {
      const out = [];
      for (let i = 0; i < 7; i++) out.push(D.shift(weekStartStr, i));
      return out;
    },
    isRest(dateStr, restDays) {
      return (restDays || []).indexOf(D.dow(dateStr)) >= 0;
    },
    fmtCN(s) {
      const d = D.parse(s); if (!d) return s;
      const w = ['日', '一', '二', '三', '四', '五', '六'];
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + w[d.getDay()];
    },
    monthOf(s) { return s.slice(0, 7); }
  };

  /* ==================== 二、均分（最大余数法） ==================== */
  function splitEvenly(total, weights) {
    const n = weights.length;
    if (n === 0) return [];
    let sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) { weights = weights.map(() => 1); sum = n; }
    total = Math.max(0, Math.round(total));
    const raw = weights.map(w => total * w / sum);
    const base = raw.map(Math.floor);
    let rem = total - base.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => ({ i, r }))
      .sort((a, b) => (b.r - a.r) || (a.i - b.i));
    for (let k = 0; rem > 0 && k < order.length; k++) {
      base[order[k].i] += 1; rem--;
    }
    return base;
  }

  /* ==================== 三、月目标 → 周任务建议 ==================== */
  // 返回 [{weekStart, weekEnd, days, suggested}]，Σsuggested === 可拆分目标的 target
  function suggestWeekSplit(goal) {
    const start = goal.startDate, end = goal.endDate;
    if (!D.isValid(start) || !D.isValid(end) || D.diff(start, end) < 0) return [];
    const weeks = [];
    let ws = D.weekStart(start);
    while (D.diff(ws, end) >= 0) {
      const we = D.shift(ws, 6);
      const effStart = D.diff(ws, start) < 0 ? start : ws;
      const effEnd = D.diff(end, we) < 0 ? end : we;
      weeks.push({ weekStart: ws, weekEnd: we, days: D.diff(effStart, effEnd) + 1, suggested: 0 });
      ws = D.shift(ws, 7);
    }
    if (weeks.length === 0) return [];
    const splittable = goal.metric && (goal.metric.type === 'count' || goal.metric.type === 'habit');
    if (splittable) {
      const values = splitEvenly(goal.metric.target, weeks.map(w => w.days));
      weeks.forEach((w, i) => { w.suggested = values[i]; });
    } else {
      // accuracy / score 类：每周建议 1 次（测一次/练一次），量由妈妈定
      weeks.forEach(w => { w.suggested = 1; });
    }
    return weeks;
  }

  /* ==================== 四、周任务 → 每日待办建议 ==================== */
  // 返回 [{date, value}]，仅可学习日；Σvalue === target.value
  function suggestDaySplit(weekTask, settings) {
    const restDays = (settings && settings.restDays) || [];
    const dates = D.weekDates(weekTask.weekStart)
      .filter(d => !D.isRest(d, restDays));
    if (dates.length === 0) return [];
    const values = splitEvenly(weekTask.target.value, dates.map(() => 1));
    const out = [];
    dates.forEach((d, i) => {
      if (values[i] > 0) out.push({ date: d, value: values[i] });
    });
    return out;
  }

  /* ==================== 五、进度聚合 ==================== */
  function todosIn(todos, from, to) {
    const out = [];
    Object.keys(todos || {}).forEach(date => {
      if (D.diff(from, date) >= 0 && D.diff(date, to) >= 0) {
        (todos[date] || []).forEach(t => out.push(t));
      }
    });
    return out;
  }

  function completionRate(list) {
    if (!list || list.length === 0) return null;
    let w = 0;
    list.forEach(t => {
      if (t.status === 'completed') w += 1;
      else if (t.status === 'partial') w += 0.5;
      // skipped / pending 计 0，skipped 保留在分母
    });
    return w / list.length;
  }

  function todoDoneValue(t) {
    if (t.status === 'completed') return t.targetValue || 0;
    if (t.status === 'partial') return Math.min(t.doneValue || 0, t.targetValue || 0);
    return 0;
  }

  function weekTaskProgress(wt, todos, today) {
    if (!wt) return 0;
    if (wt.progressMode === 'manual') {
      return Math.max(0, Math.min(1, wt.manualProgress || 0));
    }
    const list = todosIn(todos, wt.weekStart, wt.weekEnd);
    const done = list.filter(t => t.weekTaskId === wt.id)
      .reduce((a, t) => a + todoDoneValue(t), 0);
    return Math.min(1, wt.target.value > 0 ? done / wt.target.value : 0);
  }

  function goalProgress(goal, weekTasks, todos, today) {
    const type = goal.metric.type;
    if (type === 'accuracy' || type === 'score') {
      const base = goal.metric.baseline || 0;
      const tgt = goal.metric.target || 1;
      const m = goal.lastMeasured;
      if (m === null || m === undefined) return 0;
      return Math.max(0, Math.min(1, (m - base) / (tgt - base || 1)));
    }
    const wts = (weekTasks || []).filter(w => w.goalId === goal.id && w.status !== 'skipped');
    const totalTarget = goal.metric.target || 0;
    if (totalTarget <= 0) return 0;
    let doneWeighted = 0;
    wts.forEach(wt => {
      doneWeighted += weekTaskProgress(wt, todos, today) * (wt.target.value || 0);
    });
    return Math.min(1, doneWeighted / totalTarget);
  }

  function expectedProgress(goal, today, restDays) {
    const start = goal.startDate, end = goal.endDate;
    if (!D.isValid(start) || !D.isValid(end)) return 0;
    let total = 0, passed = 0;
    let cur = start;
    while (D.diff(cur, end) >= 0) {
      if (!D.isRest(cur, restDays)) {
        total++;
        if (D.diff(cur, today) >= 0) passed++;
      }
      cur = D.shift(cur, 1);
    }
    if (total === 0) return 1;
    return Math.min(1, passed / total);
  }

  // state: {settings, goals, weekTasks, todos} → 仪表盘数据
  function computeProgress(state, today) {
    const s = state.settings || {};
    const todos = state.todos || {};
    const ws = D.weekStart(today);
    const monthStart = D.monthOf(today) + '-01';
    const tList = todos[today] || [];
    const wList = todosIn(todos, ws, D.shift(ws, 6));
    const mList = todosIn(todos, monthStart, today);

    const goals = (state.goals || []).filter(g => g.status === 'active').map(g => {
      const progress = goalProgress(g, state.weekTasks || [], todos, today);
      const expected = expectedProgress(g, today, s.restDays);
      return {
        goal: g, progress: progress, expected: expected,
        deviation: progress - expected
      };
    });

    return {
      today: { rate: completionRate(tList), list: tList },
      week: { rate: completionRate(wList), list: wList },
      month: { rate: completionRate(mList), list: mList },
      goals: goals,
      carryPile: tList.filter(t => t.carryOver && t.status !== 'completed' && t.status !== 'skipped').length
    };
  }

  /* ==================== 六、逾期顺延 ==================== */
  /**
   * 扫描 (lastRollOverDate, today) 内未完成待办，顺延到今日；
   * 顺延满 carryOverMax 次的转为 stagnant（不再顺延，移到今日等待处置）。
   * 直接修改 state.todos / state.meta，返回 {changed, movedCount, stagnantCount}
   */
  function rollOver(state, today) {
    const s = state.settings || {};
    const max = s.carryOverMax || 3;
    if (!state.meta) state.meta = {};
    const last = state.meta.lastRollOverDate;
    if (last === today) return { changed: false, movedCount: 0, stagnantCount: 0 };

    let moved = 0, stagnantCount = 0;
    if (!state.todos) state.todos = {};
    const todayList = state.todos[today] || (state.todos[today] = []);
    const originIds = new Set(todayList.map(t => t.originId || t.id));

    Object.keys(state.todos).forEach(date => {
      if (D.diff(date, today) <= 0) return; // 只看严格早于今天的日期
      const list = state.todos[date] || [];
      const keep = [];
      list.forEach(t => {
        if (t.status !== 'pending' && t.status !== 'partial') { keep.push(t); return; }
        if (t.stagnant) { keep.push(t); return; } // 停滞项原地保留，等待处置
        const originId = t.originId || t.id;
        const carryCount = (t.carryCount || 0) + 1;
        const originDate = t.originDate || t.date;
        if (originIds.has(originId)) { keep.push(t); return; } // 今日已顺延过
        const copy = JSON.parse(JSON.stringify(t));
        copy.id = 't_' + today + '_' + originId;
        copy.date = today;
        copy.originId = originId;
        copy.originDate = originDate;
        copy.carryCount = carryCount;
        copy.status = 'pending';
        copy.completedAt = null;
        if (t.status === 'partial') {
          // 部分完成：只顺延剩余量
          copy.targetValue = Math.max(1, (t.targetValue || 1) - (t.doneValue || 0));
          copy.doneValue = 0;
        }
        if (carryCount >= max) {
          copy.stagnant = true;
          copy.carryOver = false;
          copy.note = '从 ' + D.fmtCN(originDate) + ' 顺延 ' + carryCount + ' 次仍未完成，需要妈妈介入';
          stagnantCount++;
        } else {
          copy.stagnant = false;
          copy.carryOver = true;
          copy.note = '从 ' + D.fmtCN(originDate) + ' 顺延（第 ' + carryCount + ' 次）';
        }
        todayList.push(copy);
        originIds.add(originId);
        moved++;
      });
      state.todos[date] = keep;
    });

    state.meta.lastRollOverDate = today;
    return { changed: moved + stagnantCount > 0, movedCount: moved, stagnantCount: stagnantCount };
  }

  // 全量扫描停滞未处置项（供看板"需关注"）
  function findStagnant(state) {
    const out = [];
    Object.keys(state.todos || {}).forEach(date => {
      (state.todos[date] || []).forEach(t => {
        if (t.stagnant && t.status === 'pending') out.push(t);
      });
    });
    return out;
  }

  /* ==================== 七、薄弱指数诊断 ==================== */
  function consecutiveRedoFails(mistake) {
    const h = mistake.redoHistory || [];
    let n = 0;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].result === 'wrong') n++; else break;
    }
    return n;
  }

  /**
   * mistakes + kpointStates + settings → 薄弱知识点排名
   * 返回 [{kpointId, subject, raw, relative, mistakeCount, failCount, topCause, recentExam}]
   */
  function weakIndex(mistakes, kpointStates, settings, today, exams) {
    const s = settings || {};
    const cw = s.causeWeights || { concept: 1.4, method: 1.3, reading: 1.1, calc: 1.0, sloppy: 0.8, time: 0.7 };
    const weakSubject = s.weakSubject || 'math';
    const examDates = {};
    (exams || []).forEach(e => { examDates[e.id] = e.date; });
    const now = D.parse(today);

    const byK = {};
    (mistakes || []).forEach(m => {
      if (m.archived) return;
      if (D.diff(m.date, today) > 90 || D.diff(m.date, today) < 0) return;
      const kid = m.kpointId || '_custom.unclassified';
      if (!byK[kid]) byK[kid] = { items: [], subject: m.subject, causeW: {} };
      byK[kid].items.push(m);
    });

    const results = Object.keys(byK).map(kid => {
      const g = byK[kid];
      let raw = 0;
      const causeW = {};
      let fails = 0;
      g.items.forEach(m => {
        const w = cw[m.cause] || 1.0;
        const days = Math.max(0, D.diff(m.date, today));
        const decay = Math.max(0.4, Math.pow(0.5, days / 30));
        const sf = m.status === 'redo_wrong' ? 1.2 : m.status === 'redo_right' ? 0.5 : 1.0;
        const fc = m.failCount || 0;
        const v = w * decay * (1 + 0.5 * fc) * sf;
        raw += v;
        causeW[m.cause] = (causeW[m.cause] || 0) + v;
        fails += fc;
        const cf = consecutiveRedoFails(m);
        raw += 2 * cf;
        if (m.examId && examDates[m.examId] && D.diff(examDates[m.examId], today) <= 30 && D.diff(examDates[m.examId], today) >= 0) {
          raw += 1.5;
        }
      });
      const st = (kpointStates || {})[kid];
      if (st && (st.mastery || 0) >= 0.8) raw -= 1;
      if (g.subject === weakSubject) raw += 0.5;
      const topCause = Object.keys(causeW).sort((a, b) => causeW[b] - causeW[a])[0];
      return {
        kpointId: kid, subject: g.subject, raw: raw,
        mistakeCount: g.items.length, failCount: fails,
        topCause: topCause || null
      };
    });

    results.sort((a, b) => b.raw - a.raw);
    const maxW = results.length ? results[0].raw : 0;
    results.forEach(r => { r.relative = maxW > 0 ? Math.round(100 * r.raw / maxW) : 0; });
    return results;
  }

  function causeName(id) { return CAUSE_NAME[id] || id || ''; }

  function diagnosisText(tops, kpointMap) {
    if (!tops.length) return '暂无足够错题，先录 3-5 题再诊断。';
    return tops.map((r, i) => {
      const k = kpointMap[r.kpointId];
      // 「Module 7 My past life」这类英文单元只取前两段，避免切出孤立的 "Module"
      let name = r.kpointId;
      if (k) {
        const ch = /^Module\b/.test(k.chapter)
          ? k.chapter.split(' ').slice(0, 2).join(' ')
          : k.chapter.split(' ')[0];
        name = ch + '·' + k.name;
      }
      const subj = { math: '数学', chinese: '语文', english: '英语', history: '历史', politics: '道法' }[r.subject] || r.subject;
      return (i + 1) + '. ' + subj + '「' + name + '」：' + r.mistakeCount + ' 题错题' +
        (r.topCause ? '，主要错因 ' + causeName(r.topCause) : '') +
        (r.failCount ? '，重做失败 ' + r.failCount + ' 次' : '');
    }).join('；');
  }

  /* ==================== 八、艾宾浩斯重做调度 ==================== */
  function buildReviewSchedule(dateStr, settings) {
    const restDays = (settings && settings.restDays) || [];
    const offsets = (settings && settings.ebbinghausOffsets) || [1, 3, 7];
    return offsets.map(off => {
      let d = D.shift(dateStr, off);
      let guard = 0;
      while (D.isRest(d, restDays) && guard < 7) { d = D.shift(d, 1); guard++; }
      return { tag: 'D' + off, date: d, done: false, todoId: null };
    });
  }

  /* ==================== 九、7 天补学计划生成 ==================== */
  /**
   * input: {tops: [weakIndex 结果（含 kpoint）], settings, today, mistakes,
   *         existingMinutes: {date: 已占用分钟}}
   * 返回 remedialPlan 对象（status:'active'，由调用方置旧计划为 replaced）
   */
  function generatePlan(input) {
    const s = input.settings || {};
    const tops = (input.tops || []).filter(t => t.kpoint);
    const today = input.today || D.today();
    const restDays = s.restDays || [];
    const weakSubject = s.weakSubject || 'math';
    const existing = input.existingMinutes || {};

    // 未来 7 个可学习日（含今天）
    const days = [];
    let cur = today, guard = 0;
    while (days.length < 7 && guard < 14) {
      if (!D.isRest(cur, restDays)) days.push(cur);
      cur = D.shift(cur, 1); guard++;
    }
    if (days.length === 0) return null;

    // 主知识点序列：弱科优先，尽量轮换避免同一知识点连续两天同类型
    const weakTops = tops.filter(t => t.subject === weakSubject);
    const otherTops = tops.filter(t => t.subject !== weakSubject);
    const pool = [];
    if (weakTops.length) {
      // 模板：弱科、其他、其他（若有）、弱科、弱科、弱科、弱科
      const seq = [0, 1, 2, 3, 4, 5, 6];
      seq.forEach(i => {
        if (i === 1 && otherTops[0]) pool.push(otherTops[0]);
        else if (i === 2 && otherTops[1] && otherTops[0]) pool.push(otherTops[1]);
        else pool.push(weakTops[i % weakTops.length]);
      });
    } else {
      tops.forEach(t => pool.push(t));
      while (pool.length < 7) pool.push(tops[pool.length % Math.max(1, tops.length)] || null);
    }

    // 每天到期的重做错题
    const dueByDate = {};
    (input.mistakes || []).forEach(m => {
      if (m.archived) return;
      (m.reviewSchedule || []).forEach(rv => {
        if (rv.done || D.diff(rv.date, today) < 0) return;
        if (D.diff(today, rv.date) > 7) return;
        if (!dueByDate[rv.date]) dueByDate[rv.date] = [];
        dueByDate[rv.date].push(m);
      });
    });

    const plan = {
      id: 'p_' + today.replace(/-/g, ''),
      createdAt: today,
      status: 'active',
      basedOn: { topKpointIds: tops.map(t => t.kpointId), mistakeCount: (input.mistakes || []).length, generatedBy: 'rule' },
      days: []
    };

    days.forEach((date, i) => {
      const items = [];
      let budget = 20 - Math.min(10, existing[date] || 0); // 已有待办则压缩
      const due = dueByDate[date] || [];
      const main = pool[i];
      const actionSeq = ['microLesson+practice', 'practice', 'practice', 'practice', 'miniTest', 'practice', 'redo+check'];

      if (main && budget >= 10) {
        const k = main.kpoint;
        const kind = actionSeq[i] || 'practice';
        if (i === 0) {
          items.push({ kpointId: k.id, subject: k.subject, action: 'microLesson', minutes: 5, mistakeIds: [], ebbinghausTag: null, title: '微讲：' + k.name + '（' + k.prescription.microLesson + '）', todoIds: [] });
          items.push({ kpointId: k.id, subject: k.subject, action: 'practice', minutes: 10, mistakeIds: [], ebbinghausTag: null, title: '练习：' + k.name + ' ' + (k.prescription.practiceTypes[0] || ''), todoIds: [] });
        } else if (kind === 'miniTest') {
          items.push({ kpointId: k.id, subject: k.subject, action: 'miniTest', minutes: 10, mistakeIds: [], ebbinghausTag: null, title: '小测：' + k.name + '（' + (k.prescription.practiceTypes[1] || k.prescription.practiceTypes[0] || '') + '）', todoIds: [] });
          items.push({ kpointId: k.id, subject: k.subject, action: 'practice', minutes: 5, mistakeIds: [], ebbinghausTag: null, title: '错因回看：' + k.name, todoIds: [] });
        } else if (i === 6) {
          items.push({ kpointId: k.id, subject: k.subject, action: 'redo', minutes: 10, mistakeIds: [], ebbinghausTag: null, title: '综合重做：' + k.name, todoIds: [] });
          items.push({ kpointId: k.id, subject: k.subject, action: 'practice', minutes: 5, mistakeIds: [], ebbinghausTag: null, title: '点亮检查：' + k.name + '（' + k.prescription.masteryCriteria + '）', todoIds: [] });
        } else {
          const pt = k.prescription.practiceTypes[i % k.prescription.practiceTypes.length] || '';
          items.push({ kpointId: k.id, subject: k.subject, action: 'practice', minutes: 15, mistakeIds: [], ebbinghausTag: null, title: '练习：' + k.name + ' ' + pt, todoIds: [] });
        }
      }
      due.slice(0, 1).forEach(m => {
        const tag = (m.reviewSchedule || []).find(rv => rv.date === date);
        items.push({ kpointId: m.kpointId, subject: m.subject, action: 'redo', minutes: 5, mistakeIds: [m.id], ebbinghausTag: tag ? tag.tag : null, title: '重做错题 ' + (m.source || m.id), todoIds: [] });
      });
      if (items.length === 0) {
        // 没有主项也没有重做：补一个通用复习
        const k = (main && main.kpoint) || null;
        if (k) {
          items.push({ kpointId: k.id, subject: k.subject, action: 'practice', minutes: 10, mistakeIds: [], ebbinghausTag: null, title: '轻练习：' + k.name, todoIds: [] });
        }
      }
      plan.days.push({ date: date, items: items });
    });

    return plan;
  }

  /* ==================== 十、徽章与连续打卡 ==================== */
  // icon 为 js/icons.js 线性图标名
  const BADGES = [
    { id: 'redo_king', name: '错题重做王', icon: 'redo', desc: '累计「重做对」≥ 10 题', type: 'redoRight', threshold: 10 },
    { id: 'streak_3', name: '三日启动', icon: 'seed', desc: '连续打卡 ≥ 3 天', type: 'streak', threshold: 3 },
    { id: 'streak_7', name: '七日连续', icon: 'calendar', desc: '连续打卡 ≥ 7 天', type: 'streak', threshold: 7 },
    { id: 'streak_14', name: '十四日稳住', icon: 'fire', desc: '连续打卡 ≥ 14 天', type: 'streak', threshold: 14 },
    { id: 'streak_30', name: '三十日习惯', icon: 'mountain', desc: '连续打卡 ≥ 30 天', type: 'streak', threshold: 30 },
    { id: 'asker', name: '主动提问', icon: 'hand', desc: '主动提问 ≥ 5 次', type: 'ask', threshold: 5 },
    { id: 'hard_climber', name: '啃硬骨头', icon: 'climb', desc: '完成「启动难」待办 ≥ 5 次', type: 'hardDone', threshold: 5 },
    { id: 'math_steps', name: '数学小步', icon: 'calc', desc: '数学知识点点亮 ≥ 3 个', type: 'lit', threshold: 3 },
    { id: 'star_week', name: '点亮之星', icon: 'star', desc: '单周点亮 ≥ 2 个知识点', type: 'weekLit', threshold: 2 },
    { id: 'explain', name: '讲给你听', icon: 'read', desc: '讲一道题给妈妈听 ≥ 3 次', type: 'explain', threshold: 3 },
    { id: 'self_correct', name: '自己找错', icon: 'search', desc: '自己发现并订正 ≥ 3 次', type: 'selfCorrect', threshold: 3 },
    { id: 'stagnant_clear', name: '停滞清零', icon: 'broom', desc: '把当日停滞项全部处置完 1 次', type: 'stagnantClear', threshold: 1 }
  ];

  function streak(habitEvents, today) {
    const dates = new Set();
    (habitEvents || []).forEach(h => {
      if (h.type === 'checkin' && D.isValid(h.date)) dates.add(h.date);
    });
    const hasToday = dates.has(today);
    const base = hasToday ? today : D.shift(today, -1);
    let current = 0;
    let cur = base;
    while (dates.has(cur)) { current++; cur = D.shift(cur, -1); }
    // 最长连续
    const sorted = Array.from(dates).sort();
    let best = 0, run = 0, prev = null;
    sorted.forEach(d => {
      if (prev !== null && D.diff(prev, d) === 1) run++;
      else run = 1;
      if (run > best) best = run;
      prev = d;
    });
    return { current: current, best: best, checkedToday: hasToday };
  }

  // state: {todos, mistakes, habitEvents, kpointStates, badges, settings}
  // 返回新解锁徽章数组（由调用方追加进 state.badges）
  function evaluateBadges(state, today) {
    const counts = { redoRight: 0, ask: 0, hardDone: 0, lit: 0, weekLit: 0, explain: 0, selfCorrect: 0, stagnantClear: 0 };
    (state.mistakes || []).forEach(m => { if (m.status === 'redo_right') counts.redoRight++; });
    (state.habitEvents || []).forEach(h => {
      if (counts[h.type] !== undefined) counts[h.type]++;
    });
    Object.keys(state.kpointStates || {}).forEach(kid => {
      const st = state.kpointStates[kid];
      if (st.lit) {
        counts.lit++;
        if (st.litAt && D.weekStart(st.litAt) === D.weekStart(today)) counts.weekLit++;
      }
    });
    // 启动难完成次数：从 todos 全量统计
    Object.keys(state.todos || {}).forEach(d => {
      (state.todos[d] || []).forEach(t => {
        if (t.hardToStart && t.status === 'completed') counts.hardDone++;
      });
    });
    const st = streak(state.habitEvents || [], today);
    const unlocked = new Set((state.badges || []).map(b => b.id));
    const fresh = [];
    BADGES.forEach(def => {
      if (unlocked.has(def.id)) return;
      const v = def.type === 'streak' ? Math.max(st.current, st.best) : (counts[def.type] || 0);
      if (v >= def.threshold) {
        fresh.push({ id: def.id, unlockedAt: today, progressSnapshot: v });
      }
    });
    return fresh;
  }

  /* ==================== 导出 ==================== */
  global.J1Engine = {
    date: D,
    splitEvenly: splitEvenly,
    suggestWeekSplit: suggestWeekSplit,
    suggestDaySplit: suggestDaySplit,
    computeProgress: computeProgress,
    completionRate: completionRate,
    todosIn: todosIn,
    todoDoneValue: todoDoneValue,
    weekTaskProgress: weekTaskProgress,
    goalProgress: goalProgress,
    rollOver: rollOver,
    findStagnant: findStagnant,
    weakIndex: weakIndex,
    causeName: causeName,
    diagnosisText: diagnosisText,
    buildReviewSchedule: buildReviewSchedule,
    generatePlan: generatePlan,
    BADGES: BADGES,
    streak: streak,
    evaluateBadges: evaluateBadges,
    consecutiveRedoFails: consecutiveRedoFails
  };
})(typeof window !== 'undefined' ? window : globalThis);
