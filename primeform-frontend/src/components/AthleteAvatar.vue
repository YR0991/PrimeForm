<template>
  <q-avatar
    :size="size"
    :color="showFallback ? 'rgba(255,255,255,0.1)' : undefined"
    :text-color="showFallback ? '#9ca3af' : undefined"
    font-size="0.9em"
  >
    <img
      v-if="avatar && !showFallback"
      :src="avatar"
      :alt="name || 'Avatar'"
      referrerpolicy="no-referrer"
      @error="onImgError"
    />
    <span v-else>{{ initials }}</span>
  </q-avatar>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  /** Profile image URL (e.g. Strava profile_medium). */
  avatar: { type: String, default: null },
  /** Display name for initials fallback (e.g. "Jane Doe" → "JD"). */
  name: { type: String, default: '' },
  size: { type: String, default: '32px' },
})

const showFallback = ref(!props.avatar)

function onImgError() {
  showFallback.value = true
}

watch(
  () => props.avatar,
  (url) => {
    showFallback.value = !url
  }
)

const initials = computed(() => {
  const n = (props.name || '').trim()
  if (!n) return '?'
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return n.slice(0, 2).toUpperCase()
})
</script>
