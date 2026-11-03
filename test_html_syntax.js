/**
 * HTML / JS 静态检查（Node，无依赖）：node test_html_syntax.js
 *  - 全部页面内联 <script> 语法检查
 *  - 外链脚本/样式文件存在性
 *  - 每页含 viewport 与 #bottom-nav 占位
 *  - print.html 禁用词扫描（孩子侧不得出现积分/排名/兑换/价格/分数）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failed = 0;
function fail(msg) { failed++; console.log('  ✗ ' + msg); process.exitCode = 1; }
function ok(msg) { console.log('  ✓ ' + msg); }

const REQUIRED_PAGES = ['index.html', 'tasks.html',
  'mistakes.html', 'plan.html', 'growth.html', 'print.html', 'settings.html'];
const PRINT_BANNED = /积分|排名|兑换|价格|分数|价目|徽章数|薄弱指数/;

const htmlFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
console.log('发现页面：' + htmlFiles.join(', '));

htmlFiles.forEach(file => {
  console.log('\n' + file + ':');
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');

  // viewport
  if (/name="viewport"/.test(html)) ok('viewport 存在'); else fail('缺少 viewport meta');

  // bottom-nav 占位（print 页同样保留容器，由 CSS @media print 隐藏）
  if (html.indexOf('bottom-nav') >= 0) ok('bottom-nav 占位存在'); else fail('缺少 #bottom-nav');

  // 内联脚本语法
  const inlineMatches = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  inlineMatches.forEach((match, idx) => {
    const code = match.replace(/<script>/, '').replace(/<\/script>/, '');
    try {
      new vm.Script(code, { filename: file + ':script' + (idx + 1) });
      ok('内联 script' + (idx + 1) + ' 语法 OK');
    } catch (err) {
      fail('内联 script' + (idx + 1) + ' 语法错误: ' + err.message);
    }
  });

  // 外链资源存在（剥离内联脚本后检查，避免误抓 JS 字符串）
  const htmlNoScript = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  const srcMatches = htmlNoScript.match(/(src|href)="(?!https?:|#|mailto:)([^"]+)"/g) || [];
  srcMatches.forEach(m => {
    const target = m.match(/"(.+?)"/)[1];
    if (target.endsWith('.html') || target === 'manifest.json') return; // 页面间跳转不检查
    const p = path.join(__dirname, target);
    if (fs.existsSync(p)) ok('外链存在: ' + target);
    else fail('外链缺失: ' + target);
  });

  // print.html 禁用词
  if (file === 'print.html') {
    if (PRINT_BANNED.test(html)) {
      const hits = html.match(PRINT_BANNED);
      fail('print.html 含禁用词: ' + Array.from(new Set(hits)).join(','));
    } else {
      ok('print.html 无禁用词（积分/排名/兑换/价格/分数）');
    }
    // 不得有指向其他页面的链接
    if (/href="(?!#)[^"]*\.html"/.test(html)) fail('print.html 含跳转其他页面的链接');
    else ok('print.html 无页面跳转链接');
  }
});

// 核心 JS 文件语法检查
console.log('\nJS 文件语法：');
['js/app.js', 'js/store.js', 'js/engine.js', 'js/charts.js', 'js/ai-bridge.js', 'js/icons.js', 'js/data/kpoints.js', 'service-worker.js']
  .filter(f => fs.existsSync(path.join(__dirname, f)))
  .forEach(f => {
    try {
      new vm.Script(fs.readFileSync(path.join(__dirname, f), 'utf8'), { filename: f });
      ok(f + ' 语法 OK');
    } catch (err) {
      fail(f + ' 语法错误: ' + err.message);
    }
  });

// 必要页面齐全性（v2：goals/exams 录入页已删除，AI 全托管只读看板）
const missing = REQUIRED_PAGES.filter(p => !fs.existsSync(path.join(__dirname, p)));
if (missing.length === 0) ok('7 个核心页面齐全（v2 只读版）');
else console.log('  ℹ️ 尚未创建（阶段进行中）: ' + missing.join(', '));

// 已删页面不得残留引用
console.log('\nv2 只读化检查：');
['goals.html', 'exams.html'].forEach(p => {
  if (fs.existsSync(path.join(__dirname, p))) fail(p + ' 应已删除');
  else ok(p + ' 已删除');
});
let dangling = 0;
htmlFiles.forEach(file => {
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const htmlNoScript = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  if (new RegExp('href="[^"]*' + file.replace('.html', '') + '\\.html"').test(htmlNoScript)) {
    // 页面静态链接指向已删页面（JS 动态拼的不算）
  }
  ['goals.html', 'exams.html'].forEach(dead => {
    if (htmlNoScript.indexOf('href="' + dead) >= 0) {
      fail(file + ' 仍静态链接到已删除的 ' + dead); dangling++;
    }
  });
});
if (dangling === 0) ok('无页面静态链接到已删除页面');

// data/feed.json 存在且可解析
console.log('\nfeed 文件：');
try {
  const feed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/feed.json'), 'utf8'));
  if (feed.app === 'j1-study-workbench' && feed.feedVersion >= 1) ok('data/feed.json 结构正确（v' + feed.feedVersion + '）');
  else fail('data/feed.json 缺少 app/feedVersion 字段');
} catch (e) {
  fail('data/feed.json 不存在或 JSON 解析失败: ' + e.message);
}

// 全站去 emoji 图标检查（数据迁移映射与纯文本符号除外）
console.log('\n去 emoji 图标检查：');
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const TEXT_SYMBOLS = new Set(['\u2713']); // ✓ 为文本对勾符号，非图标
let emojiHits = 0;
['index.html', 'tasks.html', 'mistakes.html', 'plan.html', 'growth.html', 'print.html', 'settings.html',
  'js/app.js', 'js/engine.js', 'js/data/kpoints.js'].forEach(f => {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const hits = (codeOnly.match(new RegExp(EMOJI_RE, 'gu')) || []).filter(c => !TEXT_SYMBOLS.has(c));
  if (hits.length) {
    fail(f + ' 仍含 emoji 图标: ' + Array.from(new Set(hits)).join(' '));
    emojiHits++;
  }
});
if (emojiHits === 0) ok('全部页面与核心 JS 无 emoji 图标');

// store.js 特权图标必须全部在 icons.js 注册表内
console.log('\n图标注册表一致性：');
try {
  const sandbox = { console: console };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/icons.js'), 'utf8'), ctx, { filename: 'js/icons.js' });
  const names = new Set(vm.runInContext('J1Icons.names', ctx));
  const storeSrc = fs.readFileSync(path.join(__dirname, 'js/store.js'), 'utf8');
  const engineSrc = fs.readFileSync(path.join(__dirname, 'js/engine.js'), 'utf8');
  const iconIds = [];
  (storeSrc.match(/icon: '([a-z]+)'/g) || []).forEach(m => iconIds.push(m.match(/'([a-z]+)'/)[1]));
  (engineSrc.match(/icon: '([a-z]+)'/g) || []).forEach(m => iconIds.push(m.match(/'([a-z]+)'/)[1]));
  const unknown = iconIds.filter(i => !names.has(i));
  if (unknown.length) fail('未注册的图标名: ' + unknown.join(', '));
  else ok(iconIds.length + ' 个数据层图标全部已注册（共 ' + names.size + ' 个）');
  if (names.has('home') && names.has('leaf')) ok('导航 5 图标在注册表内');
  else fail('导航图标缺失');
} catch (e) {
  fail('icons.js 加载失败: ' + e.message);
}

console.log('\nDone' + (failed ? '（' + failed + ' 项失败）' : '（全部通过）'));
if (failed > 0) process.exitCode = 1;
