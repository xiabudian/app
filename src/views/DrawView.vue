<script setup>
import { computed, ref, watch } from 'vue'
import { showToast } from 'vant'
import { settings, providerRef, allProviders } from '../stores/settings'
import { draw, generateDraw } from '../stores/draw'
import { ui, TAB } from '../stores/ui'
import { compressImage } from '../lib/storage'

const mode = ref('text') // text=文生图 / image=图生图
const prompt = ref('')
const style = ref('')
const size = ref('1024x1024')
const refFiles = ref([])

// 服务商和默认模型都在「设置」里配置，这里只读出来展示
const conf = computed(() => providerRef(settings.imageProvider) || providerRef('demo'))
const drawableProviders = computed(() => allProviders().filter((p) => p.imageModels?.length))
const statusText = computed(() =>
  `${conf.value?.name || '未选择服务商'} · ${conf.value?.imageModel || '未设置绘图模型'}`
)
const runningCount = computed(() => draw.results.filter((r) => r.loading).length)

// 风格 / 比例选项来自「设置 → 通用」，这里做成下拉框
const styleOptions = computed(() => [
  { text: '不使用', value: '' },
  ...settings.drawStyles.map((s) => ({ text: s.label, value: s.label })),
])
const sizeOptions = computed(() =>
  settings.drawSizes.map((s) => ({ text: s.label, value: s.size }))
)
// 底部弹出式选择器
const pickShow = ref(false)
const pickType = ref('style')
const pickOptions = computed(() => (pickType.value === 'style' ? styleOptions.value : sizeOptions.value))
const pickCurrent = computed(() => (pickType.value === 'style' ? style.value : size.value))
const styleText = computed(() => styleOptions.value.find((o) => o.value === style.value)?.text || '不使用')
const sizeText = computed(() => sizeOptions.value.find((o) => o.value === size.value)?.text || size.value)

function openPick(t) {
  pickType.value = t
  pickShow.value = true
}

function choose(v) {
  if (pickType.value === 'style') style.value = v
  else size.value = v
  pickShow.value = false
}

// 设置里删掉了当前选中的项时，自动回落
watch(styleOptions, (o) => {
  if (!o.some((x) => x.value === style.value)) style.value = ''
})
watch(sizeOptions, (o) => {
  if (o.length && !o.some((x) => x.value === size.value)) size.value = o[0].value
})

async function afterRead(status) {
  const items = Array.isArray(status) ? status : [status]
  for (const it of items) {
    it.content = await compressImage(it.content)
    it.url = it.content
  }
}

function onOversize() {
  showToast('参考图不能超过 10MB')
}

async function onGenerate() {
  if (mode.value === 'image' && !refFiles.value.length) {
    showToast('请先上传参考图')
    return
  }
  if (!prompt.value.trim() && mode.value === 'text') {
    showToast('请先输入提示词')
    return
  }
  const image = mode.value === 'image' ? refFiles.value[0]?.content : ''
  const stylePrompt = settings.drawStyles.find((s) => s.label === style.value)?.prompt || ''
  const r = await generateDraw({ prompt: prompt.value.trim(), size: size.value, image, stylePrompt })
  if (r === 'need-setup') ui.tab = TAB.SETTINGS
}
</script>

<template>
  <div class="view draw-view">
    <van-nav-bar title="AI 绘图" />

    <div class="scroll">
      <!-- 当前使用的服务商与模型（在「设置」里改默认，点这里可跳过去） -->
      <div class="draw-status" @click="ui.tab = TAB.SETTINGS">
        <span class="dot"></span>
        <span class="txt">{{ statusText }}</span>
        <van-icon name="arrow" size="12" />
      </div>

      <template v-if="!conf?.imageModels?.length">
        <van-notice-bar wrapable :scrollable="false" text="当前绘图服务商不支持绘图，点下面的标签快速切换" />
        <div class="switch-row">
          <van-tag
            v-for="p in drawableProviders"
            :key="p.id"
            size="large"
            plain
            type="primary"
            @click="settings.imageProvider = p.id"
          >
            {{ p.name }}
          </van-tag>
        </div>
      </template>

      <!-- 画面描述卡片 -->
      <div class="draw-card">
        <div class="seg">
          <div class="seg-item" :class="{ on: mode === 'text' }" @click="mode = 'text'">
            <van-icon name="edit" />文生图
          </div>
          <div class="seg-item" :class="{ on: mode === 'image' }" @click="mode = 'image'">
            <van-icon name="photo-o" />图生图
          </div>
        </div>

        <div v-if="mode === 'image'" class="ref-uploader">
          <van-uploader
            v-model="refFiles"
            :max-count="1"
            :after-read="afterRead"
            :preview-size="[64, 64]"
            :max-size="10 * 1024 * 1024"
            @oversize="onOversize"
          />
          <div class="tip">上传参考图，用支持编辑的模型（如 Qwen-Image-Edit），下方描述要怎么改</div>
        </div>

        <textarea
          v-model="prompt"
          class="prompt-input"
          maxlength="500"
          rows="3"
          :placeholder="mode === 'text'
            ? '描述你想要的画面，例如：一只戴宇航员头盔的橘猫，漂浮在星空中，电影感'
            : '描述如何修改参考图，例如：把背景换成樱花盛开的公园'"
        ></textarea>
        <div class="prompt-count">{{ prompt.length }}/500</div>
      </div>

      <!-- 风格与比例：点卡片从底部弹出选项列表，选项在「设置 → 通用」里自定义 -->
      <div class="pick-row">
        <div class="pick" @click="openPick('style')">
          <div class="pick-main">
            <div class="pick-label">风格</div>
            <div class="pick-value">{{ styleText }}</div>
          </div>
          <van-icon name="arrow-down" size="12" />
        </div>
        <div class="pick" @click="openPick('size')">
          <div class="pick-main">
            <div class="pick-label">比例</div>
            <div class="pick-value">{{ sizeText }}</div>
          </div>
          <van-icon name="arrow-down" size="12" />
        </div>
      </div>

      <van-popup :show="pickShow" position="bottom" round @update:show="pickShow = $event">
        <div class="picker-title">{{ pickType === 'style' ? '🎨 选择风格' : '📐 选择比例' }}</div>
        <div class="picker-list">
          <div
            v-for="o in pickOptions"
            :key="o.value"
            class="picker-item"
            :class="{ on: o.value === pickCurrent }"
            @click="choose(o.value)"
          >
            <span>{{ o.text }}</span>
            <van-icon v-if="o.value === pickCurrent" name="checked" color="#3b6ef5" size="18" />
          </div>
        </div>
      </van-popup>

      <!-- 生成按钮：可在后台生成，随时切去别的页面 -->
      <div class="gen-btn" @click="onGenerate">✨ 立即生成</div>

      <div class="works-hint">
        {{
          runningCount
            ? `⏳ 正在后台生成 ${runningCount} 张，完成后会通知你，可随时离开此页`
            : '生成的图片会保存到「作品」菜单，点底部图片图标查看'
        }}
      </div>
    </div>
  </div>
</template>
