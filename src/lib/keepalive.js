// 生成期间的保活：APK 里启动前台服务（切到其他应用连接不断），网页端用屏幕常亮锁
import { Capacitor } from '@capacitor/core'

let wakeLock = null

export async function startKeepAlive() {
  try {
    if (Capacitor.isNativePlatform()) {
      const FGS = Capacitor.getPlugin('ForegroundService')
      if (FGS?.startForegroundService) {
        await FGS.startForegroundService({
          id: 1001,
          title: 'AI 聊天助手',
          body: '正在生成内容，可切换到其他应用',
        })
      }
      return
    }
    // 网页端：屏幕常亮锁（Chrome / Edge 支持）
    if (navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener?.('release', () => {
        wakeLock = null
      })
    }
  } catch (e) {
    console.warn('保活启动失败（不影响使用）', e)
  }
}

export async function stopKeepAlive() {
  try {
    if (Capacitor.isNativePlatform()) {
      const FGS = Capacitor.getPlugin('ForegroundService')
      if (FGS?.stopForegroundService) await FGS.stopForegroundService()
    }
  } catch { /* ignore */ }
  try {
    await wakeLock?.release()
  } catch { /* ignore */ }
  wakeLock = null
}
