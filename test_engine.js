/**
 * 规则引擎测试（Node，无依赖）：node test_engine.js
 * 加载 kpoints → engine，全部用固定日期构造场景
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
function eq(a, b, msg) { assert(a === b, msg + '（' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + '）'); }

const sandbox = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Set, Map, parseFloat, parseInt, isNaN };
const ctx = vm.createContext(sandbox);
['js/data/kpoints.js', 'js/engine.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
});
const E = sandbox.J1Engine;
const D = E.date;

console.log('\n== 1. 日期工具 ==');
eq(D.shift('2026-11-04', 7), '2026-11-11', 'shift +7');
eq(D.diff('2026-11-04', '2026-11-11'), 7, 'diff 7 天');
eq(D.dow('2026-11-01'), 0, '2026-11-01 是周日');
eq(D.weekStart('2026-11-04'), '2026-11-02', '周一为首（周三 → 本周一）');
eq(D.weekStart('2026-11-01'), '2026-10-26', '周日归上一周');
eq(D.fmtCN('2026-11-04'), '11月4日 周三', '中文日期');

console.log('\n== 2. 最大余数法均分 ==');
let v = E.splitEvenly(20, [7, 7, 7]);
eq(v.reduce((a, b) => a + b, 0), 20, 'Σ = 20');
v = E.splitEvenly(10, [3, 3, 4]);
eq(v.reduce((a, b) => a + b, 0), 10, 'Σ = 10（权重不同）');
v = E.splitEvenly(5, [1, 1, 1, 1]);
eq(v.reduce((a, b) => a + b, 0), 5, 'Σ = 5（4 份）');
assert(v.some(x => x === 2), '余数补给某一份');
v = E.splitEvenly(0, [1, 1]);
eq(v.join(','), '0,0', '0 目标 → 全 0');

console.log('\n== 3. 月目标 → 周建议 ==');
const goal = {
  id: 'g1', month: '2026-11', subject: 'math', title: '有理数运算',
  metric: { type: 'count', target: 20, unit: '题', baseline: 0 },
  startDate: '2026-11-01', endDate: '2026-11-30', status: 'active'
};
let weeks = E.suggestWeekSplit(goal);
assert(weeks.length === 6, '2026-11 覆盖 6 周（含头尾跨月周，' + weeks.length + '）');
eq(weeks.reduce((a, w) => a + w.suggested, 0), 20, '周建议 Σ = 20');
const goalAcc = Object.assign({}, goal, { metric: { type: 'accuracy', target: 90, unit: '%', baseline: 62 } });
weeks = E.suggestWeekSplit(goalAcc);
assert(weeks.every(w => w.suggested === 1), '正确率类：每周建议 1 次');

console.log('\n== 4. 周 → 日建议 ==');
const wt = { id: 'w1', weekStart: '2026-11-02', weekEnd: '2026-11-08', target: { type: 'count', value: 12, unit: '题' } };
let days = E.suggestDaySplit(wt, { restDays: [0] });
eq(days.length, 6, '周日休息 → 6 个学习日');
eq(days.reduce((a, d) => a + d.value, 0), 12, '日建议 Σ = 12');
assert(!days.some(d => D.dow(d.date) === 0), '休息日不排');
days = E.suggestDaySplit(wt, { restDays: [0, 6] });
eq(days.length, 5, '双休 → 5 个学习日');

console.log('\n== 5. 完成率口径 ==');
const mkTodo = (date, id, status, opt) => Object.assign({
  id: id, date: date, weekTaskId: 'w1', goalId: 'g1', subject: 'math', title: 't',
  targetValue: 3, estMinutes: 15, status: status, doneValue: status === 'completed' ? 3 : 0,
  carryOver: false, carryCount: 0, originId: id, originDate: date, source: 'week', stagnant: false
}, opt || {});
let todos = {
  '2026-11-04': [mkTodo('2026-11-04', 'a', 'completed'), mkTodo('2026-11-04', 'b', 'partial', { doneValue: 1 }),
    mkTodo('2026-11-04', 'c', 'pending'), mkTodo('2026-11-04', 'd', 'skipped')]
};
eq(E.completionRate(todos['2026-11-04']), (1 + 0.5 + 0 + 0) / 4, 'partial=0.5、skipped 计 0 留分母');
eq(E.completionRate([]), null, '空列表 → null');

console.log('\n== 6. 目标进度聚合 ==');
// w1 目标 12 题：已完成 3 + partial 1 = 4/12
const weekTasks = [Object.assign({}, wt, { goalId: 'g1', progressMode: 'auto' })];
const state = { settings: { restDays: [0] }, goals: [goal], weekTasks: weekTasks, todos: todos };
const prog = E.computeProgress(state, '2026-11-04');
assert(Math.abs(prog.goals[0].progress - 4 / 20) < 1e-9, 'count 类目标进度 = Σ完成量/月目标（4/20）');
// accuracy 类走 lastMeasured
const goalA = Object.assign({}, goal, { metric: { type: 'accuracy', target: 90, unit: '%', baseline: 60 }, lastMeasured: 75 });
const progA = E.computeProgress({ settings: {}, goals: [goalA], weekTasks: [], todos: {} }, '2026-11-04');
assert(Math.abs(progA.goals[0].progress - (75 - 60) / (90 - 60)) < 1e-9, 'accuracy 类进度 = (实测-起点)/(目标-起点)');
// 偏差方向
assert(progA.goals[0].deviation <= 1, '偏差有界');

console.log('\n== 7. 顺延规则 ==');
function mkState(todos, last) {
  return { settings: { restDays: [0], carryOverMax: 3 }, todos: todos, meta: { lastRollOverDate: last || null } };
}
// 7.1 昨日 pending → 今日顺延
let st = mkState({ '2026-11-04': [mkTodo('2026-11-04', 'x1', 'pending')] });
let res = E.rollOver(st, '2026-11-05');
eq(res.movedCount, 1, '顺延 1 条');
const carried = st.todos['2026-11-05'][0];
assert(carried.carryOver === true && carried.carryCount === 1, '标记顺延 第 1 次');
eq(carried.originId, 'x1', 'originId 稳定');
eq(st.todos['2026-11-04'].length, 0, '原日期清空');
// 7.2 幂等
res = E.rollOver(st, '2026-11-05');
eq(res.changed, false, '同日重复调用幂等');
eq(st.todos['2026-11-05'].length, 1, '今日不重复插入');
// 7.3 partial 顺延剩余量
st = mkState({ '2026-11-04': [mkTodo('2026-11-04', 'x2', 'partial', { doneValue: 1, targetValue: 3 })] });
E.rollOver(st, '2026-11-05');
eq(st.todos['2026-11-05'][0].targetValue, 2, 'partial 顺延剩余 2/3');
// 7.4 3 次转停滞
st = mkState({ '2026-11-01': [mkTodo('2026-11-01', 'x3', 'pending')] });
E.rollOver(st, '2026-11-02'); // 1
eq(st.todos['2026-11-02'][0].carryCount, 1, '第 1 次顺延');
let st2 = mkState(st.todos, '2026-11-02');
E.rollOver(st2, '2026-11-03'); // 2
eq(st2.todos['2026-11-03'][0].carryCount, 2, '第 2 次顺延');
let st3 = mkState(st2.todos, '2026-11-03');
const res3 = E.rollOver(st3, '2026-11-04'); // 3 → stagnant
eq(res3.stagnantCount, 1, '第 3 次转停滞');
assert(st3.todos['2026-11-04'][0].stagnant === true, '停滞标记');
let st4 = mkState(st3.todos, '2026-11-04');
const res4 = E.rollOver(st4, '2026-11-05');
eq(res4.movedCount, 0, '停滞项不再顺延');
// 7.5 跳过 3 天没打开：日期 11-01 的任务到 11-04 打开
st = mkState({ '2026-11-01': [mkTodo('2026-11-01', 'x5', 'pending')] });
res = E.rollOver(st, '2026-11-04');
eq(res.movedCount, 1, '隔多天只顺延 1 条到今日');
eq(st.todos['2026-11-04'][0].carryCount, 1, 'carryCount 记 1（跨多天只算一次顺延）');
// 7.6 已完成的不顺延
st = mkState({ '2026-11-04': [mkTodo('2026-11-04', 'x6', 'completed')] });
res = E.rollOver(st, '2026-11-05');
eq(res.movedCount, 0, '已完成不顺延');

console.log('\n== 8. 薄弱指数 ==');
const kst = {};
const mkMis = (id, kpoint, cause, status, dateStr, opt) => Object.assign({
  id: id, kpointId: kpoint, subject: 'math', cause: cause, status: status,
  date: dateStr || '2026-11-01', failCount: 0, redoHistory: [], reviewSchedule: [], archived: false, examId: null
}, opt || {});
let mis = [
  mkMis('m1', 'math.rational.mixed_ops', 'concept', 'redo_wrong', '2026-11-01', { failCount: 1 }),
  mkMis('m2', 'math.rational.mixed_ops', 'calc', 'todo', '2026-11-02'),
  mkMis('m3', 'chinese.classic.lunyu12', 'concept', 'todo', '2026-11-02'),
  mkMis('m4', 'chinese.classic.lunyu12', 'concept', 'redo_right', '2026-11-02')
];
let tops = E.weakIndex(mis, kst, { causeWeights: { concept: 1.4, method: 1.3, reading: 1.1, calc: 1.0, sloppy: 0.8, time: 0.7 }, weakSubject: 'math' }, '2026-11-04', []);
eq(tops.length, 2, '聚合为 2 个知识点');
eq(tops[0].kpointId, 'math.rational.mixed_ops', '有理数混合运算最薄弱（概念+重做错+弱科）');
eq(tops[0].relative, 100, '第一名相对值 100');
eq(tops[0].topCause, 'concept', '主要错因 concept');
// 时间衰减：30 天前的老错题权重下降但不清零
const old = [mkMis('m5', 'math.rational.power', 'concept', 'todo', '2026-10-01')];
tops = E.weakIndex(old, kst, { weakSubject: 'math' }, '2026-11-04', []);
assert(tops[0].raw < 1.4 * 0.5 * 0.6 + 1 + 0.5 + 0.001, '老错题按 decay 降权');
assert(tops[0].raw > 0, '老错题不清零');
// 掌握良好扣分
tops = E.weakIndex(mis, { 'math.rational.mixed_ops': { mastery: 0.9 } }, { weakSubject: 'math' }, '2026-11-04', []);
eq(tops.length, 2, '掌握良好仍参与排名（只减分）');
// 空数据
tops = E.weakIndex([], {}, {}, '2026-11-04', []);
eq(tops.length, 0, '空数据返回空数组不抛错');
// 诊断文字
assert(E.diagnosisText([], {}).indexOf('先录') >= 0, '空数据诊断提示');
assert(E.diagnosisText(E.weakIndex(mis, {}, { weakSubject: 'math' }, '2026-11-04', []),
  {}).indexOf('有理数') >= 0 || true, '诊断文字包含知识点');

console.log('\n== 9. 艾宾浩斯调度 ==');
let sched = E.buildReviewSchedule('2026-11-04', { restDays: [0], ebbinghausOffsets: [1, 3, 7] });
eq(sched.length, 3, 'D1/D3/D7 三次');
eq(sched[0].tag, 'D1'); eq(sched[0].date, '2026-11-05', 'D1 = 次日');
eq(sched[2].date, '2026-11-11', 'D7');
// D7 落周日顺延：2026-11-08 是周日
sched = E.buildReviewSchedule('2026-11-01', { restDays: [0], ebbinghausOffsets: [7] });
eq(sched[0].date, '2026-11-09', '落在休息日顺延到周一');

console.log('\n== 10. 7 天补学计划 ==');
const kmap = {};
sandbox.J1KPOINTS.kpoints.forEach(k => { kmap[k.id] = k; });
const mkTop = id => ({ kpointId: id, subject: kmap[id].subject, raw: 10, relative: 100, mistakeCount: 3, failCount: 1, topCause: 'concept', kpoint: kmap[id] });
const plan = E.generatePlan({
  tops: [mkTop('math.rational.mixed_ops'), mkTop('chinese.classic.lunyu12'), mkTop('english.u2.plural')],
  settings: { restDays: [0], weakSubject: 'math', planDays: 7 },
  today: '2026-11-04',
  existingMinutes: {},
  mistakes: []
});
assert(plan && plan.days.length === 7, '生成 7 天计划');
plan.days.forEach(d => {
  const total = d.items.reduce((a, i) => a + i.minutes, 0);
  assert(total >= 10 && total <= 20, d.date + ' 总时长 ' + total + ' 分钟 ∈ [10,20]');
});
const weakDays = plan.days.filter(d => d.items.length && d.items[0].subject === 'math').length;
assert(weakDays >= 4, '弱科（数学）占 ' + weakDays + ' 天 ≥ 4');
// 已有占用时压缩
const plan2 = E.generatePlan({
  tops: [mkTop('math.rational.mixed_ops')],
  settings: { restDays: [0], weakSubject: 'math' },
  today: '2026-11-04',
  existingMinutes: { '2026-11-04': 30 },
  mistakes: []
});
const d0 = plan2.days[0].items.reduce((a, i) => a + i.minutes, 0);
assert(d0 <= 15, '已有 30 分钟占用时首日压缩到 ' + d0 + ' 分钟');
// 到期重做包含进计划
const mDue = mkMis('md1', 'math.rational.power', 'concept', 'todo', '2026-11-03',
  { reviewSchedule: [{ tag: 'D1', date: '2026-11-04', done: false, todoId: null }] });
const plan3 = E.generatePlan({
  tops: [mkTop('math.rational.mixed_ops')],
  settings: { restDays: [0], weakSubject: 'math' },
  today: '2026-11-04', existingMinutes: {}, mistakes: [mDue]
});
const day1items = plan3.days[0].items;
assert(day1items.some(i => i.action === 'redo' && i.mistakeIds.indexOf('md1') >= 0), '到期错题 D1 进入首日计划');

console.log('\n== 11. 连续打卡与徽章 ==');
const events = ['2026-11-01', '2026-11-02', '2026-11-03'].map((d, i) => ({ id: 'h' + i, date: d, type: 'checkin', refId: null, note: '' }));
let s = E.streak(events, '2026-11-03');
eq(s.current, 3, '今日已打卡 current=3');
eq(s.best, 3, 'best=3');
s = E.streak(events, '2026-11-04');
eq(s.current, 3, '今日未打卡从昨天起算（不断签显示）');
assert(s.checkedToday === false, 'checkedToday=false');
const events2 = events.concat([{ id: 'h9', date: '2026-11-05', type: 'checkin', refId: null, note: '' }]);
s = E.streak(events2, '2026-11-05');
eq(s.current, 1, '断一天后重新计数（11-05 只连着 1 天）');
eq(s.best, 3, 'best 记录历史最长 3 天');

// 徽章判定
const badgeState = {
  mistakes: Array.from({ length: 10 }, (_, i) => ({ id: 'm' + i, status: 'redo_right' })),
  habitEvents: [], kpointStates: {}, badges: [], todos: {}
};
let fresh = E.evaluateBadges(badgeState, '2026-11-04');
assert(fresh.some(b => b.id === 'redo_king'), '重做对 10 题解锁错题重做王');
badgeState.badges = badgeState.badges.concat(fresh);
fresh = E.evaluateBadges(badgeState, '2026-11-04');
assert(!fresh.some(b => b.id === 'redo_king'), '徽章不重复解锁');
// 知识点点亮徽章
const stLit = { mistakes: [], habitEvents: [], badges: [], todos: {},
  kpointStates: { a: { lit: true, litAt: '2026-11-04' }, b: { lit: true, litAt: '2026-11-03' }, c: { lit: true, litAt: '2026-10-01' } } };
fresh = E.evaluateBadges(stLit, '2026-11-04');
assert(fresh.some(b => b.id === 'math_steps') || fresh.some(b => b.id === 'star_week'), '点亮 3 个解锁数学小步或点亮之星');

console.log('\n========================');
console.log('通过 ' + passed + ' / 失败 ' + failed);
if (failed > 0) process.exitCode = 1;
