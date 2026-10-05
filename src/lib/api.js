// 核心网络层：调用 OpenAI 兼容接口，逐字读取流式响应
function joinUrl(base, path) {
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

export function describeError(e) {
  if (e?.name === 'AbortError') return '已停止生成'
  const msg = e?.message || String(e)
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return '网络请求失败：请检查网络与服务地址。若用的是演示模式，请先在项目目录运行 node mock-server.mjs'
  }
  if (/\b401\b|unauthorized/i.test(msg)) return 'API Key 无效或未填写（401）'
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

/**
 * 文生图 / 图生图（OpenAI 兼容的 /images/generations 接口）。
 * 图生图：image 传参考图（data URL），需要用支持编辑的模型（如 Qwen-Image-Edit）。
 */
export async function generateImage({ providerId, baseUrl, apiKey, model, prompt, size, image, signal }) {
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

  const url = extractImageUrl(await res.json())
  if (!url) throw new Error('服务返回成功，但没能解析出图片地址')
  return url
}
