<script setup>
import { computed, ref } from 'vue'
import { chat, openConversation, deleteConversation, deleteConversations, newConversation, clearAll } from '../stores/chat'
import { ui, TAB } from '../stores/ui'
import { showToast, showConfirmDialog } from 'vant'

const managing = ref(false) // 批量管理模式
const selectedIds = ref([])

const list = computed(() => [...chat.conversations].sort((a, b) => b.updatedAt - a.updatedAt))
const allSelected = computed(() => list.value.length > 0 && selectedIds.value.length === list.value.length)

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

function onCardClick(c) {
  if (managing.value) toggleSelect(c.id)
  else open(c)
}

function toggleManage() {
  managing.value = !managing.value
  selectedIds.value = []
}

function toggleSelect(id) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : list.value.map((c) => c.id)
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

async function batchDelete() {
  if (!selectedIds.value.length) return showToast('请先选择要删除的对话')
  try {
    await showConfirmDialog({ title: '批量删除', message: `确定删除选中的 ${selectedIds.value.length} 个对话？删除后无法恢复。` })
  } catch {
    return
  }
  const n = selectedIds.value.length
  deleteConversations(selectedIds.value)
  selectedIds.value = []
  managing.value = false
  showToast(`已删除 ${n} 个对话`)
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
  <div class="view history-view" :class="{ managing }">
    <van-nav-bar title="历史对话">
      <template #right>
        <div class="nav-actions">
          <span v-if="list.length" class="nav-manage" @click="toggleManage">
            <van-icon :name="managing ? 'cross' : 'delete-o'" size="14" />
            {{ managing ? '完成' : '管理' }}
          </span>
          <van-icon name="plus" size="18" class="nav-plus" @click="onNew" />
        </div>
      </template>
    </van-nav-bar>

    <div v-if="!list.length" class="hero-empty">
      <div class="hero-logo">🕓</div>
      <div class="hero-title">还没有对话记录</div>
      <p class="hero-sub">每一次对话都会自动保存在这里<br />随时可以回来继续聊</p>
      <van-button round type="primary" @click="onNew">开始新对话</van-button>
    </div>

    <div v-else class="list">
      <van-swipe-cell v-for="c in list" :key="c.id">
        <div class="conv-card" :class="{ active: c.id === chat.currentId }" @click="onCardClick(c)">
          <div class="conv-top">
            <span v-if="managing" class="conv-check" :class="{ on: selectedIds.includes(c.id) }" @click.stop="toggleSelect(c.id)">
              <van-icon v-if="selectedIds.includes(c.id)" name="success" size="12" />
            </span>
            <span class="conv-title">{{ c.title }}</span>
            <span class="conv-time">{{ fmt(c.updatedAt) }}</span>
          </div>
          <div class="conv-preview">{{ preview(c) }}</div>
        </div>
        <template #right>
          <van-button square type="danger" text="删除" class="del-btn" @click="del(c)" />
        </template>
      </van-swipe-cell>
    </div>

    <!-- 固定在底部：普通模式显示清空全部；管理模式显示全选 + 批量删除 -->
    <div v-if="list.length" class="history-foot" :class="{ managing }">
      <template v-if="managing">
        <van-button round plain @click="toggleAll">
          {{ allSelected ? '取消全选' : '全选' }}
        </van-button>
        <van-button round type="danger" :disabled="!selectedIds.length" @click="batchDelete">
          删除（{{ selectedIds.length }}）
        </van-button>
      </template>
      <van-button v-else size="small" plain round type="danger" @click="onClear">清空全部记录</van-button>
    </div>
  </div>
</template>
