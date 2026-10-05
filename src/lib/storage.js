// localStorage 的读写封装：所有数据（Key、对话记录）都只存在本机浏览器里
export const KEYS = {
  settings: 'ai-chat.settings.v1',
  conversations: 'ai-chat.conversations.v1',
  draws: 'ai-chat.draws.v1',
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    console.warn('读取本地数据失败', e)
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('保存本地数据失败（可能是空间不足）', e)
  }
}

// 把上传的图片压到最长边 1024px 的 JPEG，否则 base64 存 localStorage 很容易超容量
export function compressImage(dataUrl, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl) // 压缩失败就直接用原图
    img.src = dataUrl
  })
}

// 触发浏览器下载：http/data 链接都先转 blob，保证 download 文件名生效
export async function downloadImage(url, filename) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(obj), 3000)
  } catch {
    // 兜底：直接用原链接下载
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.click()
  }
}
