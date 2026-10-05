<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { showToast, showImagePreview } from 'vant'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  msg: { type: Object, required: true },
  isLast: Boolean,
})
defineEmits(['regenerate'])

// 模型输出大多是 Markdown，渲染成 HTML 前必须用 DOMPurify 消毒，防止注入
const rendered = computed(() => {
  if (props.msg.role !== 'assistant') return ''
  return DOMPurify.sanitize(marked.parse(props.msg.content || ''))
})

async function copyText() {
  try {
    await navigator.clipboard.writeText(props.msg.content || '')
    showToast('已复制')
  } catch {
    showToast('复制失败')
  }
}
</script>

<template>
  <div class="msg" :class="msg.role">
    <div class="avatar" :class="msg.role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
    <div class="body">
      <details v-if="msg.reasoning" class="reason" :open="!!msg.reasoning && !!msg.streaming">
        <summary>💭 思考过程</summary>
        <div class="reason-body">{{ msg.reasoning }}</div>
      </details>

      <div v-if="msg.images && msg.images.length" class="imgs">
        <van-image
          v-for="(im, k) in msg.images"
          :key="k"
          :src="im"
          width="110"
          height="110"
          fit="cover"
          radius="8"
          @click="showImagePreview(msg.images, k)"
        />
      </div>

      <template v-if="msg.role === 'assistant'">
        <!-- 等待首字：三点跳动动画，避免看起来像卡死 -->
        <div v-if="msg.streaming && msg.waiting" class="thinking">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="thinking-txt">正在思考…</span>
        </div>
        <div v-else class="bubble md" :class="{ streaming: msg.streaming }" v-html="rendered"></div>
      </template>
      <div v-else class="bubble" :class="{ streaming: msg.streaming }">{{ msg.content }}</div>

      <div v-if="msg.error" class="error">{{ msg.error }}</div>

      <div v-if="!msg.streaming" class="meta">
        <span v-if="msg.role === 'assistant'" class="act" @click="copyText">复制</span>
        <span v-if="msg.role === 'assistant' && isLast" class="act" @click="$emit('regenerate')">重新生成</span>
      </div>
    </div>
  </div>
</template>
