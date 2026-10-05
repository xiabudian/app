<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { chat, currentConv, newConversation, sendMessage, regenerate, stopStreaming } from '../stores/chat'
import { settings, providerRef } from '../stores/settings'
import { ui, TAB } from '../stores/ui'
import MessageBubble from '../components/MessageBubble.vue'
import ChatInput from '../components/ChatInput.vue'

const listRef = ref(null)
const conv = computed(() => currentConv())

function scrollBottom() {
  nextTick(() => {
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// 依赖最后一条消息的内容长度：流式输出每变一下就自动滚到底部
watch(
  () => {
    const ms = conv.value?.messages
    if (!ms || !ms.length) return 0
    const last = ms[ms.length - 1]
    return ms.length * 100000 + last.content.length + (last.reasoning?.length || 0)
  },
  scrollBottom,
  { flush: 'post', immediate: true }
)

async function onSend({ text, images }) {
  const r = await sendMessage(text, images)
  if (r === 'need-setup') ui.tab = TAB.SETTINGS
}

function onNew() {
  newConversation()
  scrollBottom()
}
</script>

<template>
  <div class="view chat-view">
    <van-nav-bar :title="conv && conv.messages.length ? conv.title : 'AI 聊天'">
      <template #right>
        <van-icon name="plus" size="18" class="nav-plus" @click="onNew" />
      </template>
    </van-nav-bar>

    <div ref="listRef" class="msg-list">
      <template v-if="conv && conv.messages.length">
        <MessageBubble
          v-for="(m, i) in conv.messages"
          :key="i"
          :msg="m"
          :is-last="i === conv.messages.length - 1"
          @regenerate="regenerate(conv)"
        />
      </template>
      <div v-else class="hero-empty">
        <div class="hero-logo">🤖</div>
        <div class="hero-title">AI 聊天助手</div>
        <p class="hero-sub">
          支持 DeepSeek、Grok、魔搭社区等多个模型<br />
          {{ providerRef(settings.chatProvider)?.apiKey ? '在下方输入框开始对话吧' : '先去「设置」选择服务商并填写 API Key' }}
        </p>
        <van-button
          v-if="!providerRef(settings.chatProvider)?.apiKey"
          round
          type="primary"
          size="small"
          @click="ui.tab = TAB.SETTINGS"
        >
          去设置
        </van-button>
      </div>
    </div>

    <ChatInput :streaming="chat.streaming" @send="onSend" @stop="stopStreaming" />
  </div>
</template>
