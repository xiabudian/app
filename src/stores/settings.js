import { reactive, watch } from 'vue'
import { PROVIDER_PRESETS } from '../lib/providers'
import { loadJSON, saveJSON, KEYS } from '../lib/storage'

// 数据结构：
//   settings.chatProvider  -> 对话用哪个服务商（id）
//   settings.imageProvider -> 绘图用哪个服务商（可以和对话不同）
//   settings.providers     -> 内置服务商的配置（按 id）
//   settings.userProviders -> 用户自己添加的服务商（数组，可任意多个）
// 每个服务商：{ name, baseUrl, apiKey, model(默认聊天模型), imageModel(默认绘图模型), models[], imageModels[] }
function buildSettings() {
  const providers = {}
  for (const [id, p] of Object.entries(PROVIDER_PRESETS)) {
    providers[id] = {
      name: p.label,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey || '',
      imageKey: '', // 绘图专用 Key：留空则沿用 apiKey（有的中转站两者不同）
      model: p.models[0] || '',
      imageModel: p.imageModels[0] || '',
      models: [...p.models],
      imageModels: [...p.imageModels],
      hint: p.hint || '',
      imageHint: p.imageHint || '',
      builtin: true,
    }
  }

  const data = {
    chatProvider: 'demo',
    imageProvider: 'demo',
    systemPrompt: '',
    autoDownload: false, // 生成成功后自动下载图片到「下载」文件夹
    ttsModel: 'tts-1', // 语音合成模型
    sttModel: 'whisper-1', // 语音识别模型
    providers,
    userProviders: [],
    // 绘图页下拉框的选项，可在「设置 → 通用」里自定义
    // 风格：{ label: 显示名, prompt: 追加到提示词后面的固定文字 }
    drawStyles: [
      { label: '写实', prompt: '写实摄影风格，8K 画质，细节丰富，自然光影' },
      { label: '动漫', prompt: '日系动漫插画风格，色彩明快，线条干净' },
      { label: '国风水墨', prompt: '中国水墨画风格，留白意境，笔墨晕染' },
      { label: '赛博朋克', prompt: '赛博朋克风格，霓虹灯光，雨夜街头，电影感' },
    ],
    drawSizes: [
      { label: '16:9 4K 横图', size: '3840x2160' },
      { label: '9:16 4K 竖图', size: '2160x3840' },
      { label: '1:1 方图', size: '1024x1024' },
      { label: '3:4 竖图', size: '768x1024' },
      { label: '4:3 横图', size: '1024x768' },
      { label: '3:2 横图', size: '1536x1024' },
      { label: '2:3 竖图', size: '1024x1536' },
      { label: '16:9 2K 横图', size: '2560x1440' },
      { label: '9:16 2K 竖图', size: '1440x2560' },
    ],
  }

  const saved = loadJSON(KEYS.settings, null)
  if (saved) {
    for (const id of Object.keys(data.providers)) {
      const s = saved.providers?.[id] || {}
      for (const k of ['baseUrl', 'apiKey', 'imageKey', 'model', 'imageModel', 'models', 'imageModels']) {
        if (s[k] !== undefined) data.providers[id][k] = s[k] // 模型列表数组也一并恢复（用户可能在编辑里加过模型）
      }
    }
    if (Array.isArray(saved.userProviders)) data.userProviders = saved.userProviders
    if (typeof saved.systemPrompt === 'string') data.systemPrompt = saved.systemPrompt

    // 旧版本内置了「自定义」服务商：如果用户在里面填过配置，自动迁移成一个用户自建服务商
    const savedCustom = saved.providers?.custom
    if (savedCustom && (savedCustom.baseUrl || savedCustom.apiKey || savedCustom.model)) {
      const migrated = {
        id: 'u-migrated-custom',
        name: '自定义服务',
        baseUrl: savedCustom.baseUrl || '',
        apiKey: savedCustom.apiKey || '',
        imageKey: savedCustom.imageKey || '',
        model: savedCustom.model || '',
        imageModel: savedCustom.imageModel || '',
        models: savedCustom.models?.length ? savedCustom.models : savedCustom.model ? [savedCustom.model] : [],
        imageModels: savedCustom.imageModels?.length
          ? savedCustom.imageModels
          : savedCustom.imageModel
            ? [savedCustom.imageModel]
            : [],
        hint: '',
        imageHint: '',
        builtin: false,
      }
      if (!data.userProviders.some((u) => u.id === migrated.id)) data.userProviders.unshift(migrated)
    }
    if (typeof saved.autoDownload === 'boolean') data.autoDownload = saved.autoDownload
    if (typeof saved.ttsModel === 'string') data.ttsModel = saved.ttsModel
    if (typeof saved.sttModel === 'string') data.sttModel = saved.sttModel
    if (Array.isArray(saved.drawStyles)) {
      // 兼容旧格式（纯字符串数组）→ 迁移为 { label, prompt }
      data.drawStyles = saved.drawStyles.map((s) =>
        typeof s === 'string' ? { label: s, prompt: `${s}风格` } : s
      )
    }
    if (Array.isArray(saved.drawSizes)) {
      const legacyLabels = JSON.stringify([
        { label: '1:1 方图', size: '1024x1024' },
        { label: '3:4 竖图', size: '768x1024' },
        { label: '4:3 横图', size: '1024x768' },
      ].map((x) => x.label))
      const legacyLabels2 = JSON.stringify(['1:1 方图', '3:4 竖图', '4:3 横图', '9:16 手机壁纸'])
      const savedLabels = JSON.stringify(saved.drawSizes.map((x) => x.label))
      if (savedLabels === legacyLabels || savedLabels === legacyLabels2) {
        // 旧默认列表视为未自定义，直接用新默认
      } else {
        data.drawSizes = saved.drawSizes
      }
    }

    const exists = (id) => !!id && (data.providers[id] || data.userProviders.some((u) => u.id === id))
    const canDraw = (id) => {
      const p = data.providers[id] || data.userProviders.find((u) => u.id === id)
      return !!p && (p.imageModels?.length || 0) > 0
    }
    const firstDrawable = Object.keys(data.providers).find((id) => canDraw(id)) || 'demo'

    // 兼容旧版本：以前只有一个 activeProvider，现在拆成对话/绘图两个
    data.chatProvider = exists(saved.chatProvider)
      ? saved.chatProvider
      : exists(saved.activeProvider)
        ? saved.activeProvider
        : 'demo'
    data.imageProvider = exists(saved.imageProvider)
      ? saved.imageProvider
      : canDraw(data.chatProvider)
        ? data.chatProvider
        : firstDrawable
  }

  // 演示服务的地址由项目内置决定（避免旧数据里的失效地址），不允许被覆盖
  data.providers.demo.baseUrl = PROVIDER_PRESETS.demo.baseUrl
  return data
}

