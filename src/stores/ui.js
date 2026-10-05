import { reactive } from 'vue'

// 各页面在底部导航中的位置
export const TAB = { CHAT: 0, DRAW: 1, WORKS: 2, HISTORY: 3, SETTINGS: 4 }

// 极简的全局 UI 状态：当前在哪个 Tab
export const ui = reactive({ tab: TAB.CHAT })
