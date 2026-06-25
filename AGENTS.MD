# JM Boom Project Notes

本文件记录当前项目已经实现的关键工作和后续接手约定，避免下次继续开发时重新摸索。

## 基本约定

- 这是 Tauri 2 + React 19 + Vite + TanStack Router/Query + shadcn/ui + Rust reqwest 项目。
- 当前优先桌面端体验，暂时不重点处理小屏适配。
- 用户明确说过：代码已格式化，不用优先管 lint。常规验证优先跑 `bun run build`；如果当前 Windows 环境没有 `bun`，可直接跑本地 `node_modules/.bin/tsc.exe --noEmit` 和 `node_modules/.bin/vite.exe build`；改 Rust 后再跑 `cargo check`。
- 不要手动编辑 `src/routeTree.gen.ts`。路由变更后由 TanStack Router 插件、HMR 或 build 自动生成。
- 读取或写入包含中文的文件时必须显式使用 UTF-8 编码，避免 Windows 终端默认编码导致乱码读写。
- 前端和 Rust 通信用 Tauri `invoke`，项目不再保留 axios；新接口不要新增 axios 调用。
- 全局用户状态使用 Zustand：`src/stores/user-store.ts`，目前只在内存中保存登录用户和 endpoint。
- UI 优先复用 shadcn/ui 已安装组件。需要新 shadcn 组件时，告诉用户安装，不要自己重造复杂基础组件。
- 项目已有 `floating-nav`，不要再加传统 sidebar。
- 需要安装外部依赖，如果该依赖是 Rust 需要的，则直接添加，后续使用 `cargo check` 下载，如果是前端项目，则直接告诉用户，由用户来安装相关依赖。
- 项目接口实现或数据来源参考同级项目的 `jm-mobile` 项目。

## 已实现页面

- 首页：`src/routes/_app/index.tsx`
  - 通过 `getHomeFeed` 获取信息流。
  - 从上到下依次渲染各个信息流大项，不使用 tabs。
  - 右侧有轻量“导航”目录，可平滑跳转并随滚动高亮当前分组。
  - 有独立 BackTop 组件，滚动到一定距离后显示。

- 每周推荐：`src/routes/_app/weekly.tsx`
  - 已使用 shadcn `Tabs` 和 `Select`。
  - filters 使用较长 stale time，切换 tabs/select 时只刷新下方 items 区域。
  - items 使用 `ComicGrid`，骨架屏尺寸和真实 card 保持一致。

- 详情页：`src/routes/_app/comic/$comicId.tsx`
  - 展示封面、标题、作者、stats、简介、标签、章节、相关推荐。
  - 评论通过 stats 中的评论入口打开右侧 Drawer。
  - 评论 Drawer 不显示头像，滚动到底部自动加载更多；无更多时显示“暂无更多评论”。
  - 评论时间使用原生 `Intl.DateTimeFormat('zh-CN')` 格式化为中文日期/时间，不再使用 `date-fns`，也不显示相对时间。
  - 章节使用 shadcn `Pagination`，每页 10 个。
  - 章节标题兜底规则：有 `chapter.title` 用标题；否则有 `sort` 显示 `第 N 章`；再否则显示 `章节 N`。
  - 章节进入阅读页时会传 `title`、`chapter`、`albumId`、`nextId`、`nextChapter`。

- 阅读页：`src/routes/reader/$comicId.tsx`
  - 独立于 `_app`，所以没有 floating-nav。
  - 顶部 toolbar 显示返回、作品标题、章节名、刷新按钮；不显示页码。
  - toolbar 在鼠标移动时出现，短暂后隐藏；键盘操作时隐藏。
  - 左右方向键翻页，`Esc` 返回；页面左右透明点击区也可翻页。
  - 图片使用 `h-screen w-screen object-contain`，尽量占满视口但保留原比例，不裁切。
  - 底部 footer 是悬浮预览组件：`absolute bottom-20 left-1/2 w-80`，圆角背景，内部上方进度条、下方页码。
  - 到当前章节最后一页且存在下一章时，右下角单独显示“下一章”按钮。
  - 阅读页会优先使用 search 中的章节名；如果为空，会根据 `albumId` 获取详情并按同一兜底规则生成章节名。

