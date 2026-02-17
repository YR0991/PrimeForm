<template>
  <div class="cycle-comparison-card">
    <div class="header row items-center justify-between q-mb-sm">
      <div class="card-label">Cyclus vergelijking</div>
      <div class="metric-toggle row items-center q-gutter-xs">
        <q-btn
          dense
          flat
          no-caps
          :color="selectedMetric === 'hrv' ? 'primary' : 'grey-6'"
          @click="selectedMetric = 'hrv'"
        >
          Toon HRV
        </q-btn>
        <q-btn
          dense
          flat
          no-caps
          :color="selectedMetric === 'rhr' ? 'primary' : 'grey-6'"
          @click="selectedMetric = 'rhr'"
        >
          Toon RHR
        </q-btn>
      </div>
    </div>

    <div v-if="!hasEnoughData" class="empty-state text-grey text-center q-pa-md">
      Nog niet genoeg cyclusdata om een vergelijking te maken.
    </div>
    <div v-else class="apex-wrap">
      <VueApexCharts
        type="line"
        height="260"
        :options="chartOptions"
        :series="series"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  },
  lastPeriodDate: {
    type: String,
    default: ''
  },
  cycleLength: {
    type: Number,
    default: 28
  }
})

const selectedMetric = ref('hrv') // 'hrv' | 'rhr'

