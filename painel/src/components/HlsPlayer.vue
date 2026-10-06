<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Hls from 'hls.js'

const props = defineProps({
  src: { type: String, default: '' },
  startAt: { type: Number, default: 0 }, // segundos dentro do vídeo
  autoplay: { type: Boolean, default: true },
  rate: { type: Number, default: 1 },
})
const emit = defineEmits(['time', 'ended', 'error'])

const video = ref(null)
const loading = ref(false)
const failed = ref('')
let hls = null

function destroy() {
  hls?.destroy()
  hls = null
}

// autoplay com som é bloqueado sem clique do usuário (F5, link direto): tenta de novo mudo
function tryPlay(v) {
  v.play().catch(() => {
    v.muted = true
    v.play().catch(() => {})
  })
}

function load() {
  destroy()
  failed.value = ''
  const v = video.value
  if (!props.src || !v) return
  loading.value = true
  const start = () => {
    if (props.startAt) v.currentTime = props.startAt
    v.playbackRate = props.rate
    if (props.autoplay) tryPlay(v)
  }
  if (Hls.isSupported()) {
    hls = new Hls({ startPosition: props.startAt || -1, xhrSetup: (xhr) => (xhr.withCredentials = true) })
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      v.playbackRate = props.rate
      if (props.autoplay) tryPlay(v)
    })
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal) return
      loading.value = false
      failed.value = 'Não foi possível carregar este trecho.'
      emit('error', d)
      destroy()
    })
    hls.loadSource(props.src)
    hls.attachMedia(v)
  } else {
    // Safari/iOS tocam HLS nativamente
    v.src = props.src
    v.addEventListener('loadedmetadata', start, { once: true })
  }
}

// troca de posição sem recarregar a playlist
function seek(t) {
  if (video.value) video.value.currentTime = t
}

onMounted(load)
onBeforeUnmount(destroy)
watch(() => props.src, load)
watch(
  () => props.rate,
  (r) => {
    if (video.value) video.value.playbackRate = r
  },
)

defineExpose({ seek, video })
</script>

<template>
  <div class="hls">
    <video
      ref="video"
      controls
      playsinline
      @timeupdate="emit('time', video.currentTime)"
      @playing="loading = false"
      @loadeddata="loading = false"
      @waiting="loading = true"
      @ended="emit('ended')"
    />
    <div v-if="failed" class="overlay"><span class="muted">{{ failed }}</span></div>
    <div v-else-if="loading && src" class="overlay pass"><div class="spinner" /></div>
    <div v-else-if="!src" class="overlay"><span class="muted">Selecione um trecho</span></div>
  </div>
</template>

<style scoped>
.hls { position: relative; background: #000; width: 100%; height: 100%; }
video { width: 100%; height: 100%; display: block; object-fit: contain; }
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
}
.overlay.pass { pointer-events: none; background: transparent; }
</style>
