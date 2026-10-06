import { createRouter, createWebHistory } from 'vue-router'
import { api, session } from './api'
import { loadConfig, store } from './store'

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'live', component: () => import('./views/LiveView.vue') },
  { path: '/camera/:name', name: 'camera', component: () => import('./views/CameraView.vue'), props: true },
  { path: '/gravacoes/:camera?', name: 'recordings', component: () => import('./views/RecordingsView.vue') },
  { path: '/eventos', name: 'review', component: () => import('./views/ReviewView.vue') },
  { path: '/exportacoes', name: 'exports', component: () => import('./views/ExportsView.vue') },
  { path: '/sistema', name: 'system', component: () => import('./views/SystemView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  if (!session.checked) {
    try {
      const p = await api.profile()
      session.user = p.username
      session.role = p.role
    } catch {
      session.user = null
    }
    session.checked = true
  }
  if (to.meta.public) return session.user ? { name: 'live' } : true
  if (!session.user) return { name: 'login', query: { next: to.fullPath } }
  if (!store.config) {
    try {
      await loadConfig()
    } catch {
      return { name: 'login', query: { next: to.fullPath } }
    }
  }
  return true
})

export default router
