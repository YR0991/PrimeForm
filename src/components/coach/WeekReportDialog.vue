<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    class="week-report-dialog"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <q-card class="week-report-card" flat dark>
      <q-card-section class="week-report-header">
        <div class="week-report-header-main">
          <div class="week-report-title">WEEKRAPPORT</div>
          <div v-if="athleteName" class="week-report-subtitle">
            {{ athleteName }}
          </div>
        </div>
        <q-btn flat round icon="close" color="grey" @click="emit('update:modelValue', false)" />
      </q-card-section>

      <q-card-section v-if="loading" class="week-report-loading">
        <q-spinner-orbit color="#fbbf24" size="48px" />
        <p class="loading-text">Analyseren van data & cyclus...</p>
      </q-card-section>

      <q-card-section v-else-if="reportMessage || reportStats" class="week-report-body">
        <q-input
          v-if="reportStats"
          v-model="reportStats"
          type="textarea"
          outlined
          dark
          autogrow
          dense
          class="stats-input q-mb-sm"
          label="Stats"
          hide-bottom-space
        />
        <q-input
          v-model="reportMessage"
          type="textarea"
          outlined
          dark
          autogrow
          dense
          class="message-input"
          label="Rapport"
          hide-bottom-space
        />
      </q-card-section>

      <q-card-section v-else class="week-report-body">
        <p class="no-data">Geen rapport beschikbaar.</p>
      </q-card-section>

      <q-card-actions class="week-report-actions">
        <q-btn
          flat
          icon="refresh"
          label="Regenerate"
          color="amber"
          @click="regenerate"
        />
        <q-btn
          flat
          icon="content_copy"
          label="Kopieer"
          color="amber"
          @click="doCopy"
        />
        <q-space />
        <q-btn flat label="Sluiten" color="grey" @click="emit('update:modelValue', false)" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Notify, copyToClipboard } from 'quasar'
import { fetchWeekReport } from '../../services/coachService'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  athleteId: { type: String, default: '' },
  athleteName: { type: String, default: '' },
  defaultWeekRange: {
    type: Object,
    default: null,
  },
  coachNotes: { type: String, default: '' },
  directive: { type: String, default: '' },
  injuries: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const loading = ref(false)
const reportMessage = ref('')
const reportStats = ref('')

const effectiveRange = computed(() => {
  const r = props.defaultWeekRange || null
  if (!r || !r.from || !r.to) return null
  return { from: String(r.from).slice(0, 10), to: String(r.to).slice(0, 10) }
})

async function loadReport() {
  if (!props.athleteId) return

  loading.value = true
  reportMessage.value = ''
  reportStats.value = ''

  try {
    const range = effectiveRange.value
    const result = await fetchWeekReport(props.athleteId, {
      coachNotes: props.coachNotes || undefined,
      directive: props.directive || undefined,
      injuries: props.injuries ? [props.injuries] : undefined,
      from: range?.from,
      to: range?.to,
    })
    reportStats.value = result.stats || ''
    reportMessage.value = result.message || ''
  } catch (err) {
    console.error('Week report failed:', err)
    Notify.create({
      type: 'negative',
      message: err?.message || 'Weekrapport ophalen mislukt.',
    })
  } finally {
    loading.value = false
  }
}

async function regenerate() {
  await loadReport()
}

/**
 * Maak plain text voor WhatsApp:
 * - Geen markdown headers / bullets
 * - Geen **vet** of _italic_ syntax
 */
function toPlainText(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return ''
  let s = markdownText.trim()
  // Verwijder code fences
  s = s.replace(/```[\s\S]*?```/g, '')
  // Headers (# ...) verwijderen
  s = s.replace(/^#{1,6}\s+/gm, '')
  // Bullet-prefixes (-, *, +) verwijderen
  s = s.replace(/^\s*[-*+]\s+/gm, '')
  // Inline markdown-symbolen verwijderen
  s = s.replace(/[*_`]/g, '')
  // Meerdere lege regels samenvoegen
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

function doCopy() {
  const raw = (reportMessage.value || '').trim()
  if (!raw) {
    Notify.create({ type: 'warning', message: 'Geen inhoud om te kopiëren.' })
    return
  }
  const text = toPlainText(raw)
  const doNativeCopy = typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function'

  const copyPromise = doNativeCopy
    ? navigator.clipboard.writeText(text)
    : copyToClipboard(text)

  copyPromise
    .then(() => {
      Notify.create({
        type: 'positive',
        message: 'Gekopieerd',
      })
    })
    .catch(() => {
      Notify.create({
        type: 'negative',
        message: 'Kopiëren mislukt.',
      })
    })
}

watch(
  () => [props.modelValue, props.athleteId],
  ([open, id]) => {
    if (open && id) {
      if (!reportMessage.value) loadReport()
    }
    if (!open) {
      reportMessage.value = ''
      reportStats.value = ''
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
@use '../../css/quasar.variables' as q;

.week-report-dialog :deep(.q-dialog__backdrop) {
  background: rgba(0, 0, 0, 0.7);
}

.week-report-card {
  background: q.$prime-black !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: q.$radius-sm;
  min-width: 420px;
  max-width: 560px;
}

.week-report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 20px;
}

.week-report-header-main {
  display: flex;
  flex-direction: column;
}

.week-report-title {
  font-family: q.$typography-font-family;
  font-weight: 700;
  font-size: 1rem;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.week-report-subtitle {
  margin-top: 2px;
  font-family: q.$typography-font-family;
  font-size: 0.75rem;
  color: q.$prime-gray;
}

.week-report-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 20px;
}

.loading-text {
  font-family: q.$typography-font-family;
  font-size: 0.875rem;
  color: q.$prime-gray;
  margin: 0;
}

.week-report-body {
  padding: 20px;
}

.stats-input :deep(.q-field__control),
.message-input :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}

.stats-input :deep(textarea),
.message-input :deep(textarea) {
  font-family: q.$mono-font;
  font-size: 0.85rem;
  color: #ffffff;
}

.message-input :deep(textarea) {
  font-family: q.$typography-font-family;
  min-height: 200px;
}

.no-data {
  font-size: 0.875rem;
  color: q.$prime-gray;
  margin: 0;
}

.week-report-actions {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 20px;
}
</style>
