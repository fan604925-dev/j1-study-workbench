# 初一学习工作台（j1-study-workbench）

家长专用学习指导工作台：月目标拆解 → 周任务 → 每日待办，进度看板，考试记录，错题库与知识点补学计划，去金钱化过程激励。孩子零手机接触，只看纸面「今日待办」。

## 本地验证

```bash
cd 本目录
node test_store.js          # 数据层测试
node test_engine.js         # 规则引擎测试
node test_ai_bridge.js      # AI 回路测试
node test_html_syntax.js    # 页面静态检查
py -m http.server 8080      # 或 python -m http.server 8080
# 浏览器打开 http://localhost:8080/index.html（需 HTTP 服务，file:// 下 SW 不注册）
```

## 技术栈

纯静态多页 HTML + 原生 JS（无构建、无框架、无后端）。Tailwind CDN + Chart.js CDN。数据存 localStorage（主）+ IndexedDB（冗余双写），全量可导出/导入 JSON。PWA 可加主屏幕、支持离线。

## ⚠️ 与「暑假学习管家」同 origin 共存

两个站点都部署在 `fan604925-dev.github.io` 时，localStorage / IndexedDB / Cache Storage 按 origin 共享（路径不隔离）。本项目已做全套隔离：

- 所有 localStorage key 前缀 `j1_`（旧项目是 `ssm_`）
- IndexedDB 库名 `j1-study-db-v1`（旧项目 `ssm-db-v1`）
- Service Worker 缓存 `j1-v1`，activate 只清理 `j1-` 前缀缓存，绝不删其他应用缓存
- 全局对象名 `J1Store` / `J1App` / `J1Engine`

## 版本升级 CheckList（改数据结构时必做）

1. `js/store.js` 的 `DATA_VERSION` 递增
2. `service-worker.js` 的 `CACHE_NAME` 递增（j1-v1 → j1-v2）
3. 在 `_repairData()` 补一条幂等迁移（只补字段，绝不删用户数据）
4. 跑 `node test_store.js` 确认迁移用例通过
5. 页面保留「一键修复（不删数据）」入口兜底

## 部署（GitHub Pages）

1. 新建仓库（如 `j1-study-workbench`），把本目录全部文件推到 `main` 分支
2. Settings → Pages → Deploy from a branch → `main` / `(root)`
3. 访问 `https://fan604925-dev.github.io/j1-study-workbench/`
4. 手机浏览器固定用同一链接（换链接 = localStorage 隔离 = 数据"消失"），加到主屏幕
5. 每周导出一次 JSON 备份（设置 → 数据管理）

## 设计底线

- 去金钱化：无积分、无价目表、无兑换、无排行榜；激励 = 徽章 + 知识点点亮 + 自主选择权 + 表扬话术 + 非货币小特权
- 孩子侧（print.html）只有任务与鼓励语，禁用词有自动化测试护栏
- 所有分析（薄弱指数、补学计划）本地规则引擎完成，无需 API Key；深度分析走「复制摘要 → AI 对话 → 粘贴回填」回路
