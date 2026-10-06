import { reactive } from 'vue'
import { showToast } from 'vant'
import { loadJSON, saveJSON, KEYS } from '../lib/storage'
import { streamChat, describeError } from '../lib/api'
import { settings, providerRef } from './settings'
import { appVisibility } from './ui'
import { startKeepAlive, stopKeepAlive } from '../lib/keepalive'

export const chat = reactive({
  conversations: loadJSON(KEYS.conversations, []),
  currentId: null,
  streaming: false,
  abortCtrl: null,
})

// 从 localStorage 恢复的历史消息可能带着残留的 streaming/waiting 标记，统一清掉
for (const c of chat.conversations) {
  for (const m of c.messages || []) {
    m.streaming = false
    m.waiting = false
  }
}

let seq = Date.now()
const genId = () => `${seq++}-${Math.random().toString(36).slice(2, 8)}`

export function currentConv() {
  return chat.conversations.find((c) => c.id === chat.currentId) || null
}

function persist() {
  saveJSON(KEYS.conversations, JSON.parse(JSON.stringify(chat.conversations)))
}

export function newConversation() {
  const conv = { id: genId(), title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
  chat.conversations.unshift(conv)
  chat.currentId = conv.id
  persist()
  // 返回响应式代理而不是原始对象，否则外部对它的修改不会触发界面更新
  return chat.conversations[0]
}

export function openConversation(id) {
  chat.currentId = id
}

export function deleteConversation(id) {
  if (id === chat.currentId && chat.streaming) stopStreaming()
  const i = chat.conversations.findIndex((c) => c.id === id)
  if (i >= 0) chat.conversations.splice(i, 1)
  if (chat.currentId === id) chat.currentId = chat.conversations[0]?.id ?? null
  persist()
}

export function deleteConversations(ids) {
  const set = new Set(ids)
  chat.conversations = chat.conversations.filter((c) => !set.has(c.id))
  if (chat.currentId && set.has(chat.currentId)) chat.currentId = chat.conversations[0]?.id ?? null
  persist()
}

export function clearAll() {
  if (chat.streaming) stopStreaming()
  chat.conversations = []
  chat.currentId = null
  persist()
}

export function stopStreaming() {
  chat.abortCtrl?.abort()
}

// 带图片时按 OpenAI 多模态格式组装 content，纯文本时直接用字符串
function buildContent(m) {
  if (m.images && m.images.length) {
    return [
      { type: 'text', text: m.content || '（图片）' },
      ...m.images.map((u) => ({ type: 'image_url', image_url: { url: u } })),
    ]
  }
  return m.content || ''
}

export async function sendMessage(text, images = []) {
  if (chat.streaming) return
  if (!text && !images.length) return

  const pid = settings.chatProvider
  const conf = providerRef(pid)
  if (!conf?.baseUrl || (!conf?.apiKey && pid !== 'demo')) {
    showToast('请先到「设置」填写 API Key')
    return 'need-setup'
  }

  let conv = currentConv()
  if (!conv) conv = newConversation()

  conv.messages.push({ role: 'user', content: text, images, time: Date.now() })
  // 第一条消息自动作为对话标题
  const firstUser = conv.messages.find((m) => m.role === 'user')
  if (conv.messages.filter((m) => m.role === 'user').length === 1 && firstUser) {
    conv.title = (firstUser.content || '图片对话').slice(0, 20)
  }
  await generate(conv)
}

export async function regenerate(conv) {
  if (chat.streaming || !conv) return
  while (conv.messages.length && conv.messages[conv.messages.length - 1].role === 'assistant') {
    conv.messages.pop()
  }
  if (!conv.messages.length) return
  await generate(conv)
}

async function generate(conv) {
  conv.messages.push({ role: 'assistant', content: '', reasoning: '', images: [], time: Date.now(), streaming: true, waiting: true })
  // 注意：必须通过响应式代理修改消息（直接改 push 进去的原始对象，界面不会更新）
  const assistant = conv.messages[conv.messages.length - 1]
  conv.updatedAt = Date.now()
  chat.streaming = true
  chat.abortCtrl = new AbortController()
  await startKeepAlive() // 生成期间保活：切到其他应用连接不断

  const conf = providerRef(settings.chatProvider)
  try {
    await streamChat({
      baseUrl: conf.baseUrl,
      apiKey: conf.apiKey,
      model: conf.model,
      systemPrompt: settings.systemPrompt,
      signal: chat.abortCtrl.signal,
      messages: conv.messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.content || m.reasoning)))
        .map((m) => ({ role: m.role, content: buildContent(m) })),
      onDelta(t) {
        assistant.waiting = false
        assistant.content += t
      },
      onReasoning(t) {
        assistant.waiting = false
        assistant.reasoning += t
      },
    })
    if (!assistant.content && !assistant.reasoning) assistant.content = '（模型返回了空回复）'
  } catch (e) {
    if (e?.name === 'AbortError') {
      if (!assistant.content) assistant.content = '（已停止生成）'
    } else {
      assistant.error = describeError(e, settings.chatProvider)
      // 请求期间切过后台 → 系统会冻结连接，提示用户一键重发
      const bgInt = !appVisibility.visible || Date.now() - appVisibility.lastHiddenAt < 30000
      if (bgInt && /网络请求失败|超时/.test(assistant.error)) {
        assistant.error += '（切后台导致连接中断，点「重新生成」可重发）'
      }
      if (!assistant.content) assistant.content = '生成失败'
    }
  } finally {
    assistant.streaming = false
    await stopKeepAlive()
    chat.streaming = false
    chat.abortCtrl = null
    persist()
  }
}
