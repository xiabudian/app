<script setup>
import { computed, ref } from 'vue'
import { settings, allProviders, providerRef, removeUserProvider } from '../stores/settings'
import { clearAll } from '../stores/chat'
import { showToast, showConfirmDialog } from 'vant'
import { downloadImage } from '../lib/storage'
import ProviderEditor from '../components/ProviderEditor.vue'

const importInput = ref(null)

// 导出全部配置（含 Key）为 JSON 文件
function exportConfig() {
  const data = {
    app: 'ai-chat',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: JSON.parse(JSON.stringify(settings)),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  downloadImage(url, `ai-chat配置_${new Date().toISOString().slice(0, 10)}.json`)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

// 导入配置：覆盖当前的服务商 / Key / 模型等
function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result)
      const s = data.settings || data
      if (!s.providers) throw new Error('文件里没有配置信息')
      try {
        await showConfirmDialog({ title: '导入配置', message: '将覆盖当前的服务商、Key、模型等设置，继续？' })
      } catch {
        return
      }
      for (const [id, p] of Object.entries(s.providers || {})) {
        if (settings.providers[id]) Object.assign(settings.providers[id], p)
      }
      if (Array.isArray(s.userProviders)) settings.userProviders = s.userProviders
      if (typeof s.systemPrompt === 'string') settings.systemPrompt = s.systemPrompt
      if (Array.isArray(s.drawStyles)) settings.drawStyles = s.drawStyles
      if (Array.isArray(s.drawSizes)) settings.drawSizes = s.drawSizes
      if (typeof s.autoDownload === 'boolean') settings.autoDownload = s.autoDownload
      const has = (id) => id && (settings.providers[id] || settings.userProviders.some((u) => u.id === id))
      if (has(s.chatProvider)) settings.chatProvider = s.chatProvider
      if (has(s.imageProvider)) settings.imageProvider = s.imageProvider
      showToast('配置已导入')
    } catch (err) {
      showToast('导入失败：' + (err?.message || '文件无法解析'))
    }
  }
  reader.readAsText(file)
}

// 顶部三个页签：对话 / 绘图 / 通用，避免一页列两大串服务商
const sec = ref('chat')
const editorShow = ref(false)
const editingId = ref(null) // null = 新增

const chatProviders = computed(() => allProviders())
const drawProviders = computed(() => allProviders().filter((p) => p.imageModels?.length))

// 服务商选择：底部弹窗挑选（服务商多也不用长页面滚动）
const provPicker = ref('') // 'chat' | 'draw' | ''
const provPickOptions = computed(() => (provPicker.value === 'chat' ? chatProviders.value : drawProviders.value))
const provPickCurrent = computed(() => (provPicker.value === 'chat' ? settings.chatProvider : settings.imageProvider))
const chatProvName = computed(() => providerRef(settings.chatProvider)?.name || '未选择')
const chatProvModel = computed(() => providerRef(settings.chatProvider)?.model || '未设置模型')
const drawProvName = computed(() => providerRef(settings.imageProvider)?.name || '未选择')
const drawProvModel = computed(() => providerRef(settings.imageProvider)?.imageModel || '未设置绘图模型')

function chooseProv(id) {
  if (provPicker.value === 'chat') settings.chatProvider = id
  else settings.imageProvider = id
  provPicker.value = ''
}

async function delProv(id) {
  const p = providerRef(id)
  try {
    await showConfirmDialog({ title: '删除服务商', message: `确定删除「${p?.name || '该服务商'}」？其 Key 与模型配置会一并删除。` })
  } catch {
    return
  }
  removeUserProvider(id)
  showToast('已删除')
}

// 绘图选项：设置里存数组，这里用文本框编辑
// 风格一行一个「名称=提示词」（提示词里可以有逗号）；比例逗号分隔「标签=宽x高」
const stylesText = computed({
  get: () => settings.drawStyles.map((s) => `${s.label}=${s.prompt}`).join('\n'),
  set: (v) => {
    settings.drawStyles = v
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf('=')
        if (i > 0) return { label: l.slice(0, i).trim(), prompt: l.slice(i + 1).trim() }
        return { label: l, prompt: `${l}风格` }
      })
      .filter((s) => s.label)
  },
})
const sizesText = computed({
  get: () =>
    settings.drawSizes.map((s) => (s.label && s.label !== s.size ? `${s.label}=${s.size}` : s.size)).join(', '),
  set: (v) => {
    settings.drawSizes = v
      .split(/[,，]/)
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => {
        const i = e.indexOf('=')
        return i > 0
          ? { label: e.slice(0, i).trim(), size: e.slice(i + 1).trim() }
          : { label: e, size: e }
      })
      .filter((s) => /^\d+x\d+$/.test(s.size)) // 格式不对的忽略
  },
})

function openEditor(id) {
  editingId.value = id
  editorShow.value = true
}

