'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateFilter from '@/components/layout/DateFilter'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
} from 'chart.js'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement
)

interface KPIProps {
  label: string
  value: number | string
  icon: string
  color: string
  onClick?: () => void
}

function KPICard({ label, value, icon, color, onClick }: KPIProps) {
  return (
    <div
      onClick={onClick}
      className={
        'card p-5 flex items-center gap-4 transition-all duration-200 ' +
        (onClick
          ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-blue-400/40'
          : '')
      }
    >
      <div
        className={
          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl ' +
          color
        }
      >
        {icon}
      </div>

      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {value}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>

      {onClick && (
        <div className="ml-auto text-slate-300 dark:text-slate-600 text-lg">
          ›
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  // Date range state — defaults to current month
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats', dateRange],
    queryFn: () => getDashboardStats({
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    }).then((r) => r.data),
    refetchInterval: 60000,
    retry: 2,
    retryDelay: 2000,
  })

  const kpis = data?.kpis || {}

  const basePath = '/dashboard/my-tasks'

  // Build trend data based on date range or last 7 days
  const trendDays = dateRange.startDate && dateRange.endDate
    ? eachDayOfInterval({ start: parseISO(dateRange.startDate), end: parseISO(dateRange.endDate) }).map(d => format(d, 'yyyy-MM-dd'))
    : Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))

  const trendMap = Object.fromEntries(
    (data?.completionTrend || []).map((d: any) => [d._id, d.count])
  )

  const trendData = {
    labels: trendDays.map((d) => format(new Date(d), 'MMM dd')),
    datasets: [
      {
        label: 'Completed',
        data: trendDays.map((d) => trendMap[d] || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const pieLabels = [
    'Done',
    'In Progress',
    'Pending',
    'Need Discussion',
    'Delayed',
  ]

  const pieColors = [
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#8b5cf6',
    '#ef4444',
  ]

  const statusMap = Object.fromEntries(
    (data?.statusStats || []).map((s: any) => [s._id, s.count])
  )

  const statusData = {
    labels: pieLabels,
    datasets: [
      {
        data: pieLabels.map((l) => statusMap[l] || 0),
        backgroundColor: pieColors,
        borderWidth: 2,
      },
    ],
  }

  const pieRouteMap: Record<string, string> = {
    Done: 'status=Done',
    'In Progress': 'status=In+Progress',
    Pending: 'status=Pending',
    'Need Discussion': 'status=Need+Discussion',
    Delayed: 'status=Delayed',
  }

  const handlePieClick = (_evt: any, elements: any[]) => {
    if (elements.length > 0) {
      const param = pieRouteMap[pieLabels[elements[0].index]]
      if (param) router.push(basePath + '?' + param)
    }
  }

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
    onClick: handlePieClick,
  }

  const categoryData = {
    labels: (data?.categoryStats || []).map((c: any) => c._id),
    datasets: [
      {
        label: 'Tasks',
        data: (data?.categoryStats || []).map((c: any) => c.count),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
      },
    ],
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (isError) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
          <p>Could not load dashboard data.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">

        {/* Date Filter */}
        <div className="card p-4">
          <DateFilter onChange={setDateRange} defaultMode="month" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard label="Open Tasks" value={kpis.open || 0} icon="📂" color="bg-blue-50 dark:bg-blue-900/20" onClick={() => router.push(basePath)} />
          <KPICard label="In Progress" value={kpis.inProgress || 0} icon="🔄" color="bg-indigo-50 dark:bg-indigo-900/20" onClick={() => router.push(basePath + '?status=In+Progress')} />
          <KPICard label="Need Discussion" value={kpis.needDiscussion || 0} icon="💬" color="bg-purple-50 dark:bg-purple-900/20" onClick={() => router.push(basePath + '?status=Need+Discussion')} />
          <KPICard label="Completed" value={kpis.completed || 0} icon="✅" color="bg-green-50 dark:bg-green-900/20" onClick={() => router.push(basePath + '?status=Done')} />
          <KPICard label="Overdue" value={kpis.overdue || 0} icon="⚠️" color="bg-red-50 dark:bg-red-900/20" onClick={() => router.push(basePath + '?filter=overdue')} />
          <KPICard label="Productivity" value={`${kpis.productivity || 0}%`} icon="📊" color="bg-emerald-50 dark:bg-emerald-900/20" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold mb-4">
              Task Completion Trend
            </h3>

            <Line
              data={trendData}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                  },
                },
              }}
            />
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-4">
              Status Distribution
            </h3>

            <Doughnut data={statusData} options={pieOptions} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-semibold mb-4">
              Tasks by Category
            </h3>

            <Bar
              data={categoryData}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                  },
                },
              }}
            />
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-4">
              Team Productivity
            </h3>

            {data?.userProductivity?.length > 0 ? (
              <div className="space-y-3">
                {data.userProductivity.map((u: any) => (
                  <div key={u._id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{u.name}</span>
                      <span>
                        {u.done}/{u.total} ({Math.round(u.productivity)}%)
                      </span>
                    </div>

                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(u.productivity, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-slate-400">
                No productivity data yet
              </p>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
