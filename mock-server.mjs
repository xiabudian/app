// 本地演示服务：模拟 OpenAI 兼容的流式接口，让你在没有 API Key 时也能体验完整功能。
// 运行：node mock-server.mjs  （然后在 App 设置里选择「演示模式」）
import http from 'node:http'

// 用 8788 而不是常见的 8787，避免和机器上其他开发服务撞端口
const PORT = process.env.PORT || 8788

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const REPLY = `你好，我是本地演示助手 🤖

这是一条**流式回复**，用来演示打字机效果——文字会一段一段地出现。

## 我能演示什么

- 流式打字机输出
- Markdown 渲染（标题、列表、代码块）
- 多轮对话与历史记录

\`\`\`js
// 甚至还能渲染代码
console.log('Hello, AI!')
\`\`\`

到「设置」页切换为 DeepSeek、Grok 或魔搭社区并填入 API Key，就能和真实模型聊天了。`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sse = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  const url = new URL(req.url, 'http://localhost')

  if (req.method === 'GET' && url.pathname.endsWith('/models')) {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ data: [{ id: 'demo-model' }, { id: 'demo-image-model' }] }))
  }

  // 演示绘图：返回一张程序生成的 SVG 占位图（渐变背景 + 提示词文字）
  if (req.method === 'POST' && url.pathname.endsWith('/images/generations')) {
    let body = ''
    for await (const chunk of req) body += chunk
    let payload = {}
    try {
      payload = JSON.parse(body || '{}')
    } catch { /* ignore */ }

    const raw = (payload.image ? '（图生图）' : '') + (payload.prompt || '未填写提示词')
    const [w0, h0] = String(payload.size || payload.image_size || '1024x1024').split('x')
    const W = Math.min(1024, parseInt(w0, 10) || 1024)
    const H = Math.min(1024, parseInt(h0, 10) || 1024)
    const colors = [
      ['#6366f1', '#a855f7'],
      ['#0ea5e9', '#22d3ee'],
      ['#f59e0b', '#ef4444'],
      ['#10b981', '#84cc16'],
    ][Math.floor(Math.random() * 4)]

    const escapeXml = (s) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
    const lines = []
    for (let i = 0; i < raw.length && lines.length < 6; i += 16) lines.push(raw.slice(i, i + 16))
    const startY = H / 2 - (lines.length - 1) * 15
    const textEls = lines
      .map((l, i) => `<text x="50%" y="${startY + i * 30}" text-anchor="middle" font-size="22" fill="#fff" font-family="sans-serif">${escapeXml(l)}</text>`)
      .join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${textEls}<text x="50%" y="${H - 28}" text-anchor="middle" font-size="16" fill="rgba(255,255,255,0.85)" font-family="sans-serif">✨ 演示模式生成 · ${W}×${H}</text></svg>`

    await sleep(4000)
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      created: Date.now(),
      data: [{ url: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') }],
    }))
  }

  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    let body = ''
    for await (const chunk of req) body += chunk
    let payload = {}
    try {
      payload = JSON.parse(body || '{}')
    } catch { /* ignore */ }

    if (!payload.stream) {
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: REPLY } }] }))
    }

    res.writeHead(200, {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // 先延迟一下再出第一个字，模拟真实模型的首字等待（演示「正在思考…」动画）
    await sleep(1200)
    // 再来两段「思考过程」，演示推理模型的折叠效果
    sse(res, { choices: [{ delta: { role: 'assistant', reasoning_content: '用户打了个招呼，我先演示一下思考过程……' } }] })
    await sleep(400)
    sse(res, { choices: [{ delta: { reasoning_content: '好，现在开始正式回复。' } }] })
    await sleep(300)

    const lastUser = (payload.messages || []).filter((m) => m.role === 'user').pop()
    let text = REPLY
    if (Array.isArray(lastUser?.content)) {
      text = '我收到了你发来的图片 📷（演示模式只是假装看懂了）。继续演示流式输出：\n\n' + REPLY
    }

    for (let i = 0; i < text.length; i += 3) {
      sse(res, { choices: [{ delta: { content: text.slice(i, i + 3) } }] })
      await sleep(25)
    }

    sse(res, { choices: [{ delta: {}, finish_reason: 'stop' }] })
    res.write('data: [DONE]\n\n')
    return res.end()
  }

  res.writeHead(404, CORS)
  res.end('not found')
})

server.listen(PORT, () => {
  console.log(`✅ 演示服务已启动: http://localhost:${PORT}  （在 App 设置里选择「演示模式」即可体验）`)
})
