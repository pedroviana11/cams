<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { api, media } from '../api'
import { cameraName, dateTime, label } from '../format'
import { downloadUrl } from '../composables'
import HlsPlayer from './HlsPlayer.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['close', 'viewed'])

// alguns segundos antes/depois pra dar contexto
const PAD = 4
const end = computed(() => props.item.end_time || Date.now() / 1000)
const src = computed(() => media.vod(props.item.camera, props.item.start_time - PAD, end.value + PAD))
const objects = computed(() => (props.item.data?.objects || []).map(label).join(', ') || 'movimento')

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  if (!props.item.has_been_reviewed) {
    try {
      await api.markViewed([props.item.id])
      emit('viewed', props.item.id)
    } catch {}
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function download() {
  downloadUrl(media.reviewClip(props.item.id), `${props.item.camera}-${props.item.id}.mp4`)
}
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')">
      <div class="modal card">
        <header>
          <div>
            <strong class="cap">{{ objects }}</strong>
            <span class="muted"> · {{ cameraName(item.camera) }} · {{ dateTime(item.start_time) }}</span>
          </div>
          <div class="toolbar">
            <button class="btn" @click="download"><AppIcon name="download" :size="15" /> Baixar</button>
            <RouterLink
              class="btn"
              :to="{ name: 'recordings', params: { camera: item.camera }, query: { t: Math.floor(item.start_time) } }"
              @click="emit('close')"
            >
              <AppIcon name="film" :size="15" /> Ver na linha do tempo
            </RouterLink>
            <button class="btn icon" title="Fechar" @click="emit('close')"><AppIcon name="x" :size="16" /></button>
          </div>
        </header>
        <div class="video"><HlsPlayer :src="src" /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.75);
  display: grid;
  place-items: center;
  padding: 16px;
}
.modal { width: min(1100px, 100%); overflow: hidden; }
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
}
.cap { text-transform: capitalize; }
.video { aspect-ratio: 16 / 9; max-height: 75vh; }

@media (max-width: 760px) {
  .backdrop { padding: 0; align-items: end; }
  .modal { border-radius: var(--radius) var(--radius) 0 0; }
  header .btn span, header .btn { font-size: 13px; }
}
</style>
