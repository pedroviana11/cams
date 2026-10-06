const dt = (opts) => new Intl.DateTimeFormat('pt-BR', opts)

const fTime = dt({ hour: '2-digit', minute: '2-digit', second: '2-digit' })
const fShort = dt({ hour: '2-digit', minute: '2-digit' })
const fDay = dt({ weekday: 'short', day: '2-digit', month: '2-digit' })
const fFull = dt({ day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const time = (ts) => fTime.format(ts * 1000)
export const shortTime = (ts) => fShort.format(ts * 1000)
export const dateTime = (ts) => fFull.format(ts * 1000)

// "2026-10-02" -> "sex., 02/10" (meio-dia evita virar o dia por fuso)
export const dayLabel = (day) => fDay.format(new Date(`${day}T12:00:00`))

export const duration = (s) => {
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m) return `${m}min ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

export const uptime = (s) => {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`
}

// tamanhos do Frigate vêm em MB
export const size = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`)

export const label = (s) =>
  ({ person: 'pessoa', car: 'carro', cat: 'gato', dog: 'cachorro', motion: 'movimento' })[s] || s

// início (epoch) de uma hora local de um dia "YYYY-MM-DD"
export const hourStart = (day, hour) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).getTime() / 1000

export const quality = (q) =>
  ({ excellent: 'excelente', good: 'boa', fair: 'regular', poor: 'ruim', unusable: 'inutilizável' })[q] || q || '—'

export const cameraName = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