- 个人中心：`src/routes/_app/me.tsx`
  - 使用 Zustand 的 `useUserStore` 读取登录用户、endpoint 和 logout。
  - 未登录时显示登录入口；已登录后展示头像、UID、邮箱、经验、等级、金币、收藏容量、等级进度和常用入口占位。
  - 签到数据通过 `getSignInData` 获取，签到动作通过 `signIn` 触发，成功后 toast 提示并 refetch。
  - 签到图为 GitHub 风格 6 个月视图：前 5 个月 + 本月完整日期，并补齐到周网格；尽量不出现横向滚动条。
  - 签到格子小尺寸显示：已签到为绿色，额外奖励日只加黄色边框；不再显示图例和月份标签。
  - 单个格子 hover 使用 Tooltip 显示中文日期、签到状态和额外奖励提示。
  - 当前接口主要返回本月记录，前端优先用 `record.date` 匹配完整日期，无法解析时 fallback 到本月 `day` 序号；后续若用 app storage 保存历史月份，可直接按完整日期回填。

- 应用壳：`src/routes/_app.tsx`
  - `floating-nav` 的 `me` 路由未登录时会拦截跳转并打开 `LoginDialog`。
  - 登录成功后自动跳转到 `/me`，个人页直接渲染 Zustand 中的用户数据。

## 组件与视觉状态

- `src/features/user/login-dialog.tsx`
  - 使用 shadcn `Dialog`、`Input`、`Button` 和项目 `Field` 组件。
  - 登录失败用 `sonner` toast 展示错误，不把长错误文本渲染进表单布局，避免 input 区域被撑开。
  - 登录按钮在用户名/密码为空或正在登录时禁用；成功后关闭对话框并触发可选 `onLoginSuccess`。

- `src/stores/user-store.ts`
  - 使用 Zustand 管理 `user`、`endpoint`、`isLoggingIn`、`login`、`logout`。
  - `login` 调用 Tauri `login` command，保存返回的 user 和 endpoint。
  - `logout` 调用 `clear_session` command 后清空本地 store。

- `src/components/comic-feed.tsx`
  - `ComicGrid` 为 4 列网格。
  - Comic card 使用 shadcn `Card`。
  - 封面是 `aspect-square`，只展示标题和作者。
  - 标题单行省略，hover 使用项目 Tooltip。
  - 封面左上角半透明圆角容器显示 `JM id`。
  - 当前 `SHOW_COVER_MASK = true`，真实图上覆盖蒙版；需要展示真实图片时删除或关闭该蒙版即可。

## Rust / Tauri API

- Rust API 已从 `lib.rs` 拆出：
  - `src-tauri/src/api.rs`：远程设置、搜索、首页、每周推荐、详情、评论等普通接口。
  - `src-tauri/src/reader.rs`：阅读 manifest、图片下载、解码、缓存、预取。
  - `src-tauri/src/lib.rs`：只保留 Tauri command 包装和 invoke handler 注册。

- 已注册 Tauri commands：
  - `get_remote_setting`
  - `search_comics`
  - `get_home_feed`
  - `get_week_filters`
  - `get_week_items`
  - `get_comic_detail`
  - `get_comic_comments`
  - `login`
  - `get_sign_in_data`
  - `sign_in`
  - `clear_session`
  - `get_comic_read_manifest`
  - `get_comic_read_page`
  - `prefetch_comic_read_pages`

- 用户 / 签到 Rust 侧要点：
  - `login` 使用 multipart 请求 `/login`，登录响应里的 `uid` 等数字字段可能是字符串，反序列化需兼容 string/number。
  - Rust reqwest client 现在通过共享 client + cookie jar 维持会话；重新登录前和退出登录时调用 `clear_session` 清掉会话。
  - `get_sign_in_data` 请求 `/daily`，返回 `dailyId`、奖励配置、event name、current progress、record 列表。
  - `sign_in` 请求 `/daily_chk`，需要 `user_id` 和 `daily_id`。
  - user avatar 通过远程 `img_host` 拼接 `/media/users/{photo}`，如果服务端直接返回 http(s) 地址则原样使用。

- 阅读器 Rust 侧要点：
  - 读取 `chapter_view_template`。
  - 使用 `json5` 解析源端宽松 JS/JSON 对象。
  - 使用 `image` crate 解码被切割/扰乱的图片。
  - 解码后页面缓存到 app cache 的 `reader` 目录。
  - 缓存上限约 512MB，修剪目标约 420MB。
  - 当前页会预取前后约 3 页。
  - `tauri.conf.json` 已开启 asset protocol，并允许 `$APPCACHE/reader/**`。

## 验证建议

- 仅前端改动：跑 `bun run build`。
- 如果 `bun` 不在 PATH，可退一步跑 `node_modules/.bin/tsc.exe --noEmit` 和 `node_modules/.bin/vite.exe build`。
- 改 `src-tauri` Rust 代码：跑 `cargo check`，工作目录为 `src-tauri`。
- 用户此前表示暂时不要纠结 lint；不要因为 lint 结果扩大无关改动。

