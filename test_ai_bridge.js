/**
 * AI 回路测试（Node，无依赖）：node test_ai_bridge.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); process.exitCode = 1; }
}

function makeStorage() {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    _dump: m
  };
}
const sandbox = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Set, Map, parseFloat, parseInt, isNaN };
const ctx = vm.createContext(sandbox);
['js/data/kpoints.js', 'js/engine.js', 'js/store.js', 'js/ai-bridge.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
});
const B = sandbox.J1AiBridge;
const E = sandbox.J1Engine;
const TODAY = '2026-11-04';

// 构造带数据的 store
sandbox.localStorage = makeStorage();
sandbox.indexedDB = undefined;
const store = new sandbox.J1StoreClass();
store.init();
const exam = store.addExam({ date: '2026-10-28', subject: 'math', type: 'unit', score: 62, fullScore: 100, source: '学校单元测' });
store.addGoal({ month: '2026-11', subject: 'math', title: '有理数混合运算', metric: { type: 'count', target: 20, unit: '题', baseline: 0 }, startDate: '2026-11-01' });
store.addMistake({ subject: 'math', kpointId: 'math.rational.mixed_ops', cause: 'concept', source: '单元测 P2 Q7', examId: exam.id }, '2026-11-01');
store.addMistake({ subject: 'math', kpointId: 'math.rational.mixed_ops', cause: 'calc', source: '练习册 P18 Q3' }, '2026-11-02');
store.addMistake({ subject: 'chinese', kpointId: 'chinese.classic.lunyu12', cause: 'reading', source: '默写' }, '2026-11-02');

console.log('\n== 1. 出站摘要 ==');
const summary = B.buildSummary(store, TODAY);
assert(summary.indexOf('【孩子概况】') === 0, '摘要以【孩子概况】开头');
assert(summary.indexOf('哥哥') >= 0 && summary.indexOf('初一上') >= 0, '含孩子概况');
assert(summary.indexOf('本月目标') >= 0 && summary.indexOf('有理数混合运算') >= 0, '含本月目标');
assert(summary.indexOf('62/100') >= 0, '含考试记录');
assert(summary.indexOf('#') >= 0 && summary.indexOf('单元测 P2 Q7') >= 0, '含错题清单');
assert(summary.indexOf('【回复格式】') >= 0 && summary.indexOf('diagnosis') >= 0, '含回复格式指引');
assert(!/积分|价目|兑换/.test(summary), '摘要不含金钱相关词');
// 超 20 条截断
for (let i = 0; i < 25; i++) {
  store.addMistake({ subject: 'math', kpointId: 'math.rational.power', cause: 'calc', source: '批量 ' + i }, '2026-11-03');
}
const summary2 = B.buildSummary(store, TODAY);
assert(summary2.indexOf('共 28 题') >= 0, '摘要显示总错题数');
assert((summary2.match(/^[0-9]+\. #/gm) || []).length <= 20, '错题清单最多 20 条');

console.log('\n== 2. JSON 解析（标准） ==');
const stdJson = JSON.stringify({
  diagnosis: [{ kpointId: 'math.rational.mixed_ops', priority: '高', advice: '先补运算顺序再练 10 题' }],
  weekTasks: [{ weekStart: '2026-11-09', subject: 'math', title: '有理数混合运算 12 题', target: { value: 12, unit: '题' } }],
  todos: [{ date: '2026-11-04', subject: 'math', title: '重做错题并口述运算顺序', minutes: 15 }],
  praise: [{ scene: 'initiative', text: '你今天自己把错题翻出来了。' }],
  notes: '加油'
});
let r = B.parseInput(stdJson);
assert(r.ok === true, '标准 JSON 解析成功');
eq(r.diagnosis.length, 1, 'diagnosis 1 条');
eq(r.weekTasks.length, 1, 'weekTasks 1 条');
eq(r.todos.length, 1, 'todos 1 条');
eq(r.praise.length, 1, 'praise 1 条');
eq(r.notes, '加油', 'notes 保留');

function eq(a, b, msg) { assert(a === b, msg + '（' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + '）'); }

console.log('\n== 3. JSON 容错 ==');
r = B.parseInput('好的，我的建议如下：\n```json\n' + stdJson.replace(/","/g, '"，"').replace(/":"/g, '"："') + '\n```\n希望有帮助');
assert(r.ok === true, 'code fence + 前后说明文字 + 全角标点');
r = B.parseInput('{"diagnosis":[],"weekTasks":[],"todos":[],"praise":[],"notes":"x",}');
assert(r.ok === true, '行尾逗号容错');
r = B.parseInput(stdJson + ' 另外提醒一句');
assert(r.ok === true, 'JSON 后跟文字');
r = B.parseInput(JSON.stringify({ diagnosis: [], weekTasks: [], todos: [], praise: [], extra: 1 }));
assert(r.ok === true && r.warnings.some(w => w.indexOf('extra') >= 0), '未知字段进 warnings');
r = B.parseInput('{"diagnosis":[{"priority":"高"}]}');
assert(r.ok === true && r.diagnosis.length === 0 && r.warnings.length >= 1, '缺 kpointId 的条目被忽略并告警');

console.log('\n== 4. 行文格式解析 ==');
const textFmt = [
  '分析好了：',
  '【诊断】',
  '- 知识点：有理数混合运算 ｜ 优先级：高 ｜ 建议：先补运算顺序，再练 10 题',
  '- 知识点：math.rational.power ｜ 优先级：中 ｜ 建议：每天 5 题乘方',
  '【周任务】',
  '- 2026-11-09 ~ 2026-11-15 ｜ 数学 ｜ 有理数混合运算 12 题 ｜ 目标：12 题',
  '【今日待办】',
  '- 11-04 ｜ 数学 ｜ 重做错题并口述运算顺序 ｜ 15分钟',
  '【表扬】',
  '- 场景：主动学习 ｜ 话术：你今天自己把错题翻出来重做了一遍。',
  '【备注】',
  '- 坚持每天 15 分钟就够'
].join('\n');
r = B.parseInput(textFmt);
assert(r.ok === true, '行文格式解析成功');
eq(r.diagnosis.length, 2, '诊断 2 条');
eq(r.diagnosis[0].kpointId, '有理数混合运算', '中文名诊断');
eq(r.diagnosis[1].kpointId, 'math.rational.power', 'id 诊断');
eq(r.weekTasks.length, 1, '周任务 1 条');
eq(r.weekTasks[0].weekStart, '2026-11-09', '周任务日期解析');
eq(r.weekTasks[0].subject, 'math', '周任务科目');
eq(r.todos.length, 1, '待办 1 条');
eq(r.todos[0].date, '2026-11-04', 'MM-DD 日期补全年份');
eq(r.todos[0].minutes, 15, '分钟解析');
eq(r.praise.length, 1, '表扬 1 条');
eq(r.praise[0].scene, 'initiative', '场景映射');
assert(r.notes.indexOf('每天 15 分钟') >= 0, '备注保留');

r = B.parseInput('【未知段】\n- 随便写');
assert(r.ok === true && r.warnings.some(w => w.indexOf('未知段名') >= 0), '未知段名进 warnings 且不报错');

console.log('\n== 5. 解析失败不静默 ==');
r = B.parseInput('这只是一段普通文字，没有任何格式');
assert(r.ok === false && r.reason, '纯文本解析失败给出原因');
r = B.parseInput('');
assert(r.ok === false, '空内容失败');
r = B.parseInput(null);
assert(r.ok === false, 'null 不抛错');

console.log('\n== 6. 预览与回填白名单 ==');
const parsed = B.parseInput(stdJson);
const pv = B.preview(store, parsed, TODAY);
eq(pv.diagnosisNotes.length, 1, '诊断预览 1 条');
eq(pv.diagnosisNotes[0].kpointId, 'math.rational.mixed_ops', '知识点 id 精确匹配');
eq(pv.weekTasks.length, 1, '周任务预览 1 条');
eq(pv.todos.length, 1, '待办预览 1 条');
eq(pv.praise.length, 1, '话术预览 1 条');
// 知识点模糊匹配
const parsed2 = B.parseInput(JSON.stringify({ todos: [{ date: '2026-11-04', subject: 'math', title: '练乘方', minutes: 15, kpointId: '乘方' }] }));
const pv2 = B.preview(store, parsed2, TODAY);
eq(pv2.todos[0].kpointId, 'math.rational.power', '知识点中文名模糊匹配');
// 未知知识点
const parsed3 = B.parseInput(JSON.stringify({ todos: [{ date: '2026-11-04', subject: 'math', title: 'x', minutes: 15, kpointId: '量子力学' }] }));
const pv3 = B.preview(store, parsed3, TODAY);
eq(pv3.todos[0].kpointId, null, '未知知识点降级为 null 并告警');
assert(pv3.warnings.length >= 1, '未知知识点有告警');
// 日期不合法默认今天
const parsed4 = B.parseInput(JSON.stringify({ todos: [{ date: 'bad-date', subject: 'math', title: 'x', minutes: 15 }] }));
const pv4 = B.preview(store, parsed4, TODAY);
eq(pv4.todos[0].date, TODAY, '不合法日期默认今天');

// 回填前基线
const goalsBefore = store.goals.length;
const examsBefore = store.exams.length;
const mistakesBefore = store.mistakes.length;
const note = B.commit(store, pv, stdJson, TODAY);
assert(note.applied.weekTasks.length === 1, '回填新增 1 条周任务');
assert(store.weekTasks.some(w => w.title === '有理数混合运算 12 题'), '周任务已写入');
assert(store.todos['2026-11-04'].some(t => t.title === '重做错题并口述运算顺序'), '待办已写入');
assert(store.praiseLibrary.some(p => p.text === '你今天自己把错题翻出来了。'), '话术已写入');
// 白名单：不删改 goal/exam/mistake
eq(store.goals.length, goalsBefore, '回填不动 goal');
eq(store.exams.length, examsBefore, '回填不动 exam');
eq(store.mistakes.length, mistakesBefore, '回填不动 mistake');

console.log('\n== 7. 幂等与撤销 ==');
const note2 = B.commit(store, pv, stdJson, TODAY);
eq(note2.applied.todos.length, 0, '同内容二次回填待办幂等（id 相同不重复）');
assert(B.undo(store, note.id) === true, '撤销回填成功');
assert(!store.weekTasks.some(w => w.title === '有理数混合运算 12 题'), '撤销后周任务删除');
assert(!store.praiseLibrary.some(p => p.id === note.applied.praise[0]), '撤销后话术删除');
assert(B.undo(store, note.id) === false, '重复撤销返回 false');
// 撤销不误删手动数据
const manualWt = store.addWeekTask({ weekStart: '2026-11-16', subject: 'math', title: '手动任务', target: { type: 'count', value: 5, unit: '题' } });
const note3 = B.commit(store, pv, stdJson, TODAY);
B.undo(store, note3.id);
assert(store.weekTasks.some(w => w.id === manualWt.id), '撤销不误删手动添加的周任务');

console.log('\n========================');
console.log('通过 ' + passed + ' / 失败 ' + failed);
if (failed > 0) process.exitCode = 1;
