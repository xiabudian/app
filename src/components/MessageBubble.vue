<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { showToast, showImagePreview } from 'vant'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  msg: { type: Object, required: true },
  isLast: Boolean,
})
defineEmits(['regenerate'])

// 流式输出时的实时计时：让「生成中」状态始终可感知，不像卡住
const elapsed = ref(0)
let timer = null
watch(
  () => props.msg.streaming,
  (on) => {
    if (on) {
      const start = props.msg.time || Date.now()
      elapsed.value = Math.max(0, Math.round((Date.now() - start) / 1000))
      timer = setInterval(() => {
        elapsed.value = Math.round((Date.now() - start) / 1000)
      }, 1000)
    } else if (timer) {
      clearInterval(timer)
      timer = null
    }
  },
  { immediate: true }
)
onUnmounted(() => timer && clearInterval(timer))

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
        <template v-else>
          <div class="bubble md" :class="{ streaming: msg.streaming }" v-html="rendered"></div>
          <button
            v-if="!msg.streaming && msg.content"
            class="b-copy"
            title="复制全文"
            @click="copyText"
          >
            ⧉ 复制
          </button>
          <div v-if="msg.streaming" class="stream-meta">
            <van-loading size="12" />
            <span>生成中 · {{ elapsed }}s</span>
          </div>
        </template>
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
