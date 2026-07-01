# JM Boom

禁漫天堂跨平台客户端。

## WIP

当前项目处于高速开发中，功能和特性可能会发生巨大变化。

当前分支用于 Android 移植版，目标是在 Android 上保持现有功能不变。

前往下载 [Release](https://github.com/jfjdjdhsj/jm-boom-for-Android/releases)。

## 截图

![JM Boom 截图 1](screenshot/ScreenShot_2026-06-27_002701_832.png)

![JM Boom 截图 11](screenshot/ScreenShot_2026-07-01_170104_487.png)

![JM Boom 截图 11](screenshot/ScreenShot_2026-07-01_183044_419.png)

![JM Boom 截图 2](screenshot/ScreenShot_2026-06-27_002725_560.png)

![JM Boom 截图 3](screenshot/ScreenShot_2026-06-27_002735_186.png)

![JM Boom 截图 4](screenshot/ScreenShot_2026-06-27_002758_753.png)

![JM Boom 截图 6](screenshot/ScreenShot_2026-06-27_002820_731.png)

![JM Boom 截图 7](screenshot/ScreenShot_2026-06-27_002849_983.png)

![JM Boom 截图 8](screenshot/ScreenShot_2026-06-27_002929_032.png)

## 特性 TODO

### 已完成

- [x] 首页
- [x] 每周推荐
- [x] 详情页、章节列表、相关推荐和评论
- [x] 阅读器单页阅读（从左到右、从右到左）、竖屏阅读、键盘翻页、点击翻页
- [x] 阅读历史
- [x] 收藏列表
- [x] 个人中心、自动登录、自动签到
- [x] 设置
- [x] 详情页标签、作者搜索
- [x] 搜索页
- [x] 章节/批量章节下载

### 进行中

- [ ] 自动阅读模式
- [ ] 阅读器体验进一步优化
- [ ] 更完整的多平台打包与发布流程

### 规划中

- [ ] 更细的阅读器性能优化
- [ ] 更完善的离线缓存管理体验
- [ ] 细化桌面端交互和快捷键支持
- [ ] 桌面端系统托盘
- [ ] 本地漫画管理
- [ ] 其他漫画源的接入

## Android 发布

本项目不在本地构建 APK。发布时由 GitHub Actions 初始化 Tauri Android 工程、构建分架构 APK、签名并上传到 GitHub Release。

### Release 文件命名

Android Release 产物按以下格式命名：

```text
JM-Boom-架构-v版本号.apk
```

当前 workflow 会生成：

- `JM-Boom-arm64-v8a-v0.0.2.apk`
- `JM-Boom-armeabi-v7a-v0.0.2.apk`
- `JM-Boom-x86_64-v0.0.2.apk`
- `JM-Boom-x86-v0.0.2.apk`

### GitHub Actions Secrets

发布前需要在仓库 `Settings -> Secrets and variables -> Actions` 中配置：

- `ANDROID_KEY_BASE64`：Android 签名 keystore 的 base64 内容
- `ANDROID_KEY_ALIAS`：签名 key alias
- `ANDROID_KEY_PASSWORD`：keystore/key 密码

### 触发发布

推送 tag 或手动运行 `Android Release` workflow 均可触发发布。版本号需要与 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock` 保持一致。

```bash
git tag v0.0.2
git push origin v0.0.2
```

### Android 布局适配

- Android WebView 使用 `viewport-fit=cover`，页面顶部和底部通过安全区变量避开状态栏与手势导航栏。
- 手机端保留底部导航；平板竖屏和中等宽度优先沿用底部导航与三列内容网格；大平板横屏和桌面宽度切换为左侧浮动导航。
- 阅读器顶部栏、底部控制栏和章节抽屉会避开系统安全区。手机端阅读器底栏将页码与阅读设置分区显示，避免 `1 / 32` 这类页码与按钮重叠。

### Android 外部存储

- Android 构建会在启动时请求“所有文件访问权限”，用户需要在系统设置页手动允许。
- Android 下载文件保存到 `/storage/emulated/0/jj-boom/downloads`。
- Android 运行日志保存到 `/storage/emulated/0/jj-boom/logs/jm-boom.log`。
- 如果 `/storage/emulated/0/jj-boom` 已存在，应用会直接复用；不存在时会在权限允许后自动创建 `downloads` 和 `logs` 子目录。
- 桌面端仍使用系统分配的应用数据目录和日志目录。

### 缓存管理

- 设置页缓存区只显示当前缓存大小、缓存上限和清理入口，不显示内部缓存路径和打开文件夹按钮。

## 环境依赖

- Bun：用于安装前端依赖、运行 Vite 和 Tauri CLI
- Rust stable：用于编译 `src-tauri`
- Android SDK/NDK：GitHub Actions 会自动安装，用于构建 Android APK

## 启动项目

桌面开发仍可使用原 Tauri 开发流程：

```bash
bun install
bun run tauri dev
```

## NSFW 警告

本软件可能存在裸露、暴力、色情或冒犯等不适宜公众场合的内容，请勿在公共场合使用本软件，避免不必要的纷争。

## 致谢

本项目参考了以下项目的部分实现，在此表示衷心的感谢！

- [jm-mobile](https://github.com/Dedicatus546/jm-mobile)
- [Breeze](https://github.com/deretame/Breeze)
- [jmcomic-next](https://github.com/HongShi2333/jmcomic-next)

同时感谢社区 [LinuxDO](https://linux.do) 的帮助。

## 免责声明

本项目仅供学习、研究和技术交流使用。项目作者与任何第三方服务、原始应用或内容提供方无关。
使用者应自行遵守当地法律法规以及相关服务条款。因使用本项目产生的任何法律、版权、账号、数据或财务风险均由使用者自行承担。

## License

遵循 [MIT](./LICENSE) 协议。

## Star History

<a href="https://www.star-history.com/?repos=jfjdjdhsj%2Fjm-boom-for-Android&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=jfjdjdhsj/jm-boom-for-Android&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=jfjdjdhsj/jm-boom-for-Android&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=jfjdjdhsj/jm-boom-for-Android&type=date&legend=top-left" />
 </picture>
</a>
