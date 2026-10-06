import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api, AuthError } from './api'

// stats do Frigate atualizados periodicamente (fps, conexão, CPU...)
export function useStats(interval = 5000) {
  const stats = ref(null)
  const error = ref('')
  let timer = null

  async function load() {
    try {
      stats.value = await api.stats()
      error.value = ''
    } catch (e) {
      if (!(e instanceof AuthError)) error.value = e.message
    }
  }

  onMounted(() => {
    load()
    timer = setInterval(load, interval)
  })
  onBeforeUnmount(() => clearInterval(timer))

  return { stats, error, reload: load }
}

export function cameraHealth(stats, name) {
  const c = stats?.cameras?.[name]
  if (!c) return { cls: '', text: '—' }
  if (!c.camera_fps) return { cls: 'bad', text: 'Offline' }
  // camera_fps é do stream de detecção (5 fps configurado), não do vídeo; por isso só mostra o estado
  if (c.connection_quality && c.connection_quality !== 'excellent' && c.connection_quality !== 'good')
    return { cls: 'warn', text: 'Instável' }
  return { cls: 'ok', text: 'Online' }
}

export async function toggleFullscreen(el) {
  if (!el) return
  if (document.fullscreenElement) return document.exitFullscreen()
  if (el.requestFullscreen) return el.requestFullscreen().catch(() => {})
  // iOS Safari só deixa o <video> em tela cheia
  const v = el.querySelector('video')
  v?.webkitEnterFullscreen?.()
}

export function downloadUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
