import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Em dev o Vite faz o papel do nginx: tudo que é do Frigate vai pra porta 8091 (com login)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frigate = env.FRIGATE_URL || 'http://127.0.0.1:8091'
  const proxy = Object.fromEntries(
    ['/api', '/vod', '/clips', '/exports', '/live'].map((p) => [
      p,
      { target: frigate, changeOrigin: true, secure: false, ws: p === '/live' },
    ]),
  )

  return {
    plugins: [vue()],
    server: { host: true, port: 5173, proxy },
    // hls.js (~570 kB) fica num chunk próprio, carregado só na tela de gravações
    build: { chunkSizeWarningLimit: 700 },
  }
})
