import { reactive } from 'vue'
import { api } from './api'

export const store = reactive({
  config: null,
  cameras: [], // [{ name, main, sub, width, height }]
})

export async function loadConfig() {
  const cfg = await api.config()
  store.config = cfg
  store.cameras = Object.entries(cfg.cameras)
    .filter(([, c]) => c.enabled !== false)
    .map(([name, c]) => {
      // streams do go2rtc ligados à câmera; o menor (sub) vai pra grade, o principal pra tela cheia
      const streams = Object.values(c.live?.streams || {})
      const main = streams.find((s) => !/sub/i.test(s)) || streams[0] || name
      const sub = streams.find((s) => /sub/i.test(s)) || main
      return { name, main, sub, width: c.detect?.width || 16, height: c.detect?.height || 9 }
    })
  return cfg
}
