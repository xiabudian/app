// 语音：文本合成（TTS）与录音转文字（STT），OpenAI 兼容接口，主流中转站通用
import { joinUrl } from './api'

export async function textToSpeech({ baseUrl, apiKey, model = 'tts-1', text, voice = 'alloy' }) {
  const res = await fetch(joinUrl(baseUrl, '/audio/speech'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text.slice(0, 3000), voice, response_format: 'mp3' }),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.error?.message || j.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return await res.blob()
}

export async function transcribeAudio({ baseUrl, apiKey, model = 'whisper-1', file }) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'recording.webm')
  fd.append('model', model)
  const res = await fetch(joinUrl(baseUrl, '/audio/transcriptions'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
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
  return j.text || ''
}

// 去掉 Markdown 符号再朗读，听感更自然
export function plainText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, '（代码省略）')
    .replace(/[#*`>_~|]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
