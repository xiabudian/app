// 核心网络层：调用 OpenAI 兼容接口，逐字读取流式响应
export function joinUrl(base, path) {
  const trimmed = (base || '').replace(/\/+$/, '')
  if (trimmed.endsWith(path)) return trimmed // 用户直接填了完整接口地址的情况
  return trimmed + path
}

/**
 * 流式对话。每收到一小段文字就回调 onDelta，收到思考内容回调 onReasoning，
 * 界面因此能做出「打字机」效果。
 */
export async function streamChat({
  baseUrl,
  apiKey,
  model,
  messages,
  systemPrompt,
  signal,
  onDelta,
  onReasoning,
}) {
  const payloadMessages = systemPrompt && systemPrompt.trim()
    ? [{ role: 'system', content: systemPrompt.trim() }, ...messages]
    : messages

  const res = await fetch(joinUrl(baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: payloadMessages, stream: true }),
    signal,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.error?.message || j.message || msg
    } catch { /* 响应不是 JSON 就用状态码 */ }
    throw new Error(msg)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 协议：一行一行地解析 "data: {...}"
    let idx
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        if (json.error) throw new Error(json.error.message || '服务返回错误')
        const delta = json.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content) onReasoning?.(delta.reasoning_content)
        if (delta.content) onDelta?.(delta.content)
      } catch (e) {
        if (e instanceof Error && e.message && !/JSON/i.test(e.message)) throw e
        // 其余情况：个别行不是合法 JSON，跳过即可
      }
    }
  }
}

