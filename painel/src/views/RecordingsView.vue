<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, media } from '../api'
import { store } from '../store'
import { downloadUrl } from '../composables'
import { cameraName, dayLabel, duration, hourStart, label, shortTime, time } from '../format'
import HlsPlayer from '../components/HlsPlayer.vue'
import ReviewModal from '../components/ReviewModal.vue'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()

const camera = computed(() => route.params.camera || store.cameras[0]?.name || '')
const days = ref([]) // [{ day, hours: Map(hour -> {duration, motion, events}) }]
const day = ref('')
const hour = ref(null)
const segments = ref([]) // segmentos da hora selecionada, recortados
const reviews = ref([])
const loading = ref(false)
const error = ref('')

const player = ref(null)
const startAt = ref(0)
const videoTime = ref(0)
const rate = ref(1)
const openReview = ref(null)

const exporting = ref(false)
const exportForm = ref(null) // { from: 'HH:MM', to: 'HH:MM', name }
const exportMsg = ref('')

// ---- carga de dados ----

async function loadSummary() {
  if (!camera.value) return
  loading.value = true
  error.value = ''
  try {
    const summary = await api.recordingsSummary(camera.value)
    days.value = summary
      .map((d) => ({ day: d.day, hours: new Map(d.hours.map((h) => [Number(h.hour), h])) }))
      .sort((a, b) => b.day.localeCompare(a.day))
  } catch (e) {
    error.value = e.message
    days.value = []
  } finally {
    loading.value = false
  }
}

async function loadDayReviews() {
  if (!day.value) return (reviews.value = [])
  const after = hourStart(day.value, 0)
  try {
    reviews.value = await api.reviews({ cameras: camera.value, after, before: after + 86400, limit: 500 })
  } catch {
    reviews.value = []
  }
}

