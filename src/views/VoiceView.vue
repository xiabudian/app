<script setup>
import { computed, ref, watch } from 'vue'
import { settings, providerRef } from '../stores/settings'
import { showToast } from 'vant'
import { textToSpeech } from '../lib/voice'
import { runComfyTTS } from '../lib/comfy'
import { saveImage } from '../lib/storage'

// 引擎：openai=跟随当前聊天服务商（OpenAI 兼容 TTS）；comfy=ComfyUI 工作流（IndexTTS 等，可克隆音色）
const engine = ref(settings.voice.engine || 'openai')
const text = ref('')
const voice = ref(settings.voice.ttsVoice || 'alloy')
const wfId = ref(settings.voice.comfyWorkflow || '')
const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

const refAudios = ref([])
const running = ref(false)
const audios = ref([]) // {url(data), time, name}

const comfyConf = computed(() => settings.comfy || { baseUrl: '', workflows: [] })
const ttsWorkflows = computed(() => (comfyConf.value.workflows || []).filter((w) => w.type === 'tts'))
const pickedName = computed(() => ttsWorkflows.value.find((w) => w.id === wfId.value)?.name || '')

// 选择变化写回设置，下次进来保持
watch([engine, voice, wfId], () => {
  settings.voice.engine = engine.value
  settings.voice.ttsVoice = voice.value
  settings.voice.comfyWorkflow = wfId.value
})

async function onGenerate() {
  const txt = text.value.trim()
  if (!txt) return showToast('请输入要合成的文本')
  if (running.value) return
  running.value = true
  try {
    const newItems = []
    if (engine.value === 'comfy') {
      const wf = ttsWorkflows.value.find((w) => w.id === wfId.value)
      if (!wf) {
        showToast('请先选择一个 TTS 工作流')
        running.value = false
        return
      }
      const outs = await runComfyTTS({
        baseUrl: settings.comfy.baseUrl,
        workflow: JSON.parse(wf.apiJson),
        bind: wf.bind || {},
        text: txt,
        refDataUrl: refAudios.value[0]?.content || undefined,
      })
      let n = 0
      for (const au of outs) {
        newItems.push({ url: au, time: Date.now() + n++, name: `语音_${Date.now()}_${n}.wav` })
      }
    } else {
      const conf = providerRef(settings.chatProvider) || {}
      if (!conf.baseUrl || !conf.apiKey) {
        showToast('当前对话服务商未配置 Key')
        running.value = false
        return
      }
      const blob = await textToSpeech({
        baseUrl: conf.baseUrl,
        apiKey: conf.apiKey,
        model: settings.ttsModel || 'tts-1',
        text: txt,
        voice: voice.value || 'alloy',
      })
      const du = await new Promise((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result || ''))
        fr.readAsDataURL(blob)
      })
      newItems.push({ url: du, time: Date.now(), name: `语音_${Date.now()}.mp3` })
    }
    audios.value.unshift(...newItems)
    showToast('合成完成，已存到 下载/AIChat/')
    // APK 自动存到 下载/AIChat/
    for (const it of newItems) {
      await saveImage(it.url, it.name).catch(() => {})
    }
    setTimeout(() => {
      const a = document.querySelector('.v-item audio')
      a?.play().catch(() => {})
    }, 100)
  } catch (e) {
    showToast('合成失败：' + (e?.message || e))
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="view voice-view">
    <van-nav-bar title="语音合成" />

    <div class="scroll">
      <!-- 引擎切换 -->
      <div class="voice-card">
        <div class="v-label">合成引擎</div>
        <div class="seg">
          <div class="seg-item" :class="{ on: engine === 'openai' }" @click="engine = 'openai'">在线模型</div>
          <div class="seg-item" :class="{ on: engine === 'comfy' }" @click="engine = 'comfy'">ComfyUI</div>
        </div>

        <template v-if="engine === 'openai'">
          <div class="v-row">
            <span class="v-key">音色</span>
            <div class="v-chips">
              <span
                v-for="v in VOICES"
                :key="v"
                class="v-chip"
                :class="{ on: voice === v }"
                @click="voice = v"
              >{{ v }}</span>
            </div>
          </div>
          <div class="tip">使用「设置 → 对话」当前服务商的地址与 Key（需支持 /v1/audio/speech）</div>
        </template>

        <template v-else>
          <div v-if="!ttsWorkflows.length" class="tip">
            还没有 TTS 工作流：先在「设置 → 通用 → ComfyUI」导入工作流（含 SaveAudio 节点的会被识别为语音）
          </div>
          <div v-else class="v-row">
            <span class="v-key">工作流</span>
            <div class="v-chips">
              <span
                v-for="w in ttsWorkflows"
                :key="w.id"
                class="v-chip"
                :class="{ on: wfId === w.id }"
                @click="wfId = w.id"
              >{{ w.name }}</span>
            </div>
          </div>
          <div class="v-row">
            <span class="v-key">克隆音色</span>
            <van-uploader
              v-model="refAudios"
              accept="audio/*"
              :max-count="1"
              :preview-size="[64, 64]"
              :deletable="true"
            >
              <div class="v-upload-btn">上传参考音频</div>
            </van-uploader>
          </div>
          <div class="tip">参考音频可选：工作流里有 LoadAudio 节点时用于音色克隆（如 IndexTTS）</div>
        </template>
      </div>

      <div class="voice-card">
        <div class="v-label">合成文本（最多 1000 字）</div>
        <textarea v-model="text" maxlength="1000" rows="4" placeholder="输入要朗读的文字…"></textarea>
        <div class="v-count">{{ text.length }}/1000</div>
      </div>

      <div class="v-gen" :class="{ busy: running }" @click="onGenerate">
        {{ running ? '合成中…' : '🔊 立即合成' }}
      </div>

      <div class="v-list">
        <div v-for="a in audios" :key="a.time" class="v-item">
          <audio :src="a.url" controls class="v-audio"></audio>
          <a class="v-dl" :href="a.url" :download="a.name">下载</a>
        </div>
      </div>
      <div v-if="!audios.length" class="works-none">还没有生成的语音</div>
    </div>
  </div>
</template>
