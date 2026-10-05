<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { settings, providerRef, addUserProvider, removeUserProvider } from '../stores/settings'
import { testConnection, describeError } from '../lib/api'

const props = defineProps({
  show: Boolean,
  providerId: String, // null 表示新增
})
const emit = defineEmits(['update:show'])

const blank = () => ({ name: '', baseUrl: '', apiKey: '', imageKey: '', modelsText: '', imageModelsText: '', model: '', imageModel: '' })
const draft = reactive(blank())
const showKey = ref(false)
const testing = ref(false)

const isBuiltin = computed(() => !!props.providerId && !!settings.providers[props.providerId])

// 每次打开时，把当前服务商的值拷贝进草稿
watch(
  () => props.show,
  (v) => {
    if (!v) return
    showKey.value = false
    const p = props.providerId ? providerRef(props.providerId) : null
    if (p) {
      Object.assign(draft, blank(), {
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        imageKey: p.imageKey || '',
        modelsText: (p.models || []).join(', '),
        imageModelsText: (p.imageModels || []).join(', '),
        model: p.model || '',
        imageModel: p.imageModel || '',
      })
    } else {
      Object.assign(draft, blank())
    }
  }
)

function parseList(t) {
  return t.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

function close() {
  emit('update:show', false)
}

function onSave() {
  if (!draft.baseUrl.trim()) return showToast('请填写服务地址')
  if (!isBuiltin.value && !draft.name.trim()) return showToast('请填写服务商名称')

  const patch = {
    baseUrl: draft.baseUrl.trim(),
    apiKey: draft.apiKey.trim(),
    imageKey: draft.imageKey.trim(),
    model: draft.model,
    imageModel: draft.imageModel,
    models: parseList(draft.modelsText),
    imageModels: parseList(draft.imageModelsText),
  }

  let target
  if (props.providerId) {
    target = providerRef(props.providerId)
    Object.assign(target, patch)
  } else {
    target = addUserProvider()
    Object.assign(target, patch, { name: draft.name.trim() })
  }
  // 没选默认模型时，自动用列表第一个
  if (!target.model && target.models.length) target.model = target.models[0]
  if (!target.imageModel && target.imageModels.length) target.imageModel = target.imageModels[0]

  showToast('已保存')
  close()
}

async function onDelete() {
  try {
    await showConfirmDialog({ title: '删除服务商', message: `确定删除「${draft.name}」？` })
  } catch {
    return
  }
  removeUserProvider(props.providerId)
  showToast('已删除')
  close()
}

async function onTest() {
  if (!draft.baseUrl.trim()) return showToast('请先填写服务地址')
  testing.value = true
  try {
    const n = await testConnection({ baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim() })
    showToast(n ? `连接成功，可用模型 ${n} 个` : '连接成功')
  } catch (e) {
    showToast(describeError(e))
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <van-popup :show="props.show" position="bottom" round @update:show="emit('update:show', $event)">
    <div class="editor-title">
      <span>{{ props.providerId ? '编辑服务商' : '新增自定义服务商' }}</span>
      <van-icon name="cross" size="18" @click="close" />
    </div>

    <div class="editor-body">
      <van-field v-model="draft.name" label="名称" placeholder="例如：我的中转站" :disabled="isBuiltin" clearable />
      <van-field v-model="draft.baseUrl" label="服务地址" placeholder="https://…（一般以 /v1 结尾）" clearable />
      <van-field
        v-model="draft.apiKey"
        :type="showKey ? 'text' : 'password'"
        label="API Key"
        placeholder="聊天用 Key，sk-…"
        clearable
      >
        <template #right-icon>
          <van-icon :name="showKey ? 'eye-o' : 'closed-eye'" @click="showKey = !showKey" />
        </template>
      </van-field>
      <van-field
        v-model="draft.imageKey"
        :type="showKey ? 'text' : 'password'"
        label="绘图 Key"
        placeholder="生图用 Key，留空则沿用上面的 Key"
        clearable
      >
        <template #right-icon>
          <van-icon :name="showKey ? 'eye-o' : 'closed-eye'" @click="showKey = !showKey" />
        </template>
      </van-field>

      <van-field
        v-model="draft.modelsText"
        label="聊天模型"
        placeholder="多个模型用逗号分隔，如：gpt-4o, gpt-4o-mini"
      />
      <div v-if="parseList(draft.modelsText).length" class="editor-tip">
        点标签设为默认聊天模型（当前：{{ draft.model || '未设置' }}）
      </div>
      <div v-if="parseList(draft.modelsText).length" class="model-tags">
        <van-tag
          v-for="m in parseList(draft.modelsText)"
          :key="m"
          :type="draft.model === m ? 'primary' : 'default'"
          size="medium"
          class="mt"
          @click="draft.model = m"
        >
          {{ m }}
        </van-tag>
      </div>

      <van-field
        v-model="draft.imageModelsText"
        label="绘图模型"
        placeholder="多个模型用逗号分隔，不需要绘图可留空"
      />
      <div v-if="parseList(draft.imageModelsText).length" class="editor-tip">
        点标签设为默认绘图模型（当前：{{ draft.imageModel || '未设置' }}）
      </div>
      <div v-if="parseList(draft.imageModelsText).length" class="model-tags">
        <van-tag
          v-for="m in parseList(draft.imageModelsText)"
          :key="m"
          :type="draft.imageModel === m ? 'primary' : 'default'"
          size="medium"
          class="mt"
          @click="draft.imageModel = m"
        >
          {{ m }}
        </van-tag>
      </div>

      <div class="editor-btns">
        <van-button round plain type="primary" :loading="testing" @click="onTest">测试连接</van-button>
        <van-button round type="primary" @click="onSave">保存</van-button>
        <van-button v-if="!isBuiltin" round plain type="danger" @click="onDelete">删除</van-button>
      </div>
    </div>
  </van-popup>
</template>
