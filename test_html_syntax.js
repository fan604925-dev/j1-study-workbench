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

const REQUIRED_PAGES = ['index.html', 'goals.html', 'tasks.html', 'exams.html',
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
['js/app.js', 'js/store.js', 'js/engine.js', 'js/charts.js', 'js/ai-bridge.js', 'js/data/kpoints.js', 'service-worker.js']
  .filter(f => fs.existsSync(path.join(__dirname, f)))
  .forEach(f => {
    try {
      new vm.Script(fs.readFileSync(path.join(__dirname, f), 'utf8'), { filename: f });
      ok(f + ' 语法 OK');
    } catch (err) {
      fail(f + ' 语法错误: ' + err.message);
    }
  });

// 必要页面齐全性（允许阶段性缺失，但全部存在时提示完整）
const missing = REQUIRED_PAGES.filter(p => !fs.existsSync(path.join(__dirname, p)));
if (missing.length === 0) ok('9 个核心页面齐全');
else console.log('  ℹ️ 尚未创建（阶段进行中）: ' + missing.join(', '));

console.log('\nDone' + (failed ? '（' + failed + ' 项失败）' : '（全部通过）'));
if (failed > 0) process.exitCode = 1;
