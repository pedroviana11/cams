<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, AuthError, session } from '../api'
import { loadConfig } from '../store'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()

const user = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await api.login(user.value, password.value)
    const p = await api.profile()
    session.user = p.username
    session.role = p.role
    await loadConfig()
    router.replace(route.query.next || '/')
  } catch (e) {
    error.value = e instanceof AuthError ? 'Usuário ou senha inválidos.' : e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <form class="card box" @submit.prevent="submit">
      <div class="brand"><AppIcon name="live" :size="26" /> Câmeras</div>
      <p class="muted">Entre com seu usuário e senha.</p>
      <label>
        Usuário
        <input v-model="user" class="input" autocomplete="username" autocapitalize="none" required autofocus />
      </label>
      <label>
        Senha
        <input v-model="password" class="input" type="password" autocomplete="current-password" required />
      </label>
      <div v-if="error" class="error-box">{{ error }}</div>
      <button class="btn primary" :disabled="busy">{{ busy ? 'Entrando…' : 'Entrar' }}</button>
    </form>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 16px; }
.box { width: min(360px, 100%); padding: 24px; display: grid; gap: 14px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 600; color: var(--accent); }
p { margin: -6px 0 4px; }
label { display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
label .input { color: var(--text); padding: 10px 12px; }
.btn.primary { justify-content: center; padding: 10px; }
.error-box { margin: 0; }
</style>
