import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Label
} from 'recharts'
import type { ChartDataPoint, Platform } from '@shared/types'
import { useState } from 'react'
import { useThemeStore } from '../../stores/useThemeStore'

// Palette cycles for up to 6 platforms
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface SalesChartProps {
  data: ChartDataPoint[]
  platforms: Platform[]
  mode?: 'revenue' | 'sales' // revenue = 總收益(NTD); sales = 銷售量(件)
  /** ISO range — used to render the time axis even when there is no data. */
  rangeStart?: string
  rangeEnd?: string
}

export function SalesChart({ data, platforms, mode = 'revenue', rangeStart, rangeEnd }: SalesChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const dark = useThemeStore((s) => s.theme === 'dark')

  // Theme-aware chart colours (Recharts renders SVG, so it can't use CSS classes).
  const gridStroke = dark ? '#374151' : '#f0f0f0'
  const axisTick = { fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }
  const labelFill = dark ? '#9ca3af' : '#9ca3af'
  const tooltipStyle = dark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }
    : undefined

  const prefix = mode === 'revenue' ? 'earnings_' : 'sales_'
  const isEmpty = data.length === 0

  // Which platform series actually appear in the data.
  const activeKeys = platforms
    .map((p) => ({ key: `${prefix}${p.PlatformName}`, label: p.PlatformName }))
    .filter(({ key }) => data.some((d) => key in d))

  // When empty, scaffold the time axis from the selected range so the chart still
  // renders with a time X-axis and an NTD Y-axis (per requirement #10).
  const slice = (iso?: string) => (iso ? iso.slice(0, 10) : undefined)
  const chartData: ChartDataPoint[] = isEmpty
    ? [{ date: slice(rangeStart) ?? '—' }, { date: slice(rangeEnd) ?? new Date().toISOString().slice(0, 10) }]
    : data

  const yLabel = mode === 'revenue' ? 'NTD' : '件數'
  const yFormatter = (v: number) =>
    mode === 'revenue' ? `NT$${(v / 1000).toFixed(0)}k` : `${v}`

  const tooltipFormatter = (value: number, name: string) => {
    const label = name.replace('earnings_', '').replace('sales_', '')
    return [mode === 'revenue' ? `NT$ ${value.toLocaleString()}` : `${value} 件`, label]
  }

  const ChartComponent = chartType === 'line' ? LineChart : BarChart

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">
          {mode === 'revenue' ? '總收益趨勢 (NTD)' : '銷售量趨勢 (件)'}
        </p>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(['line', 'bar'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                chartType === t ? 'bg-white shadow text-indigo-600' : 'text-gray-500'
              }`}
            >
              {t === 'line' ? '折線圖' : '長條圖'}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="date" tick={axisTick} stroke={gridStroke}>
            <Label value="時間" position="insideBottom" offset={-2} style={{ fontSize: 11, fill: labelFill }} />
          </XAxis>
          <YAxis tickFormatter={yFormatter} tick={axisTick} width={60} stroke={gridStroke}>
            <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 11, fill: labelFill }} />
          </YAxis>
          <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
          <Legend />
          {activeKeys.map(({ key, label }, i) =>
            chartType === 'line' ? (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ) : (
              <Bar key={key} dataKey={key} name={label} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>

      {isEmpty && (
        <p className="text-center text-xs text-gray-400 mt-2">此時段內尚無銷售紀錄</p>
      )}
    </div>
  )
}