/** 用 GET /models 快速验证地址和 Key 是否可用 */
export async function testConnection({ baseUrl, apiKey }) {
  const res = await fetch(joinUrl(baseUrl, '/models'), {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.error?.message || j.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  const j = await res.json()
  return Array.isArray(j.data) ? j.data.length : 0
}

export function describeError(e, providerId) {
  if (e?.name === 'AbortError') return '已停止生成'
  if (e?.name === 'TimeoutError') return '请求超时（180 秒无响应），服务商响应过慢或网络不稳，可点「重试」'
  const cause = e?.cause?.message || e?.cause?.code || ''
  const msg = e?.message || String(e)
  if (/failed to fetch|networkerror|load failed|timed out/i.test(msg)) {
    if (providerId === 'demo') {
      return '网络请求失败：演示模式需要先在电脑的项目目录运行 node mock-server.mjs'
    }
    const detail = cause ? `（${cause}）` : ''
    return `网络请求失败${detail}，请检查网络后点「重试」`
  }
  if (/\b401\b|unauthorized|无效的令牌/i.test(msg)) return 'API Key 无效或未填写（401）'
  if (/\b402\b/.test(msg)) return '账户余额不足（402）'
  if (/\b429\b/.test(msg)) return '请求太频繁或额度不足（429）'
  return msg
}

/** 各家返回格式略有差异，尽量把图片地址从常见字段里找出来 */
function extractImageUrl(j) {
  const d = j?.data?.[0]
  if (d?.url) return d.url
  if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`
  const im = j?.images?.[0]
  if (typeof im === 'string') return im
  if (im?.url) return im.url
  if (im?.b64_json) return `data:image/png;base64,${im.b64_json}`
  const r = j?.output?.results?.[0]
  if (r?.url) return r.url
  return null
}

// ============ ApiMart：异步任务式生图（提交 → 轮询 → 取图） ============

// 用户选的像素尺寸 → ApiMart 最接近的宽高比（支持的比例见官方文档）
const APIMART_RATIOS = [
  ['1:1', 1], ['3:2', 3 / 2], ['2:3', 2 / 3], ['4:3', 4 / 3], ['3:4', 3 / 4],
  ['5:4', 5 / 4], ['4:5', 4 / 5], ['16:9', 16 / 9], ['9:16', 9 / 16],
  ['2:1', 2], ['1:2', 1 / 2], ['21:9', 21 / 9], ['9:21', 9 / 21],
  ['3:1', 3], ['1:3', 1 / 3],
]

function nearestApimartRatio(size) {
  const [w, h] = String(size).split('x').map(Number)
  if (!w || !h) return '1:1'
  const r = w / h
  let best = '1:1'
  let bestDiff = Infinity
  for (const [name, ratio] of APIMART_RATIOS) {
    const diff = Math.abs(Math.log(r / ratio))
    if (diff < bestDiff) {
      bestDiff = diff
      best = name
    }
  }
  return best
}

async function dataUrlToBlob(dataUrl) {
  return await (await fetch(dataUrl)).blob()
}

// 把临时图片链接转成本地 data URL（官方链接 72 小时会过期），失败就用原链接
async function urlToDataUrl(url) {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result || ''))
      fr.onerror = () => resolve('')
      fr.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

async function apimartImage({ baseUrl, apiKey, model, prompt, size, image }) {
  const headers = { Authorization: `Bearer ${apiKey}` }
  const body = { model, prompt, n: 1 }

  if (image) {
    // 图生图：ApiMart 不收 base64，参考图必须先上传成临时 URL
    const fd = new FormData()
    fd.append('file', await dataUrlToBlob(image), 'reference.png')
    const upRes = await fetch(joinUrl(baseUrl, '/uploads/images'), { method: 'POST', headers, body: fd })
    const upJson = await upRes.json().catch(() => ({}))
    const refUrl = upJson?.data?.url || upJson?.url
    if (!upRes.ok || !refUrl) {
      throw new Error(upJson?.error?.message || `参考图上传失败（HTTP ${upRes.status}）`)
    }
    body.image_urls = [refUrl]
  } else if (size) {
    body.size = nearestApimartRatio(size)
    body.resolution = '1k'
  }

  // 提交异步任务
  const res = await fetch(joinUrl(baseUrl, '/images/generations'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: withTimeout(undefined, 60000),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.error?.message || j.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  const submitted = await res.json()
  const taskId = submitted?.data?.[0]?.task_id || submitted?.data?.task_id
  if (!taskId) throw new Error('ApiMart 未返回任务 ID：' + JSON.stringify(submitted).slice(0, 120))

  // 轮询任务状态（每 3 秒，最长 5 分钟；网络抖动/切后台时自动重连续查）
  const deadline = Date.now() + 300000
  let pollFails = 0
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    let poll
    try {
      poll = await fetch(joinUrl(baseUrl, `/tasks/${taskId}`), {
        headers,
        signal: withTimeout(undefined, 30000),
      })
    } catch {
      // 任务在服务端继续跑，这里只是查状态，断线自动重连即可
      if (++pollFails >= 5) throw new Error('任务状态查询连续失败，请检查网络后重试')
      continue
    }
    if (!poll.ok) {
      if (poll.status === 401 || poll.status === 402) {
        let msg = `HTTP ${poll.status}`
        try {
          const j = await poll.json()
          msg = j.error?.message || j.message || msg
        } catch { /* ignore */ }
        throw new Error(msg)
      }
      if (++pollFails >= 5) throw new Error(`任务状态查询失败（HTTP ${poll.status}）`)
      continue
    }
    pollFails = 0
    const j = await poll.json()
    const data = j?.data || {}
    if (data.status === 'completed') {
      // 结果在 data.result.images[0].url[]（注意 url 是数组）
      const urls = data.result?.images?.[0]?.url || []
      const imgUrl = Array.isArray(urls) ? urls[0] : urls
      if (!imgUrl) throw new Error('任务完成但未返回图片地址')
      const local = await urlToDataUrl(imgUrl)
      return local || imgUrl
    }
    if (data.status === 'failed') {
      throw new Error(data.error?.message || j?.error?.message || 'ApiMart 生成失败')
    }
    // submitted / processing → 继续等
  }
  throw new Error('生成超时（超过 5 分钟未完成），可稍后在作品页点「重试」')
}

// 生图这类请求给个总超时，避免网络异常时任务永远挂着（180 秒）
function withTimeout(external, timeoutMs) {
  const t = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : null
  if (external && t && AbortSignal.any) return AbortSignal.any([external, t])
  return external || t || undefined
}

/**
 * 文生图 / 图生图统一入口：按服务商分发（ApiMart 走异步任务，其余走同步接口）。
 * 图生图：image 传参考图（data URL），需要用支持编辑的模型。
 */
export async function generateImage(opts) {
  if (opts.providerId === 'apimart') return apimartImage(opts)
  return openAIImage(opts)
}

async function openAIImage({ providerId, baseUrl, apiKey, model, prompt, size, image, signal }) {
  const body = { model, prompt, n: 1 }
  // 尺寸参数各家叫法不同：硅基流动用 image_size，其余用 size；xAI 两个都不支持
  if (size && providerId !== 'xai') {
    let s = size
    if (/^gpt-image/i.test(model)) {
      // gpt-image 系列只接受 1024x1024 / 1536x1024 / 1024x1536 三种尺寸，按用户选的比例就近映射
      const [w, h] = size.split('x').map(Number)
      s = w === h ? '1024x1024' : w > h ? '1536x1024' : '1024x1536'
    }
    if (providerId === 'siliconflow') body.image_size = s
    else body.size = s
  }
  if (image && providerId !== 'xai') body.image = image

  const res = await fetch(joinUrl(baseUrl, '/images/generations'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: withTimeout(signal, 180000),
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.error?.message || j.message || msg
    } catch { /* 响应不是 JSON 就用状态码 */ }
    throw new Error(msg)
  }

  const url = extractImageUrl(await res.json())
  if (!url) throw new Error('服务返回成功，但没能解析出图片地址')
  return url
}
