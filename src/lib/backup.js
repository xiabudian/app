// 全量备份：配置（含 Key）+ 作品（含提示词与图片本体）
import { Capacitor } from '@capacitor/core'
import { settings } from '../stores/settings'
import { draw } from '../stores/draw'
import { idbGet } from './idb'

export async function buildBackup() {
  const works = []
  for (const r of draw.results) {
    let url = r.url || ''
    if (r.idb && !url) {
      try {
        url = (await idbGet(r.id)) || ''
      } catch { /* ignore */ }
    }
    works.push({ ...r, url, image: undefined })
  }
  return {
    app: 'ai-chat',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: JSON.parse(JSON.stringify(settings)),
    works,
  }
}

// 恢复：配置覆盖 + 作品写回（图片本体转存 IndexedDB）
export function applyBackup(data) {
  const s = data.settings || {}
  for (const [id, p] of Object.entries(s.providers || {})) {
    if (settings.providers[id]) Object.assign(settings.providers[id], p)
  }
  if (Array.isArray(s.userProviders)) settings.userProviders = s.userProviders
  if (typeof s.systemPrompt === 'string') settings.systemPrompt = s.systemPrompt
  if (Array.isArray(s.drawStyles)) settings.drawStyles = s.drawStyles
  if (Array.isArray(s.drawSizes)) settings.drawSizes = s.drawSizes
  if (typeof s.autoDownload === 'boolean') settings.autoDownload = s.autoDownload
  if (typeof s.ttsModel === 'string') settings.ttsModel = s.ttsModel
  if (typeof s.sttModel === 'string') settings.sttModel = s.sttModel
  const has = (id) => id && (settings.providers[id] || settings.userProviders.some((u) => u.id === id))
  if (has(s.chatProvider)) settings.chatProvider = s.chatProvider
  if (has(s.imageProvider)) settings.imageProvider = s.imageProvider

  if (Array.isArray(data.works)) {
    draw.results = data.works.map((r) => ({
      ...r,
      image: undefined,
      loading: false,
    }))
  }
}

// 备份文件落地：APK 存 Documents/AIChat/backup/，网页走浏览器下载
export async function saveBackupFile(json, filename) {
  if (Capacitor.isNativePlatform()) {
    try {
      const Saver = Capacitor.getPlugin('Saver')
      if (!Saver?.saveToDownloads) throw new Error('no saver plugin')
      const b64 = btoa(unescape(encodeURIComponent(json)))
      await Saver.saveToDownloads({ data: b64, name: filename, mime: 'application/json' })
      return 'downloads' // 公共下载目录（文件管理可见）
    } catch { /* 走浏览器下载兜底 */ }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
  return 'download'
}
