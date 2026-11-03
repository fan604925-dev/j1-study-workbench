# 初一学习工作台（j1-study-workbench）

**线上地址：https://fan604925-dev.github.io/j1-study-workbench/**（手机浏览器固定用这个链接，建议加到主屏幕；换链接前先在「设置 → 数据管理」导出备份）

AI 全托管的家长学习工作台：妈妈把试卷/作业照片、分数、考试时间、复习情况**直接发到 WorkBuddy 对话里**，AI 读图识别错题、按知识点归类、诊断薄弱、生成 7 天补学计划，自动推送到本线上看板。看板只读（唯一交互：今日待办勾选）。孩子零手机接触，只看纸面「今日待办」。

## 数据流（AI 托管管道）

```
妈妈在对话里发材料
  → AI 识别/归类/诊断/排计划（SOP 见用户级技能 ~/.workbuddy/skills/j1-study-ai-pipeline/SKILL.md）
  → 写入 data/feed.json（feedVersion 递增，增量实体新 id）
  → git push → GitHub Pages 更新
  → 妈妈打开看板：app.js init 时 fetch feed → J1Store.applyFeed() 字段级合并
    （新实体插入；已有实体只更新内容字段，进度字段如勾选/重做记录永不覆盖）
```

## 本地验证

```bash
cd 本目录
node test_store.js          # 数据层测试（含 applyFeed 用例）
node test_engine.js         # 规则引擎测试
node test_ai_bridge.js      # AI 回路解析测试（遗留，页面已下线回路）
node test_html_syntax.js    # 页面静态检查（含去 emoji、feed 结构检查）
python -m http.server 8080
# 浏览器打开 http://localhost:8080/index.html（需 HTTP 服务，file:// 下 SW 不注册）
```

## 技术栈

纯静态多页 HTML + 原生 JS（无构建、无框架、无后端）。Tailwind CDN + Chart.js CDN。数据存 localStorage（主）+ IndexedDB（冗余双写），全量可导出/导入 JSON。PWA 可加主屏幕、支持离线。图标统一为线性 SVG（js/icons.js 注册表，全站无 emoji 图标）。

## ⚠️ 与「暑假学习管家」同 origin 共存

两个站点都部署在 `fan604925-dev.github.io` 时，localStorage / IndexedDB / Cache Storage 按 origin 共享（路径不隔离）。本项目已做全套隔离：

- 所有 localStorage key 前缀 `j1_`（旧项目是 `ssm_`）
- IndexedDB 库名 `j1-study-db-v1`（旧项目 `ssm-db-v1`）
- Service Worker 缓存 `j1-v2`，activate 只清理 `j1-` 前缀缓存，绝不删其他应用缓存
- 全局对象名 `J1Store` / `J1App` / `J1Engine` / `J1Icons`

## 版本升级 CheckList（改数据结构时必做）

1. `js/store.js` 的 `DATA_VERSION` 递增
2. `service-worker.js` 的 `CACHE_NAME` 递增（j1-v1 → j1-v2 …）
3. 在 `_repairData()` 补一条幂等迁移（只补字段，绝不删用户数据）
4. 跑 `node test_store.js` 确认迁移用例通过
5. 页面保留「一键修复（不删数据）」入口兜底

## 部署（GitHub Pages）

1. 仓库 `j1-study-workbench`，`main` 分支根目录，Settings → Pages → Deploy from a branch
2. 访问 `https://fan604925-dev.github.io/j1-study-workbench/`
3. 手机浏览器固定用同一链接（换链接 = localStorage 隔离 = 数据"消失"），加到主屏幕
4. 每周导出一次 JSON 备份（设置 → 数据管理）

## 设计底线

- 去金钱化：无积分、无价目表、无兑换、无排行榜；激励 = 徽章 + 知识点点亮 + 自主选择权 + 表扬话术 + 非货币小特权
- 孩子侧（print.html）只有任务与鼓励语，禁用词有自动化测试护栏
- AI 识别内容宁缺毋假：识别存疑的题目必须由妈妈确认后才入库
