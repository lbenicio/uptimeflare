import { Line } from 'react-chartjs-2'
import {
  CategoryScale,
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
} from 'chart.js'
import 'chartjs-adapter-moment'
import { MonitorState, MonitorTarget } from '@/types/config'
import { iataToCountry } from '@/util/iata'
import classes from '@/styles/DetailChart.module.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  TimeScale
)

export default function DetailChart({
  monitor,
  state,
}: {
  monitor: MonitorTarget
  state: MonitorState
}) {
  const latencyData = state.latency[monitor.id].recent.map((point) => ({
    x: point.time * 1000,
    y: point.ping,
    loc: point.loc,
  }))
  const theme =
    typeof document === 'undefined' ? undefined : getComputedStyle(document.documentElement)
  const gridColor = theme?.getPropertyValue('--chart-grid').trim() || '#edf0f5'
  const labelColor = theme?.getPropertyValue('--status-neutral').trim() || '#8390a1'

  const data = {
    datasets: [
      {
        data: latencyData,
        borderColor: '#6286c6',
        borderWidth: 2,
        radius: 0,
        cubicInterpolationMode: 'monotone' as const,
        tension: 0.32,
        fill: false,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    animation: {
      duration: 0,
    },
    plugins: {
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (item: any) => {
            if (item.parsed.y !== null && item.parsed.y !== undefined) {
              return `${item.parsed.y}ms (${iataToCountry(item.raw.loc)})`
            }
            return ''
          },
        },
      },
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    font: {
      family: 'Inter, ui-sans-serif, system-ui, sans-serif',
      size: 10,
    },
    scales: {
      x: {
        type: 'time' as const,
        grid: { display: false },
        ticks: {
          source: 'auto' as const,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 5,
          color: labelColor,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          maxTicksLimit: 4,
          color: labelColor,
          callback: (value: string | number) => `${value}ms`,
        },
      },
    },
  }

  return (
    <div className={classes.chart}>
      <div className={classes.chartHeading}>
        <span>Response time</span>
        <span>Recent 12 hours</span>
      </div>
      <div className={classes.plot}>
        {latencyData.length > 0 ? (
          <Line options={options} data={data} />
        ) : (
          <div className={classes.noData}>No response time data available.</div>
        )}
      </div>
    </div>
  )
}
