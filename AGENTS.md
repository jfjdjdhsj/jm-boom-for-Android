# Repository Guidelines

## 项目结构与模块组织

本项目是 Tauri 2 + React 19 + Vite 的 Android 移植分支。前端源码在 `src/`，页面路由在 `src/routes/`，功能模块在 `src/features/`，通用组件在 `src/components/`，全局样式在 `src/styles/`。Rust/Tauri 后端在 `src-tauri/src/`，其中 `api/` 负责远程接口，`reader/` 负责阅读器与图片缓存，`download/` 负责下载任务，`storage/` 负责 SQLite。发布说明放在 `docs/release-notes/`，截图资源放在 `screenshot/`。

## 构建、检查与开发命令

- `bun install`：安装前端依赖，需手动执行。
- `bun run dev`：启动 Vite 开发服务。
- `bun run build`：执行 TypeScript 检查并构建前端。
- `bun run lint`：运行 `oxlint src`。
- `bun run fmt:check`：检查前端格式。
- `cd src-tauri && cargo check`：检查 Rust/Tauri 代码。

Android APK 不在本地构建，Release 由 GitHub Actions 负责分架构构建、签名和上传。

## 编码风格与命名规范

TypeScript 使用 React 函数组件和 hooks，组件文件采用 kebab-case，例如 `reader-settings-menu.tsx`。Rust 模块保持 snake_case。优先复用现有 shadcn/ui 组件和本地工具函数，不新增重复抽象。重要复杂逻辑可加简短中文注释，普通代码保持自解释。提交前应消除 lint、类型和编译警告。

## 测试与验证要求

当前仓库没有独立测试套件。前端改动至少运行 `bun run build` 或等价的 `tsc`/Vite 检查；Rust 改动运行 `cargo check`。无法本地运行时，需要在说明中明确原因。涉及 Android 布局时必须同时考虑手机、平板和桌面宽度，避免状态栏、手势导航栏、底部导航和阅读器底栏遮挡。

## 提交与 Pull Request 规范

提交信息保持简短明确，优先使用 `fix:`、`feat:`、`docs:`、`chore(scope):` 等前缀，例如 `fix: improve android storage and responsive layout`。PR 需要说明变更范围、验证结果、未验证原因，并在 UI 改动中附截图或描述影响。每次发布新版本必须新增 `docs/release-notes/v版本号.md`，包含 `功能`、`优化`、`修复`、`其他` 四个板块。

## 安全与配置提示

不要提交签名 keystore、密码或 GitHub Actions secrets。Android 外部存储、下载目录、日志目录等用户可见行为变更，需要同步更新 README 或发布说明。
