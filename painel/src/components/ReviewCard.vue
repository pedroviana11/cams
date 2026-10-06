<script setup>
import { computed } from 'vue'
import { media } from '../api'
import { cameraName, dateTime, duration, label } from '../format'

const props = defineProps({ item: { type: Object, required: true }, showCamera: { type: Boolean, default: true } })
defineEmits(['open'])

const objects = computed(() => {
  const d = props.item.data || {}
  const list = [...new Set([...(d.objects || []), ...(d.audio || [])])].map((o) => label(o.replace(/-verified$/, '')))
  return list.length ? list : ['movimento']
})
const len = computed(() => (props.item.end_time ? duration(props.item.end_time - props.item.start_time) : 'em andamento'))
</script>

<template>
  <button :class="['review', { seen: item.has_been_reviewed }]" @click="$emit('open', item)">
    <div class="thumb">
      <img :src="media.file(item.thumb_path)" loading="lazy" alt="" />
      <span :class="['badge', item.severity]">{{ item.severity === 'alert' ? 'Alerta' : 'Detecção' }}</span>
      <span class="len">{{ len }}</span>
    </div>
    <div class="info">
      <div class="row">
        <strong>{{ objects.join(', ') }}</strong>
        <span v-if="!item.has_been_reviewed" class="new" title="Não visto" />
      </div>
      <div class="muted small">
        <template v-if="showCamera">{{ cameraName(item.camera) }} · </template>{{ dateTime(item.start_time) }}
      </div>
      <div v-if="item.data?.zones?.length" class="muted small">Zona: {{ item.data.zones.join(', ') }}</div>
    </div>
  </button>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  text-align: left;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-2);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.review:hover { border-color: var(--accent); }
.review.seen { opacity: 0.7; }
.thumb { position: relative; aspect-ratio: 16 / 9; background: #000; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb .badge { position: absolute; top: 8px; left: 8px; background: rgba(0, 0, 0, 0.65); }
.len {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.7);
}
.info { padding: 10px 12px; display: grid; gap: 2px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; text-transform: capitalize; }
.small { font-size: 12px; }
.new { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
</style>
