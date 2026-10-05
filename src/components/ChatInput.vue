<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ streaming: Boolean })
const emit = defineEmits(['send', 'stop'])

const text = ref('')

// 电脑上按 Enter 直接发送，手机上 Enter 换行（用发送按钮发）
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

const canSend = computed(() => !props.streaming && text.value.trim())

function onEnter(e) {
  if (!isMobile) {
    e.preventDefault()
    doSend()
  }
}

function doSend() {
  if (!canSend.value) return
  emit('send', { text: text.value.trim() })
  text.value = ''
}
</script>

<template>
  <div class="chat-input">
    <div class="input-card">
      <van-field
        v-model="text"
        type="textarea"
        rows="1"
        :autosize="{ maxHeight: 96 }"
        placeholder="输入消息…"
        @keydown.enter.exact="onEnter"
      />
      <button
        v-if="streaming"
        class="send-btn stop"
        title="停止生成"
        @click="emit('stop')"
      >
        <van-icon name="stop-circle-o" />
      </button>
      <button v-else class="send-btn" title="发送" :disabled="!canSend" @click="doSend">
        <van-icon name="arrow-up" />
      </button>
    </div>
  </div>
</template>
