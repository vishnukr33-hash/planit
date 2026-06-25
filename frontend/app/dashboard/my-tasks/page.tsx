'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTasks, exportTasks } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TaskTable from '@/components/tasks/TaskTable'
import TaskModal from '@/components/tasks/TaskModal'
import DateFilter from '@/components/layout/DateFilter'
import { STATUSES, CATEGORIES, PRIORITIES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

export default function MyTasksPage() {
  const { user } = useAuthStore()
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [viewTaskId, setViewTaskId] = useState<string | null>(searchParams.get('taskId'))

  // Date range state
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' })

  // Pre-apply filters from dashboard KPI navigation
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    category: '',
    priority: '',
    search: '',
    filter: searchParams.get('filter') || '', // 'overdue'
  })

  // Sync if URL params change (e.g. back-navigation)
  useEffect(() => {
    setFilters(f => ({
      ...f,
      status: searchParams.get('status') || '',
      filter: searchParams.get('filter') || '',
    }))
  }, [searchParams])

  const queryParams: Record<string, any> = {
    assignedTo: user?._id,
    isTeamTask: false,
    ...Object.fromEntries(Object.entries({ status: filters.status, category: filters.category, priority: filters.priority, search: filters.search }).filter(([, v]) => v))
  }
  if (filters.filter === 'overdue') {
    queryParams.filter = 'overdue'
  }
  // Only apply date filter if no status/overdue filter from navigation
  if (!filters.status && !filters.filter) {
    if (dateRange.startDate) queryParams.startDate = dateRange.startDate
    if (dateRange.endDate) queryParams.endDate = dateRange.endDate
  }

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'my', filters, dateRange],
    queryFn: () => getTasks(queryParams).then(r => r.data),
  })

  const activeFilterLabel = filters.filter === 'overdue'
    ? 'Overdue Tasks'
    : filters.status
    ? `Status: ${filters.status}`
    : null

  const handleExport = async () => {
    try {
      const params: any = { isTeamTask: false }
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate
      const response = await exportTasks(params)
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-tasks-${dateRange.startDate || 'all'}-to-${dateRange.endDate || 'all'}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <DashboardLayout title="My Tasks">
      <div className="space-y-4">
        {/* Date Filter */}
        <div className="card p-4">
          <DateFilter onChange={setDateRange} defaultMode="month" />
        </div>

        {/* Active filter banner */}
        {activeFilterLabel && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span>🔎 Filtered by: <strong>{activeFilterLabel}</strong></span>
            <button
              onClick={() => setFilters(f => ({ ...f, status: '', filter: '' }))}
              className="ml-auto text-blue-400 hover:text-blue-600 font-bold"
            >✕ Clear</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <input className="input max-w-xs text-sm" placeholder="🔍 Search tasks..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          <select className="input max-w-[140px] text-sm" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, filter: '' }))}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input max-w-[140px] text-sm" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input max-w-[130px] text-sm" value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
            <option value="">All Priority</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          {/* Clear Filters */}
          {(filters.status || filters.category || filters.priority || filters.search || filters.filter) && (
            <button
              onClick={() => setFilters({ status: '', category: '', priority: '', search: '', filter: '' })}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              ✕ Clear Filters
            </button>
          )}
          <div className="flex-1" />
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            📥 Export Excel
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <span>+</span> Add Task
          </button>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold">My Tasks</h2>
            <span className="text-sm text-slate-500">{data?.total || 0} tasks</span>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <TaskTable tasks={data?.tasks || []} />
          )}
        </div>
      </div>

      {showModal && <TaskModal onClose={() => setShowModal(false)} />}
    </DashboardLayout>
  )
}
