import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 使用相对路径打包，方便以后直接塞进 App 壳（如 Capacitor / HBuilderX）
  base: './',
  server: {
    // 局域网内手机也能访问：npm run dev 后用终端里显示的 Network 地址
    host: true,
    port: 5173,
    // 如果某家 API 浏览器直连报 CORS 错误，可以配置代理绕过：
    // 1. 取消下面注释  2. 在 App 设置里把该服务商的「服务地址」改成 /proxy/deepseek
    // proxy: {
    //   '/proxy/deepseek': {
    //     target: 'https://api.deepseek.com',
    //     changeOrigin: true,
    //     rewrite: (p) => p.replace(/^\/proxy\/deepseek/, ''),
    //   },
    // },
  },
})
