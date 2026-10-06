<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api, media } from '../api'
import { store } from '../store'
import { cameraHealth, downloadUrl, toggleFullscreen, useStats } from '../composables'
import { cameraName, quality } from '../format'
import LivePlayer from '../components/LivePlayer.vue'
import ReviewCard from '../components/ReviewCard.vue'
import ReviewModal from '../components/ReviewModal.vue'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps({ name: { type: String, required: true } })

const cam = computed(() => store.cameras.find((c) => c.name === props.name))
const hd = ref(true)
const muted = ref(true)
const player = ref(null)
const { stats } = useStats()

const reviews = ref([])
const open = ref(null)

async function loadReviews() {
  try {
    reviews.value = await api.reviews({ cameras: props.name, after: 1, limit: 12 })
  } catch {
    reviews.value = []
  }
}

function snapshot() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  downloadUrl(`/api/${props.name}/latest.jpg?t=${Date.now()}`, `${props.name}-${stamp}.jpg`)
}

function markSeen(id) {
  const r = reviews.value.find((x) => x.id === id)
  if (r) r.has_been_reviewed = true
}

onMounted(loadReviews)
watch(() => props.name, loadReviews)

const camStats = computed(() => stats.value?.cameras?.[props.name])
</script>

<template>
  <div class="page">
    <div v-if="!cam" class="empty card">Câmera "{{ name }}" não encontrada.</div>
    <template v-else>
      <div class="page-head">
        <div class="title">
          <RouterLink to="/" class="btn icon" title="Voltar"><AppIcon name="back" :size="16" /></RouterLink>
          <h1>{{ cameraName(cam.name) }}</h1>
          <span :class="['dot', cameraHealth(stats, cam.name).cls]" />
          <span class="muted">{{ cameraHealth(stats, cam.name).text }}</span>
        </div>
        <div class="toolbar">
          <button :class="['btn', { active: hd }]" title="Qualidade" @click="hd = !hd">
            <AppIcon name="hd" :size="16" /> {{ hd ? 'HD' : 'SD' }}
          </button>
          <button class="btn" :title="muted ? 'Ativar som' : 'Silenciar'" @click="muted = !muted">
            <AppIcon :name="muted ? 'mute' : 'volume'" :size="16" />
          </button>
          <button class="btn" title="Foto" @click="snapshot"><AppIcon name="camera" :size="16" /></button>
          <RouterLink class="btn" :to="{ name: 'recordings', params: { camera: cam.name } }">
            <AppIcon name="film" :size="16" /> Gravações
          </RouterLink>
          <button class="btn" title="Tela cheia" @click="toggleFullscreen(player?.el)">
            <AppIcon name="maximize" :size="16" />
          </button>
        </div>
      </div>

      <div class="layout">
        <div class="live card" :style="{ aspectRatio: `${cam.width} / ${cam.height}` }">
          <LivePlayer ref="player" :stream="hd ? cam.main : cam.sub" :camera="cam.name" :muted="muted" />
        </div>

        <aside class="side">
          <div v-if="camStats" class="card stats">
            <div><span class="muted">Stream de análise</span><strong>{{ camStats.camera_fps }} fps</strong></div>
            <div><span class="muted">Detecção de objetos</span><strong>{{ camStats.detection_enabled ? `${camStats.detection_fps} fps` : 'desligada' }}</strong></div>
            <div><span class="muted">Conexão</span><strong>{{ quality(camStats.connection_quality) }}</strong></div>
            <div><span class="muted">Reconexões/h</span><strong>{{ camStats.reconnects_last_hour ?? 0 }}</strong></div>
          </div>

          <div class="side-head">
            <h2>Eventos recentes</h2>
            <RouterLink :to="{ name: 'review', query: { camera: cam.name } }" class="small">ver todos</RouterLink>
          </div>
          <div v-if="!reviews.length" class="empty card small">Nada por enquanto.</div>
          <div class="reviews">
            <ReviewCard v-for="r in reviews" :key="r.id" :item="r" :show-camera="false" @open="open = r" />
          </div>
        </aside>
      </div>
    </template>
    <ReviewModal v-if="open" :item="open" @close="open = null" @viewed="markSeen" />
  </div>
</template>

<style scoped>
.title { display: flex; align-items: center; gap: 10px; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
.live { overflow: hidden; background: #000; max-height: calc(100vh - 110px); }
.side { display: grid; gap: 12px; }
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
}
.stats div { display: grid; }
.stats span { font-size: 12px; }
.side-head { display: flex; align-items: baseline; justify-content: space-between; }
.side-head h2 { font-size: 15px; margin: 4px 0 0; }
.reviews { display: grid; gap: 10px; max-height: calc(100vh - 290px); overflow: auto; }
.small { font-size: 12px; }
.empty.small { padding: 20px; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .live { max-height: none; }
  .reviews { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); max-height: none; }
}
@media (max-width: 760px) {
  .toolbar .btn { padding: 7px 9px; }
  .reviews { grid-template-columns: 1fr 1fr; }
}
</style>
