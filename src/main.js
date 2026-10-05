import { createApp } from 'vue'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import './styles.css'

const app = createApp(App)
// 开发期错误面板：组件渲染报错时直接显示在页面上，方便排查
app.config.errorHandler = (err) => {
  document.body.innerHTML =
    '<pre style="padding:20px;white-space:pre-wrap;font-size:12px;color:#b00">启动/渲染错误:\n' +
    (err?.stack || String(err)) +
    '</pre>'
}
app.use(Vant).mount('#app')
