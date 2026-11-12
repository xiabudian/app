<script setup>
import { computed, ref } from 'vue'
import { SKILLS } from '../lib/skills'

const props = defineProps({ streaming: Boolean })
const emit = defineEmits(['send', 'stop'])

const text = ref('')
const skillId = ref('')
const pickShow = ref(false)

// 电脑上按 Enter 直接发送，手机上 Enter 换行（用发送按钮发）
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

const canSend = computed(() => !props.streaming && text.value.trim())
const activeSkill = computed(() => SKILLS.find((s) => s.id === skillId.value) || null)

function onEnter(e) {
  if (!isMobile) {
    e.preventDefault()
    doSend()
  }
}

function chooseSkill(id) {
  skillId.value = id
  pickShow.value = false
}

function doSend() {
  if (!canSend.value) return
  emit('send', { text: text.value.trim(), skillId: skillId.value })
  text.value = ''
}
</script>

<template>
  <div class="chat-input">
    <div v-if="activeSkill" class="skill-chip">
      <van-icon name="apps-o" />
      <span class="chip-name">{{ activeSkill.name }}</span>
      <van-icon name="cross" class="chip-x" @click="skillId = ''" />
    </div>
    <div class="input-card">
      <button class="skill-btn" :class="{ active: !!activeSkill }" title="选择技能" @click="pickShow = true">
        <van-icon name="apps-o" />
      </button>
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
    <van-popup :show="pickShow" position="bottom" round @update:show="pickShow = $event">
      <div class="skill-sheet">
        <div class="sheet-title">选择技能</div>
        <div class="skill-item" :class="{ active: !skillId }" @click="chooseSkill('')">
          <div class="si-name">不使用技能</div>
          <div class="si-desc">普通对话，不注入任何提示词模板</div>
        </div>
        <div
          v-for="s in SKILLS"
          :key="s.id"
          class="skill-item"
          :class="{ active: skillId === s.id }"
          @click="chooseSkill(s.id)"
        >
          <div class="si-name">{{ s.name }}</div>
          <div class="si-desc">{{ s.desc }}</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>
