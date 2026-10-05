# AI 聊天助手（纯前端 · 无后端）

一个适合新手的 AI 聊天 App：**不需要自己写后端**，浏览器直连各家大模型 API。所有数据（API Key、聊天记录）都只存在你自己的电脑/手机里。

技术栈：**Vue 3 + Vite + Vant 4**（手机优先的界面，电脑浏览器也能用）。

## 功能清单

- ✅ 多服务商聊天：DeepSeek、Grok（xAI）、魔搭社区 ModelScope、硅基流动、任何 OpenAI 兼容服务（agens-ai、中转站等）
- ✅ 流式「打字机」输出，支持中途停止
- ✅ 推理模型思考过程展示（如 DeepSeek R1，可折叠）
- ✅ Markdown / 代码块渲染，一键复制、重新生成
- ✅ 服务商管理：API Key 存本机 localStorage；**对话和绘图可以分别指定不同服务商**；可新增任意多个自定义服务商，每个可配多个模型并指定默认模型
- ✅ 对话历史：自动标题、切换、删除（左滑）、清空
- ✅ AI 绘图：文生图 + 图生图（需对应服务商），风格 / 比例下拉选择（可在设置里自定义，每个风格可绑定一段固定提示词），独立的作品菜单（查看 / 下载 / 删除）
- ✅ 图片上传（自动压缩），配合视觉模型实现看图对话
- ✅ 演示模式：无需任何 Key 即可体验完整流程（聊天 + 绘图）

## 快速开始

### 第 1 步：安装依赖（只需一次）

