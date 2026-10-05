<script setup>
import { computed } from 'vue'
import { chat, openConversation, deleteConversation, newConversation, clearAll } from '../stores/chat'
import { ui, TAB } from '../stores/ui'
import { showToast, showConfirmDialog } from 'vant'

const list = computed(() => [...chat.conversations].sort((a, b) => b.updatedAt - a.updatedAt))

function preview(c) {
  const m = c.messages[c.messages.length - 1]
  if (!m) return '暂无消息'
  const img = m.images && m.images.length ? '[图片] ' : ''
  return img + (m.content || '').replace(/\s+/g, ' ').slice(0, 40)
}

function fmt(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `${p(d.getHours())}:${p(d.getMinutes())}`
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function open(c) {
  openConversation(c.id)
  ui.tab = TAB.CHAT
}

async function del(c) {
  try {
    await showConfirmDialog({ title: '删除对话', message: `确定删除「${c.title}」？删除后无法恢复。` })
  } catch {
    return
  }
  deleteConversation(c.id)
  showToast('已删除')
}

async function onClear() {
  try {
    await showConfirmDialog({ title: '清空全部', message: '将删除所有对话记录，无法恢复！' })
  } catch {
    return
  }
  clearAll()
  showToast('已清空')
}

function onNew() {
  newConversation()
  ui.tab = TAB.CHAT
}
</script>

<template>
  <div class="view history-view">
    <van-nav-bar title="历史对话">
      <template #right>
        <van-icon name="plus" size="18" class="nav-plus" @click="onNew" />
      </template>
    </van-nav-bar>

    <div v-if="!list.length" class="hero-empty">
      <div class="hero-logo">🕓</div>
      <div class="hero-title">还没有对话记录</div>
      <p class="hero-sub">每一次对话都会自动保存在这里<br />随时可以回来继续聊</p>
      <van-button round type="primary" size="small" @click="onNew">开始新对话</van-button>
    </div>

    <div v-else class="list">
      <van-swipe-cell v-for="c in list" :key="c.id">
        <div class="conv-card" :class="{ active: c.id === chat.currentId }" @click="open(c)">
          <div class="conv-top">
            <span class="conv-title">{{ c.title }}</span>
            <span class="conv-time">{{ fmt(c.updatedAt) }}</span>
          </div>
          <div class="conv-preview">{{ preview(c) }}</div>
        </div>
        <template #right>
          <van-button square type="danger" text="删除" class="del-btn" @click="del(c)" />
        </template>
      </van-swipe-cell>
      <div class="clear-wrap">
        <van-button size="small" plain round type="danger" @click="onClear">清空全部记录</van-button>
      </div>
    </div>
  </div>
</template>