async function loadHour(h, seekTs = null) {
  const start = hourStart(day.value, h)
  const end = start + 3600
  let list = []
  try {
    list = await api.recordings(camera.value, start, end)
  } catch (e) {
    error.value = e.message
  }
  // hora, segmentos e posição mudam juntos: o player só recarrega com tudo consistente
  segments.value = list
    .map((s) => ({ start: Math.max(s.start_time, start), end: Math.min(s.end_time, end), motion: s.motion, objects: s.objects }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)
  hour.value = h
  startAt.value = seekTs ? wallToVideo(seekTs) : 0
  videoTime.value = startAt.value
}

// ---- mapeamento hora real <-> posição no vídeo (VOD junta só os trechos gravados) ----

const offsets = computed(() => {
  let acc = 0
  return segments.value.map((s) => {
    const o = { ...s, offset: acc }
    acc += s.end - s.start
    return o
  })
})

function wallToVideo(ts) {
  for (const s of offsets.value) {
    if (ts < s.start) return s.offset // caiu num buraco: vai pro próximo trecho gravado
    if (ts <= s.end) return s.offset + (ts - s.start)
  }
  const last = offsets.value.at(-1)
  return last ? last.offset + (last.end - last.start) : 0
}

function videoToWall(t) {
  for (const s of offsets.value) if (t <= s.offset + (s.end - s.start)) return s.start + (t - s.offset)
  return offsets.value.at(-1)?.end || hourStart(day.value, hour.value ?? 0)
}

// ---- derivados ----

const hourSrc = computed(() => {
  if (hour.value === null || !segments.value.length) return ''
  const start = hourStart(day.value, hour.value)
  return media.vod(camera.value, start, start + 3600)
})

const currentDay = computed(() => days.value.find((d) => d.day === day.value))
const wallNow = computed(() => (segments.value.length ? videoToWall(videoTime.value) : null))

const hourCells = computed(() =>
  Array.from({ length: 24 }, (_, h) => {
    const info = currentDay.value?.hours.get(h)
    const start = hourStart(day.value || '1970-01-01', h)
    const evs = reviews.value.filter((r) => r.start_time >= start && r.start_time < start + 3600)
    return {
      h,
      coverage: info ? Math.min(1, info.duration / 3600) : 0,
      motion: info?.motion || 0,
      alerts: evs.filter((r) => r.severity === 'alert').length,
      detections: evs.filter((r) => r.severity !== 'alert').length,
    }
  }),
)
const maxMotion = computed(() => Math.max(1, ...hourCells.value.map((c) => c.motion)))

const hourReviews = computed(() => {
  if (hour.value === null) return []
  const start = hourStart(day.value, hour.value)
  return reviews.value
    .filter((r) => r.start_time >= start && r.start_time < start + 3600)
    .sort((a, b) => a.start_time - b.start_time)
})

const pct = (ts) => {
  const start = hourStart(day.value, hour.value)
  return `${Math.max(0, Math.min(100, ((ts - start) / 3600) * 100))}%`
}

const hourStats = computed(() => {
  const rec = segments.value.reduce((n, s) => n + (s.end - s.start), 0)
  return { rec, gaps: Math.max(0, 3600 - rec) }
})

// ---- ações ----

function selectDay(d) {
  day.value = d
  hour.value = null
  segments.value = []
  loadDayReviews()
  // abre a hora mais recente gravada do dia
  const hours = [...(currentDay.value?.hours.keys() || [])]
  if (hours.length) loadHour(Math.max(...hours))
}

function onBarClick(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seekWall(hourStart(day.value, hour.value) + frac * 3600)
}

function seekWall(ts) {
  const t = wallToVideo(ts)
  player.value?.seek(t)
  videoTime.value = t
}

function stepHour(delta) {
  const recorded = [...(currentDay.value?.hours.keys() || [])].sort((a, b) => a - b)
  const idx = recorded.indexOf(hour.value)
  const next = recorded[idx + delta]
  if (next !== undefined) return loadHour(next)
  // passa pro dia vizinho
  const di = days.value.findIndex((d) => d.day === day.value)
  const nd = days.value[di - delta]
  if (!nd) return
  day.value = nd.day
  loadDayReviews()
  const hs = [...nd.hours.keys()].sort((a, b) => a - b)
  loadHour(delta > 0 ? hs[0] : hs.at(-1))
}

const canPrev = computed(() => {
  const recorded = [...(currentDay.value?.hours.keys() || [])]
  return recorded.some((h) => h < hour.value) || days.value.findIndex((d) => d.day === day.value) < days.value.length - 1
})
const canNext = computed(() => {
  const recorded = [...(currentDay.value?.hours.keys() || [])]
  return recorded.some((h) => h > hour.value) || days.value.findIndex((d) => d.day === day.value) > 0
})

function snapshot() {
  if (!wallNow.value) return
  const ts = Math.floor(wallNow.value)
  downloadUrl(media.snapshotAt(camera.value, ts), `${camera.value}-${ts}.jpg`)
}

const hhmm = (ts) => shortTime(ts)

function openExport() {
  const now = wallNow.value || hourStart(day.value, hour.value)
  exportForm.value = {
    from: hhmm(now),
    to: hhmm(Math.min(now + 300, hourStart(day.value, hour.value) + 3600)),
    name: '',
  }
  exportMsg.value = ''
}

async function doExport() {
  const f = exportForm.value
  const from = new Date(`${day.value}T${f.from}:00`).getTime() / 1000
  let to = new Date(`${day.value}T${f.to}:00`).getTime() / 1000
  if (to <= from) to += 86400 // atravessou meia-noite
  exporting.value = true
  exportMsg.value = ''
  try {
    await api.createExport(camera.value, from, to, f.name || `${cameraName(camera.value)} ${dayLabel(day.value)} ${f.from}-${f.to}`)
    exportMsg.value = 'ok'
  } catch (e) {
    exportMsg.value = e.message
  } finally {
    exporting.value = false
  }
}

function changeCamera(name) {
  router.replace({ name: 'recordings', params: { camera: name } })
}

function markSeen(id) {
  const r = reviews.value.find((x) => x.id === id)
  if (r) r.has_been_reviewed = true
}

// ---- ciclo ----

async function init() {
  await loadSummary()
  const t = Number(route.query.t)
  if (t) {
    // veio de um evento: abre dia/hora daquele momento
    const d = new Date(t * 1000)
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    day.value = ymd
    loadDayReviews()
    await loadHour(d.getHours(), t - 4)
    return
  }
  if (days.value.length) selectDay(days.value[0].day)
}

watch(camera, init, { immediate: true })
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Gravações</h1>
      <div class="toolbar">
        <select class="input" :value="camera" @change="changeCamera($event.target.value)">
          <option v-for="c in store.cameras" :key="c.name" :value="c.name">{{ cameraName(c.name) }}</option>
        </select>
        <button class="btn icon" title="Atualizar" @click="init"><AppIcon name="refresh" :size="16" /></button>
      </div>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="loading && !days.length" class="empty"><div class="spinner" style="margin: auto" /></div>
    <div v-else-if="!days.length" class="empty card">Nenhuma gravação ainda para esta câmera.</div>

    <template v-else>
      <!-- dias -->
      <div class="days">
        <button
          v-for="d in days"
          :key="d.day"
          :class="['btn', { active: d.day === day }]"
          @click="selectDay(d.day)"
        >
          {{ dayLabel(d.day) }}
        </button>
      </div>

      <!-- 24h -->
      <div class="card day-bar">
        <button
          v-for="c in hourCells"
          :key="c.h"
          :class="['hour', { sel: c.h === hour, empty: !c.coverage }]"
          :disabled="!c.coverage"
          :title="c.coverage ? `${String(c.h).padStart(2, '0')}h · ${Math.round(c.coverage * 100)}% gravado` : 'Sem gravação'"
          @click="loadHour(c.h)"
        >
          <span class="fill" :style="{ height: c.coverage ? `${Math.max(12, c.coverage * 100)}%` : 0, opacity: 0.35 + 0.65 * (c.motion / maxMotion) }" />
          <span v-if="c.alerts" class="mark alert" />
          <span v-else-if="c.detections" class="mark detection" />
          <span class="lbl">{{ String(c.h).padStart(2, '0') }}</span>
        </button>
      </div>

      <div class="layout">
        <div class="main-col">
          <div class="card player">
            <div class="video">
              <HlsPlayer
                ref="player"
                :src="hourSrc"
                :start-at="startAt"
                :rate="rate"
                @time="videoTime = $event"
                @ended="canNext && stepHour(1)"
              />
            </div>

            <!-- detalhe da hora -->
            <div v-if="hour !== null" class="hour-bar" @click="onBarClick">
              <span
                v-for="s in segments"
                :key="s.start"
                class="seg"
                :style="{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }"
              />
              <span
                v-for="r in hourReviews"
                :key="r.id"
                :class="['ev', r.severity]"
                :style="{ left: pct(r.start_time), width: `max(3px, calc(${pct(r.end_time || r.start_time + 5)} - ${pct(r.start_time)}))` }"
                :title="`${time(r.start_time)} · ${(r.data?.objects || []).map(label).join(', ')}`"
              />
              <span v-if="wallNow" class="cursor" :style="{ left: pct(wallNow) }" />
              <span v-for="m in [0, 15, 30, 45]" :key="m" class="tick" :style="{ left: `${(m / 60) * 100}%` }">:{{ String(m).padStart(2, '0') }}</span>
            </div>

            <div class="controls">
              <div class="toolbar">
                <button class="btn icon" :disabled="!canPrev" title="Hora anterior" @click="stepHour(-1)"><AppIcon name="left" :size="16" /></button>
                <strong class="clock">{{ wallNow ? time(wallNow) : '--:--:--' }}</strong>
                <button class="btn icon" :disabled="!canNext" title="Próxima hora" @click="stepHour(1)"><AppIcon name="right" :size="16" /></button>
                <span v-if="hour !== null" class="muted small">
                  {{ String(hour).padStart(2, '0') }}h–{{ String((hour + 1) % 24).padStart(2, '0') }}h: {{ duration(hourStats.rec) }} gravados<template v-if="hourStats.gaps > 60"> · {{ duration(hourStats.gaps) }} sem gravação</template>
                </span>
              </div>
              <div class="toolbar">
                <select v-model.number="rate" class="input" title="Velocidade">
                  <option v-for="r in [0.5, 1, 2, 4, 8, 16]" :key="r" :value="r">{{ r }}×</option>
                </select>
                <button class="btn" :disabled="!wallNow" @click="snapshot"><AppIcon name="camera" :size="15" /> Foto</button>
                <button class="btn" :disabled="hour === null" @click="openExport"><AppIcon name="scissors" :size="15" /> Exportar</button>
              </div>
            </div>

            <form v-if="exportForm" class="export" @submit.prevent="doExport">
              <label>De <input v-model="exportForm.from" type="time" class="input" required /></label>
              <label>Até <input v-model="exportForm.to" type="time" class="input" required /></label>
              <input v-model="exportForm.name" class="input grow" placeholder="Nome (opcional)" />
              <button class="btn primary" :disabled="exporting">{{ exporting ? 'Enviando…' : 'Gerar MP4' }}</button>
              <button type="button" class="btn icon" title="Cancelar" @click="exportForm = null"><AppIcon name="x" :size="15" /></button>
              <span v-if="exportMsg === 'ok'" class="ok-msg">
                Na fila! Acompanhe em <RouterLink to="/exportacoes">Exportações</RouterLink>.
              </span>
              <span v-else-if="exportMsg" class="err-msg">{{ exportMsg }}</span>
            </form>
          </div>
        </div>

        <aside class="side card">
          <h2>Eventos da hora</h2>
          <div v-if="!hourReviews.length" class="muted small pad">Nenhum evento nesta hora.</div>
          <button
            v-for="r in hourReviews"
            :key="r.id"
            :class="['ev-row', { seen: r.has_been_reviewed }]"
            @click="seekWall(r.start_time - 3)"
            @dblclick="openReview = r"
          >
            <img :src="media.file(r.thumb_path)" alt="" loading="lazy" />
            <span class="ev-info">
              <strong>{{ time(r.start_time) }}</strong>
              <span :class="['badge', r.severity]">{{ r.severity === 'alert' ? 'Alerta' : 'Detecção' }}</span>
              <span class="muted small cap">{{ (r.data?.objects || []).map(label).join(', ') || 'movimento' }}</span>
            </span>
            <span class="btn icon" title="Abrir clipe" @click.stop="openReview = r"><AppIcon name="play" :size="13" /></span>
          </button>
        </aside>
      </div>
    </template>

    <ReviewModal v-if="openReview" :item="openReview" @close="openReview = null" @viewed="markSeen" />
  </div>
</template>

<style scoped>
.days { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 10px; scrollbar-width: thin; }
.days .btn { text-transform: capitalize; flex-shrink: 0; }

.day-bar { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; padding: 8px; margin-bottom: 14px; }
.hour {
  position: relative;
  height: 54px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--bg-3);
  padding: 0;
  cursor: pointer;
  overflow: hidden;
}
.hour.empty { cursor: default; background: var(--bg); }
.hour.sel { border-color: var(--accent); }
.hour .fill { position: absolute; left: 0; right: 0; bottom: 0; background: var(--accent-2); }
.hour .lbl { position: absolute; bottom: 3px; left: 0; right: 0; font-size: 10px; color: var(--text); text-align: center; }
.hour.empty .lbl { color: var(--muted); }
.hour .mark { position: absolute; top: 4px; left: 50%; width: 7px; height: 7px; border-radius: 50%; transform: translateX(-50%); }
.mark.alert { background: var(--alert); }
.mark.detection { background: var(--detect); }

.layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.player { overflow: hidden; }
.video { aspect-ratio: 16 / 9; background: #000; }

.hour-bar {
  position: relative;
  height: 34px;
  margin: 10px 12px 0;
  border-radius: 6px;
  background: var(--bg);
  cursor: pointer;
  overflow: hidden;
}
.seg { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--accent-2) 45%, transparent); }
.ev { position: absolute; top: 3px; height: 8px; border-radius: 3px; }
.ev.alert { background: var(--alert); }
.ev.detection { background: var(--detect); }
.cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; box-shadow: 0 0 4px #000; pointer-events: none; }
.tick { position: absolute; bottom: 2px; font-size: 10px; color: var(--muted); padding-left: 3px; border-left: 1px solid var(--line); pointer-events: none; }

.controls { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; }
.clock { font-variant-numeric: tabular-nums; font-size: 16px; min-width: 80px; text-align: center; }
.small { font-size: 12px; }

.export { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 10px 12px; border-top: 1px solid var(--line); }
.export label { display: flex; align-items: center; gap: 6px; }
.export .grow { flex: 1; min-width: 140px; }
.ok-msg { color: var(--ok); width: 100%; }
.err-msg { color: var(--bad); width: 100%; }

.side { padding: 12px; max-height: calc(100vh - 230px); overflow: auto; }
.side h2 { font-size: 15px; margin: 0 0 10px; }
.pad { padding: 6px 0; }
.ev-row {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.ev-row:hover { background: var(--bg-3); border-color: var(--line); }
.ev-row.seen { opacity: 0.65; }
.ev-row img { width: 88px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; background: #000; flex-shrink: 0; }
.ev-info { display: grid; gap: 2px; flex: 1; min-width: 0; justify-items: start; }
.cap { text-transform: capitalize; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .side { max-height: none; }
}
@media (max-width: 760px) {
  .day-bar { grid-template-columns: repeat(12, 1fr); }
  .hour { height: 40px; }
  .controls { padding: 8px; }
  .hour-bar { margin: 8px 8px 0; }
}
</style>
