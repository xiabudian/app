# AGENTS.md — AI 会话项目速览

新会话先读这份文档，避免浪费 token。有不清楚的再看 README.md（面向人类）。

## 项目是什么

AI 聊天助手：手机优先 Web App（Vue3 + Vite + Vant4），支持多服务商对话/生图，已接入 Capacitor 安卓工程云打包。

## 常用命令

```bash
npm run dev        # 开发服务器 http://localhost:5173（手机同 WiFi 用局域网 IP）
npm run mock       # 本地演示接口 http://localhost:8788（无 Key 体验用）
npm run build      # 生产构建到 dist/
npx cap sync android  # dist 同步进安卓工程（CI 会自动做）
```

云打包：`git push origin main` → GitHub Actions 自动编译 APK → 仓库 Actions 页面 Artifacts 下载。**不要本地打包**（无 Android SDK）。

## 目录结构

- `src/lib/` 接口层：`api.js`（流式对话/生图/错误处理）、`providers.js`（服务商预设：DeepSeek/xAI/魔搭/硅基流动/XPivot/ApiMart）、`storage.js`（localStorage+下载）、`idb.js`（图片存 IndexedDB）、`voice.js`（TTS/STT）、`keepalive.js`（前台保活）
- `src/stores/` 状态（reactive 单例，非 pinia）：`settings.js`（服务商/Key/模型/开关）、`chat.js`（对话+流式生成）、`draw.js`（生图任务队列）、`ui.js`（页签/可见性）
- `src/views/` 五页签：Chat / Draw / Works / History / Settings；`ProviderEditor.vue` 服务商编辑弹窗
- `mock-server.mjs` 演示服务（8788 端口）

## 关键机制（改代码前必读）

- **服务商配置**：`settings.chatProvider` / `settings.imageProvider` 互相独立；内置预设在 `providers.js`，用户自建在 `settings.userProviders`。绘图 Key 留空则沿用聊天 Key
- **图片存储**：本体在 IndexedDB（`lib/idb.js`），localStorage 只存元数据；作品上限 30 张，删除时同步清理
- **ApiMart 生图是异步任务**：POST `/v1/images/generations` 返回 task_id → 轮询 GET `/v1/tasks/{id}` → 完成后 `data.result.images[0].url[]`（url 是数组）；图生图必须先 POST `/v1/uploads/images`（不接受 base64）；尺寸用比例（如 `2:3`）+ resolution（`1k/2k/4k`），代码会自动映射
- **XPivot 等同步接口**：单次请求，**切后台会被安卓冻结连接**导致网络错误 → 已做：错误标注"切后台导致连接中断" + 回前台自动重试一次（`bgInterrupted`/`autoRetried` 标记）
- **前台保活**：`keepalive.js` 生成期间启动前台服务（APK）/屏幕常亮锁（网页）
- **界面风格**：全站黑白极简（`--ink #111`），主按钮纯黑无渐变，次要按钮白底灰边黑字，语义红仅用于停止/删除/报错。**不要擅自加彩色或渐变**
- 文档站：ApiMart 用 `.md` 后缀抓取（如 `docs.apimart.ai/en/api-reference/images/gpt-image-2.5/generation.md`），HTML 页面是 SPA 抓不到内容

## 已踩过的坑（别再踩）

- **Vite 文件监听偶尔失效**：改完代码页面没变化 → `touch` 该文件或重启 dev server；验证以 `curl localhost:5173/src/xxx` 的实际内容为准
- **Vue 响应式**：向 reactive 数组 push 原始对象后，必须通过 `arr[arr.length - 1]`（代理）修改字段，直接改原对象界面不更新（已踩两次）
- **settings.js 的 watch 全量覆盖 localStorage**：多标签页会互相覆盖，已有"Key 非空优先"合并保护；改合并逻辑时别破坏它
- **GitHub API 匿名限流（60 次/小时）**：查云构建状态用 `git fetch` logs 分支（构建结果写在提交信息里），不要用 API
- **用户网络走代理 127.0.0.1:7897**：git push 超时加 `-c http.proxy=http://127.0.0.1:7897 -c https.proxy=...`
- **Capacitor CLI 8 要求 Node ≥22**；`cap sync` 不支持把 `--verbose` 放在平台名后面
- **调试签名已固定**：`android/app/debug.keystore` 已提交仓库（build.gradle 的 signingConfigs.debug 引用），所有构建签名一致，覆盖安装正常。别删这个文件，也别用 `*.keystore` 忽略它（.gitignore 已加白名单）
- **旧版本覆盖安装报错**：历史构建每次随机签名，属预期；用户手机如遇到，用 adb + `run-as com.aichat.phoneapp` 迁移数据（adb 在 D:i\myprojectdb\platform-tools\）
- **安卓 15 强制全屏（状态栏/手势条遮挡）**：由内置 SystemBars 插件处理，配置 `plugins.SystemBars.insetsHandling`：`css`（默认，要求手机 WebView ≥140）/ `native`（原生加边距，不依赖版本，当前采用）/ `disable`。不存在 `adjustMarginsForEdgeToEdge` 这个配置（写了会被静默忽略）

## 用户偏好（重要）

- 改完代码**只本地提交，不要 push**（push 触发云打包）；用户网页（localhost:5173）确认后说"打包"再推
- 回复精简省 token；中文交流
- 手机端问题优先想：是否切后台断连、是否安卓沙箱限制

## 代码地图（二开直接定位）

数据流：ChatInput → chat.js `sendMessage` → `generate` → api.js `streamChat`(SSE逐字回调) → persist。
生图：DrawView → draw.js `generateDraw`(校验+建任务) → `runGeneration`(执行+保活+自动下载+红点) → api.js `generateImage` 按服务商分发。
配置：settings.js `buildSettings`(启动加载+preset合并+迁移) → watch 全量写 localStorage（Key 非空优先合并）。

| 要改什么 | 位置 |
| --- | --- |
| 服务商预设/取Key链接 | `lib/providers.js` |
| 流式解析/SSE/错误转人话 | `lib/api.js`：`streamChat` / `describeError` / `withTimeout` |
| ApiMart 异步任务+轮询+参考图上传 | `lib/api.js`：`apimartImage`（比例映射 `nearestApimartRatio`） |
| 聊天发送/重试/切后台标记 | `stores/chat.js`：`sendMessage` / `generate` |
| 生图任务队列/自动下载/红点 | `stores/draw.js`：`generateDraw` / `runGeneration` / `retryDraw` |
| TTS/STT | `lib/voice.js` + `MessageBubble`(朗读) + `ChatInput`(麦克风) |
| 图片本地持久化 | `lib/idb.js`（draw.js 持久化时转存） |
| 服务商编辑弹窗字段 | `components/ProviderEditor.vue`（按 mode 分 chat/image） |
| 气泡/样式 | `styles.css`（注释分区块）+ 各 view 的 template |

新加页面：views/ 新组件 → `ui.js` 加 TAB → App.vue 挂载。
