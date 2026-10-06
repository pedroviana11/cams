<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { store } from '../store'
import { cameraName, dayLabel } from '../format'
import ReviewCard from '../components/ReviewCard.vue'
import ReviewModal from '../components/ReviewModal.vue'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()

const PAGE = 48
const items = ref([])
const loading = ref(false)
const more = ref(true)
const error = ref('')
const open = ref(null)

const filters = ref({
  camera: route.query.camera || '',
  severity: route.query.severity || '',
  seen: route.query.seen || 'unseen', // unseen | all
  day: route.query.day || '',
})

const params = (before) => {
  const f = filters.value
  // sem "after" a API devolve só as últimas 24h (e 0 conta como ausente)
  const p = { limit: PAGE, after: 1, cameras: f.camera || undefined, severity: f.severity || undefined }
  if (f.seen === 'unseen') p.reviewed = 0
  if (f.day) {
    const start = new Date(`${f.day}T00:00:00`).getTime() / 1000
    p.after = start
    p.before = start + 86400
  }
  if (before) p.before = before
  return p
}

async function load(reset = true) {
  loading.value = true
  error.value = ''
  try {
    const before = reset ? null : items.value.at(-1)?.start_time
    const page = await api.reviews(params(before))
    items.value = reset ? page : [...items.value, ...page.filter((p) => !items.value.some((i) => i.id === p.id))]
    more.value = page.length === PAGE
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// agrupado por dia pra leitura mais fácil
const groups = computed(() => {
  const map = new Map()
  for (const it of items.value) {
    const d = new Date(it.start_time * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(it)
  }
  return [...map.entries()]
})

const unseenIds = computed(() => items.value.filter((i) => !i.has_been_reviewed).map((i) => i.id))

async function markAll() {
  if (!unseenIds.value.length) return
  try {
    await api.markViewed(unseenIds.value)
    if (filters.value.seen === 'unseen') items.value = []
    else items.value.forEach((i) => (i.has_been_reviewed = true))
  } catch (e) {
    error.value = e.message
  }
}

function markSeen(id) {
  const r = items.value.find((x) => x.id === id)
  if (r) r.has_been_reviewed = true
}

watch(
  filters,
  (f) => {
    const query = Object.fromEntries(Object.entries(f).filter(([k, v]) => v && !(k === 'seen' && v === 'unseen')))
    router.replace({ query })
    load()
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Eventos</h1>
      <div class="toolbar">
        <select v-model="filters.camera" class="input">
          <option value="">Todas as câmeras</option>
          <option v-for="c in store.cameras" :key="c.name" :value="c.name">{{ cameraName(c.name) }}</option>
        </select>
        <select v-model="filters.severity" class="input">
          <option value="">Alertas e detecções</option>
          <option value="alert">Só alertas</option>
          <option value="detection">Só detecções</option>
        </select>
        <select v-model="filters.seen" class="input">
          <option value="unseen">Não vistos</option>
          <option value="all">Todos</option>
        </select>
        <input v-model="filters.day" type="date" class="input" title="Dia" />
        <button class="btn" :disabled="!unseenIds.length" @click="markAll">
          <AppIcon name="check" :size="15" /> Marcar vistos
        </button>
      </div>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="!items.length && !loading" class="empty card">
      {{ filters.seen === 'unseen' ? 'Tudo em dia, nenhum evento novo.' : 'Nenhum evento encontrado.' }}
    </div>

    <section v-for="[d, list] in groups" :key="d" class="group">
      <h2>{{ dayLabel(d) }} <span class="muted">· {{ list.length }}</span></h2>
      <div class="grid">
        <ReviewCard v-for="r in list" :key="r.id" :item="r" @open="open = r" />
      </div>
    </section>

    <div class="foot">
      <div v-if="loading" class="spinner" />
      <button v-else-if="more && items.length" class="btn" @click="load(false)">Carregar mais</button>
    </div>

    <ReviewModal v-if="open" :item="open" @close="open = null" @viewed="markSeen" />
  </div>
</template>

<style scoped>
.group h2 { font-size: 15px; margin: 18px 0 10px; text-transform: capitalize; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.foot { display: grid; place-items: center; padding: 20px; }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .toolbar { width: 100%; }
  .toolbar .input { flex: 1 1 140px; }
}
</style>
