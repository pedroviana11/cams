<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { media } from '../api'

const props = defineProps({
  stream: { type: String, required: true }, // nome do stream no go2rtc
  camera: { type: String, required: true }, // nome da câmera no Frigate (fallback MJPEG)
  muted: { type: Boolean, default: true },
  fit: { type: String, default: 'contain' },
})
const emit = defineEmits(['state'])

const video = ref(null)
const root = ref(null)
const mode = ref('mse') // mse | mjpeg
const state = ref('loading') // loading | playing | error

let ws = null
let ms = null
let sb = null
let queue = []
let retryTimer = null
let retries = 0
let gotData = false
let visible = true
let observer = null

const MSE = window.ManagedMediaSource || window.MediaSource
const CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus']

function setState(s) {
  state.value = s
  emit('state', s)
}

function cleanup() {
  clearTimeout(retryTimer)
  if (ws) {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
    ws.close()
    ws = null
  }
  sb = null
  queue = []
  if (ms && ms.readyState === 'open') {
    try { ms.endOfStream() } catch {}
  }
  ms = null
  if (video.value) {
    video.value.removeAttribute('src')
    video.value.srcObject = null
  }
}

function flush() {
  if (!sb || sb.updating) return
  try {
    if (queue.length) {
      const total = queue.reduce((n, b) => n + b.byteLength, 0)
      const data = new Uint8Array(total)
      let off = 0
      for (const b of queue) {
        data.set(new Uint8Array(b), off)
        off += b.byteLength
      }
      queue = []
      sb.appendBuffer(data)
    } else if (sb.buffered.length) {
      // mantém só ~15 s no buffer pra não estourar memória
      const start = sb.buffered.start(0)
      const end = sb.buffered.end(sb.buffered.length - 1) - 15
      if (end > start) sb.remove(start, end)
    }
  } catch {}
}

function keepLive() {
  const v = video.value
  if (!v || !sb || !v.buffered.length) return
  const end = v.buffered.end(v.buffered.length - 1)
  // ficou pra trás (aba em segundo plano, rede lenta): pula pra borda ao vivo
  if (end - v.currentTime > 2.5) v.currentTime = end - 0.4
  if (v.paused) v.play().catch(() => {})
}

function connect() {
  cleanup()
  if (!visible) return
  if (!MSE) return useMjpeg()
  setState('loading')
  gotData = false

  ms = new MSE()
  const v = video.value
  ms.addEventListener(
    'sourceopen',
    () => {
      if (!window.ManagedMediaSource) URL.revokeObjectURL(v.src)
      ws = new WebSocket(media.mseSocket(props.stream))
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        const codecs = CODECS.filter((c) => MSE.isTypeSupported(`video/mp4; codecs="${c}"`)).join(',')
        ws.send(JSON.stringify({ type: 'mse', value: codecs }))
      }
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'mse' && ms?.readyState === 'open') {
            sb = ms.addSourceBuffer(msg.value)
            sb.mode = 'segments'
            sb.addEventListener('updateend', flush)
          } else if (msg.type === 'error') {
            scheduleRetry()
          }
          return
        }
        if (!sb) return
        if (!gotData) {
          gotData = true
          retries = 0
        }
        queue.push(ev.data)
        flush()
      }
      ws.onclose = ws.onerror = () => scheduleRetry()
    },
    { once: true },
  )

  if (window.ManagedMediaSource) {
    v.disableRemotePlayback = true
    v.srcObject = ms
  } else {
    v.src = URL.createObjectURL(ms)
  }
  v.play().catch(() => {})
}

function scheduleRetry() {
  cleanup()
  retries++
  // MSE nunca entregou vídeo: desiste e usa MJPEG
  if (!gotData && retries >= 3) return useMjpeg()
  setState('loading')
  retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries, 15000))
}

function useMjpeg() {
  cleanup()
  mode.value = 'mjpeg'
  setState('loading')
}

function onPlaying() {
  setState('playing')
}

let liveTimer = null

onMounted(() => {
  liveTimer = setInterval(keepLive, 1000)
  // só transmite o que está na tela (grade com muitas câmeras no celular)
  observer = new IntersectionObserver(([e]) => {
    const was = visible
    visible = e.isIntersecting
    if (mode.value !== 'mse') return
    if (visible && !was) connect()
    if (!visible && was) cleanup()
  })
  observer.observe(root.value)
  connect()
})

onBeforeUnmount(() => {
  clearInterval(liveTimer)
  observer?.disconnect()
  cleanup()
})

watch(
  () => props.stream,
  () => {
    mode.value = 'mse'
    retries = 0
    connect()
  },
)

watch(
  () => props.muted,
  (m) => {
    if (video.value) video.value.muted = m
  },
)

defineExpose({ el: root })
</script>

<template>
  <div ref="root" class="player" :style="{ '--fit': fit }">
    <video
      v-show="mode === 'mse'"
      ref="video"
      :muted="muted"
      autoplay
      playsinline
      @playing="onPlaying"
      @waiting="setState('loading')"
    />
    <img
      v-if="mode === 'mjpeg'"
      :src="media.mjpeg(camera, 720)"
      alt=""
      @load="setState('playing')"
      @error="setState('error')"
    />
    <div v-if="state !== 'playing'" class="overlay">
      <div v-if="state === 'loading'" class="spinner" />
      <span v-else class="muted">Sem sinal</span>
    </div>
  </div>
</template>

<style scoped>
.player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}
video, img {
  width: 100%;
  height: 100%;
  object-fit: var(--fit);
  display: block;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
}
</style>
