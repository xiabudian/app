<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import Viewer from 'viewerjs'
import 'viewerjs/dist/viewer.css'
import { draw, removeWork, removeWorks, retryDraw } from '../stores/draw'
import { ui, TAB } from '../stores/ui'
import { showImagePreview, showConfirmDialog, showToast } from 'vant'
import { saveImage } from '../lib/storage'

const managing = ref(false) // 批量管理模式
const selectedIds = ref([])

const detailShow = ref(false)
const detailItem = ref(null)

// 提示词搜索 + 分页加载（作品多了不用一直划）
const q = ref('')
const visibleCount = ref(12)
const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  if (!kw) return draw.results
  return draw.results.filter((r) => (r.userPrompt || r.prompt || '').toLowerCase().includes(kw))
})
const visibleList = computed(() => filtered.value.slice(0, visibleCount.value))
const hasMore = computed(() => filtered.value.length > visibleCount.value)
watch(q, () => {
  visibleCount.value = 12
})

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

function onThumbClick(e, r) {
  if (managing.value) {
    toggleSelect(r.id)
    return
  }
  // 局部放大查看：滚轮/双指缩放 + 拖动平移
  const thumb = e.currentTarget.closest('.g-thumb')
  if (!thumb) return
  const viewer = new Viewer(thumb, {
    navbar: false,
    title: [1, () => (r.userPrompt || r.prompt || '').slice(0, 60)],
    toolbar: {
      zoomIn: 1,
      zoomOut: 1,
      oneToOne: 1,
      reset: 1,
      prev: 0,
      play: 0,
      next: 0,
      rotateLeft: 0,
      rotateRight: 0,
      flipHorizontal: 0,
      flipVertical: 0,
    },
    backdrop: true,
    hidden() {
      viewer.destroy()
    },
  })
  viewer.show()
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

async function saveWork(r) {
  if (!r.url) return
  const ext = r.url.startsWith('data:image/svg') ? 'svg' : 'png'
  const name = `AI绘图_${(r.userPrompt || 'image').slice(0, 12)}_${r.id.slice(0, 6)}.${ext}`
  try {
    const where = await saveImage(r.url, name)
    showToast(where === 'app' ? '已存到手机 下载/AIChat/（图库不显示）' : '已下载到「下载」文件夹')
  } catch {
    showToast('保存失败')
  }
}
</script>

<template>
  <div class="view works-view" :class="{ managing }">
    <van-nav-bar title="我的作品">
      <template #right>
        <span v-if="draw.results.length" class="nav-manage" @click="toggleManage">
          <van-icon :name="managing ? 'cross' : 'delete-o'" size="14" />
          {{ managing ? '完成' : '管理' }}
        </span>
      </template>
    </van-nav-bar>

    <div v-if="!draw.results.length" class="hero-empty">
      <div class="hero-logo">🎨</div>
      <div class="hero-title">还没有作品</div>
      <p class="hero-sub">生成的图片都会保存在这里<br />可以随时查看、下载或删除</p>
      <van-button round type="primary" @click="ui.tab = TAB.DRAW">去绘图</van-button>
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

      <div v-if="draw.results.length > 6" class="works-search">
        <van-search v-model="q" placeholder="搜索提示词" />
      </div>

      <div v-if="!filtered.length" class="works-none">没有匹配的作品</div>

      <div class="gallery">
        <div v-for="r in visibleList" :key="r.id" class="g-item">
          <div v-if="r.loading || (r.idb && !r.url)" class="g-loading">
            <van-loading size="22" />
            <span>{{ r.loading ? `生成中… ${elapsed(r)}s` : '读取中…' }}</span>
          </div>
          <div v-else-if="r.error" class="g-error">
            <div class="g-error-txt">{{ r.error }}</div>
            <button class="g-retry" @click.stop="retry(r)">↻ 重试</button>
          </div>
          <div v-else class="g-thumb">
            <van-image :src="r.url" fit="cover" width="100%" height="100%" @click="onThumbClick($event, r)" />
            <template v-if="!managing">
              <span class="g-del" @click.stop="del(r.id)">✕</span>
              <button class="g-dl" @click.stop="saveWork(r)">下载</button>
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

      <div v-if="hasMore" class="more-wrap">
        <van-button size="small" plain round @click="visibleCount += 12">
          加载更多（还有 {{ filtered.length - visibleCount }} 张）
        </van-button>
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
          <van-button
            v-if="detailItem.url && !detailItem.error"
            size="small"
            round
            type="primary"
            @click="saveWork(detailItem)"
          >
            下载图片
          </van-button>
          <van-button size="small" round plain type="danger" @click="del(detailItem.id)">删除</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>