const toMillis = (ts) => {
  if (!ts) return 0
  const d = new Date(ts)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

const inferCycleDayFromProfile = (entry) => {
  if (!props.lastPeriodDate) return null

  const rawDate = entry.date || entry.timestamp
  if (!rawDate) return null

  const entryDate = new Date(rawDate)
  const lastPeriod = new Date(props.lastPeriodDate)
  if (isNaN(entryDate.getTime()) || isNaN(lastPeriod.getTime())) return null

  const diffMs = entryDate.getTime() - lastPeriod.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const len = Number.isFinite(props.cycleLength) && props.cycleLength > 0 ? props.cycleLength : 28

  // Modulo zodat we altijd een waarde tussen 1 en len krijgen
  const mod = ((diffDays % len) + len) % len
  return mod + 1
}

const getCycleDay = (entry) => {
  // Direct opgeslagen cycleDay velden
  const direct = Number(entry.cycleDay)
  if (Number.isFinite(direct) && direct > 0) return direct

  const metricsDay = Number(entry.metrics?.cycleDay)
  if (Number.isFinite(metricsDay) && metricsDay > 0) return metricsDay

  const nestedDay = Number(entry.cycle?.day)
  if (Number.isFinite(nestedDay) && nestedDay > 0) return nestedDay

  const infoDay = Number(entry.cycleInfo?.currentCycleDay)
  if (Number.isFinite(infoDay) && infoDay > 0) return infoDay

  // Fallback: bereken op basis van profiel (lastPeriod + cycleLength)
  return inferCycleDayFromProfile(entry)
}

const getMetricValue = (entry, metricKey) => {
  if (metricKey === 'hrv') {
    const v =
      Number(entry.hrv) ||
      Number(entry.metrics?.hrv?.current) ||
      Number(entry.metrics?.hrv?.value) ||
      Number(entry.metrics?.hrv)
    return Number.isFinite(v) && v > 0 ? v : null
  }

  if (metricKey === 'rhr') {
    const v =
      Number(entry.metrics?.rhr?.current) ||
      Number(entry.metrics?.rhr)
    return Number.isFinite(v) && v > 0 ? v : null
  }

  return null
}

const hasEnoughData = computed(() => {
  const logs = Array.isArray(props.history) ? props.history : []
  return logs.length > 0
})

const series = computed(() => {
  const logs = Array.isArray(props.history) ? props.history : []
  if (logs.length === 0) {
    return [
      { name: 'Vorige cyclus', data: [] },
      { name: 'Huidige cyclus', data: [] },
      { name: 'Projectie', data: [] }
    ]
  }

  const sorted = [...logs].sort((a, b) => toMillis(a.timestamp || a.date) - toMillis(b.timestamp || b.date)) // oud -> nieuw

  const markers = sorted
    .map((entry, idx) => ({ idx, day: getCycleDay(entry) }))
    .filter((m) => m.day === 1)

  let currentLogs = []
  let previousLogs = []

  if (markers.length >= 2) {
    const lastStart = markers[markers.length - 1].idx
    const prevStart = markers[markers.length - 2].idx
    currentLogs = sorted.slice(lastStart)
    previousLogs = sorted.slice(prevStart, lastStart)
  } else if (markers.length === 1) {
    const lastStart = markers[0].idx
    currentLogs = sorted.slice(lastStart)
    previousLogs = []
  } else {
    // Geen expliciete dag-1 markers → alles behandelen als huidige cyclus
    currentLogs = sorted
    previousLogs = []
  }

  const metric = selectedMetric.value

  const mapCycle = (entries) => {
    const points = []

    entries.forEach((entry, idxInCycle) => {
      const cycleDay = getCycleDay(entry)
      const day = Number.isFinite(cycleDay) && cycleDay > 0 ? cycleDay : idxInCycle + 1
      const value = getMetricValue(entry, metric)
      if (value == null) return

      points.push({ x: day, y: value })
    })

    // Deduplicate by day (keep the latest value for that day)
    const byDay = new Map()
    for (const p of points) {
      byDay.set(p.x, p.y)
    }

    return Array.from(byDay.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([x, y]) => ({ x, y }))
  }

  const previousSeries = mapCycle(previousLogs)
  const currentSeries = mapCycle(currentLogs)

  // Projectie: vanaf huidige max dag de lijn van vorige cyclus kopiëren
  const projectionSeries = []
  if (previousSeries.length > 0 && currentSeries.length > 0) {
    const maxCurrentDay = currentSeries.reduce((max, p) => Math.max(max, p.x), 0)

    previousSeries.forEach((p) => {
      if (p.x > maxCurrentDay) {
        projectionSeries.push({ x: p.x, y: p.y })
      }
    })
  }

  return [
    { name: 'Vorige cyclus', data: previousSeries },
    { name: 'Huidige cyclus', data: currentSeries },
    { name: 'Projectie', data: projectionSeries }
  ]
})

const chartOptions = computed(() => ({
  chart: {
    type: 'line',
    background: 'transparent',
    toolbar: { show: false },
    foreColor: 'rgba(255,255,255,0.75)'
  },
  theme: { mode: 'dark' },
  stroke: {
    curve: 'smooth',
    width: [2, 3, 2],
    dashArray: [8, 0, 6]
  },
  colors: ['#999999', '#26c6da', 'rgba(153,153,153,0.4)'],
  grid: {
    borderColor: 'rgba(255,255,255,0.08)',
    strokeDashArray: 4,
    padding: { left: 8, right: 8, top: 8, bottom: 8 }
  },
  xaxis: {
    type: 'numeric',
    title: {
      text: 'Cyclusdag',
      style: { color: 'rgba(255,255,255,0.7)' }
    },
    labels: {
      style: { colors: 'rgba(255,255,255,0.55)' }
    },
    tickAmount: 10,
    min: 1
  },
  yaxis: {
    title: {
      text: selectedMetric.value === 'hrv' ? 'HRV' : 'RHR',
      style: { color: 'rgba(255,255,255,0.7)' }
    },
    labels: { style: { colors: 'rgba(255,255,255,0.55)' } }
  },
  tooltip: {
    theme: 'dark',
    x: {
      formatter: (val) => `Dag ${val}`
    }
  },
  legend: {
    labels: { colors: 'rgba(255,255,255,0.8)' }
  }
}))
</script>

<style scoped>
.cycle-comparison-card {
  background: transparent;
}

.header .card-label {
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.metric-toggle :deep(.q-btn) {
  font-size: 0.75rem;
}

.apex-wrap {
  min-height: 260px;
}
</style>

