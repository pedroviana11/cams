import { reactive } from 'vue'

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

export const session = reactive({ user: null, role: null, checked: false })

export class AuthError extends Error {}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      // a UI oficial do Frigate manda esse header em toda requisição que altera estado
      'X-CSRF-TOKEN': '1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401) {
    session.user = null
    throw new AuthError('Sessão expirada')
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      msg = j.message || j.detail || msg
    } catch {}
    throw new Error(msg)
  }
  const type = res.headers.get('content-type') || ''
  return type.includes('json') ? res.json() : res.text()
}

const qs = (params) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  login: (user, password) => request('/api/login', { method: 'POST', body: { user, password } }),
  logout: () => fetch('/api/logout', { credentials: 'same-origin', redirect: 'manual' }),
  profile: () => request('/api/profile'),

  config: () => request('/api/config'),
  stats: () => request('/api/stats'),
  storage: () => request('/api/recordings/storage'),

  recordingsSummary: (camera) => request(`/api/${camera}/recordings/summary${qs({ timezone: TZ })}`),
  recordings: (camera, after, before) => request(`/api/${camera}/recordings${qs({ after, before })}`),

  reviews: (params) => request(`/api/review${qs(params)}`),
  markViewed: (ids, reviewed = true) => request('/api/reviews/viewed', { method: 'POST', body: { ids, reviewed } }),

  exports: () => request('/api/exports'),
  createExport: (camera, start, end, name) =>
    request(`/api/export/${camera}/start/${Math.floor(start)}/end/${Math.ceil(end)}`, {
      method: 'POST',
      body: { playback: 'realtime', name },
    }),
  deleteExports: (ids) => request('/api/exports/delete', { method: 'POST', body: { ids } }),
}

// URLs de mídia (usadas direto em <img>/<video>, o cookie de sessão vai junto)
export const media = {
  latest: (camera, height = 360, bust = Date.now()) => `/api/${camera}/latest.webp?height=${height}&t=${bust}`,
  mjpeg: (camera, height = 360) => `/api/${camera}?fps=5&height=${height}`,
  vod: (camera, start, end) => `/vod/${camera}/start/${Math.floor(start)}/end/${Math.ceil(end)}/index.m3u8`,
  snapshotAt: (camera, ts) => `/api/${camera}/recordings/${ts}/snapshot.jpg`,
  reviewClip: (id) => `/api/review/${id}/clip.mp4`,
  // o Frigate devolve caminhos do disco (/media/frigate/...), que o nginx serve sem esse prefixo
  file: (path) => (path ? path.replace(/^\/media\/frigate/, '') : ''),
  mseSocket: (stream) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}/live/mse/api/ws?src=${encodeURIComponent(stream)}`
  },
}