export const settings = reactive(buildSettings())

watch(
  settings,
  () => {
    // 多标签页保护：如果另一个标签页刚填了 Key，以非空优先合并，
    // 避免旧标签页用自己的旧数据把新 Key 覆盖成空
    const fresh = loadJSON(KEYS.settings, null)
    if (fresh) {
      for (const id of Object.keys(fresh.providers || {})) {
        const mine = settings.providers[id]
        const theirs = fresh.providers[id]
        if (mine && theirs) {
          if (!mine.apiKey && theirs.apiKey) mine.apiKey = theirs.apiKey
          if (!mine.imageKey && theirs.imageKey) mine.imageKey = theirs.imageKey
        }
      }
      if (!settings.userProviders.length && fresh.userProviders?.length) {
        settings.userProviders = fresh.userProviders
      }
    }
    saveJSON(KEYS.settings, JSON.parse(JSON.stringify(settings)))
  },
  { deep: true }
)

/** 所有服务商（内置 + 用户自建），用于列表展示 */
export function allProviders() {
  return [
    ...Object.entries(settings.providers).map(([id, p]) => ({ id, ...p })),
    ...settings.userProviders.map((u) => ({ ...u, builtin: false })),
  ]
}

/** 按 id 取服务商的响应式对象（直接改字段会自动保存并刷新界面） */
export function providerRef(id) {
  return settings.providers[id] || settings.userProviders.find((u) => u.id === id) || null
}

let seq = Date.now()

export function addUserProvider() {
  const p = {
    id: `u-${seq++}`,
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    imageModel: '',
    models: [],
    imageModels: [],
    hint: '',
    imageHint: '',
    builtin: false,
  }
  settings.userProviders.push(p)
  return p
}

export function removeUserProvider(id) {
  const i = settings.userProviders.findIndex((u) => u.id === id)
  if (i >= 0) settings.userProviders.splice(i, 1)
  if (settings.chatProvider === id) settings.chatProvider = 'demo'
  if (settings.imageProvider === id) settings.imageProvider = 'demo'
}
