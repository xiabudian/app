<script setup>
import { watch } from 'vue'
import { ui, TAB } from './stores/ui'
import { draw } from './stores/draw'
import ChatView from './views/ChatView.vue'
import DrawView from './views/DrawView.vue'
import WorksView from './views/WorksView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'

// 回到绘图/作品页时清掉红点
watch(
  () => ui.tab,
  (t) => {
    if (t === TAB.DRAW || t === TAB.WORKS) draw.unseen = 0
  }
)
</script>

<template>
  <div class="app-shell">
    <ChatView v-show="ui.tab === TAB.CHAT" />
    <DrawView v-show="ui.tab === TAB.DRAW" />
    <WorksView v-show="ui.tab === TAB.WORKS" />
    <HistoryView v-show="ui.tab === TAB.HISTORY" />
    <SettingsView v-show="ui.tab === TAB.SETTINGS" />

    <van-tabbar v-model="ui.tab" :fixed="false">
      <van-tabbar-item icon="chat-o">对话</van-tabbar-item>
      <van-tabbar-item icon="photograph">绘图</van-tabbar-item>
      <van-tabbar-item icon="photo-o" :dot="draw.unseen > 0">作品</van-tabbar-item>
      <van-tabbar-item icon="clock-o">历史</van-tabbar-item>
      <van-tabbar-item icon="setting-o">设置</van-tabbar-item>
    </van-tabbar>
  </div>
</template>
