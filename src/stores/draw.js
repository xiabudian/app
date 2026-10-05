import { reactive } from 'vue'
import { showToast } from 'vant'
import { loadJSON, saveJSON, KEYS, downloadImage } from '../lib/storage'
import { idbPut, idbGet, idbDel } from '../lib/idb'
import { generateImage, describeError } from '../lib/api'
import { settings, providerRef } from './settings'
import { ui, TAB } from './ui'

export const draw = reactive({
  results: loadJSON(KEYS.draws, []),
  generating: false, // 是否有进行中的生成任务
  unseen: 0, // 用户还没查看的完成结果数（作品菜单红点）
})

let seq = Date.now()
const genId = () => `${seq++}-${Math.random().toString(36).slice(2, 8)}`

// 图片本体（data:image/...）转存 IndexedDB，localStorage 只存元数据；
// http 链接（部分服务商返回临时链接）直接存字符串。
function persistDraws() {
  const keep = draw.results.slice(0, 30).map((r) => {
    const { image, ...rest } = r // 参考图太大不入库（重试仅在本次会话内可用）
    if (rest.url && rest.url.startsWith('data:')) {
      // 图片本体转存 IndexedDB，localStorage 只记标记
      idbPut(rest.id, rest.url).catch(() => {})
      rest.url = ''
      rest.idb = true
    } else if (rest.url) {
      rest.idb = false // http 链接直接存
    } else {
      rest.idb = !!r.idb // url 还是空（IDB 恢复中/生成中），保留原标记不误清
    }
    return rest
  })
  saveJSON(KEYS.draws, keep)
}

// 页面启动时，把存在 IndexedDB 里的图片本体取回来
for (const r of draw.results) {
  if (r.idb && r.id) {
    idbGet(r.id)
      .then((u) => {
        if (u) r.url = u
        else {
          r.idb = false
          r.error = r.error || '图片数据丢失（可能清除过浏览器数据），可重试或删除'
        }
      })
      .catch(() => {})
  }
}

function purgeImages(items) {
  for (const r of items) {
    if (r.id) idbDel(r.id).catch(() => {})
  }
}

export function removeWork(id) {
  const i = draw.results.findIndex((r) => r.id === id)
  if (i >= 0) {
    purgeImages([draw.results[i]])
    draw.results.splice(i, 1)
    persistDraws()
  }
}

export function removeWorks(ids) {
  const set = new Set(ids)
  const removed = draw.results.filter((r) => set.has(r.id))
  purgeImages(removed)
  draw.results = draw.results.filter((r) => !set.has(r.id))
  persistDraws()
}

// 校验当前绘图服务商配置，返回 { pid, conf, imageKey } 或 { err: 'need-setup' }
function validate() {
  const pid = settings.imageProvider
  const conf = providerRef(pid)
  if (!conf?.imageModels?.length) {
    showToast('当前绘图服务商不支持绘图，请先到「设置」切换')
    return { err: '' }
  }
  if (!conf.baseUrl) {
    showToast('请先到「设置」填写服务地址')
    return { err: 'need-setup' }
  }
  // 绘图 Key 独立（有的中转站生图和文本 Key 不同），留空则沿用聊天 Key
  const imageKey = conf.imageKey || conf.apiKey
  if (!imageKey && pid !== 'demo') {
    showToast('请先到「设置」填写绘图 API Key')
    return { err: 'need-setup' }
  }
  return { pid, conf, imageKey }
}

// 执行一次生成并写入 item；完成后若用户在别的页面，累计红点提醒
async function runGeneration(item, pid, conf, imageKey, { prompt, size, image }) {
  draw.generating = true
  try {
    item.url = await generateImage({
      providerId: pid,
      baseUrl: conf.baseUrl,
      apiKey: imageKey,
      model: item.model,
      prompt,
      size,
      image,
    })
  } catch (e) {
    item.error = describeError(e)
  } finally {
    item.loading = false
    // 记录本次请求的响应耗时（秒，保留一位小数）
    item.duration = Math.round((Date.now() - item.time) / 100) / 10
    draw.generating = draw.results.some((r) => r.loading)
    persistDraws()
    // 开了自动下载：成功后直接存到浏览器的「下载」文件夹
    if (!item.error && item.url && settings.autoDownload) {
      const ext = item.url.startsWith('data:image/svg') ? 'svg' : 'png'
      const name = `AI绘图_${(item.userPrompt || 'image').slice(0, 12)}_${item.id.slice(0, 6)}.${ext}`
      downloadImage(item.url, name).catch(() => {})
    }
    if (ui.tab !== TAB.DRAW && ui.tab !== TAB.WORKS) draw.unseen++
  }
}

export async function generateDraw({ prompt, size, image, stylePrompt }) {
  // 最多同时 3 张，防止手滑连点把额度打爆
  const running = draw.results.filter((r) => r.loading).length
  if (running >= 3) {
    showToast('最多同时生成 3 张，请等一张完成')
    return
  }
  const v = validate()
  if (!v || v.err) return v?.err
  const { pid, conf, imageKey } = v
  if (!prompt && !image) {
    showToast('请先输入提示词')
    return
  }

  // 风格对应的固定提示词追加在用户描述后面
  const fullPrompt = stylePrompt ? `${prompt}，${stylePrompt}` : prompt
  draw.results.unshift({
    id: genId(),
    prompt: fullPrompt, // 实际发给模型的完整提示词
    userPrompt: prompt || '（参考图改图）', // 用户自己输入的部分，作品页展示用
    model: conf.imageModel || conf.imageModels[0],
    providerId: pid,
    size,
    image,
    url: '',
    error: '',
    loading: true,
    time: Date.now(),
  })
  if (draw.results.length > 30) {
    purgeImages(draw.results.slice(30))
    draw.results.length = 30
  }
  // 必须通过响应式代理修改（直接改 unshift 进去的原始对象，界面不会更新）
  const item = draw.results[0]
  await runGeneration(item, pid, conf, imageKey, { prompt: fullPrompt, size, image })
}

// 失败重试：原地把这条任务重新跑一遍（参数不变）
export async function retryDraw(item) {
  if (item.loading) return
  const conf = providerRef(item.providerId) || providerRef(settings.imageProvider)
  if (!conf?.baseUrl) {
    showToast('请先到「设置」填写服务地址')
    return
  }
  const imageKey = conf.imageKey || conf.apiKey
  if (!imageKey && item.providerId !== 'demo') {
    showToast('请先到「设置」填写绘图 API Key')
    return
  }
  item.loading = true
  item.error = ''
  item.url = ''
  await runGeneration(item, item.providerId, conf, imageKey, {
    prompt: item.prompt,
    size: item.size,
    image: item.image,
  })
}
