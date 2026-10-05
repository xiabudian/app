<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { draw, removeWork, removeWorks, retryDraw } from '../stores/draw'
import { ui, TAB } from '../stores/ui'
import { showImagePreview, showConfirmDialog, showToast } from 'vant'

const managing = ref(false) // 批量管理模式
const selectedIds = ref([])

const detailShow = ref(false)
const detailItem = ref(null)

const allSelected = computed(() => draw.results.length > 0 && selectedIds.value.length === draw.results.length)

// 进行中的任务列表 + 实时计时
const runningList = computed(() => draw.results.filter((r) => r.loading))
const now = ref(Date.now())
let timer = null
watch(
  () => runningList.value.length,
  (n) => {
    if (n > 0 && !timer) {
      now.value = Date.now()
      timer = setInterval(() => (now.value = Date.now()), 1000)
    } else if (n === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  },
  { immediate: true }
)
onUnmounted(() => timer && clearInterval(timer))

function elapsed(t) {
  return Math.max(1, Math.round((now.value - t.time) / 1000))
}

function fmtDur(s) {
  if (s == null) return ''
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}分${Math.round(s % 60)}秒`
}

function showDetail(r) {
  detailItem.value = r
  detailShow.value = true
}

function fmtTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(detailItem.value.prompt || '')
    showToast('提示词已复制')
  } catch {
    showToast('复制失败')
  }
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
  selectedIds.value = allSelected.value ? [] : draw.results.map((r) => r.id)
}

function onThumbClick(r) {
  if (managing.value) toggleSelect(r.id)
  else showImagePreview([r.url])
}

async function del(id) {
  try {
    await showConfirmDialog({ title: '删除作品', message: '确定删除这张图片？' })
  } catch {
    return
  }
  removeWork(id)
  detailShow.value = false
  showToast('已删除')
}

async function batchDelete() {
  if (!selectedIds.value.length) return showToast('请先选择要删除的作品')
  try {
    await showConfirmDialog({ title: '批量删除', message: `确定删除选中的 ${selectedIds.value.length} 个作品？删除后无法恢复。` })
  } catch {
    return
  }
  const n = selectedIds.value.length
  removeWorks(selectedIds.value)
  selectedIds.value = []
  managing.value = false
  showToast(`已删除 ${n} 个作品`)
}

async function retry(r) {
  await retryDraw(r)
}
</script>

<template>
  <div class="view works-view">
    <van-nav-bar title="我的作品">
      <template #right>
        <span v-if="draw.results.length" class="nav-manage" @click="toggleManage">
          {{ managing ? '取消' : '批量删除' }}
        </span>
      </template>
    </van-nav-bar>

    <div v-if="!draw.results.length" class="hero-empty">
      <div class="hero-logo">🎨</div>
      <div class="hero-title">还没有作品</div>
      <p class="hero-sub">生成的图片都会保存在这里<br />可以随时查看、下载或删除</p>
      <van-button round type="primary" size="small" @click="ui.tab = TAB.DRAW">去绘图</van-button>
    </div>

    <div v-else class="scroll">
      <!-- 进行中的生成任务：实时显示已等待时长 -->
      <div v-if="runningList.length" class="task-card">
        <div class="task-head">⏳ 进行中的任务（{{ runningList.length }}）</div>
        <div v-for="t in runningList" :key="t.id" class="task-row">
          <van-loading size="16" />
          <span class="task-prompt">{{ t.userPrompt || t.prompt }}</span>
          <span class="task-elapsed">{{ elapsed(t) }}s</span>
        </div>
      </div>

      <div class="gallery">
        <div v-for="r in draw.results" :key="r.id" class="g-item">
          <div v-if="r.loading || (r.idb && !r.url)" class="g-loading">
            <van-loading size="22" />
            <span>{{ r.loading ? `生成中… ${elapsed(r)}s` : '读取中…' }}</span>
          </div>
          <div v-else-if="r.error" class="g-error">
            <div class="g-error-txt">{{ r.error }}</div>
            <button class="g-retry" @click.stop="retry(r)">↻ 重试</button>
          </div>
          <div v-else class="g-thumb">
            <van-image :src="r.url" fit="cover" width="100%" height="100%" @click="onThumbClick(r)" />
            <template v-if="!managing">
              <span class="g-del" @click.stop="del(r.id)">✕</span>
              <a class="g-dl" :href="r.url" download target="_blank">下载</a>
            </template>
            <span v-if="r.duration != null" class="g-dur">{{ fmtDur(r.duration) }}</span>
          </div>
          <span
            v-if="managing"
            class="g-check"
            :class="{ on: selectedIds.includes(r.id) }"
            @click.stop="toggleSelect(r.id)"
          >
            <van-icon v-if="selectedIds.includes(r.id)" name="success" />
          </span>
          <div class="g-cap" @click.stop="managing ? toggleSelect(r.id) : showDetail(r)">
            {{ r.userPrompt || r.prompt }}
          </div>
        </div>
      </div>
    </div>

    <!-- 批量管理时的底部操作栏 -->
    <div v-if="managing" class="batch-bar">
      <van-button size="small" round plain @click="toggleAll">
        {{ allSelected ? '取消全选' : '全选' }}
      </van-button>
      <van-button size="small" round type="danger" :disabled="!selectedIds.length" @click="batchDelete">
        删除（{{ selectedIds.length }}）
      </van-button>
    </div>

    <!-- 作品详情：完整提示词 / 模型 / 尺寸 / 耗时 / 时间 -->
    <van-popup :show="detailShow" position="bottom" round @update:show="detailShow = $event">
      <div v-if="detailItem" class="detail-card">
        <div class="d-head">
          <span>作品详情</span>
          <van-icon name="cross" size="16" @click="detailShow = false" />
        </div>
        <div class="d-row">
          <div class="d-label">提示词（实际发送）</div>
          <p class="d-prompt">{{ detailItem.prompt }}</p>
        </div>
        <div class="d-meta">
          <span>模型：{{ detailItem.model }}</span>
          <span>尺寸：{{ detailItem.size || '默认' }}</span>
          <span v-if="detailItem.duration != null">耗时：{{ fmtDur(detailItem.duration) }}</span>
          <span>{{ fmtTime(detailItem.time) }}</span>
        </div>
        <div class="d-btns">
          <van-button size="small" round plain type="primary" @click="copyPrompt">复制提示词</van-button>
          <a v-if="detailItem.url && !detailItem.error" class="d-dl" :href="detailItem.url" download target="_blank">
            <van-button size="small" round type="primary">下载图片</van-button>
          </a>
          <van-button size="small" round plain type="danger" @click="del(detailItem.id)">删除</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>
