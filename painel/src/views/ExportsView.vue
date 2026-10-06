<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api, media } from '../api'
import { cameraName, dateTime } from '../format'
import { downloadUrl } from '../composables'
import AppIcon from '../components/AppIcon.vue'

const items = ref([])
const error = ref('')
const playing = ref(null)
let timer = null

async function load() {
  try {
    const list = await api.exports()
    items.value = list.sort((a, b) => b.date - a.date)
    error.value = ''
  } catch (e) {
    error.value = e.message
  }
}

const busy = computed(() => items.value.some((i) => i.in_progress))

async function remove(item) {
  if (!confirm(`Apagar "${item.name}"?`)) return
  try {
    await api.deleteExports([item.id])
    items.value = items.value.filter((i) => i.id !== item.id)
  } catch (e) {
    error.value = e.message
  }
}

function download(item) {
  downloadUrl(media.file(item.video_path), item.video_path.split('/').pop())
}

onMounted(() => {
  load()
  // enquanto houver exportação rodando, atualiza sozinho
  timer = setInterval(() => busy.value && load(), 3000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Exportações</h1>
      <div class="toolbar">
        <span class="muted small">Gere novos trechos na tela de Gravações</span>
        <button class="btn icon" title="Atualizar" @click="load"><AppIcon name="refresh" :size="16" /></button>
      </div>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="!items.length" class="empty card">Nenhuma exportação ainda.</div>

    <div class="grid">
      <div v-for="it in items" :key="it.id" class="card item">
        <button class="thumb" :disabled="it.in_progress" @click="playing = it">
          <img v-if="it.thumb_path" :src="media.file(it.thumb_path)" alt="" loading="lazy" />
          <span v-if="it.in_progress" class="overlay"><span class="spinner" /> Processando…</span>
          <span v-else class="overlay play"><AppIcon name="play" :size="28" /></span>
        </button>
        <div class="info">
          <strong :title="it.name">{{ it.name }}</strong>
          <span class="muted small">{{ cameraName(it.camera) }} · {{ dateTime(it.date) }}</span>
        </div>
        <div class="actions">
          <button class="btn" :disabled="it.in_progress" @click="download(it)"><AppIcon name="download" :size="15" /> Baixar</button>
          <button class="btn icon danger" :disabled="it.in_progress" title="Apagar" @click="remove(it)"><AppIcon name="trash" :size="15" /></button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="playing" class="backdrop" @click.self="playing = null">
        <div class="modal card">
          <header>
            <strong>{{ playing.name }}</strong>
            <button class="btn icon" @click="playing = null"><AppIcon name="x" :size="16" /></button>
          </header>
          <video :src="media.file(playing.video_path)" controls autoplay playsinline />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.item { overflow: hidden; display: flex; flex-direction: column; }
.thumb { position: relative; aspect-ratio: 16 / 9; background: #000; border: 0; padding: 0; cursor: pointer; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.overlay { position: absolute; inset: 0; display: flex; gap: 10px; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); }
.overlay.play { opacity: 0; transition: opacity 0.15s; }
.thumb:hover .overlay.play { opacity: 1; }
.info { padding: 10px 12px 4px; display: grid; gap: 2px; }
.info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; gap: 6px; padding: 8px 12px 12px; margin-top: auto; }
.small { font-size: 12px; }
.backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.75); display: grid; place-items: center; padding: 16px; }
.modal { width: min(1100px, 100%); overflow: hidden; }
.modal header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; }
.modal video { width: 100%; max-height: 78vh; background: #000; display: block; }
</style>
