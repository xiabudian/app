# 语音合成 与 ComfyUI 生图 使用教程

> 适合照着一步步操作。前提：手机上已安装包含「语音」页签和 ComfyUI 功能的版本（网页版 localhost:5173 也可以）。

---

## 目录

1. [准备工作：启动 ComfyUI](#一准备工作启动-comfyui)
2. [ComfyUI 文生图](#二comfyui-文生图)
3. [ComfyUI 图生图](#三comfyui-图生图)
4. [语音合成](#四语音合成)
5. [常见问题](#五常见问题)

---

## 一、准备工作：启动 ComfyUI

手机 App 要连上你电脑上的 ComfyUI，启动命令必须带两个参数（Windows 下双击编辑 `run_nvidia_gpu.bat` 或直接在 ComfyUI 文件夹开命令行）：

```bash
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header "*"
```

| 参数 | 作用 | 不加会怎样 |
| --- | --- | --- |
| `--listen 0.0.0.0` | 允许局域网设备（手机）访问 | 手机连不上 |
| `--enable-cors-header "*"` | 允许 App 跨域调用 | 一直报 Failed to fetch |

- 启动成功后，命令行里会显示本机地址，类似 `http://192.168.1.10:8188`，**记下这个地址**
- 电脑防火墙第一次会弹窗，选择「允许访问」；手机和电脑必须连**同一个 WiFi**
- 浏览器打开 `http://192.168.1.10:8188` 能看到 ComfyUI 界面就说明正常

## 二、ComfyUI 文生图

### 第 1 步：App 里填服务器地址

打开 App → **设置 → 通用 → ComfyUI**：

- **服务器**：填 `http://192.168.1.10:8188`（换成你自己的地址，结尾不要带 `/`）

### 第 2 步：保存示例工作流为 JSON 文件

新建一个记事本，把下面内容原样粘贴进去，另存为 `文生图.json`（保存类型选「所有文件」，编码 UTF-8）：

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 42,
      "steps": 25,
      "cfg": 7,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": { "width": 512, "height": 512, "batch_size": 1 }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "a cute cat", "clip": ["4", 1] }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "text, watermark, low quality", "clip": ["4", 1] }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": { "filename_prefix": "AIChat", "images": ["8", 0] }
  }
}
```

**必须改一处**：`v1-5-pruned-emaonly.safetensors` 换成你 ComfyUI 里已有的模型名——在 ComfyUI 网页里看 `Load Checkpoint` 节点下拉框里有什么名字，就填什么（文件在 `ComfyUI/models/checkpoints/` 目录）。分辨率、步数、采样器也都可以在这里顺便改。

> 想用 SDXL / Flux？不用改结构，直接在 ComfyUI 里搭好你自己的工作流，用「工作流 → **导出(API)**」导出 JSON 再导入 App 就行。本示例只是保证开箱能跑。

### 第 3 步：导入 App

设置 → 通用 → ComfyUI → 点「**导入工作流 JSON**」→ 选刚保存的 `文生图.json`。

导入成功后列表会出现一条 **「绘图」** 类型的工作流（含 SaveAudio 的才会被识别为语音）。名称默认取文件名，想改名就在导入前先在「工作流名称」框里填好。

> 正向 / 负向两个提示词节点：App 默认把你的描述填进第一个（正向）。如果生成结果不对劲，到这条工作流下面的「**提示词节点**」下拉框换一个试试。

### 第 4 步：去绘图页生成

1. **绘图页 → 点「生成引擎」卡片 → 选 `ComfyUI：文生图`**
2. 上面状态栏会变成「ComfyUI 本地工作流 · 文生图」
3. 输入提示词 → 立即生成
4. 结果进「作品」页，保存 / 下载和其他绘图完全一样

注意：用 ComfyUI 引擎时，**比例选项不生效**（分辨率由工作流 JSON 里的 width/height 决定）；风格选项仍会追加到提示词后面。

## 三、ComfyUI 图生图

图生图 = 工作流里多一个「加载图像」节点，App 会把你上传的参考图自动传进去。

### 第 1 步：保存图生图工作流

同样方法另存为 `图生图.json`（模型名 `ckpt_name` 记得换成自己的）：

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 42,
      "steps": 25,
      "cfg": 7,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 0.55,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["10", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "same person in a garden", "clip": ["4", 1] }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "text, watermark, low quality", "clip": ["4", 1] }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": { "filename_prefix": "AIChat", "images": ["8", 0] }
  },
  "10": {
    "class_type": "VAEEncode",
    "inputs": { "pixels": ["11", 0], "vae": ["4", 2] }
  },
  "11": {
    "class_type": "LoadImage",
    "inputs": { "image": "reference.png", "upload": "image" }
  }
}
```

- `denoise: 0.55` = 改图幅度：越小越像原图，越大改得越狠（1 就变成文生图了）
- 导入后如果这条工作流下出现「参考图节点」下拉框，说明检测到多个加载图像节点，选你要用的那个

### 第 2 步：使用

绘图页 → 引擎选 `ComfyUI：图生图` → 模式切到「**图生图**」→ 上传参考图 → 输入要怎么改（如「把背景换成海边日落」）→ 生成。

App 会自动：压缩参考图 → 上传到 ComfyUI 的 input 目录 → 替换 LoadImage 节点 → 提交执行 → 取回结果。

## 四、语音合成

「语音」页有两个引擎，用页面顶部的分段按钮切换。

### 引擎 A：在线模型（最简单）

用「设置 → 对话」里**当前聊天服务商**的地址和 Key 发请求，不额外配置：

1. 确认你的服务商支持语音接口 `/v1/audio/speech`（OpenAI、硅基流动、部分中转站支持；不确定就试一次）
2. **设置 → 通用 → 语音**：把「合成模型」改成该服务商支持的模型名（如 `tts-1`、`FunAudioLLM/CosyVoice2-0.5B:9f8a…`）
3. 语音页 → 引擎选「在线模型」→ 挑一个音色（alloy/echo/nova…）→ 输入文字 → 立即合成

生成后自动播放，音频自动存到手机「下载/AIChat/」。

### 引擎 B：ComfyUI（可克隆音色，如 IndexTTS）

1. 在 ComfyUI 里装好 TTS 插件（用 ComfyUI Manager 搜 `IndexTTS` 安装；装完重启 ComfyUI）
2. 在 ComfyUI 里搭 / 载入一个 TTS 工作流（插件一般自带示例工作流），确认最后有 **SaveAudio** 节点
3. 「工作流 → **导出(API)**」→ 存成 `语音.json` → App 里导入 → 自动识别为 **「语音」** 类型
4. 语音页 → 引擎选「ComfyUI」→ 点选这条工作流 → 输入文字 → 合成

**音色克隆**：工作流里有 LoadAudio 节点时，语音页会出现「克隆音色」上传框——传一段 5~10 秒的清晰人声（让插件从参考音频提取音色），合成出来的就是那个声音。工作流里没有 LoadAudio 就只按工作流自带音色合成。

## 五、常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| 一直转圈后报 Failed to fetch | ComfyUI 启动没加 `--enable-cors-header "*"`；或服务器地址写错（要 `http://`，不带结尾 `/`） |
| 手机完全连不上 | 没加 `--listen 0.0.0.0`；不在同一 WiFi；防火墙拦了 8188 |
| 导入提示「不是 API 格式」 | 用了普通「导出」，必须「工作流 → 导出(API)」 |
| 生成报找不到模型 `ckpt_name` | JSON 里的模型名和 ComfyUI 里的文件名不一致，照第 2 步改 |
| 出的图和上次一模一样 | App 已自动随机化所有 seed；若你用了自定义固定 seed 节点，进工作流改 |
| 提示词好像没生效 | 多个文本节点绑错了，到设置里该工作流下换「提示词节点」 |
| 图生图没变化 | denoise 太小（改图幅度低），把 JSON 里 denoise 调到 0.6~0.8 |
| 在线模型合成报 404/模型不存在 | 该服务商不支持 `/v1/audio/speech` 或模型名不对，换个支持的模型名/服务商 |
| ComfyUI 那边看得到任务但 App 超时 | 大模型跑得慢，App 最多等 10 分钟（绘图）/ 5 分钟（语音）；提升电脑性能或换小模型 |

---

配置原理和节点绑定规则（给想深究 / 二开的人）见 [ComfyUI与语音适配教程.md](./ComfyUI与语音适配教程.md)。
