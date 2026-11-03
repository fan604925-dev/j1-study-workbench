/**
 * 初一学习工作台 - AI 对话回路（无 API Key、纯本地）
 * ============================================================
 * 出站：buildSummary(store, today) → 结构化纯文本摘要（复制给 AI 助手）
 * 入站：parseInput(text) → 容错解析（JSON 优先 → 【段名】行文兜底 → 失败不静默）
 * 回填：preview(store, parsed) → 待新增清单；commit(store, preview) → 白名单写入
 *       白名单：只允许新增 weekTask / dailyTodo / praise / diagnosis 备注 / aiNote，
 *       绝不允许删改 goal / exam / mistake / kpointState / badge / 既有 todo。
 * ============================================================
 */
(function (global) {
  'use strict';

  const SUBJECT_NAME = { math: '数学', chinese: '语文', english: '英语', other: '其他' };

  /* ==================== 一、出站摘要 ==================== */
  function buildSummary(store, today) {
    const E = global.J1Engine;
    let lines = [];
    const child = store.settings.child;
    lines.push('【孩子概况】' + child.grade + '·' + child.name + '；' +
      (SUBJECT_NAME[child.weakSubject] || '数学') + '最弱，各科基础薄弱；' + (child.note || '晚间可用时间约 30-40 分钟'));

    // 本月目标
    const prog = E.computeProgress(store, today);
    const goals = prog.goals.map(g => {
      const go = g.goal;
      return SUBJECT_NAME[go.subject] + '：' + go.title + ' 目标 ' + go.metric.target + (go.metric.unit || '') +
        '（进度 ' + Math.round(g.progress * 100) + '%，偏差 ' + Math.round(g.deviation * 100) + '%）';
    });
    lines.push('【本月目标】' + (goals.length ? goals.join('；') : '暂无'));

    // 近期考试（最近 3 场）
    const exams = store.exams.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 3)
      .map(e => e.date + ' ' + SUBJECT_NAME[e.subject] + ' ' + examTypeName(e.type) + ' ' + e.score + '/' + e.fullScore);
    lines.push('【近期考试】' + (exams.length ? exams.join('；') : '暂无记录'));

    // 错题清单（≤20 条，按薄弱指数排序）
    const kmap = {};
    store.getKpoints(true).forEach(k => { kmap[k.id] = k; });
    const tops = E.weakIndex(store.mistakes, store.kpointStates, store.settings, today, store.exams);
    const rankedIds = tops.map(t => t.kpointId);
    const all = store.mistakes.filter(m => !m.archived && E.date.diff(m.date, today) <= 14 && E.date.diff(m.date, today) >= 0);
    all.sort((a, b) => rankedIds.indexOf(a.kpointId) - rankedIds.indexOf(b.kpointId));
    const recent = store.mistakes.filter(m => !m.archived);
    if (recent.length === 0) {
      lines.push('【错题清单】暂无');
    } else {
      const shown = all.length ? all : recent.slice(0, 20);
      const list = shown.slice(0, 20).map((m, i) => {
        const k = kmap[m.kpointId];
        const kpath = k ? (SUBJECT_NAME[k.subject] + '/' + k.chapter.replace(/^第.{1,3}章\s*/, '') + '/' + k.name) : '未分类';
        const status = m.status === 'redo_wrong' ? '重做错×' + (m.failCount || 1) : m.status === 'redo_right' ? '重做对' : '未重做';
        return (i + 1) + '. #' + m.id.slice(-4) + ' | ' + kpath + ' | ' + E.causeName(m.cause) +
          ' | ' + status + ' | ' + m.date + (m.source ? ' | ' + m.source : '');
      });
      lines.push('【错题清单】共 ' + recent.length + ' 题（展示近 14 天 ' + shown.length + ' 题' +
        (shown.length > 20 ? '，已按薄弱程度截断' : '') + '）');
      lines = lines.concat(list);
      if (recent.length > 20 && shown.length > 20) lines.push('（已省略 ' + (shown.length - 20) + ' 条）');
    }

    // 当前诊断
    const top3 = tops.slice(0, store.settings.topN || 3);
    lines.push('【当前诊断】' + (top3.length
      ? '薄弱 Top' + top3.length + '：' + top3.map(t => {
          const k = kmap[t.kpointId];
          return (k ? k.name : t.kpointId) + ' ' + t.relative;
        }).join('、') + '；主要错因 ' + (top3[0].topCause ? E.causeName(top3[0].topCause) : '—')
      : '暂无足够错题'));

    // 当前补学计划
    const activePlan = store.plans.filter(p => p.status === 'active').pop();
    if (activePlan) {
      const ds = activePlan.days.slice(0, 3).map(d =>
        d.date.slice(5).replace('-', '/') + ' ' + d.items.map(i => i.title).join('；'));
      lines.push('【当前计划】' + ds.join('；') + (activePlan.days.length > 3 ? ' …' : ''));
    } else {
      lines.push('【当前计划】暂无');
    }

    lines.push('【想请你帮忙】① 最该先补的 2 个知识点和顺序 ② 下周周任务拆分建议 ③ 给妈妈的表扬话术 2 条');
    lines.push('【回复格式】请优先用下面的 JSON（diagnosis/weekTasks/todos/praise/notes 五个字段，没有的留空数组）；不方便时也可用【段名】行文格式，两种都能识别');
    lines.push('{"diagnosis":[{"kpointId":"知识点id或名称","priority":"高","advice":"建议"}],"weekTasks":[{"weekStart":"2026-11-09","subject":"math","title":"有理数混合运算 12 题","target":{"value":12,"unit":"题"}}],"todos":[{"date":"2026-11-04","subject":"math","title":"重做错题并口述运算顺序","minutes":15}],"praise":[{"scene":"initiative","text":"话术"}],"notes":"备注"}');
    return lines.join('\n');
  }

  function examTypeName(t) {
    return { unit: '单元测', monthly: '月考', midterm: '期中', final: '期末', quiz: '随堂测' }[t] || t || '考试';
  }

  /* ==================== 二、入站解析 ==================== */
  // 返回 {ok:true, diagnosis:[], weekTasks:[], todos:[], praise:[], notes:'', warnings:[]}
  // 或 {ok:false, reason}
  function parseInput(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return { ok: false, reason: '内容为空' };
    }
    const warnings = [];

    // 1) JSON 优先
    const jsonResult = tryJson(text, warnings);
    if (jsonResult) return { ok: true, ...jsonResult, warnings: warnings };

    // 2) 行文格式兜底
    const textResult = trySectioned(text, warnings);
    if (textResult) return { ok: true, ...textResult, warnings: warnings };

    return { ok: false, reason: '既不是约定的 JSON，也没有识别到【段名】行文格式', warnings: warnings };
  }

  function tryJson(text, warnings) {
    let s = text.trim();
    // 剥 code fence
    s = s.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
    // 截取首个 { 到最后一个 }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first < 0 || last <= first) return null;
    s = s.slice(first, last + 1);
    // 全角结构字符归一
    s = s.replace(/｛/g, '{').replace(/｝/g, '}').replace(/［/g, '[').replace(/］/g, ']')
      .replace(/：/g, ':').replace(/，/g, ',')
      .replace(/“|”/g, '"').replace(/‘|’/g, "'");
    // 去行尾逗号与 // 注释
    s = s.replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n"]*$/gm, '');
    let obj;
    try { obj = JSON.parse(s); } catch (e) { return null; }
    if (typeof obj !== 'object' || Array.isArray(obj)) return null;

    const out = { diagnosis: [], weekTasks: [], todos: [], praise: [], notes: '' };
    if (Array.isArray(obj.diagnosis)) {
      obj.diagnosis.forEach((d, i) => {
        if (d && typeof d === 'object' && (d.kpointId || d.kpoint)) {
          out.diagnosis.push({
            kpointId: d.kpointId || d.kpoint || '', priority: d.priority || '',
            advice: d.advice || d.suggestion || ''
          });
        } else warnings.push('diagnosis 第 ' + (i + 1) + ' 条缺少 kpointId/advice，已忽略');
      });
    }
    if (Array.isArray(obj.weekTasks)) {
      obj.weekTasks.forEach((w, i) => {
        if (w && typeof w === 'object' && w.title) {
          out.weekTasks.push({
            weekStart: w.weekStart || '', weekEnd: w.weekEnd || '',
            subject: w.subject || 'other', title: w.title,
            value: (w.target && w.target.value) || w.value || 1, unit: (w.target && w.target.unit) || w.unit || '题',
            goalId: w.goalId || null
          });
        } else warnings.push('weekTasks 第 ' + (i + 1) + ' 条缺少 title，已忽略');
      });
    }
    if (Array.isArray(obj.todos)) {
      obj.todos.forEach((t, i) => {
        if (t && typeof t === 'object' && t.title) {
          out.todos.push({
            date: t.date || '', subject: t.subject || 'other', title: t.title,
            minutes: t.minutes || 15, kpointId: t.kpointId || null
          });
        } else warnings.push('todos 第 ' + (i + 1) + ' 条缺少 title，已忽略');
      });
    }
    if (Array.isArray(obj.praise)) {
      obj.praise.forEach((p, i) => {
        if (p && typeof p === 'object' && p.text) {
          out.praise.push({ scene: p.scene || 'initiative', text: p.text });
        } else if (typeof p === 'string') {
          out.praise.push({ scene: 'initiative', text: p });
        } else warnings.push('praise 第 ' + (i + 1) + ' 条缺少 text，已忽略');
      });
    }
    if (typeof obj.notes === 'string') out.notes = obj.notes;
    Object.keys(obj).forEach(k => {
      if (['diagnosis', 'weekTasks', 'todos', 'praise', 'notes'].indexOf(k) < 0) {
        warnings.push('未知字段「' + k + '」已忽略（只接受 diagnosis/weekTasks/todos/praise/notes）');
      }
    });
    return out;
  }

  const SECTION_MAP = {
    '诊断': 'diagnosis', '诊断与建议': 'diagnosis',
    '周任务': 'weekTasks', '下周任务': 'weekTasks',
    '今日待办': 'todos', '待办': 'todos', '每日待办': 'todos',
    '表扬': 'praise', '表扬话术': 'praise', '话术': 'praise',
    '备注': 'notes'
  };

  function trySectioned(text, warnings) {
    const out = { diagnosis: [], weekTasks: [], todos: [], praise: [], notes: '' };
    let foundAny = false;
    let current = null;
    const notesLines = [];
    const year = new Date().getFullYear();

    text.split(/\n/).forEach((raw, lineNo) => {
      const line = raw.trim();
      const secMatch = line.match(/^【(.+?)】/);
      if (secMatch) {
        const key = SECTION_MAP[secMatch[1]];
        if (key) { current = key; foundAny = true; if (key === 'notes') current = 'notes'; }
        else { warnings.push('第 ' + (lineNo + 1) + ' 行：未知段名「' + secMatch[1] + '」，已按备注保留'); current = 'notes'; foundAny = true; }
        return;
      }
      if (!line) return;
      if (current === 'notes') { notesLines.push(line); return; }
      if (line.charAt(0) !== '-' && line.charAt(0) !== '•') return;
      const content = line.replace(/^[-•]\s*/, '');
      const parts = content.split(/[｜|]/).map(p => p.trim());
      const get = (i) => parts[i] || '';

      if (current === 'diagnosis') {
        // - 知识点：xxx ｜ 优先级：高 ｜ 建议：xxx
        const kp = pick(get(0), ['知识点', '知识点：']);
        out.diagnosis.push({
          kpointId: kp || get(0), priority: pick(get(1), ['优先级']) || '', advice: pick(get(2), ['建议']) || get(2)
        });
      } else if (current === 'weekTasks') {
        // - 2026-11-09 ~ 2026-11-15 ｜ 数学 ｜ 标题 ｜ 目标 12 题
        const dates = content.match(/(\d{4}-\d{2}-\d{2})\s*[~～到至]\s*(\d{4}-\d{2}-\d{2})/);
        const rest = parts.filter(p => !/^\d{4}-\d{2}-\d{2}/.test(p) && !/[~～到至]\s*\d{4}-\d{2}-\d{2}/.test(p));
        const subj = rest.find(p => ['数学', '语文', '英语'].indexOf(p.replace(/^科目[:：]?/, '')) >= 0) || '';
        const title = rest.find(p => ['数学', '语文', '英语'].indexOf(p.replace(/^科目[:：]?/, '')) < 0 && !/^(目标|量)[:：]/.test(p)) || rest[0] || '';
        const valMatch = content.match(/(\d+)\s*(题|分钟|篇|个|次)/);
        out.weekTasks.push({
          weekStart: dates ? dates[1] : '', weekEnd: dates ? dates[2] : '',
          subject: subjectId(subj.replace(/^科目[:：]?/, '')),
          title: title.replace(/^标题[:：]?/, ''),
          value: valMatch ? Number(valMatch[1]) : 1, unit: valMatch ? valMatch[2] : '题', goalId: null
        });
      } else if (current === 'todos') {
        // - 11-04 ｜ 数学 ｜ 标题 ｜ 15分钟
        let dateStr = '';
        const dm = content.match(/(\d{4}-)?(\d{2}-\d{2})/);
        if (dm) dateStr = dm[1] ? dm[0] : (year + '-' + dm[2]);
        const restParts = parts.filter(p => p !== dm[0]);
        const subj = restParts.find(p => ['数学', '语文', '英语'].indexOf(p.replace(/^科目[:：]?/, '')) >= 0) || '';
        const mm = content.match(/(\d+)\s*分钟/);
        const titlePart = restParts.filter(p => ['数学', '语文', '英语'].indexOf(p.replace(/^科目[:：]?/, '')) < 0 && !/\d+\s*分钟/.test(p))[0] || restParts[0] || '';
        out.todos.push({
          date: dateStr, subject: subjectId(subj.replace(/^科目[:：]?/, '')),
          title: titlePart.replace(/^标题[:：]?/, ''),
          minutes: mm ? Number(mm[1]) : 15, kpointId: null
        });
      } else if (current === 'praise') {
        // - 场景：主动学习 ｜ 话术：xxx
        const scene = pick(get(0), ['场景']) || 'initiative';
        const txt = pick(get(1), ['话术']) || get(1) || get(0);
        if (txt) out.praise.push({ scene: sceneId(scene), text: txt });
      }
    });

    out.notes = notesLines.join('\n');
    return foundAny ? out : null;
  }

  function pick(str, prefixes) {
    if (!str) return '';
    for (const p of prefixes) {
      if (str.indexOf(p) === 0) return str.slice(p.length).replace(/^[:：]\s*/, '');
    }
    return '';
  }

  function subjectId(name) {
    const map = { '数学': 'math', '语文': 'chinese', '英语': 'english' };
    return map[name] || 'other';
  }

  function sceneId(name) {
    const map = { '完成难任务': 'hard_task', '考试进步': 'exam_progress', '主动学习': 'initiative', '遇到挫折': 'frustration', '坚持习惯': 'habit' };
    return map[name] || 'initiative';
  }

  /* ==================== 三、预览与回填（白名单） ==================== */
  /**
   * 解析结果 → 待新增条目预览（不写库）。
   * 返回 {weekTasks:[], todos:[], praise:[], diagnosisNotes:[], warnings:[]}
   */
  function preview(store, parsed, today) {
    const E = global.J1Engine;
    const warnings = (parsed.warnings || []).slice();
    const kpoints = store.getKpoints(true);
    const resolveKpoint = (idOrName) => {
      if (!idOrName) return null;
      const exact = kpoints.find(k => k.id === idOrName);
      if (exact) return exact;
      const fuzzy = kpoints.find(k => k.name === idOrName || k.name.indexOf(idOrName) >= 0 ||
        (idOrName.indexOf(k.name) >= 0));
      if (fuzzy) return fuzzy;
      return null;
    };

    const out = { weekTasks: [], todos: [], praise: [], diagnosisNotes: [], warnings: warnings };

    (parsed.diagnosis || []).forEach(d => {
      const k = resolveKpoint(d.kpointId);
      if (k) out.diagnosisNotes.push({ kpointId: k.id, name: k.name, priority: d.priority, advice: d.advice });
      else { out.diagnosisNotes.push({ kpointId: null, name: d.kpointId, priority: d.priority, advice: d.advice }); warnings.push('知识点「' + d.kpointId + '」没有匹配到图谱，建议将保留为备注'); }
    });

    (parsed.weekTasks || []).forEach((w, i) => {
      let ws = w.weekStart;
      if (!ws || !E.date.isValid(ws)) {
        warnings.push('周任务第 ' + (i + 1) + ' 条 weekStart 不合法（' + (ws || '空') + '），默认本周一');
        ws = E.date.weekStart(today);
      }
      out.weekTasks.push({
        id: 'w_ai_' + today.replace(/-/g, '') + '_' + i,
        goalId: null, weekStart: ws, weekEnd: E.date.shift(ws, 6),
        subject: w.subject || 'other', title: w.title,
        target: { type: 'count', value: Math.max(1, w.value || 1), unit: w.unit || '题' },
        suggestedValue: Math.max(1, w.value || 1), derived: 'manual', status: 'active'
      });
    });

    (parsed.todos || []).forEach((t, i) => {
      let d = t.date;
      if (!d || !E.date.isValid(d)) {
        if (d && /^\d{2}-\d{2}$/.test(d)) d = today.slice(0, 4) + '-' + d;
      }
      if (!d || !E.date.isValid(d)) {
        warnings.push('待办第 ' + (i + 1) + ' 条日期不合法（' + (t.date || '空') + '），默认今天');
        d = today;
      }
      const k = resolveKpoint(t.kpointId);
      if (t.kpointId && !k) warnings.push('待办「' + t.title + '」的知识点「' + t.kpointId + '」未匹配到图谱，已忽略关联');
      out.todos.push({
        id: 't_ai_' + d.replace(/-/g, '') + '_' + i,
        date: d, weekTaskId: null, goalId: null, source: 'manual',
        subject: t.subject || 'other', title: t.title,
        targetValue: 1, estMinutes: Math.min(45, Math.max(5, t.minutes || 15)),
        kpointId: k ? k.id : null, status: 'pending'
      });
    });

    (parsed.praise || []).forEach((p, i) => {
      out.praise.push({ id: 'pr_ai_' + i, scene: p.scene || 'initiative', text: p.text, tip: 'AI 建议', usedCount: 0 });
    });

    return out;
  }

  /**
   * 确认后写入（只新增，不删改既有数据）。返回 aiNote 记录。
   */
  function commit(store, previewData, raw, today) {
    const applied = { weekTasks: [], todos: [], praise: [] };
    previewData.weekTasks.forEach(w => {
      const created = store.addWeekTask(w);
      applied.weekTasks.push(created.id);
    });
    previewData.todos.forEach(t => {
      const created = store.addTodoIfAbsent(t);
      if (created) applied.todos.push(created.id);
    });
    previewData.praise.forEach(p => {
      store.praiseLibrary.push(p);
      applied.praise.push(p.id);
    });
    const note = {
      id: 'ai_' + Date.now().toString(36),
      createdAt: today,
      raw: raw,
      parsed: previewData,
      warnings: previewData.warnings,
      applied: applied,
      undone: false
    };
    store.aiNotes.push(note);
    store.save();
    return note;
  }

  /** 撤销一次回填：只删本次新增的条目 */
  function undo(store, aiNoteId) {
    const note = store.aiNotes.find(n => n.id === aiNoteId);
    if (!note || note.undone) return false;
    const ap = note.applied || {};
    if (ap.weekTasks) store.weekTasks = store.weekTasks.filter(w => ap.weekTasks.indexOf(w.id) < 0);
    if (ap.todos) {
      Object.keys(store.todos).forEach(d => {
        store.todos[d] = store.todos[d].filter(t => ap.todos.indexOf(t.id) < 0);
        if (store.todos[d].length === 0) delete store.todos[d];
      });
    }
    if (ap.praise) store.praiseLibrary = store.praiseLibrary.filter(p => ap.praise.indexOf(p.id) < 0);
    note.undone = true;
    store.save();
    return true;
  }

  global.J1AiBridge = {
    buildSummary: buildSummary,
    parseInput: parseInput,
    preview: preview,
    commit: commit,
    undo: undo
  };
})(typeof window !== 'undefined' ? window : globalThis);