前提：电脑已安装 [Node.js](https://nodejs.org/zh-cn) 18 或更高版本（下载 LTS 版，一路下一步即可）。

```bash
npm install
```

### 第 2 步：启动

```bash
# 终端 1：启动网页（按 Ctrl+C 可停止）
npm run dev
```

打开浏览器访问 http://localhost:5173

手机上体验：手机和电脑连同一个 WiFi，用手机浏览器打开终端里显示的 **Network** 地址（如 `http://192.168.x.x:5173`）。

```bash
# 终端 2（可选）：没有 API Key？先启动本地演示服务
npm run mock
```

然后在 App「设置」页选择 **演示模式（无需 Key）**，回到「对话」页即可看到流式打字机效果。

## 获取 API Key

| 服务商 | 注册/获取 Key | 说明 |
| --- | --- | --- |
| DeepSeek | https://platform.deepseek.com/api_keys | 国内可直充，价格便宜 |
| Grok (xAI) | https://console.x.ai | 需要国外支付方式 |
| 魔搭社区 | https://modelscope.cn/my/myaccesstoken | 阿里旗下，实名后有免费额度，在「访问令牌」页创建 Key |
| 硅基流动 | https://cloud.siliconflow.cn/account/ak | 国内直连、注册送额度，聊天绘图都支持 |
| XPivot 中转站 | https://www.xpivot.top/console/token | 第三方中转聚合站，已预填 grok-4.5 与 gpt-image-2.5 系列生图模型 |
| 自定义 | 各服务商官网 | 可新增任意多个：填服务地址 + Key + 模型名（多个模型用逗号分隔） |

操作：打开「设置」→ 选择服务商 → 填入 Key（选模型可点下面的常用模型标签）→ 点「测试连接」确认可用 → 回「对话」页开始聊天。

## 项目结构（新手阅读指南）

```
phoneapp/
├── index.html                  # 页面入口
├── vite.config.js              # 开发服务器配置（含 CORS 代理示例）
├── mock-server.mjs             # 本地演示服务（模拟流式 API）
└── src/
    ├── main.js                 # 程序入口
    ├── App.vue                 # 外壳：三个页面 + 底部导航
    ├── styles.css              # 全部样式
    ├── lib/
    │   ├── providers.js        # 服务商预设（地址/模型/绘图模型/获取Key链接）
    │   ├── api.js              # 核心：流式请求、SSE 解析、绘图接口、错误提示
    │   └── storage.js          # localStorage 封装、图片压缩
    ├── stores/
    │   ├── settings.js         # 设置数据（Key、模型、系统提示词）
    │   ├── chat.js             # 对话数据：发送、流式生成、历史管理
    │   ├── draw.js             # 绘图数据：生成、作品记录
    │   └── ui.js               # 当前所在页面
    ├── views/
    │   ├── ChatView.vue        # 对话页
    │   ├── DrawView.vue        # 绘图页（文生图/图生图）
    │   ├── WorksView.vue       # 我的作品（生成的图片管理）
    │   ├── HistoryView.vue     # 历史页
    │   └── SettingsView.vue    # 设置页
    └── components/
        ├── MessageBubble.vue   # 单条消息气泡（Markdown/思考过程/复制）
        ├── ChatInput.vue       # 底部输入框
        └── ProviderEditor.vue  # 服务商编辑弹窗（新增/编辑/删除/设默认模型）
```

想改点什么？常见入手点：

- **加新服务商** → 在 `src/lib/providers.js` 里照抄一段预设即可
- **改默认回复/演示脚本** → `mock-server.mjs` 里的 `REPLY` 变量
- **改界面颜色气泡样式** → `src/styles.css`

## 常见问题（FAQ）

**1. 提示「网络请求失败」或 CORS 跨域错误？**

浏览器有同源安全策略，个别服务商可能不允许网页直连。解决办法：
- 开发阶段：在 `vite.config.js` 里按注释配置代理，再把该服务商的「服务地址」改成代理路径；
- 打包成手机 App 后（见下），请求从 App 原生层发出，基本不受此限制。

**2. 报 401？** Key 填错或没填。检查是否多了空格、是否选对了服务商。

**3. 报 429 / 402？** 请求太频繁或账户余额/免费额度用完了。

**4. 发了图片但模型报错？** 图片需要**视觉模型**支持：魔搭选 `Qwen2.5-VL` 系列、xAI 用 Grok-4；**DeepSeek 目前不支持图片输入**。

**5. 绘图报错或很慢？** 生图通常要几秒到几十秒；各家对尺寸参数支持不同，报错时先换默认的 1:1 试试。图生图要用支持编辑的模型（如 `Qwen-Image-Edit`）。部分服务商返回的是临时图片链接，过一段时间会失效，看到喜欢的图及时「下载」保存。

**6. 图片存在哪里？浏览器会不会变大？** 图片本体存在浏览器的 **IndexedDB**（浏览器为大文件准备的数据库，配额通常几百 MB 起），localStorage 里只存提示词等轻量元数据；作品最多保留 30 张，删除作品时会同步清理图片。聊天记录和 API Key 仍在 localStorage（都是小文本）。清除浏览器数据会同时删除全部记录，重要对话请及时复制备份。

**7. 模型名过期了？** 各家模型更新很快，模型名以官方文档为准，「模型」一栏可以随意手动输入。

## 后续路线

- **✅ 打包成手机安装包（APK）——已支持两种方式，见下方「打包成安卓 APK」章节**
- 更多玩法：语音输入、导出聊天记录、多轮对话设置（温度等参数）、绘图结果一键分享。

## 打包成安卓 APK

项目已接入 [Capacitor](https://capacitorjs.com/)（网页转安卓的官方级方案），安卓工程在 `android/` 目录。**推荐云打包**（电脑不需要装任何安卓环境）：

### 方式一：GitHub Actions 云打包（推荐，零环境配置）

1. 注册 [GitHub](https://github.com) 账号（如已有可跳过）；
2. 在 GitHub 上新建一个**公开**仓库（New repository → 起名 → 不要勾选任何初始化选项）；
3. 在项目目录执行下面三行命令（把 `你的用户名/仓库名` 换成自己的）：

```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

4. 打开仓库页面 → **Actions** 标签 → 会看到「打包安卓 APK」正在运行（约 3~5 分钟）；
5. 完成后点进该次运行 → 底部 **Artifacts** → 下载 `AI聊天助手-debug-apk`，解压得到 `app-debug.apk`；
6. 把 APK 传到手机上安装（需允许「安装未知应用」）。

以后每次 `git push`，云端都会自动重新打包最新版。

> Debug 包仅供自己安装使用；要上架应用商店需要用 `assembleRelease` 并配置签名，属于进阶内容。

### 方式二：本地打包（需要安装 Android Studio + JDK 17）

```bash
npm run apk:sync   # 构建网页并同步到安卓工程
npm run apk:open   # 用 Android Studio 打开，点 Run 即可安装到手机
```

### 方式三：HBuilderX 云打包（不想要 GitHub 的话）

用 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 新建「5+App(A)」项目，把 `dist` 目录内容作为应用资源导入，再用其「发行 → 原生 App-云打包」生成 APK（需要 DCloud 账号）。

### 说明

- 应用名称：AI 聊天助手；包名：`com.aichat.phoneapp`（在 `capacitor.config.json` 修改）；
- 已实测 DeepSeek、魔搭、硅基流动、XPivot 的接口都允许网页直连，APK 内可直接使用；
- 改了网页代码后：`npm run apk:sync` 同步，再按上面方式重新打包；
- 想换应用图标：替换 `android/app/src/main/res` 下各 `mipmap` 目录的 `ic_launcher.png`。
