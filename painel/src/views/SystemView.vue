<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import { useStats } from '../composables'
import { cameraName, quality, size, uptime } from '../format'

const { stats, error } = useStats(3000)
const storage = ref({})

onMounted(async () => {
  try {
    storage.value = await api.storage()
  } catch {}
})

const service = computed(() => stats.value?.service || {})
const disk = computed(() => service.value.storage?.['/media/frigate/recordings'])
const diskPct = computed(() => (disk.value ? (disk.value.used / disk.value.total) * 100 : 0))
const cpuTotal = computed(() => stats.value?.cpu_usages?.['frigate.full_system'])
const recordingsTotal = computed(() => Object.values(storage.value).reduce((n, c) => n + (c.usage || 0), 0))

// dias de gravação contínua que o espaço livre ainda comporta
const daysLeft = computed(() => {
  const bw = Object.values(storage.value).reduce((n, c) => n + (c.bandwidth || 0), 0) // MB/h
  if (!bw || !disk.value) return null
  return disk.value.free / (bw * 24)
})

const bar = (p) => ({ width: `${Math.min(100, p)}%`, background: p > 90 ? 'var(--bad)' : p > 75 ? 'var(--warn)' : 'var(--accent-2)' })
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Sistema</h1>
      <span v-if="service.version" class="muted">Frigate {{ service.version }}</span>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="!stats" class="empty"><div class="spinner" style="margin: auto" /></div>

    <template v-else>
      <div class="tiles">
        <div class="card tile">
          <span class="muted">Ligado há</span>
          <strong>{{ uptime(service.uptime || 0) }}</strong>
        </div>
        <div class="card tile">
          <span class="muted">CPU (sistema)</span>
          <strong>{{ cpuTotal ? `${cpuTotal.cpu}%` : '—' }}</strong>
          <span class="muted small">RAM {{ cpuTotal?.mem ?? '—' }}%</span>
        </div>
        <div v-for="(d, name) in stats.detectors" :key="name" class="card tile">
          <span class="muted">Detector {{ name }}</span>
          <strong>{{ d.inference_speed }} ms</strong>
          <span class="muted small">por inferência</span>
        </div>
        <div class="card tile">
          <span class="muted">Gravações</span>
          <strong>{{ size(recordingsTotal) }}</strong>
          <span v-if="daysLeft !== null" class="muted small">espaço livre p/ ~{{ Math.floor(daysLeft) }} dias</span>
        </div>
      </div>

      <div v-if="disk" class="card block">
        <div class="row">
          <h2>Disco das gravações</h2>
          <span class="muted">{{ size(disk.used) }} de {{ size(disk.total) }} · {{ size(disk.free) }} livres</span>
        </div>
        <div class="meter"><span :style="bar(diskPct)" /></div>
        <div v-if="disk.mount_type === 'tmpfs' || disk.mount_type === 'overlay'" class="warn-text small">
          Atenção: as gravações não estão num disco dedicado ({{ disk.mount_type }}).
        </div>
      </div>

      <div class="card block">
        <h2>Câmeras</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Câmera</th>
                <th>Conexão</th>
                <th>FPS análise</th>
                <th>Detecção</th>
                <th>Reconexões/h</th>
                <th>CPU ffmpeg</th>
                <th>Armazenado</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c, name) in stats.cameras" :key="name">
                <td><span :class="['dot', c.camera_fps ? 'ok' : 'bad']" /> {{ cameraName(name) }}</td>
                <td>{{ quality(c.connection_quality) }}</td>
                <td>{{ c.camera_fps }}</td>
                <td>{{ c.detection_enabled ? `${c.detection_fps} fps` : 'off' }}</td>
                <td>{{ c.reconnects_last_hour ?? 0 }}</td>
                <td>{{ c.ffmpeg_cpu }}%</td>
                <td>{{ storage[name] ? size(storage[name].usage) : '—' }}</td>
                <td>{{ storage[name]?.bandwidth ? `${size(storage[name].bandwidth)}/h` : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card block">
        <h2>Processos</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Processo</th><th>PID</th><th>CPU</th><th>RAM</th></tr></thead>
            <tbody>
              <tr v-for="(p, name) in stats.processes" :key="name">
                <td>{{ name }}</td>
                <td class="muted">{{ p.pid }}</td>
                <td>{{ stats.cpu_usages?.[p.pid]?.cpu ?? '—' }}%</td>
                <td>{{ stats.cpu_usages?.[p.pid]?.mem ?? '—' }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-bottom: 14px; }
.tile { padding: 14px; display: grid; gap: 2px; }
.tile strong { font-size: 22px; font-weight: 600; }
.small { font-size: 12px; }
.block { padding: 14px; margin-bottom: 14px; }
.block h2 { font-size: 15px; margin: 0 0 10px; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.meter { height: 10px; border-radius: 99px; background: var(--bg-3); overflow: hidden; }
.meter span { display: block; height: 100%; border-radius: 99px; transition: width 0.4s; }
.warn-text { color: var(--warn); margin-top: 8px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { color: var(--muted); font-weight: 500; }
tr:last-child td { border-bottom: 0; }
</style>
