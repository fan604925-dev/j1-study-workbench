/**
 * 数据层测试（Node，无依赖）：node test_store.js
 * mock localStorage / indexedDB，eval 加载 kpoints → engine → store
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

// ---- mock 环境 ----
function makeStorage() {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    _dump: m
  };
}

const sandbox = {
  console: console,
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  Date: Date, Math: Math, JSON: JSON, Promise: Promise,
  Object: Object, Array: Array, String: String, Number: Number, Set: Set, Map: Map,
  parseFloat: parseFloat, parseInt: parseInt, isNaN: isNaN
};
const ctx = vm.createContext(sandbox);

function load(file) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}
load('js/data/kpoints.js');
load('js/engine.js');
load('js/store.js');

const K = sandbox.J1Constants;
const StoreClass = sandbox.J1StoreClass;

console.log('\n== 1. 常量与前缀 ==');
assert(K.DATA_VERSION === '1', 'DATA_VERSION 初始为 1');
const keyVals = Object.values(K.STORAGE_KEYS);
assert(keyVals.every(k => k.indexOf('j1_') === 0), '所有 STORAGE_KEYS 以 j1_ 开头');
assert(keyVals.every(k => k.indexOf('ssm') < 0), '不含 ssm_ 前缀');
assert(K.IDB_NAME === 'j1-study-db-v1', '独立 IDB 库名');

console.log('\n== 2. 首次初始化 ==');
sandbox.localStorage = makeStorage();
sandbox.indexedDB = undefined; // 模拟无 IDB
let store = new StoreClass();
store.init();
assert(store.settings.child && store.settings.child.name === '哥哥', '默认孩子概况');
assert(store.settings.carryOverMax === 3, '默认顺延上限 3');
assert(store.getKpoints().length >= 45, '知识点图谱可用（' + store.getKpoints().length + ' 点）');
assert(store.getKpoints().every(k => k.prescription && k.prescription.estMinutes > 0), '每个知识点有处方');
assert(store.praiseLibrary.length >= 20, '默认话术库 ≥20 条');
assert(store.privileges.length >= 12, '默认特权 ≥12 项');
assert(!JSON.stringify(store._serializeAll()).match(/price|cost|cash|兑换|积分/), '数据模型无金钱/积分子段');
// 检查写入的 key 全部 j1_
const writtenKeys = Object.keys(sandbox.localStorage._dump);
assert(writtenKeys.length > 0, 'save 写入了数据（' + writtenKeys.length + ' 个 key）');
assert(writtenKeys.every(k => k.indexOf('j1_') === 0), 'localStorage 写入 key 全部 j1_ 前缀');

console.log('\n== 3. 持久化与重载 ==');
store.addGoal({ month: '2026-11', subject: 'math', title: '有理数混合运算 20 题正确率 90%', metric: { type: 'count', target: 20, unit: '题', baseline: 12 } });
store.addTodo({ date: '2026-11-04', subject: 'math', title: '有理数混合运算 3 题', targetValue: 3, estMinutes: 15 });
const store2 = new StoreClass();
store2.init();
assert(store2.goals.length === 1 && store2.goals[0].title.indexOf('有理数') >= 0, '重载后目标保留');
assert(store2.todos['2026-11-04'] && store2.todos['2026-11-04'].length === 1, '重载后待办保留');

console.log('\n== 4. 版本迁移与修复 ==');
// 伪造旧版本 + 损坏 settings，验证用户数据保留
sandbox.localStorage._dump['j1_data_version'] = '0';
sandbox.localStorage._dump['j1_settings'] = JSON.stringify({ child: { name: '哥哥', grade: '初一上', weakSubject: 'math' } });
const store3 = new StoreClass();
store3.init();
assert(sandbox.localStorage._dump['j1_data_version'] === '1', '修复后版本号更新为 1');
assert(store3.goals.length === 1, '迁移保留用户目标');
assert(store3.todos['2026-11-04'] && store3.todos['2026-11-04'].length === 1, '迁移保留用户待办');
assert(store3.settings.pomodoroMinutes === 15, 'settings 补齐默认字段');

console.log('\n== 5. 知识点停用防复活 ==');
store3.disableKpoint('math.rational.mixed_ops');
assert(store3.getKpoints().every(k => k.id !== 'math.rational.mixed_ops'), '停用后图谱不显示');
sandbox.localStorage._dump['j1_data_version'] = '0'; // 再触发一次修复
const store4 = new StoreClass();
store4.init();
assert(store4.getKpoints().every(k => k.id !== 'math.rational.mixed_ops'), '版本升级后停用知识点不复活');

console.log('\n== 6. 自定义知识点保留 ==');
const custom = store4.addKpoint({ subject: 'math', chapter: '自定义', name: '我的专项' });
sandbox.localStorage._dump['j1_data_version'] = '0';
const store5 = new StoreClass();
store5.init();
assert(store5.getKpoints().some(k => k.id === custom.id), '自定义知识点在迁移后保留');

console.log('\n== 7. 孤儿引用清理 ==');
store5.addMistake({ subject: 'math', kpointId: 'math.rational.mixed_ops', cause: 'concept', source: '测试' }, '2026-11-01');
// 停用该知识点后再修复：错题应归到未分类而不是被删
store5.disableKpoint('math.rational.mixed_ops');
sandbox.localStorage._dump['j1_data_version'] = '0';
const store6 = new StoreClass();
store6.init();
assert(store6.mistakes.length === 1, '停用知识点后错题不被删除');
assert(store6.mistakes[0].kpointId === '_custom.unclassified', '错题归到未分类');

console.log('\n== 8. 错题与重做 ==');
const ms = store6.addMistake({ subject: 'math', kpointId: 'math.rational.power', cause: 'concept', source: '单元测 P2 Q7' }, '2026-11-01');
assert(ms.reviewSchedule && ms.reviewSchedule.length === 3, '录入错题自动生成 D1/D3/D7');
assert(ms.reviewSchedule[0].tag === 'D1' && ms.reviewSchedule[0].date === '2026-11-02', 'D1 = 次日');
const rr = store6.recordRedo(ms.id, 'right', '2026-11-02');
assert(ms.status === 'redo_right', '重做对 → 状态 redo_right');
const st = store6.getKpointState('math.rational.power');
assert(Math.abs(st.mastery - 0.2) < 1e-9, '重做对 mastery +0.2');
assert(st.redoRightStreak === 1, '重做对 streak +1');
assert(rr.rescheduled === false, '重做对不补做');
const rw = store6.recordRedo(ms.id, 'wrong', '2026-11-05');
assert(ms.status === 'redo_wrong' && ms.failCount === 1, '重做错 failCount +1');
assert(rw.rescheduled === true, '重做错安排 D+2 补做');
assert(st.redoRightStreak === 0, '重做错清零 streak');
assert(store6.habitEvents.some(h => h.type === 'redo'), '重写写习惯事件');

console.log('\n== 9. 幂等添加待办 ==');
const t1 = store6.addTodoIfAbsent({ id: 't_fixed_1', date: '2026-11-06', subject: 'math', title: 'A', targetValue: 1 });
const t2 = store6.addTodoIfAbsent({ id: 't_fixed_1', date: '2026-11-06', subject: 'math', title: 'A', targetValue: 1 });
assert(t1 !== null && t2 === null, '同 id 幂等：第二次不添加');

console.log('\n== 10. 导出导入往返 ==');
const exported = store6.exportData();
assert(exported.app === 'j1-study-workbench', '导出带 app 标识');
sandbox.localStorage = makeStorage(); // 全新环境
sandbox.indexedDB = undefined;
const store7 = new StoreClass();
store7.init();
const res = store7.importData(exported);
assert(res.ok === true, '导入成功');
assert(store7.goals.length === store6.goals.length, '目标数量一致');
assert(store7.mistakes.length === store6.mistakes.length, '错题数量一致');
assert(JSON.stringify(store7.todos['2026-11-04']) === JSON.stringify(store6.todos['2026-11-04']), '待办内容一致');
const bad = store7.importData({ app: 'other-app', goals: [] });
assert(bad.ok === false, '非本工作台文件被拒绝');

console.log('\n== 11. IDB 异常降级 ==');
// indexedDB 存在但 open 抛错 → save 仍成功（全新环境）
sandbox.localStorage = makeStorage();
const throwingIdb = { open: () => { throw new Error('boom'); } };
sandbox.indexedDB = throwingIdb;
const store8 = new StoreClass();
store8.init(); // 无既有数据 → resetToDefaults → save
store8.addGoal({ title: '降级测试' });
assert(store8.goals.length === 1, 'IDB 抛错时 save/CRUD 仍可用');

console.log('\n== 12. clearData 只清 j1_ ==');
sandbox.localStorage.setItem('other_app_key', 'keep');
sandbox.localStorage.setItem('ssm_children', '[{"name":"旧项目数据"}]');
const before = sandbox.localStorage._dump;
store8.clearData();
assert(sandbox.localStorage.getItem('other_app_key') === 'keep', '不删其他应用 key');
assert(sandbox.localStorage.getItem('ssm_children') !== null, '不删旧项目 ssm_ key');
assert(sandbox.localStorage.getItem('j1_settings') !== null, '清空后重填默认（j1_ 仍在）');

console.log('\n== 13. 徽章判定 ==');
const store9 = new StoreClass();
store9.init();
// 构造 3 天连续打卡
['2026-11-01', '2026-11-02', '2026-11-03'].forEach(d => {
  store9.habitEvents.push({ id: 'h' + d, date: d, type: 'checkin', refId: null, note: '' });
});
const fresh = store9.evaluateBadges('2026-11-03');
assert(fresh.some(b => b.id === 'streak_3'), '连续 3 天解锁「三日启动」');
const fresh2 = store9.evaluateBadges('2026-11-03');
assert(fresh2.length === 0 || !fresh2.some(b => b.id === 'streak_3'), '徽章只追加不重复解锁');

console.log('\n========================');
console.log('通过 ' + passed + ' / 失败 ' + failed);
if (failed > 0) process.exitCode = 1;