function openNew() {
  editingId.value = null
  editorShow.value = true
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
</script>

<template>
  <div class="view settings-view">
    <van-nav-bar title="设置" />
    <div class="scroll">
      <div class="set-seg-wrap">
        <div class="set-seg">
          <div class="set-seg-item" :class="{ on: sec === 'chat' }" @click="sec = 'chat'">
            <van-icon name="chat-o" size="15" />对话
          </div>
          <div class="set-seg-item" :class="{ on: sec === 'draw' }" @click="sec = 'draw'">
            <van-icon name="photograph" size="15" />绘图
          </div>
          <div class="set-seg-item" :class="{ on: sec === 'common' }" @click="sec = 'common'">
            <van-icon name="setting-o" size="15" />通用
          </div>
        </div>
      </div>

      <!-- 对话：选默认聊天服务商 -->
      <template v-if="sec === 'chat'">
        <van-cell-group inset title="对话服务商">
          <van-cell title="当前服务商" :value="chatProvName" is-link @click="provPicker = 'chat'" />
          <van-cell title="默认模型" :value="chatProvModel" is-link @click="openEditor(settings.chatProvider)" />
        </van-cell-group>
        <van-cell-group inset>
          <van-cell title="新增自定义服务商" icon="plus" clickable @click="openNew">
            <template #label>支持添加任意多个 OpenAI 兼容服务（中转站、agens-ai 等）</template>
          </van-cell>
        </van-cell-group>
      </template>

      <!-- 绘图：选默认绘图服务商 -->
      <template v-else-if="sec === 'draw'">
        <van-cell-group inset title="绘图服务商">
          <van-cell title="当前服务商" :value="drawProvName" is-link @click="provPicker = 'draw'" />
          <van-cell title="默认绘图模型" :value="drawProvModel" is-link @click="openEditor(settings.imageProvider)" />
        </van-cell-group>
        <van-cell-group inset>
          <van-cell title="新增自定义服务商" icon="plus" clickable @click="openNew">
            <template #label>在弹窗里填好「绘图模型」，它就会出现在上面的列表里</template>
          </van-cell>
        </van-cell-group>
      </template>

      <!-- 通用 -->
      <template v-else>
        <van-cell-group inset title="通用">
          <van-field
            v-model="settings.systemPrompt"
            type="textarea"
            rows="2"
            autosize
            label="系统提示词"
            placeholder="例如：你是一个乐于助人的中文助手，回答简洁准确。"
          />
        </van-cell-group>

        <van-cell-group inset title="保存与备份">
        <van-cell center title="生成后自动下载图片" label="保存到浏览器的「下载」文件夹；下载位置可在浏览器设置中修改">
          <template #right-icon>
            <van-switch v-model="settings.autoDownload" size="22" />
          </template>
        </van-cell>
        <van-cell title="导出配置（含 API Key）" is-link @click="exportConfig" />
        <van-cell title="导入配置" is-link @click="importInput.click()" />
        <input ref="importInput" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />
      </van-cell-group>

      <van-cell-group inset title="绘图选项（在绘图页用下拉框选择）">
          <van-field
            v-model="stylesText"
            type="textarea"
            rows="4"
            autosize
            label="风格选项"
            placeholder="每行一个：名称=要追加的固定提示词"
          />
          <van-field
            v-model="sizesText"
            label="比例选项"
            placeholder="1:1 方图=1024x1024, 3:4 竖图=768x1024"
          />
          <van-cell
            title="格式说明"
            label="风格：每行一个「名称=固定提示词」，生成时会把它追加到你的描述后面，提示词里可以有逗号；只写名称则追加「名称风格」。比例：逗号分隔「标签=宽x高」，格式不对的会被忽略。"
          />
        </van-cell-group>

        <div class="btns">
          <van-button block round plain type="danger" @click="onClear">清空全部对话</van-button>
        </div>

        <div class="tip">
          API Key 和聊天记录只保存在你本机浏览器中（localStorage），请求由本机直连服务商，不经过任何第三方服务器。
        </div>
      </template>

      <div style="height: 16px"></div>
    </div>

    <!-- 服务商选择弹窗（列表可滚动，不受数量影响） -->
    <van-popup :show="provPicker !== ''" position="bottom" round @update:show="provPicker = ''">
      <div class="pp-head">选择{{ provPicker === 'chat' ? '对话' : '绘图' }}服务商</div>
      <div class="pp-list">
        <div v-for="p in provPickOptions" :key="p.id" class="pp-item" @click="chooseProv(p.id)">
          <div class="pp-info">
            <div class="pp-name">{{ p.name }}</div>
            <div class="pp-model">{{ (provPicker === 'chat' ? p.model : p.imageModel) || '未设置模型' }}</div>
          </div>
          <div class="pp-actions">
            <van-icon name="edit" size="16" @click.stop="openEditor(p.id)" />
            <van-icon v-if="!p.builtin" name="delete-o" size="16" @click.stop="delProv(p.id)" />
            <van-icon v-if="provPickCurrent === p.id" name="checked" color="#111111" size="18" />
          </div>
        </div>
      </div>
      <div class="pp-add" @click="openNew"><van-icon name="plus" size="14" /> 新增自定义服务商</div>
    </van-popup>

    <ProviderEditor v-model:show="editorShow" :provider-id="editingId" />
  </div>
</template>
