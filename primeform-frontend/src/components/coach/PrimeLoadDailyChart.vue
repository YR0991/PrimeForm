<template>
  <div class="prime-load-chart">
    <VueApexCharts
      type="bar"
      height="180"
      :options="chartOptions"
      :series="series"
      class="apex-wrap"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  activities: {
    type: Array,
    default: () => [],
  },
  days: {
    type: Number,
    default: 14,
  },
})

const emit = defineEmits(['day-click'])

function normalizeDate(val) {
  if (!val) return null
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val
  }
  if (typeof val?.toDate === 'function') {
    const d = val.toDate()
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof val === 'object') {
    const s = val._seconds ?? val.seconds
    if (Number.isFinite(Number(s))) {
      const d = new Date(Number(s) * 1000)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const buckets = computed(() => {
  const today = new Date()
  const map = new Map()

  const normalized = (Array.isArray(props.activities) ? props.activities : []).map((act) => {
    const rawDate = act.start_date ?? act.startDate ?? act.date ?? act.start_date_local
    const d = normalizeDate(rawDate)
    if (!d) return null
    const dateKey = d.toISOString().slice(0, 10)
    const loadRaw = act.loadUsed ?? act.load ?? null
    const loadNum = loadRaw != null && Number.isFinite(Number(loadRaw)) ? Number(loadRaw) : null
    return {
      ...act,
      _date: d,
      _dateKey: dateKey,
      _loadUsed: loadNum,
    }
  }).filter(Boolean)

  // Limit to last `days` calendar days
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - (props.days - 1))
  const cutoffKey = cutoff.toISOString().slice(0, 10)

  for (const act of normalized) {
    if (!act._dateKey || act._dateKey < cutoffKey) continue
    const key = act._dateKey
    if (!map.has(key)) {
      map.set(key, { dateKey: key, totalLoad: 0, activities: [] })
    }
    const bucket = map.get(key)
    if (act._loadUsed != null) {
      bucket.totalLoad += act._loadUsed
    }
    bucket.activities.push(act)
  }

  const out = []
  for (let i = props.days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
    const bucket = map.get(key) || { dateKey: key, totalLoad: 0, activities: [] }
    out.push({
      dateKey: key,
      label,
      totalLoad: Math.round((bucket.totalLoad + Number.EPSILON) * 10) / 10,
      activities: bucket.activities,
    })
  }

  return out
})

const series = computed(() => [
  {
    name: 'PrimeLoad',
    data: buckets.value.map((b) => b.totalLoad),
  },
])

const chartOptions = computed(() => ({
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: false },
    foreColor: 'rgba(255,255,255,0.75)',
    zoom: { enabled: false },
    events: {
      dataPointSelection: (_event, _chartContext, config) => {
        const idx = config?.dataPointIndex ?? -1
        if (idx < 0 || idx >= buckets.value.length) return
        const bucket = buckets.value[idx]
        if (!bucket) return
        const sortedActs = [...bucket.activities].sort((a, b) => {
          const la = a._loadUsed ?? 0
          const lb = b._loadUsed ?? 0
          return lb - la
        })
        emit('day-click', bucket.dateKey, sortedActs, bucket.totalLoad)
      },
    },
  },
  theme: { mode: 'dark' },
  plotOptions: {
    bar: {
      columnWidth: '55%',
      borderRadius: 2,
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(255,255,255,0.08)',
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
  },
  xaxis: {
    categories: buckets.value.map((b) => b.label),
    labels: {
      style: { colors: 'rgba(255,255,255,0.55)', fontSize: '10px' },
    },
    axisBorder: { color: 'rgba(255,255,255,0.08)' },
    axisTicks: { color: 'rgba(255,255,255,0.08)' },
  },
  yaxis: {
    labels: {
      style: { colors: 'rgba(255,255,255,0.55)', fontSize: '10px' },
    },
    min: 0,
    forceNiceScale: true,
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (val) => `${val} PL`,
    },
  },
}))
</script>

<style scoped lang="scss">
.prime-load-chart {
  width: 100%;
}

.apex-wrap :deep(.apexcharts-canvas) {
  border-radius: 2px;
}
</style>

