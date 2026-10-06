<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, session } from './api'
import AppIcon from './components/AppIcon.vue'

const route = useRoute()
const router = useRouter()

const nav = [
  { to: '/', name: 'live', label: 'Ao vivo', icon: 'live' },
  { to: '/gravacoes', name: 'recordings', label: 'Gravações', icon: 'film' },
  { to: '/eventos', name: 'review', label: 'Eventos', icon: 'bell' },
  { to: '/exportacoes', name: 'exports', label: 'Exportações', icon: 'download' },
  { to: '/sistema', name: 'system', label: 'Sistema', icon: 'activity' },
]

const showShell = computed(() => !route.meta.public)
const isActive = (item) => route.name === item.name || (item.name === 'live' && route.name === 'camera')

// qualquer 401 no meio do uso zera a sessão; volta pro login mantendo a página atual
watch(
  () => session.user,
  (u) => {
    if (!u && session.checked && !route.meta.public) router.push({ name: 'login', query: { next: route.fullPath } })
  },
)

async function logout() {
  await api.logout().catch(() => {})
  session.user = null
}
</script>

<template>
  <div :class="['shell', { bare: !showShell }]">
    <nav v-if="showShell" class="nav">
      <div class="brand">
        <AppIcon name="live" :size="20" />
        <span>Câmeras</span>
      </div>
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :class="['nav-item', { active: isActive(item) }]">
        <AppIcon :name="item.icon" />
        <span>{{ item.label }}</span>
      </RouterLink>
      <div class="spacer" />
      <div class="user">
        <span class="muted">{{ session.user }}</span>
        <button class="btn icon" title="Sair" @click="logout"><AppIcon name="logout" :size="16" /></button>
      </div>
    </nav>
    <main class="main">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; min-height: 100dvh; }
.main { flex: 1; min-width: 0; }

.nav {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  width: var(--nav-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  background: var(--bg-2);
  border-right: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  padding: 4px 10px 18px;
  color: var(--accent);
}
.brand span { color: var(--text); }
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: var(--bg-3); color: var(--text); }
.nav-item.active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.spacer { flex: 1; }
.user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 6px 0 12px;
  border-top: 1px solid var(--line);
}

/* tablet: só ícones */
@media (max-width: 1100px) {
  .nav { width: 68px; align-items: center; padding: 16px 8px; }
  .nav-item span, .brand span, .user span { display: none; }
  .brand { padding: 4px 0 18px; }
  .user { padding: 10px 0 0; border: 0; }
}

/* celular: barra inferior */
@media (max-width: 760px) {
  .shell { flex-direction: column-reverse; }
  .main { padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom)); }
  .nav {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    width: auto;
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    flex-direction: row;
    justify-content: space-around;
    padding: 6px 4px env(safe-area-inset-bottom);
    border-right: 0;
    border-top: 1px solid var(--line);
  }
  .brand, .spacer { display: none; }
  .nav-item { flex-direction: column; gap: 2px; padding: 6px 4px; font-size: 11px; flex: 1; }
  .nav-item span { display: block; }
  .user { padding: 0 4px; }
}
</style>
