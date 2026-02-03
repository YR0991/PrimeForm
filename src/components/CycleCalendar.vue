<template>
  <div class="cycle-calendar">
    <div class="calendar-header row items-center justify-between q-mb-md">
      <q-btn flat dense round icon="chevron_left" @click="prevMonth" />
      <span class="text-h6">{{ monthLabel }}</span>
      <q-btn flat dense round icon="chevron_right" @click="nextMonth" />
    </div>
    <div class="calendar-weekdays row">
      <div v-for="d in weekdays" :key="d" class="weekday-cell">{{ d }}</div>
    </div>
    <div class="calendar-grid">
      <div
        v-for="(day, idx) in gridDays"
        :key="idx"
        class="day-cell"
        :class="[day ? phaseClass(day) : 'empty', { 'other-month': day && !isCurrentMonth(day) }]"
        @click="day ? (selectedDay = day) : null"
      >
        <template v-if="day">{{ day.getDate() }}</template>
      </div>
    </div>
    <div v-if="selectedDay" class="selected-phase q-mt-sm text-body2">
      {{ phaseLabel(selectedDay) }}
    </div>
    <div class="legend q-mt-md row q-gutter-md">
      <span class="legend-item menstruation">Menstruatie</span>
      <span class="legend-item follicular">Folliculair/Ovulatie</span>
      <span class="legend-item luteal">Luteaal</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  lastPeriodDate: { type: String, default: '' },
  cycleLength: { type: Number, default: 28 },
})

const weekdays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const viewDate = ref(new Date())
const selectedDay = ref(null)

watch(() => props.lastPeriodDate, (v) => {
  if (v) viewDate.value = new Date(v + 'T12:00:00')
}, { immediate: true })

const monthLabel = computed(() => {
  return viewDate.value.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
})

function getCycleDay(date) {
  if (!props.lastPeriodDate) return null
  const start = new Date(props.lastPeriodDate + 'T12:00:00')
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  start.setHours(12, 0, 0, 0)
  const diff = Math.floor((d - start) / (24 * 60 * 60 * 1000))
  if (diff < 0) return null
  const day = (diff % props.cycleLength) + 1
  return day
}

function getPhase(cycleDay) {
  if (cycleDay === null) return null
  if (cycleDay <= 5) return 'menstruation'
  const ov = Math.floor(props.cycleLength / 2)
  if (cycleDay <= ov) return 'follicular'
  return 'luteal'
}

function phaseClass(date) {
  const phase = getPhase(getCycleDay(date))
  return phase ? `phase-${phase}` : ''
}

function phaseLabel(date) {
  const day = getCycleDay(date)
  if (day === null) return 'Onbekend'
  const phase = getPhase(day)
  const labels = { menstruation: 'Menstruatie', follicular: 'Folliculair / Ovulatie', luteal: 'Luteaal' }
  return `Dag ${day} – ${labels[phase] || 'Onbekend'}`
}

function isCurrentMonth(date) {
  return date.getMonth() === viewDate.value.getMonth()
}

const gridDays = computed(() => {
  const year = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth()
  const first = new Date(year, month, 1)
  let start = new Date(first)
  const startDow = start.getDay()
  const nlDow = startDow === 0 ? 6 : startDow - 1
  start.setDate(start.getDate() - nlDow)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
})

function prevMonth() {
  const d = new Date(viewDate.value)
  d.setMonth(d.getMonth() - 1)
  viewDate.value = d
}

function nextMonth() {
  const d = new Date(viewDate.value)
  d.setMonth(d.getMonth() + 1)
  viewDate.value = d
}
</script>

<style scoped>
.cycle-calendar {
  background: rgba(18, 18, 18, 0.8);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.calendar-header {
  color: rgba(255, 255, 255, 0.9);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday-cell {
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
}

.day-cell.empty {
  cursor: default;
  background: transparent;
  color: transparent;
}

.day-cell.other-month {
  opacity: 0.5;
}

.day-cell.phase-menstruation {
  background: rgba(244, 67, 54, 0.35);
  border: 1px solid rgba(244, 67, 54, 0.5);
}

.day-cell.phase-follicular {
  background: rgba(76, 175, 80, 0.3);
  border: 1px solid rgba(76, 175, 80, 0.5);
}

.day-cell.phase-luteal {
  background: rgba(255, 152, 0, 0.35);
  border: 1px solid rgba(255, 152, 0, 0.5);
}

.selected-phase {
  color: #D4AF37;
  padding: 8px 0;
}

.legend {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.legend-item.menstruation { color: #ef5350; }
.legend-item.follicular { color: #66bb6a; }
.legend-item.luteal { color: #ffa726; }
</style>
