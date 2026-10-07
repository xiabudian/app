// ComfyUI API 客户端：上传素材、队列工作流、轮询结果、取产物
// 文档：https://github.com/comfyanonymous/ComfyUI（API 格式 = 「导出(API)」的 JSON）

export async function dataUrlToBlob(dataUrl) {
  return await (await fetch(dataUrl)).blob()
}

export async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 上传素材到 ComfyUI（图片/音频通用，进入 input 目录） */
export async function uploadComfyFile(baseUrl, blob, filename) {
  const fd = new FormData()
  fd.append('image', blob, filename)
  fd.append('overwrite', 'true')
  const res = await fetch(joinU(baseUrl, '/upload/image'), { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`素材上传失败（HTTP ${res.status}）`)
  const j = await res.json()
  return { name: j.name, subfolder: j.subfolder || '' }
}

function joinU(base, path) {
  return String(base || '').replace(/\/+$/, '') + path
}

/** 提交工作流到执行队列 */
export async function queueComfyPrompt(baseUrl, workflow) {
  const res = await fetch(joinU(baseUrl, '/prompt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'aichat-app' }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j.error) throw new Error(j.error?.message || `提交失败（HTTP ${res.status}）`)
  if (!j.prompt_id) throw new Error('ComfyUI 未返回任务 ID')
  return j.prompt_id
}

/** 查询执行历史：返回该任务的输出（undefined = 还没完成） */
export async function getComfyHistory(baseUrl, promptId) {
  const res = await fetch(joinU(baseUrl, `/history/${promptId}`))
  if (!res.ok) throw new Error(`查询失败（HTTP ${res.status}）`)
  const j = await res.json()
  return j?.[promptId] || null
}

/** 取产物文件（图片/音频）→ blob */
export async function fetchComfyFile(baseUrl, fileRef) {
  const qs = new URLSearchParams({ filename: fileRef.filename, subfolder: fileRef.subfolder || '', type: fileRef.type || 'output' })
  const res = await fetch(joinU(baseUrl, `/view?${qs}`))
  if (!res.ok) throw new Error(`取文件失败（HTTP ${res.status}）`)
  return await res.blob()
}

/** 从工作流 JSON 里识别可绑定的节点 */
export function detectComfyNodes(workflow) {
  const nodes = Object.entries(workflow || {}).map(([id, n]) => ({ id, class_type: n.class_type, title: n._meta?.title || '', inputs: n.inputs || {} }))
  return {
    text: nodes.filter((n) => n.class_type === 'CLIPTextEncode'),
    image: nodes.filter((n) => n.class_type === 'LoadImage'),
    audio: nodes.filter((n) => n.class_type === 'LoadAudio'),
    samplers: nodes.filter((n) => n.inputs && n.inputs.seed !== undefined),
    outImages: nodes.filter((n) => /SaveImage|PreviewImage|SaveImageWebsocket/.test(n.class_type)),
    outAudios: nodes.filter((n) => /SaveAudio|PreviewAudio/.test(n.class_type)),
  }
}

/** 随机化全部种子（避免相同提示词命中缓存不出新图） */
export function randomizeSeeds(workflow) {
  for (const id in workflow) {
    const inputs = workflow[id]?.inputs
    if (inputs && typeof inputs.seed === 'number') inputs.seed = Math.floor(Math.random() * 1e15)
  }
  return workflow
}

/** 执行一次生图工作流：返回输出图片的 data URL 数组 */
export async function runComfyImage({ baseUrl, workflow, bind, prompt, refDataUrl }) {
  const wf = JSON.parse(JSON.stringify(workflow))
  if (bind?.image && refDataUrl) {
    const blob = await dataUrlToBlob(refDataUrl)
    const up = await uploadComfyFile(baseUrl, blob, `ref_${Date.now()}.png`)
    if (!wf[bind.image]?.inputs) throw new Error(`工作流里找不到参考图节点 ${bind.image}`)
    wf[bind.image].inputs.image = up.name
  }
  if (bind?.text && wf[bind.text]?.inputs) wf[bind.text].inputs.text = prompt
  randomizeSeeds(wf)

  const promptId = await queueComfyPrompt(baseUrl, wf)
  const deadline = Date.now() + 600000 // 10 分钟
  while (Date.now() < deadline) {
    await sleep(2000)
    let entry
    try {
      entry = await getComfyHistory(baseUrl, promptId)
    } catch {
      continue // 网络抖动重试
    }
    if (!entry) continue
    if (entry.status?.status_str === 'error') {
      const msgs = entry.status?.messages || []
      throw new Error(msgs[0]?.[1]?.m || 'ComfyUI 执行出错')
    }
    const outputs = entry.outputs
    if (!outputs || !Object.keys(outputs).length) continue
    const images = []
    for (const nodeId in outputs) {
      for (const im of outputs[nodeId].images || []) {
        if (im.type === 'temp') continue
        const blob = await fetchComfyFile(baseUrl, im)
        images.push(await blobToDataUrl(blob))
      }
    }
    if (!images.length) throw new Error('ComfyUI 完成但没有输出图片')
    return images
  }
  throw new Error('生成超时（10 分钟未完成），可稍后重试')
}

/** 执行一次语音合成工作流：返回输出音频的 data URL 数组 */
export async function runComfyTTS({ baseUrl, workflow, bind, text, refDataUrl }) {
  const wf = JSON.parse(JSON.stringify(workflow))
  if (bind?.audio && refDataUrl) {
    const blob = await dataUrlToBlob(refDataUrl)
    const up = await uploadComfyFile(baseUrl, blob, `voice_${Date.now()}.wav`)
    if (!wf[bind.audio]?.inputs) throw new Error(`工作流里找不到参考音频节点 ${bind.audio}`)
    wf[bind.audio].inputs.audio = up.name
  }
  if (bind?.text && wf[bind.text]?.inputs) wf[bind.text].inputs.text = text
  randomizeSeeds(wf)

  const promptId = await queueComfyPrompt(baseUrl, wf)
  const deadline = Date.now() + 300000
  while (Date.now() < deadline) {
    await sleep(2000)
    let entry
    try {
      entry = await getComfyHistory(baseUrl, promptId)
    } catch {
      continue
    }
    if (!entry) continue
    if (entry.status?.status_str === 'error') throw new Error('ComfyUI 执行出错')
    const outputs = entry.outputs
    if (!outputs || !Object.keys(outputs).length) continue
    const audios = []
    for (const nodeId in outputs) {
      for (const au of outputs[nodeId].audio || []) {
        const blob = await fetchComfyFile(baseUrl, au)
        audios.push(await blobToDataUrl(blob))
      }
    }
    if (!audios.length) throw new Error('ComfyUI 完成但没有输出音频')
    return audios
  }
  throw new Error('生成超时（5 分钟未完成），可稍后重试')
}

export const sleepComfy = sleep
