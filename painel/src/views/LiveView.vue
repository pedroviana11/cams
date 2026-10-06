<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import { cameraHealth, toggleFullscreen, useStats } from '../composables'
import { cameraName } from '../format'
import LivePlayer from '../components/LivePlayer.vue'
import AppIcon from '../components/AppIcon.vue'

const { stats } = useStats()

const readCols = () => {
  try {
    return localStorage.getItem('live-cols') || 'auto'
  } catch {
    return 'auto'
  }
}
const cols = ref(readCols())
watch(cols, (v) => {
  try {
    localStorage.setItem('live-cols', v)
  } catch {}
})

const gridStyle = computed(() =>
  cols.value === 'auto'
    ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))' }
    : { gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))` },
)

const players = ref({})
const setPlayer = (name) => (el) => {
  if (el) players.value[name] = el
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Ao vivo</h1>
      <div class="toolbar">
        <span class="muted">{{ store.cameras.length }} câmera{{ store.cameras.length === 1 ? '' : 's' }}</span>
        <div class="seg">
          <button
            v-for="c in ['auto', '1', '2', '3', '4']"
            :key="c"
            :class="['btn', { active: cols === c }]"
            @click="cols = c"
          >
            <AppIcon v-if="c === 'auto'" name="grid" :size="14" />
            <span v-else>{{ c }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="!store.cameras.length" class="empty card">Nenhuma câmera configurada no Frigate.</div>

    <div class="grid" :style="gridStyle">
      <div v-for="cam in store.cameras" :key="cam.name" class="tile card">
        <RouterLink
          :to="{ name: 'camera', params: { name: cam.name } }"
          class="video"
          :style="{ aspectRatio: `${cam.width} / ${cam.height}` }"
        >
          <LivePlayer :ref="setPlayer(cam.name)" :stream="cam.sub" :camera="cam.name" />
        </RouterLink>
        <div class="bar">
          <span class="name">
            <span :class="['dot', cameraHealth(stats, cam.name).cls]" />
            {{ cameraName(cam.name) }}
          </span>
          <span class="actions">
            <span class="muted small">{{ cameraHealth(stats, cam.name).text }}</span>
            <RouterLink class="btn icon" title="Gravações" :to="{ name: 'recordings', params: { camera: cam.name } }">
              <AppIcon name="film" :size="15" />
            </RouterLink>
            <button class="btn icon" title="Tela cheia" @click="toggleFullscreen(players[cam.name]?.el)">
              <AppIcon name="maximize" :size="15" />
            </button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; gap: 14px; }
.tile { overflow: hidden; }
.video { display: block; width: 100%; background: #000; }
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
}
.name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.actions { display: flex; align-items: center; gap: 6px; }
.small { font-size: 12px; margin-right: 4px; }
.seg { display: flex; gap: 4px; }
.seg .btn { min-width: 34px; justify-content: center; padding: 6px 8px; }

@media (max-width: 760px) {
  .seg { display: none; }
  .grid { grid-template-columns: 1fr !important; gap: 10px; }
}
</style>
