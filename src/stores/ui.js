import { reactive } from 'vue'

// 各页面在底部导航中的位置
export const TAB = { CHAT: 0, DRAW: 1, VOICE: 2, WORKS: 3, HISTORY: 4, SETTINGS: 5 }

// 极简的全局 UI 状态：当前在哪个 Tab
export const ui = reactive({ tab: TAB.CHAT })

// 记录 App 切后台/回前台的时机，用于识别“切后台导致连接中断”
export const appVisibility = reactive({ visible: true, lastHiddenAt: 0 })

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    appVisibility.visible = document.visibilityState === 'visible'
    if (!appVisibility.visible) appVisibility.lastHiddenAt = Date.now()
  })
}
