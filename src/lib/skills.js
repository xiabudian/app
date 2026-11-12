// 内置技能注册表：聊天输入框旁可选，选中后发消息注入对应 systemPrompt。
// 技能内容用 Vite 的 ?raw 直接嵌入 markdown 文件，构建时打进 app，不依赖网络。
import h3Prompt from '../skills/minimax-h3-prompt.md?raw'

export const SKILLS = [
  {
    id: 'h3-prompt',
    name: 'H3 提示词',
    desc: 'MiniMax H3（Hailuo 3.0）视频提示词写作与优化：分镜转提示词、口型对准、运镜与声音三层',
    prompt: h3Prompt,
  },
]

export function getSkill(id) {
  return SKILLS.find((s) => s.id === id) || null
}
