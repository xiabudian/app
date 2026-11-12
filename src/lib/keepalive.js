// 生成期间的保活：APK 里启动前台服务（切到其他应用连接不断），网页端用屏幕常亮锁
import { Capacitor, registerPlugin } from '@capacitor/core'

let wakeLock = null

export async function startKeepAlive() {
  try {
    if (Capacitor.isNativePlatform()) {
      const FGS = registerPlugin('ForegroundService')
      await FGS.startForegroundService({
        id: 1001,
        title: 'AI 聊天助手',
        body: '正在生成内容，可切换到其他应用',
      })
      // 防 WebView 暂停：切后台后安卓会暂停 JS，SSE 流没人消费就被服务商掐断，
      // 这里周期性唤醒 WebView 让流式回复在后台继续（随前台服务一起启停）
      try {
        await registerPlugin('WebViewKeeper').startKeepResuming()
      } catch { /* 不影响主流程 */ }
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
      try {
        await registerPlugin('WebViewKeeper').stopKeepResuming()
      } catch { /* ignore */ }
      await registerPlugin('ForegroundService').stopForegroundService()
    }
  } catch { /* ignore */ }
  try {
    await wakeLock?.release()
  } catch { /* ignore */ }
  wakeLock = null
}
